import { NextApiRequest, NextApiResponse } from 'next';
import { NodeSSH } from 'node-ssh';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { createWriteStream } from 'fs';

const AGENT_PORT = parseInt(process.env.AGENT_PORT || '9050', 10);
const REMOTE_BASE = process.env.REMOTE_BASE || 'simtool/version_1';
const REMOTE_FILE = 'server.js';

// Where the bundled agent lives on this (Next.js) host
const AGENT_BUNDLE_PATH =
    process.env.AGENT_BUNDLE_PATH ||
    path.join(process.cwd(), 'agent', 'dist', 'server.js');

// Node version we ship as the bundled fallback. Stays current LTS; the
// agent is esbuild-targeted at node18, so anything ≥ v20 is safe.
const BUNDLED_NODE_VERSION = process.env.BUNDLED_NODE_VERSION || 'v20.18.1';
const RUNTIME_CACHE_DIR =
    process.env.AGENT_RUNTIME_CACHE ||
    path.join(process.cwd(), 'agent', 'runtime');

// Amarisoft runtime prerequisites. The vendor's install.sh tries to
// apt-get these itself but fails on isolated boxes (no DNS / no apt
// mirrors). We check + install them during provisioning so the user
// can run lteenb / ltemme / lteue right after Amarisoft install.
//
// libsctp1 is the chronic offender — without it `./ltemme` aborts with
//   "error while loading shared libraries: libsctp.so.1"
// and there's no clear path forward without it. The other entries are
// less critical but used by various ots / watchdog scripts shipped in
// the Amarisoft package (screen for the watchdog session, net-tools
// for ifconfig in launch scripts, libusb for license dongles).
//
// Each entry is the binary package name as used by `dpkg -l`. For
// offline-target fallback we keep a per-codename URL map below so the
// simtool host can fetch the .deb from archive.ubuntu.com once and
// SCP it to every target needing it.
const AMARISOFT_PREREQS = ['libsctp1', 'net-tools', 'screen', 'libusb-1.0-0'] as const;
type Prereq = typeof AMARISOFT_PREREQS[number];

// Direct .deb URLs on archive.ubuntu.com keyed by Ubuntu codename + arch.
// Only entries needed for the bundled-fallback path; populated lazily
// when a real isolated target asks. Versions chosen to match each
// codename's main archive at the time of writing — `dpkg -i` will
// happily upgrade a system to a slightly newer build, but downgrading
// across major release lines breaks libc deps, hence the per-codename
// table.
const PREREQ_URLS: Record<string, Partial<Record<Prereq, string>>> = {
    'noble-amd64': {
        libsctp1: 'http://archive.ubuntu.com/ubuntu/pool/main/l/lksctp-tools/libsctp1_1.0.19+dfsg-2build1_amd64.deb',
    },
    'jammy-amd64': {
        libsctp1: 'http://archive.ubuntu.com/ubuntu/pool/main/l/lksctp-tools/libsctp1_1.0.19+dfsg-1build1_amd64.deb',
    },
    'focal-amd64': {
        libsctp1: 'http://archive.ubuntu.com/ubuntu/pool/main/l/lksctp-tools/libsctp1_1.0.18+dfsg-1_amd64.deb',
    },
    'noble-arm64': {
        // Noble has no historical arm64 build for libsctp 1.0.19; the
        // 1.0.21+dfsg-1build1 build (Sept 2025) is forward-compatible.
        libsctp1: 'http://archive.ubuntu.com/ubuntu/pool/universe/l/lksctp-tools/libsctp1_1.0.21+dfsg-1build1_arm64.deb',
    },
};

/**
 * Fetch a .deb to `agent/runtime/debs/<codename-arch>-<pkg>.deb`,
 * caching after first hit. Same pattern as ensureBundledNode. Returns
 * the local cached path; throws if the URL isn't known for the given
 * codename/arch combo or the download fails.
 */
