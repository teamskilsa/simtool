# Capture — live test checklist

Run this when the callbox (192.168.1.80, CBX 2026-06-12, eNB API ws :9001,
MME :9000) is reachable again. Everything below was only tested offline
against `capture-mock-remote-api.ts` with the loopback transport, which does
not exercise SSH, real `trx_iq_dump` output, tcpdump or the lteenb console.

## 0. Preconditions

1. `ping 192.168.1.80` and `nc -z 192.168.1.80 9001 && nc -z 192.168.1.80 9000`.
2. In Test Systems the callbox has an SSH login. Note whether that user is
   root, and if not, whether `sudo -n true` works:
   `ssh <user>@192.168.1.80 'id -u; sudo -n true && echo SUDO_OK'`.
3. `ssh <user>@192.168.1.80 'df -Pk /tmp; mount | grep " /tmp "'` — record free
   space and whether /tmp is tmpfs (RAM). IQ dumps land there first.
4. The offline suites still pass on this host:
   `npx tsx scripts/qa/qa-capture-dsp.ts` and (dev server running)
   `npx tsx scripts/qa/qa-capture-api.ts`.
5. Mount the tab (main session) and open **Capture**.

## 1. Probe / RF ports

1. Pick the callbox, **IQ samples**, port 9001.
2. Expect one card per RF port. For each, compare against
   `ws.js 192.168.1.80:9001 '{"message":"config_get"}'`:
   - cells on that port, band, PCI, DL frequency;
   - RX/TX channel counts. With 12 SDR100 devices, check the counts match
     `rx_channels`/`tx_channels` and that channel indices do not overlap
     between ports.
   - Sample rate: record whether it says `(est.)`. `config_get.rf_ports[].sample_rate`
     is documented only with the channel simulator, so an estimate is expected;
     step 2 checks it against the real value.
3. Port 9002 (UE sim) if it runs — same check. Port 9000 should say "no RF ports".

## 2. IQ capture — small, RX only

1. One LTE port, RX only, **10 ms**, auto-fetch on. Start.
2. Job goes `capturing` → sizes listed (`On the box: … MiB`) → `fetching` → `done`.
3. Check the size: `sample_rate × 0.010 × 8 × RX channels` bytes per file.
   If the size is not a whole multiple of 8, or differs from the estimate by
   more than rounding, record the actual rate from `manifest.json` →
   `iq.remoteApi.response.rf_ports[].sample_rate` and fix `estimateSampleRate`.
4. On the box: `ls /tmp/simtool-iq-*` — nothing left. If files remain, the job
   shows "Could not delete on the box (permission?)": the SSH user is not root
   and has no passwordless sudo (lteenb writes them as root, /tmp is sticky).
5. `manifest.json`: `format`, `sampleRates`, `antennaCount`, `durationMs`,
   `cells`, per-file `centerFreqHz` = the port's UL frequency for RX.
6. **Channel mapping** — the docs don't say whether `%d` is the global channel
   index or the index within the dump. Record `rx_files` from the response.
   For port 0 both readings give the same numbers; repeat with a port > 0 in
   step 4 to tell them apart.
7. Inspect `iq-rx-0.bin`: timeline RMS should be low and flat with no UE
   (noise), spectrum centre marked at the UL carrier. With a UE attached
   and traffic running (Traffic tab, UL), PUSCH bursts should show in the
   timeline and inside the channel bandwidth in the spectrum.

## 3. IQ capture — TX and both

1. Same port, **TX only**, 10 ms. The spectrum should show the DL carrier
   occupying ~`n_rb_dl × 180 kHz` centred on 0 offset (DL frequency in
   absolute mode) — this is the best proof the I/Q order and sign are right:
   an asymmetric signal (e.g. PSS/SSB off-centre for NR) must appear on the
   same side as in the cell config.
2. RX+TX, 10 ms: four files for a 2x2 port.
3. Download one `.bin`, load it in numpy
   (`np.fromfile(f, '<f4').view(np.complex64)`) and compare the FFT peak.

## 4. Limits and safety

1. 2x2 30.72 Msps port, RX+TX: the duration max shown should be 4369 ms,
   and 5000 ms must be refused ("over the 4.00 GiB limit").
2. Pick a size between 1 and 4 GiB (e.g. RX only 2x2 30.72 Msps, 3000 ms ≈
   1.37 GiB): the job must stop at **waiting for fetch** with the sizes shown.
   Press **Discard** → files gone on the box. Repeat and press **Fetch**; watch
   the progress bar; time the transfer (expect roughly 100 MB/s on GbE).
3. While a dump or a waiting capture exists, starting another IQ capture on
   the same system must be refused.
4. Press **Stop** during a 5 s dump: the job says trx_iq_dump cannot be
   cancelled; when the dump returns it must discard the files (`stopped`).
5. /tmp space: if /tmp is tmpfs with less free than the estimate × 1.1, the
   start must be refused with the free size.
