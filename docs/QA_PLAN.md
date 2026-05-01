# SimTool QA Plan

End-to-end functional QA: prove every config simtool generates *actually
works* on the hardware. Given a callbox IP (eNB/MME/IMS) + UE-sim IP,
run a catalog of test cases, capture evidence, classify pass/fail.

**Status**: Phase 0 design — API contract + catalog skeleton.
**Owner**: simtool team.

## Goals

- Functional coverage of every Amarisoft config simtool generates:
  every band, BW, duplex mode, antenna count, feature combo we support.
- Reproducible: each case has a stable ID and a fixed parameter set.
- Captures full evidence (cfg files, deploy logs, ots.log, screen
  hardcopy, attach timeline, data-plane sanity) into one bundle per
  case run, so failures are debuggable without re-running.
- Driven from the simtool UI — no external test harness needed.
- Single REST surface (`/api/qa/*`) so UI never reaches into
  `/api/systems/*` for QA work.

## Non-goals (v1)

- Performance / load characterization (separate effort).
- RF channel-impairment scenarios (channel sim is its own feature).
- Cross-vendor interop (Amarisoft only).
- Long-soak runs (catalog cases are minutes, not hours).

## Test case identity

Format: `<rat>-<band>-<bw>-<duplex>-<features>`

Examples:
```
lte-b7-20mhz-fdd-mimo2
lte-b41-20mhz-tdd-mimo4
lte-b5-1.4mhz-fdd-catm1-cea
nr-n78-100mhz-tdd-sa-mimo4
nr-n41-40mhz-tdd-sa-mimo2
nbiot-b5-200khz-fdd-standalone
nsa-b7-anchor-n78-secondary-mimo2
```

A case ID maps to one `TestCase` record:

```ts
interface TestCase {
  id: string;
  rat: 'lte' | 'nr' | 'nbiot' | 'catm' | 'nsa';
  band: number;          // primary band (or anchor for NSA)
  bandwidthMhz: number;
  duplex: 'fdd' | 'tdd';
  nAntennaDl: 1 | 2 | 4;
  nAntennaUl: 1 | 2 | 4;
  // RAT-specific extras
  tddConfig?: number;        // 0..6, TDD only
  tddSpecial?: number;       // 0..9, TDD only
  scsKhz?: 15 | 30 | 60 | 120;  // NR
  nbIotMode?: 'standalone' | 'inband' | 'guardband';  // NB-IoT
  catMCeMode?: 'A' | 'B';    // CAT-M
  nsaSecondary?: { band: number; bandwidthMhz: number; scsKhz: number };
  // Test expectations
  expectAttachWithinSec: number;  // default 30
  expectDataPlane: boolean;       // ping the GW after attach
}
```

Catalog is programmatic (`src/modules/qa/catalog.ts`) — generated from
the parameter matrix, not hand-curated. UI reads via `GET /api/qa/catalog`.

## Per-case execution recipe

```
A. Pre-flight
   1. ping callbox + uesim
   2. ssh-test both
   3. dpkg-lock-wait (kill stuck unattended-upgrades — already handled)
   4. verify Amarisoft prereqs (libsctp1 etc — already handled)

B. Generate
   5. enb.cfg from TestCase params
   6. ue.cfg from TestCase params
   7. sanitize both

C. Validate-only (dry-run, no live deploy)
   8. lteenb dry-run on callbox
   9. lteue dry-run on uesim
   GATE: parse error → FAIL fast, skip to G

D. Deploy live
   10. SCP enb.cfg → /root/enb/config/enb.cfg, restart `lte` service
   11. wait for :9001 (30s timeout)
   12. SCP ue.cfg  → /root/ue/config/ue.cfg, restart `lteue`
   13. wait for :9002

E. Attach + verify
   14. lteenb /api/version + /api/cells (sanity)
   15. lteue  /api/ue_get — wait state=connected
   16. snapshot { imsi, rsrp, pci, earfcn, attachMs }
   17. (optional) data-plane: lteue /api/ping <gtp_addr>

F. Teardown
   18. stop lteue, stop lte (idempotent)
   19. restore previous live cfgs from backup taken in D

G. Evidence capture
   20. screen -X hardcopy on the lte session
   21. tail /var/log/lte/ots.log
   22. persist evidence bundle
```

