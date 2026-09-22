# Mobility Scenarios — live validation checklist

Everything below passed **offline** against `scripts/qa/mock-callbox.mjs` (see
`scripts/qa/qa-mobility-scenarios.mjs`, 28/28 checks). None of it has run on the
real callbox yet. This list is for the first session with the callbox and phone.

Setup used for the offline proof and assumed here: Amarisoft CBX 2026-06-12, 6-cell
LTE (cells 1–6 = PCI 1–6; EARFCN 3350/2850 B7, 1575/1300 B3, 500/100 B1), eNB ws
:9001, MME :9000, OnePlus NE2215 on adb (serial 127238fb), IMSI 001010123456789.

## 0. Before any scenario

- [ ] Open SimTool → Mobility Scenarios → **Run**. Pick the callbox system. The UE list shows IMSI 001010123456789, which proves `/api/traffic/ues` can reach the MME.
- [ ] Phone list shows the OnePlus (`adb devices` → `device`). Screen unlocked. Mobile data on.
- [ ] Callbox baseline, so the teardown can be checked against it. Run this from the callbox or `ws.js`:
  - `{"message":"config_get"}` → note each cell's `gain` (expect 0), `cell_barred` (expect false), `ncell_list` and `logs.layers.rrc.level`.
  - MME `{"message":"config_get"}` → note `logs.layers.nas/s1ap.level`.
- [ ] **Preflight** for each scenario is all green or only has expected warnings. In particular:
  - [ ] "Cells: 6 LTE cell(s): 1=PCI 1/EARFCN 3350 …" matches the table above. This proves config_get `cells` is keyed by cell id with `n_id_cell`/`dl_earfcn`.
  - [ ] "UE on eNB: enb_ue_id N, PCell X" appears. This proves the eNB `ue_get` entry is joined to the MME entry through `mme_ue_id`.
  - [ ] For drive-test, "Measurement handover config" is OK only on a config built with **Handover from measurements** on. With that toggle off it fails with the explanation. Test both configs.
- [ ] After **every** run, check the Teardown section, then re-run the baseline commands. Gains, barring, ncell_list and log levels must match the baseline.

## 1. Handover ping-pong (`ho-ping-pong`)

Params: `pair [0,1]`, `iterations 6`, `periodMs 10000`.

- [ ] Phone ping starts (Events tab: "background ping …"). The UE stays connected throughout.
- [ ] Each hop passes "PCell = cell X, one context". `ho_complete_ms` is recorded. Expect a few hundred ms; the mock showed about 510 ms.
- [ ] The "move to start cell" step, when the UE starts on another cell, either handovers directly or logs "not a neighbour … adding it". In the second case, Teardown shows "remove neighbour PCI …" and ncell_list matches the baseline afterwards.
- [ ] `ping_loss_pct` / `ping_lost` / `ping_max_gap_ms` metrics appear at the end. Earlier live result: 0/240 loss.
- [ ] Open the Events tab with "debug" on. The `handover` request has `ran_ue_id` = eNB `enb_ue_id`, `pci`, `dl_earfcn`.
- [ ] Try `pair [1,2]` (B7→B3, inter-band).

## 2. Handover tour (`ho-tour`)

- [ ] 6 hops 1→2→…→6→1 all pass. Try it on the 12-cell config too, if one is available.
- [ ] For every missing neighbour: an `ncell_list_add` with `{n_id_cell, dl_earfcn, cell_id (ECI from config_get ecgi.eci), tac, plmn}` is accepted by lteenb.
  - **Unverified:** whether lteenb accepts `cell_id`/`tac`/`plmn` in `ncell`. If it rejects one, the error is shown on the step. Remove the field in `server/runner.ts → addNeighbourFor`.
- [ ] Teardown `ncell_list_del {cell_id, n_id_cell, dl_arfcn}` succeeds for each added neighbour. **Unverified:** the `dl_arfcn` name on a live callbox. The docs say `dl_arfcn`.
- [ ] Press **Stop** mid-tour. The state becomes `aborted`, the teardown still runs, and neighbours are removed.

## 3. SCell churn (`scell-churn`)

Needs a config whose PCell has an `scell_list` (CA).

- [ ] Preflight "Carrier aggregation" lists the PCell's SCells.
- [ ] "release all SCells" → "no SCells" passes. **Unverified:** eNB `ue_get` `cells[]` drops released SCells. If it keeps them, the assert times out. In that case, switch the assert to a `reply` from `scells_act_deact` (it returns `scells`).
- [ ] "SCells back" passes with the same list/order as before. If order differs live, change the assert to compare `ue.scells.length`.
- [ ] "shrink to SCell X" (only with ≥2 SCells) → "one SCell" → "all SCells back".
- [ ] `scells_act_deact` deactivate → reply `activated: []`; activate → `activated` has all SCells.
- [ ] Press **Stop** right after "release all SCells". Teardown shows "enb rrc_cnx_reconf (undo of rrc_cnx_reconf)" and the UE has its SCells again.

## 4. RRC idle / connected cycling (`rrc-idle-cycle`)

Needs the phone. **Don't** run the background ping here, or the UE never goes idle.