async function ensureBundledDeb(codename: string, arch: 'x64' | 'arm64', pkg: Prereq): Promise<string> {
    // x64 in our internal naming maps to amd64 in dpkg parlance.
    const dpkgArch = arch === 'x64' ? 'amd64' : 'arm64';
    const key = `${codename}-${dpkgArch}`;
    const url = PREREQ_URLS[key]?.[pkg];
    if (!url) {
        throw new Error(`No bundled .deb URL for ${pkg} on ${codename}/${dpkgArch}`);
    }
    const cacheDir = path.join(RUNTIME_CACHE_DIR, 'debs');
    const filename = `${codename}-${dpkgArch}-${pkg}.deb`;
    const cachePath = path.join(cacheDir, filename);
    try {
        const st = await fs.stat(cachePath);
        if (st.size > 1000) return cachePath;
    } catch { /* not cached */ }

    await fs.mkdir(cacheDir, { recursive: true });
    await new Promise<void>((resolve, reject) => {
        const out = createWriteStream(cachePath);
        const req = https.get(url.replace(/^http:/, 'https:'), (res) => {
            if ([301, 302, 307, 308].includes(res.statusCode || 0) && res.headers.location) {
                https.get(res.headers.location, (r2) => {
                    if (r2.statusCode !== 200) return reject(new Error(`download ${pkg}: HTTP ${r2.statusCode}`));
                    r2.pipe(out);
                    out.on('finish', () => out.close(() => resolve()));
                }).on('error', reject);
                return;
            }
            if (res.statusCode !== 200) {
                // Try plain HTTP — archive.ubuntu.com sometimes 404s on
                // https due to mirror rotations. Falls back to the
                // original URL one time.
                http.get(url, (r3) => {
                    if (r3.statusCode !== 200) return reject(new Error(`download ${pkg}: HTTP ${r3.statusCode}`));
                    r3.pipe(out);
                    out.on('finish', () => out.close(() => resolve()));
                }).on('error', reject);
                return;
            }
            res.pipe(out);
            out.on('finish', () => out.close(() => resolve()));
        });
        req.on('error', reject);
        req.setTimeout(30_000, () => req.destroy(new Error(`${pkg} download timeout`)));
    });
    return cachePath;
}

/**
 * Download (and cache) a portable Node binary tarball for the given arch.
 * Used when the target system has no apt sources / no internet — we ship
 * a self-contained node binary alongside the agent so provisioning works
 * on isolated callboxes where the only thing the user has done is enable
 * SSH.
 *
 * Cache key: node-<version>-linux-<arch>.tar.xz under agent/runtime/.
 * On cache hit returns immediately. On miss, downloads from nodejs.org
 * (the simtool host needs internet for the first deploy of each arch).
 */
