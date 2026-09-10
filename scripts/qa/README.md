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
