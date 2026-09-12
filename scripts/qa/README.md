# Config-builder QA

Exercises the path a user actually takes — build a cell, save it, reopen it in
the builder, save again — without needing the UI or a login:

    form state --generateNRConfig--> enb.cfg --importCfgToBuilder--> form state'

Run with `npx tsx scripts/qa/<script>.ts` from the repo root.

| script | what it covers |
| --- | --- |
| `qa-config.ts` | single-cell n78 happy path: generate, structure, round trip, re-save stability |
| `qa-matrix.ts` | FDD, FR2, SSB override on/off, per-antenna gain arrays, 3-digit MNC, multi-cell, Layers |
| `qa-cell-switch.ts` | regression: the GSCN must not follow you when you switch cell tabs |
| `qa-cellname.ts` | regression: custom cell names survive re-import |
| `qa-nsa-names.ts` | regression: the LTE mapper must read `cell_list`, not `nr_cell_list` |
| `qa-stats-live.ts` | validate the Stats page against a running test: live `stats`/`ue_get` from the box through the render path (needs `QA_LIVE_DIR`) |
| `qa-root-fields.ts` | regression: license_server, en_dc_support and rf_ports survive for NR and LTE, including port keys with no builder field |
| `qa-vs-live.ts` | compares against a real production `enb.cfg` (see below) |

## qa-vs-live.ts

Needs a real config at `scripts/qa/live-enb.cfg`. Fetch one read-only:

    ssh -i ~/Documents/private_key sysadmin@192.168.1.122 \
      'sudo cat /root/enb/config/enb.cfg' > scripts/qa/live-enb.cfg

**Do not commit that file** — it carries the box's AMF addresses and licence
tag. `scripts/qa/*.cfg` is gitignored for this reason.

This is the only check that proves our parser reads configs we did not write,
and that our generator emits the keys Amarisoft actually expects. It found the
missing `license_server` line.

## Known gaps

- Nothing here runs a config against an actual Amarisoft binary. The
  `config-validate` API route does that (`lteenb -c <tmp>`, no daemon
  restart), but it contends for the SDR, so it is unsafe on a shared box
  that has a live eNB running. Run it when the callbox is free.

## Fixed by this harness

- `license_server` was emitted by no generator, so re-saving an imported
  config stripped its licence line and the daemon would not start.
- The SSB GSCN followed you between cell tabs — set on Cell 1, it moved to
  Cell 2 (`qa-cell-switch.ts` now asserts the fix).
- Custom cell names were relabelled `Cell 1..N` on re-import.
- `en_dc_support` and `rf_ports` were dropped from any config that had them. Now kept for both NR and LTE; rf_ports keys the builder has no field for survive through `extra`.

## qa-stats-live.ts — validate Stats against a running test

Pull `stats` and `ue_get` off a box under load (redirect to a FILE, not a pipe —
the Amarisoft `ws.js` CLI truncates piped stdout at ~68 KB):

    ssh ... 'cd /root/ltemme-linux-*; sudo bash -c "node ws.js 127.0.0.1:9001       '{\"message\":\"stats\",\"samples\":true}' > /tmp/s.raw;       node ws.js 127.0.0.1:9001 '{\"message\":\"ue_get\",\"stats\":true}' > /tmp/u.raw"'
    # strip the tool header (keep from the first `{`) into s.json / u.json, copy local

    QA_LIVE_DIR=/path/to/folder npx tsx scripts/qa/qa-stats-live.ts

It asserts every KPI, per-cell row, donut and UE row the page shows equals the
value hand-computed from the raw JSON. Validated 2026-09-12 against a live
510-UE run (22/22).

Transport note: Amarisoft's remote-API WebSocket requires an **Origin** header
(`ws.js` sends `origin: "Test"`); a browser sends one automatically, so the
dashboard connects, but a bare Node `ws` client must pass `{ origin }`.
