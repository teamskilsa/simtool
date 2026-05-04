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
  apply/ApplyDialog             Diff preview → hot (Remote API) or cold (SSH+restart)
views/UeSimView.tsx             Tab shell that wires everything together
```

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
Verified end-to-end: `parse → map → emit → reparse → remap → emit` is **byte-identical**.

## Built-in section seeds (immutable, can be cloned)

Cell: `nr-default` (n78 100MHz 2x2), `lte-default` (B7 20MHz)
Subscriber: `1ue-milenage`, `32ue-xor-pool`
Traffic: `default` (Quick Attach + Attach+iperf-DL-100M with duration=70 example)
User Plane: `tun`, `sim`
Channel: `off`, `epa-mobility` (speed=5 m/s)
Settings: `default`

The sidebar already had `'UESim'` (port 9002) registered in `SystemType`, so the
Remote API hot-apply path uses your existing `useRemoteAPI` WebSocket helper.
Cold-apply writes the cfg over your existing `pages/api/ssh/execute.ts` and
restarts the LTE service.
