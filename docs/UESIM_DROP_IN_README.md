# UESim Section — Drop-in for `teamskilsa/simtool`

Tabs (Simnovus parity): **Cell · Subscriber · Traffic · User Plane · Channel Modelling · Settings**.
Each tab = a saveable Section File. A Profile = bundle of 6 section IDs.
Loader splits any uploaded `ue.cfg` into the 6 sections automatically.

## Apply this to your repo

```bash
unzip uesim-section.zip
cd uesim-delivery

# 1. Drop the new module in
cp -r ueSim /path/to/simtool/src/modules/ueSim

# 2. Two existing files get replaced (sidebar entry + content router case)
cp dashboard-sidebar.tsx  /path/to/simtool/src/modules/dashboard/components/
cp dashboard-content.tsx  /path/to/simtool/src/modules/dashboard/components/

# 3. Verify
cd /path/to/simtool
npx tsc --noEmit          # expect 12 errors — all pre-existing, all in BU/ dead folders
npm run dev
```

A new **UE Simulator** entry appears in the sidebar between Stats and the divider.

## What's inside `ueSim/`

```
types/index.ts                  Six section data shapes + Profile + Diff types
services/
  cfgParser.ts                  JSON5 + #define / #if / #include preprocessor (no eval)
  sectionMapper.ts              ParsedUeCfg ↔ MaterializedProfile  (bidirectional)
  cfgEmitter.ts                 Pretty-print with deterministic key order
  sectionStore.ts               localStorage CRUD + 9 built-in seeds
  applyService.ts               Hot vs cold diff classifier
hooks/useActiveProfile.ts       Profile/section state for the view
components/
  loader/UeCfgLoaderDialog      Drag a .cfg in → preview → import 6 sections
  header/ProfileSelector        Top profile dropdown + Load .cfg + Export ue.cfg
  header/SectionHeaderStrip     Per-tab section dropdown + Save / Save As / Reset
  cell/CellTab                  Cell groups, cells table, custom bands
  subscriber/SubscriberTab      UE pool + bulk add (1–5000)
  traffic/TrafficTab            Sim-event templates + UE→template assignments
  userPlane/UserPlaneTab        sim / tun / remote modes + PDN list
  channel/ChannelTab            x/y inputs PLUS draggable canvas map
  settings/SettingsTab          RF, logging, remote API, performance
  apply/ApplyDialog             Diff preview + clipboard handoff for full
                                cfg / hot config_set JSON
views/UeSimView.tsx             Tab shell that wires everything together
```

### What "Apply" actually does today

The Apply dialog **does not push to the target**. It produces two
clipboard-copyable payloads:

  • **Copy full ue.cfg** — the materialised profile rendered as a
    Simnovus-flavoured cfg file. Save it onto the target host and
    `service lte restart`.
  • **Copy hot config_set JSON** — a minimal Remote-API body covering
    the diff entries that Amarisoft accepts at runtime (tx_gain,
    rx_gain, log_options, …). Send it over the existing Remote API
    console / WebSocket helper.

A future revision will wire SSH-deploy + service-restart into this
flow via the repo's `pages/api/systems/ssh-execute` endpoint, but
that integration is **not** in this drop-in.

## The two things you flagged explicitly

### 1. Channel modelling — x/y AND visual map

`ChannelTab.tsx` shows both at once:

- **Numeric x/y inputs** for every cell antenna (`antenna_x`, `antenna_y`) and every UE position
  (`position: [x, y, z]`). Direct keyboard entry, exact metres.
- **Visual canvas map** above the tables. Square canvas; world-axis origin at centre;
  `map_extent_m` (default 500m) controls scale. Red triangles = cell antennas.
  Blue circles = UEs. **Drag any of them** — release commits the new `[x, y]` and
  the numeric tables update live. No external libs, plain HTML5 `<canvas>`.

### 2. Traffic — single duration field, two events emitted

In `TrafficTab.tsx` a `power_on` row exposes one `duration` field (seconds).
On export, `cfgEmitter.expandDurationsToPowerOff()` automatically emits:

```
{ event: "power_on",  start_time: 5  }
{ event: "power_off", start_time: 65 }   // ← 5 + 60
```

…and the resulting events are sorted by time before write-out.

Round-trip is **structurally identical**, not byte-identical: the
emitter pretty-prints with a stable two-space indent and a fixed
key order, so a parsed/re-emitted cfg won't text-diff `0` against a
hand-formatted source that used different whitespace, comments, or
`#define` macros. The materialised state on either side of
`parse → map → emit → reparse → remap` does match exactly, which is
the property the diff/apply path relies on.

## Built-in section seeds (immutable, can be cloned)

Cell: `nr-default` (n78 100MHz 2x2), `lte-default` (B7 20MHz)
Subscriber: `1ue-milenage`, `32ue-xor-pool`
Traffic: `default` (Quick Attach + Attach+iperf-DL-100M with duration=70 example)
User Plane: `tun`, `sim`
Channel: `off`, `epa-mobility` (speed=5 m/s)
Settings: `default`

The sidebar already had `'UESim'` (port 9002) registered in `SystemType`. The
Remote API hot-apply payload is shaped to drop into the existing Remote API
console; the cold-apply path is currently clipboard-only and the user
copies the full cfg onto the target. SSH-driven cold deploy via the repo's
`pages/api/systems/ssh-execute` endpoint is on the roadmap but not in this
drop-in.

## Known issues fixed on top of the original drop-in

Landed in the same feature branch as a follow-up commit:

  • `ApplyDialog` rendered `summarizeDiff(diff)` directly — produced
    `[object Object][object Object]`. Replaced with a per-section
    block that joins the lines.
  • `diffProfiles` would crash on first apply (null baseline →
    `null.cell` deref). Now treats null baseline as an empty-section
    object so every after-side leaf shows up as `∅ → <value>`.
  • `EmitOptions.header` was typed `boolean` but the caller passed a
    string label, which the truthy-only emit silently dropped.
    Now accepts `boolean | string`.
  • `writeLastApplied` was persisting `settings.com_password` to
    localStorage. The diff doesn't need a value (just a path), so we
    strip it before save. The Settings tab also surfaces a warning
    when the password is set.