- [ ] "UE gone from eNB" passes within about 0.1–1 s of `rrc_cnx_release` (`release_ms`).
- [ ] After `idleMs`, the phone ping (3 × 1 s to 192.168.2.1) brings the UE back. "reconnected with a new enb_ue_id" passes and `reconnect_ms` is measured from the ping.
- [ ] Without a phone selected: the run warns "phone steps will be SKIPPED" and the reconnect assert should fail unless something else sends data. Confirm that it fails cleanly.
- [ ] With **Strict** on and no phone, the run is refused.

## 5. RLF + re-establishment (`rlf-reestablish`)

- [ ] `cell_gain <PCell> -200` → "re-established off cell X" passes. Earlier live result: about 0.8 s (`reestablish_ms`).
- [ ] The log assert "RRC re-establishment in eNB log" passes (it is optional, so it only warns if not). **Unverified:** the RRC layer is named `rrc` in `config_set logs.layers`, and log text contains "reestablishment" (case-insensitive). Adjust `log.pattern` if the live text differs.
- [ ] The gain is back to 0 after each iteration, and the teardown restores any cell still off baseline.
- [ ] The eNB RRC log level is back to the baseline after the run (Teardown: "enb log levels restored").
- [ ] Press **Stop** while the gain is -200. The teardown restores the gain to 0.

## 6. Cell barring (`cell-barring`)

Needs the phone. Leave `sibWaitMs` at 12000 or more.

- [ ] `sib_set {cells:{"<PCell>":{sib1:{cell_barred:true}}}}` is accepted. This proves the object key is resolved from `${vars.src}`.
- [ ] After the release and the phone ping, "back on a cell other than X" holds for 3 s.
- [ ] "unbar cell X" is sent; Teardown sends `sib_set … cell_barred:false` again, which is idempotent.
- [ ] config_get afterwards shows `cell_barred` at its baseline value.
- [ ] Press **Stop** during the 12 s wait. Barring is cleared.

## 7. Drive test (`drive-test`)

Needs a config generated with **Handover from measurements** on. It has `ncell_list`, a `meas_config_desc` (A1 −100, A2 −105, A3 offset 6, hysteresis 2, TTT 480), `meas_gap_config "gp0"` and `ho_from_meas`. Keep the phone's background ping running.

- [ ] Start gains are cell 1 = 0 and the others = `floorDb` (-30). The UE stays on cell 1 for `holdMs`.
- [ ] Each hop is a ramp: src 0 → -30 and dst -30 → 0 in 3 dB steps every 1.5 s. The step stops on its own when the PCell becomes dst (`fade_to_ho_ms`).
  - Earlier live result: a measurement report at about -6 dB triggered HO 4→5. Expect roughly 3–5 ticks per hop live; the mock needed 7.
- [ ] The log assert "measurement report in eNB log" matches `measurementReport`. If the live RRC log wording differs, adjust the pattern.
- [ ] If a hop lands on the wrong neighbour (for example two cells within 8 dB), try `floorDb -40`.
- [ ] Teardown: every cell gain back to its baseline; RRC log level restored.
- [ ] Press **Stop** mid-ramp. All gains are restored.

## 8. Load-balancing TAU (`tau`)

- [ ] `load_balancing_tau {imsi, imei}` is accepted. `imei` is the first 14 digits of the MME `imeisv`. **Unverified:** whether ltemme accepts a 14-digit IMEI in single-SIM mode. If not, remove `imei` from the step.
- [ ] "S1 released" (optional) and "back: registered, new eNB context" pass (`tau_reconnect_ms`). **Unverified:** that the UE really gets a new `enb_ue_id`. If the MME keeps the S1 connection, the second assert fails; then assert on the MME log only.
- [ ] The MME log assert "tracking area update" matches with NAS/S1AP at debug level. MME log levels are restored afterwards. **Unverified:** the ltemme layer names `nas` and `s1ap`. If `config_set` rejects them, the run warns and levels stay unchanged.

## 9. Runner behaviour on real hardware

- [ ] Start two runs on the same callbox. The second is refused with "busy with mobility run …".
- [ ] Watch the eNB `ue_get` poll rate during an assert (250 ms default, 100 ms on handover asserts). Confirm it doesn't disturb the Stats → UE view. The runner never sends `ue_get stats:true`, so bitrate counters aren't reset.
- [ ] Stop the SimTool dev server mid-run. History then shows the run as `error` ("Interrupted"). The teardown did **not** run, so restore the callbox by hand (gains, barring, ncells). This is a known limit.
- [ ] Phone: `ping_stop` metrics parse NE2215 ping output (`icmp_seq=… time=…`, "N packets transmitted, M received"). `cell_info` parses `dumpsys telephony.registry` CellInfoLte (`mPci`, `mEarfcn`, `rsrp`) and needs a manual `assert source:"phone"` step to try.
- [ ] Airplane mode steps (not used by any built-in): `airplane_on` is always undone at teardown.

## 10. Test Execution link

- [ ] In Test Execution, create a deploy scenario (callbox topology) with the HO-enabled enb config.
- [ ] In Mobility Scenarios → Run, pick it under "Test Execution scenario" and click **Attach scenario to test**. `data/users/admin/scenarios.json` now has `mobility: {scenarioId, imsi, …}` on that record.
- [ ] Turn on **Deploy its configs first** and click **Deploy + run**. Deploy steps appear, then "waiting for the UE to re-attach", then the scenario runs with preflight "Config text" OK.
- [ ] History shows "test: <name>" on the run. `GET /api/scenarios/runs?linkedTestId=<id>` returns it.