async function ensureBundledNode(remoteArch: 'x64' | 'arm64'): Promise<string> {
    const filename = `node-${BUNDLED_NODE_VERSION}-linux-${remoteArch}.tar.xz`;
    const cachePath = path.join(RUNTIME_CACHE_DIR, filename);
    try {
        const st = await fs.stat(cachePath);
        // Sanity check: the tarball is ~25 MB. <1MB usually means the
        // previous download was interrupted; force re-fetch.
        if (st.size > 1_000_000) return cachePath;
    } catch { /* not cached */ }

    await fs.mkdir(RUNTIME_CACHE_DIR, { recursive: true });
    const url = `https://nodejs.org/dist/${BUNDLED_NODE_VERSION}/${filename}`;
    await new Promise<void>((resolve, reject) => {
        const out = createWriteStream(cachePath);
        const req = https.get(url, (res) => {
            // nodejs.org redirects (301 → 302 path possible). Follow once.
            if ([301, 302, 307, 308].includes(res.statusCode || 0) && res.headers.location) {
                https.get(res.headers.location, (r2) => {
                    if (r2.statusCode !== 200) return reject(new Error(`download ${filename}: HTTP ${r2.statusCode}`));
                    r2.pipe(out);
                    out.on('finish', () => out.close(() => resolve()));
                }).on('error', reject);
                return;
            }
            if (res.statusCode !== 200) return reject(new Error(`download ${filename}: HTTP ${res.statusCode}`));
            res.pipe(out);
            out.on('finish', () => out.close(() => resolve()));
        });
        req.on('error', reject);
        req.setTimeout(60_000, () => req.destroy(new Error('node download timeout')));
    });
    return cachePath;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { host, port = 22, username, password, privateKey, passphrase } = req.body ?? {};

    if (!host || !username) return res.status(400).json({ error: 'host and username are required' });
    if (!password && !privateKey) return res.status(400).json({ error: 'password or privateKey is required' });

    const steps: Array<{ name: string; ok: boolean; detail?: string }> = [];
    const ssh = new NodeSSH();

    try {
        // Verify local bundle exists first
        try {
            await fs.access(AGENT_BUNDLE_PATH);
        } catch {
            return res.status(500).json({
                success: false,
                error: `Agent bundle not found at ${AGENT_BUNDLE_PATH}. Run 'npm run build' in the agent/ directory.`,
            });
        }

        // Step 1: connect
        await ssh.connect({
            host: String(host),
            port: Number(port),
            username: String(username),
            ...(privateKey ? { privateKey: String(privateKey), passphrase } : { password: String(password) }),
            readyTimeout: 8000,
        });
        steps.push({ name: 'ssh-connect', ok: true });

        // Step 2: resolve remote home dir for the connected user
        const homeRes = await ssh.execCommand('printf %s "$HOME"');
        const remoteHome = homeRes.stdout.trim();
        if (!remoteHome || homeRes.code !== 0) {
            return res.status(200).json({ success: false, steps, error: 'Could not resolve $HOME on target' });
        }
        const remoteDir = path.posix.join(remoteHome, REMOTE_BASE);
        steps.push({ name: 'resolve-home', ok: true, detail: remoteDir });

        // Step 3: check node — auto-install if missing.
        //
        // Provisioning UX rule: the only thing the user does on the target
        // is enable SSH. simtool handles every other prerequisite. If
        // `node` isn't on PATH (or is too old), we attempt to install a
        // current LTS via the system's package manager using the SSH
        // password for sudo. The agent is bundled for node 18+, so we
        // require major ≥ 18 — older installs trigger a NodeSource
        // refresh, which is the canonical way to get a modern node on
        // older Debian / Ubuntu releases.
        const parseMajor = (verLine: string) => {
            const m = verLine.match(/v(\d+)\./);
            return m ? parseInt(m[1], 10) : 0;
        };
        const checkNode = async () => {
            const r = await ssh.execCommand('command -v node && node --version');
            return { code: r.code, version: r.stdout.trim(), major: parseMajor(r.stdout.trim()) };
        };

        // Path the start-agent step will use to run the bundled JS. Stays
        // 'node' when the target has node ≥ 18 in PATH; flips to an
        // absolute path inside remoteDir when we ship a portable binary.
        let nodeRunner = 'node';

        let nodeState = await checkNode();
        const nodePresent = nodeState.code === 0 && nodeState.major >= 18;
        if (nodePresent) {
            steps.push({ name: 'node-check', ok: true, detail: nodeState.version });
        } else {
            // Record what we found so the failure trail is auditable.
            steps.push({
                name: 'node-check',
                ok: false,
                detail: nodeState.code === 0
                    ? `node ${nodeState.version} too old (need ≥ v18) — auto-installing`
                    : 'node not found on target — auto-installing',
            });

            // Auto-install requires the user's password for sudo. With a
            // private-key login we have no password to pipe to sudo -S, so
            // we can only proceed if passwordless sudo is configured. We
            // try that path; if it fails, the user has to either provide
            // a password or pre-install node themselves.
            const pw = password ? String(password) : '';
            const sudo = pw
                ? `echo '${pw.replace(/'/g, "'\\''")}' | sudo -S -p ''`
                : 'sudo -n';

            // Connectivity probe — quick check whether the target has
            // outbound internet. If not, skip apt/NodeSource (they need
            // mirrors) and go straight to the bundled-binary fallback.
            // 3-second cap so an offline target doesn't drag the whole
            // deploy out.
            const onlineCheck = await ssh.execCommand(
                `curl -fsS --max-time 3 -o /dev/null -w '%{http_code}' https://nodejs.org/ 2>/dev/null || echo offline`,
            );
            const targetOnline = /^(2|3)\d\d$/.test(onlineCheck.stdout.trim());
            const aptOk = (await ssh.execCommand('command -v apt-get')).code === 0;

            if (targetOnline && aptOk) {
                // Wait for any in-progress apt run (unattended-upgrades
                // is the usual suspect) so we don't immediately bounce
                // off the dpkg-frontend lock. Bounded — if something's
                // truly stuck we fall through to the bundled path
                // instead of hanging.
                const lockWait = await ssh.execCommand(
                    `for i in $(seq 1 60); do ` +
                    `  ${sudo} fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || ` +
                    `  ${sudo} fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || break; ` +
                    `  sleep 2; ` +
                    `done; ` +
                    `${sudo} fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 && exit 1; exit 0`,
                    { execOptions: { pty: false } },
                );
                steps.push({
                    name: 'apt-lock-wait',
                    ok: lockWait.code === 0,
                    detail: lockWait.code === 0 ? 'lock free' : 'dpkg lock still held — falling back to bundled node',
                });

                if (lockWait.code === 0) {
                    // Phase A: try apt's nodejs. Ubuntu 24.04 ships
                    // node 20+; older releases ship stale node and we
                    // fall through to NodeSource.
                    const aptInstall = await ssh.execCommand(
                        `${sudo} apt-get update -qq -o Dpkg::Use-Pty=0 2>&1 && ` +
                        `DEBIAN_FRONTEND=noninteractive ${sudo} apt-get install -y -qq -o Dpkg::Use-Pty=0 nodejs 2>&1`,
                        { execOptions: { pty: false } },
                    );
                    steps.push({
                        name: 'apt-install-node',
                        ok: aptInstall.code === 0,
                        detail: aptInstall.code === 0 ? 'apt-get install nodejs OK'
                            : `apt failed: ${(aptInstall.stderr || aptInstall.stdout).slice(-200)}`,
                    });
                    nodeState = await checkNode();

                    // Phase B: if apt's node is too old, refresh via
                    // NodeSource. Canonical way to get current LTS on
                    // older Debian/Ubuntu.
                    if (nodeState.code !== 0 || nodeState.major < 18) {
                        const nsInstall = await ssh.execCommand(
                            `curl -fsSL https://deb.nodesource.com/setup_20.x | ${sudo} -E bash - 2>&1 && ` +
                            `DEBIAN_FRONTEND=noninteractive ${sudo} apt-get install -y -qq -o Dpkg::Use-Pty=0 nodejs 2>&1`,
                            { execOptions: { pty: false } },
                        );
                        steps.push({
                            name: 'nodesource-install',
                            ok: nsInstall.code === 0,
                            detail: nsInstall.code === 0 ? 'NodeSource nodejs 20.x'
                                : `NodeSource failed: ${(nsInstall.stderr || nsInstall.stdout).slice(-200)}`,
                        });
                        nodeState = await checkNode();
                    }
                }
            } else {
                steps.push({
                    name: 'connectivity-check',
                    ok: false,
                    detail: targetOnline
                        ? 'target online but no apt — using bundled node'
                        : 'target has no outbound internet — using bundled node',
                });
            }

            // Phase C: bundled-binary fallback. Always reachable —
            // independent of target's internet, sudo, or DNS. simtool
            // host downloads a portable node tarball (cached after first
            // hit), SCPs it, extracts just bin/node next to the agent,
            // then runs the agent with that absolute path.
            if (nodeState.code !== 0 || nodeState.major < 18) {
                const archRaw = (await ssh.execCommand('uname -m')).stdout.trim();
                const arch: 'x64' | 'arm64' | null =
                    archRaw === 'x86_64' ? 'x64' :
                    archRaw === 'aarch64' || archRaw === 'arm64' ? 'arm64' :
                    null;
                if (!arch) {
                    steps.push({ name: 'bundled-node', ok: false, detail: `unsupported arch: ${archRaw}` });
                    return res.status(200).json({
                        success: false,
                        steps,
                        error: `target arch "${archRaw}" not in {x86_64, aarch64} — bundled node not available`,
                    });
                }
                let localTarball: string;
                try {
                    localTarball = await ensureBundledNode(arch);
                } catch (e: any) {
                    steps.push({ name: 'bundled-node-cache', ok: false, detail: e?.message || 'download failed' });
                    return res.status(200).json({
                        success: false,
                        steps,
                        error: `Couldn't fetch bundled node ${BUNDLED_NODE_VERSION} for ${arch} on the simtool host: ${e?.message}`,
                    });
                }
                // SCP + extract on target. We strip components so that
                // bin/node lands at ${remoteDir}/node — easier than
                // dragging a whole node tree alongside the agent.
                await ssh.execCommand(`mkdir -p '${remoteDir}'`);
                const remoteTar = path.posix.join(remoteDir, 'node-runtime.tar.xz');
                await ssh.putFile(localTarball, remoteTar);
                const extractRes = await ssh.execCommand(
                    `tar -xJf '${remoteTar}' -C '${remoteDir}' --strip-components=2 ` +
                    `'node-${BUNDLED_NODE_VERSION}-linux-${arch}/bin/node' && ` +
                    `chmod +x '${remoteDir}/node' && rm -f '${remoteTar}' && ` +
                    `'${remoteDir}/node' --version`,
                );
                steps.push({
                    name: 'bundled-node',
                    ok: extractRes.code === 0,
                    detail: extractRes.code === 0
                        ? `${extractRes.stdout.trim()} extracted to ${remoteDir}/node`
                        : `extract failed: ${(extractRes.stderr || extractRes.stdout).slice(-200)}`,
                });
                if (extractRes.code !== 0) {
                    return res.status(200).json({
                        success: false,
                        steps,
                        error: `Couldn't extract bundled node on target — needs xz-utils (apt-get install -y xz-utils) or use a target with apt-get`,
                    });
                }
                nodeRunner = `${remoteDir}/node`;
                nodeState = { code: 0, version: extractRes.stdout.trim(), major: 20 };
            }

            if (nodeState.code !== 0 || nodeState.major < 18) {
                return res.status(200).json({
                    success: false,
                    steps,
                    error: 'all install paths exhausted; node still unavailable on target',
                });
            }
            steps.push({
                name: 'node-check',
                ok: true,
                detail: `${nodeState.version} (${nodeRunner === 'node' ? 'auto-installed' : 'bundled @ ' + nodeRunner})`,
            });
        }

        // Step 3.5: Amarisoft runtime prerequisites.
        //
        // Same UX rule as node: the user only enabled SSH, simtool
        // handles every other prerequisite. The vendor's install.sh
        // would normally apt-get its deps but fails on isolated boxes
        // (no DNS / no apt mirrors). We install them here during
        // provisioning so the user can run lteenb / ltemme / lteue
        // immediately after Amarisoft install — no missing
        // libsctp.so.1 surprises.
        //
        // Strategy mirrors node-check:
        //   • Quick check what's already installed (dpkg-query).
        //   • If apt is available + target is online → apt-get install
        //     the missing ones.
        //   • Otherwise → bundled-deb fallback. simtool host fetches
        //     the .deb from archive.ubuntu.com once per codename+arch
        //     (cached in agent/runtime/debs/), SCPs to target, dpkg-i.
        //   • Errors are non-fatal — if a single dep can't be installed
        //     we record it but continue. The user can fix it later;
        //     blocking the whole provisioning over an optional dep
        //     would be heavy-handed.
        try {
            // Detect Ubuntu codename for the bundled fallback URL map.
            const osRel = await ssh.execCommand('. /etc/os-release && echo "$VERSION_CODENAME"');
            const codename = osRel.stdout.trim();
            const archRaw2 = (await ssh.execCommand('uname -m')).stdout.trim();
            const arch2: 'x64' | 'arm64' | null =
                archRaw2 === 'x86_64' ? 'x64' :
                archRaw2 === 'aarch64' || archRaw2 === 'arm64' ? 'arm64' : null;

            // Which prereqs are missing?
            const checkRes = await ssh.execCommand(
                `for p in ${AMARISOFT_PREREQS.join(' ')}; do ` +
                `  dpkg-query -W -f='\${Status}' "$p" 2>/dev/null | grep -q 'install ok installed' || echo "$p"; ` +
                `done`,
            );
            const missing = checkRes.stdout.split(/\s+/).filter(Boolean) as Prereq[];
            if (missing.length === 0) {
                steps.push({ name: 'amarisoft-prereqs', ok: true, detail: 'all present' });
            } else {
                // Try apt path if target is online + apt available.
                const pwForSudo = password ? String(password) : '';
                const sudoP = pwForSudo
                    ? `echo '${pwForSudo.replace(/'/g, "'\\''")}' | sudo -S -p ''`
                    : 'sudo -n';
                const onlineProbe = await ssh.execCommand(
                    `curl -fsS --max-time 3 -o /dev/null -w '%{http_code}' http://archive.ubuntu.com/ 2>/dev/null || echo offline`,
                );
                const aptOnline = /^(2|3)\d\d$/.test(onlineProbe.stdout.trim());
                const aptOk2 = (await ssh.execCommand('command -v apt-get')).code === 0;

                let installedViaApt: Prereq[] = [];
                if (aptOnline && aptOk2) {
                    const aptInst = await ssh.execCommand(
                        `${sudoP} apt-get update -qq -o Dpkg::Use-Pty=0 2>&1 && ` +
                        `DEBIAN_FRONTEND=noninteractive ${sudoP} apt-get install -y -qq -o Dpkg::Use-Pty=0 ${missing.join(' ')} 2>&1`,
                        { execOptions: { pty: false } },
                    );
                    if (aptInst.code === 0) {
                        installedViaApt = missing;
                        steps.push({ name: 'apt-install-prereqs', ok: true, detail: `apt installed ${missing.join(', ')}` });
                    } else {
                        steps.push({
                            name: 'apt-install-prereqs',
                            ok: false,
                            detail: `apt failed, falling back to bundled .debs: ${(aptInst.stderr || aptInst.stdout).slice(-200)}`,
                        });
                    }
                }

                // Bundled-deb fallback for whatever apt didn't install.
                const stillMissing = missing.filter(p => !installedViaApt.includes(p));
                const bundledOk: string[] = [];
                const bundledFail: string[] = [];
                if (stillMissing.length > 0 && arch2 && codename) {
                    for (const pkg of stillMissing) {
                        try {
                            const debPath = await ensureBundledDeb(codename, arch2, pkg);
                            const remoteDebPath = `/tmp/simtool-${pkg}.deb`;
                            await ssh.putFile(debPath, remoteDebPath);
                            const dpkgRes = await ssh.execCommand(
                                `${sudoP} dpkg -i '${remoteDebPath}' 2>&1; rm -f '${remoteDebPath}'`,
                            );
                            if (dpkgRes.code === 0) bundledOk.push(pkg);
                            else bundledFail.push(`${pkg}: ${(dpkgRes.stderr || dpkgRes.stdout).slice(-100)}`);
                        } catch (e: any) {
                            bundledFail.push(`${pkg}: ${e?.message || 'unknown'}`);
                        }
                    }
                    if (bundledOk.length > 0 || bundledFail.length > 0) {
                        steps.push({
                            name: 'bundled-prereqs',
                            ok: bundledFail.length === 0,
                            detail: [
                                bundledOk.length > 0 ? `installed ${bundledOk.join(', ')}` : '',
                                bundledFail.length > 0 ? `couldn't install: ${bundledFail.join(' | ')}` : '',
                            ].filter(Boolean).join('; '),
                        });
                    }
                } else if (stillMissing.length > 0) {
                    steps.push({
                        name: 'bundled-prereqs',
                        ok: false,
                        detail: `target ${codename}/${archRaw2} not in bundled URL map; missing: ${stillMissing.join(', ')}`,
                    });
                }
            }
        } catch (e: any) {
            // Don't fail the whole deploy on a prereq install issue —
            // the agent can still come up. The user gets a clear note
            // in commandLog and can address the missing deps later.
            steps.push({
                name: 'amarisoft-prereqs',
                ok: false,
                detail: `prereq install errored: ${e?.message || 'unknown'}`,
            });
        }

        // Step 4: mkdir ~/simtool/version_1
        const mkdir = await ssh.execCommand(`mkdir -p '${remoteDir}'`);
        steps.push({ name: 'mkdir', ok: mkdir.code === 0, detail: mkdir.stderr || remoteDir });
        if (mkdir.code !== 0) return res.status(200).json({ success: false, steps });

        // Step 5: kill any previous agent on this port (ignore errors).
        // Match either PATH-installed `node` or our bundled-node path so
        // re-deploys cleanly replace older agents from either provisioning
        // mode.
        await ssh.execCommand(`(fuser -k ${AGENT_PORT}/tcp 2>/dev/null) || (pkill -f '${REMOTE_FILE}' 2>/dev/null) || true`);
        steps.push({ name: 'cleanup-old', ok: true });

        // Step 6: SCP the bundle
        const remotePath = path.posix.join(remoteDir, REMOTE_FILE);
        await ssh.putFile(AGENT_BUNDLE_PATH, remotePath);
        steps.push({ name: 'scp-bundle', ok: true, detail: remotePath });

        // Step 7: start detached. Use nodeRunner — either 'node' from
        // PATH (when system node was present or apt/NodeSource installed
        // it) or the absolute path to our bundled binary at
        // ${remoteDir}/node. Quote it because remoteDir can contain
        // spaces depending on $HOME.
        const startCmd = `nohup '${nodeRunner}' '${remotePath}' > '${remoteDir}/agent.log' 2>&1 & disown; sleep 1; pgrep -f '${REMOTE_FILE}' | head -1`;
        const startRes = await ssh.execCommand(`bash -lc "${startCmd.replace(/"/g, '\\"')}"`);
        const pid = startRes.stdout.trim();
        steps.push({ name: 'start-agent', ok: !!pid, detail: pid ? `pid=${pid} (${nodeRunner})` : startRes.stderr });
        if (!pid) return res.status(200).json({ success: false, steps });

        // Step 8: verify /api/health
        let healthy = false;
        let healthDetail = '';
        for (let i = 0; i < 6; i++) {
            await new Promise((r) => setTimeout(r, 800));
            try {
                const ac = new AbortController();
                const t = setTimeout(() => ac.abort(), 2000);
                const resp = await fetch(`http://${host}:${AGENT_PORT}/api/health`, { signal: ac.signal });
                clearTimeout(t);
                if (resp.ok) {
                    healthDetail = await resp.text();
                    healthy = true;
                    break;
                }
            } catch (e: any) {
                healthDetail = e?.message || 'fetch failed';
            }
        }
        steps.push({ name: 'verify-health', ok: healthy, detail: healthDetail });

        return res.status(200).json({ success: healthy, steps });
    } catch (error: any) {
        return res.status(200).json({ success: false, error: error?.message || 'deploy failed', steps });
    } finally {
        ssh.dispose();
    }
}