6. Multi-port: two ports RX, 10 ms — verify `rf_port` was sent as an array
   and files for both ports come back with the right frequencies (step 2.6).
7. A system with no SSH login must be refused before anything is sent to the box.

## 5. Protocol pcap

### tcpdump (S1AP/NGAP)
1. **Protocol pcap** → tcpdump, "S1AP / NGAP / X2AP / XnAP (SCTP)", `any`, 30 s.
2. During the capture, restart a UE attach (airplane mode) so S1AP flows.
3. Job ends `done`; open `capture.pcap` in Wireshark: S1AP InitialUEMessage /
   InitialContextSetup visible (SCTP on loopback or the S1 interface).
4. Stop after ~5 s on a second run: tcpdump must flush (file opens cleanly).
5. On the box `ls /tmp/simtool-pcap-*` → nothing.
6. If the SSH user is not root and has no passwordless sudo, the start must
   be refused with that message. If tcpdump is missing, the message says so.

### eNB MAC-LTE (console only)
1. **Protocol pcap** → eNB console pcap, 10 s → job shows the command
   `pcap -d 10000 -w /tmp/simtool-enbpcap-<id>.pcap`.
2. **Fetch** before running it → "run the console command first", job stays.
3. SSH to the box, `screen -x lte`, go to the ENB window, paste the command.
   Confirm the console accepts `-d` and `-w` on this version (2026-06-12
   box vs 2026-09-11 docs).
4. After 10 s press **Fetch** → `enb-mac-lte.pcap`. In Wireshark add DLT 147
   (User 0) → `mac-lte-framed`; MAC PDUs decode. Only LTE cells produce data.

## 6. Log capture

1. **Logs** → eNB/gNB, 9001, rrc=debug, s1ap=debug, 30 s. Note the current
   levels shown next to unselected layers.
2. During the capture attach a UE.
3. `capture.log` contains RRC and S1AP messages with timestamps; no PHY/MAC.
4. After the job: `config_get` → `logs.layers.rrc.level` is back to its
   previous value (job output says `Restored: …`).
5. Stop a 600 s capture after 10 s → `stopped`, levels restored.
6. MME: 9000, nas=debug, s1ap=debug → NAS attach messages in the log.
7. Heavy case: phy=debug for 60 s with traffic. Watch for
   `# discontinuity` lines (log buffer overflow) and the file size; the job
   stops itself at 512 MiB.
8. If `config_get` reports `logs.locked`, the job must warn and capture at
   the existing levels.
9. If the remote API asks for authentication (`com_auth` in enb.cfg), every
   capture fails with "requires authentication" — not supported yet.

## 7. Downloads

1. Download a >1 GiB `.bin` in the browser; watch SimTool's memory (the route
   streams with `createReadStream`; RSS should not grow by the file size).
2. `curl -r 0-99 -o part.bin 'http://localhost:3000/api/capture/download?id=<id>&file=iq-rx-0.bin'`
   → 100 bytes, HTTP 206.
3. Delete a capture from the table → folder gone from `data/captures/`.

## What to record

Real sample rate per port, `%d` semantics, SSH user/root/sudo, /tmp type and
size, fetch throughput, console `pcap` syntax on 2026-06-12, whether
`log_get` `layers` filtering matched the docs, and any job error text.

---

## Proposal: authenticated binary download on the SimTool agent (:9050)

Not implemented — the agent is out of scope. Today Capture uses SSH because
`GET /api/nodes/configs/enb/<file>?path=<dir>` returns content as a utf8
string, which corrupts binary data. A route that would let Capture work
without an SSH login:

```
GET /api/files/capture?name=simtool-iq-<id>-rx-0.bin
Authorization: Bearer <agent token>          # shared secret set at agent install
Range: bytes=<start>-                        # optional, for resume

200/206  Content-Type: application/octet-stream
         Content-Length, Accept-Ranges: bytes, X-Sha256 (optional, whole file)
DELETE /api/files/capture?name=…  → 204      # SimTool cleanup after fetch
GET    /api/files/capture/stat?name=…        → { bytes, mtime }
GET    /api/files/capture/df                 → { freeBytes }  (for /tmp)
```

Rules for the agent:
- `name` must match `^simtool-(iq-[a-f0-9]{12}-(rx|tx)-\d{1,3}\.bin|pcap-[a-f0-9]{12}\.pcap|enbpcap-[a-f0-9]{12}\.pcap)$`
  and is resolved only inside `/tmp` (no path parameter at all, `realpath`
  must stay in `/tmp`, refuse symlinks).
- Stream with `fs.createReadStream` + `pipeline`; never buffer.
- Token compared in constant time; the agent binds the route only if a token
  is configured.
- Runs as root, so it can read and delete lteenb's root-owned dump files,
  which also removes the sudo requirement for cleanup.

On the SimTool side it would slot in as a third `Box` implementation in
`src/modules/capture/server/box.ts` (sizeOf / freeBytes / fetch / remove),
chosen when the system has an agent token and no SSH login.