Every step is exactly one call into existing `/api/systems/*`. No new
SSH glue in the orchestrator.

## REST API — `/api/qa/*`

```
GET    /api/qa/catalog
GET    /api/qa/catalog/:caseId

POST   /api/qa/runs
       body: { caseIds, systems: { callbox, uesim }, options }
       → { runId, queueLength }

GET    /api/qa/runs                  # all runs (summary)
GET    /api/qa/runs/:runId           # one run with case-level status

GET    /api/qa/runs/:runId/cases/:caseId/evidence

POST   /api/qa/runs/:runId/cancel
```

## Data shape

Filesystem persistence at `data/qa/runs/<runId>.json`:

```ts
interface Run {
  id: string;                    // <ts>-<short-uuid>
  status: 'queued'|'running'|'passed'|'failed'|'mixed'|'cancelled';
  startedAt: string;
  finishedAt?: string;
  systems: { callbox: number; uesim: number };  // System IDs
  options: { stopOnFail: boolean; timeoutSec: number };
  cases: Array<{
    caseId: string;
    status: 'pending'|'running'|'passed'|'failed'|'skipped';
    failedPhase?: 'preflight'|'generate'|'validate'|'deploy'|'attach'|'data-plane';
    durationMs?: number;
    steps: Array<{ name: string; ok: boolean; detail?: string; ms?: number }>;
    evidence?: {
      generatedCfgs: { enb: string; ue: string };  // file paths
      attachSnapshot?: { imsi: string; rsrp: number; pci: number; earfcn: number; attachMs: number };
      dataPlane?: { sent: number; received: number; rttMs?: number };
    };
  }>;
}
```

Evidence bundle (logs, hardcopy, ots.log) lives at
`data/qa/runs/<runId>/<caseId>/{enb.cfg, ue.cfg, deploy.log, screen.log, ots.log, ...}`.

## Scheduling

Single in-memory queue, one case in flight at a time. The same callbox
+ UE-sim pair can't safely run two deploys simultaneously — they'd
fight over `enb.cfg`, the `lte` systemd unit, port 9001, etc. Future:
multi-pair parallel via systems-list "in-use" flag.

## Phased delivery

| Phase | Deliverable |
|-------|-------------|
| 0 | `docs/QA_PLAN.md`, `/api/qa/*` route stubs, types, catalog skeleton (this doc) |
| 1 | Single-case runner end-to-end against real callbox + uesim |
| 2 | Catalog seeded with 30+ cases (LTE FDD/TDD bands × BW + NR n78 + NB-IoT) |
| 3 | UE-side per-system tabs: Configs / Execute / Stats / Logs |
| 4 | Batch UI: pick N cases, kick off, live progress grid |
| 5 | Result dashboard, regression baseline ("compare to last green") |
| 6 | UI authoring of custom TestCases |

## Per-system tabs (UE Sim)

When clicking into a UE-sim system, four tabs (mirror for callbox):

- **Configs** — list of `ue.cfg` files, Save / Validate / Deploy buttons
- **Execute** — pick a TestCase from catalog, run it from this UE → that callbox
- **Stats** — live `/api/ue_get` from the agent: state, IMSI, RSRP, throughput, attach timeline
- **Logs** — streaming tail of `/tmp/ue0.log` + screen buffer (uses the agent we already provision on :9050)

## Open items (post-v1)

- Multi-pair parallel scheduling (currently single-runner)
- Long-soak / stability runs
- Channel impairment (fading, AWGN) sweeps
- Cross-vendor UE interop
- Performance baselines (PRB usage, throughput vs theoretical)
