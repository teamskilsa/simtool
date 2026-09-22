# Pre-conformance — live validation checklist

> **Pre-conformance — not a certified 3GPP conformance result.** An Amarisoft
> callbox is not a GCF/PTCRB-validated test system and these are not the TTCN-3
> test cases of TS 38.523-1 / 36.523-1. The checks follow the 3GPP *procedures*
> cited per case (TS 38.331 / 36.331 RRC, TS 24.501 / 24.301 NAS, TS 38.321 /
> 36.321 MAC).

Everything below passed **offline** against `scripts/qa/mock-callbox.mjs`
(`node scripts/qa/qa-conformance.mjs` — every automatic case on NR SA and LTE,
every default plan, operator prompts, stop-on-fail, locking, reports). None of
it has run on the real callbox (192.168.1.80) yet. This list is for the first
session with the callbox and a real UE.

The mock's log text is modelled on Amarisoft's format but **was not captured
from a live box**. The first job on the real callbox is to confirm the message
names the matchers expect (section 1). Every other check depends on them.

## 0. Set-up

- [ ] Test Systems: the callbox has its **SSH login** saved. Without it the callbox cannot send DL UDP (iperf). Then IDLE-01 is INCONCLUSIVE and the other cases rely on the UE's own traffic to stay connected (`inactivity_timer` is 10 s in the shipped configs).
- [ ] The callbox has `iperf` (iperf2) installed: `ssh … 'command -v iperf'`.
- [ ] The UE's IMSI is in the core's `ue_db`, with a data APN. Screen unlocked, mobile data on, Wi-Fi off.
- [ ] Record a baseline (`ws.js` or Remote API tab): eNB `config_get` gives each cell's `gain` (expect 0), `cell_barred`, `ncell_list` and `logs.layers.*.level`. MME `config_get` gives `logs.layers.nas/s1ap/ngap.level`. After **every** plan, compare against it. Every case's Teardown line in the report lists what was restored.
- [ ] SimTool → **Pre-conformance → Run**: pick the plan, the system and the UE. Click **Check preconditions**. Every check reads in plain language. "Cases on this config" shows which cases will be INCONCLUSIVE on this config, and why.

### Configs to deploy (Test Configurations)

| RAT | config | good for |
| --- | --- | --- |
| NR SA | `testDemo-6cell-2x3CC-HO.cfg` | 2 groups of 3CC CA (cells 1–3, 4–6); cross-group ncell_list; `nr_handover` A3 + `ho_from_meas`. Covers MOB-02, MOB-03, CA-01, CA-02, SI-01, KPI-01. **Every cell is on its own carrier and all cells use TAC 1**, so MOB-01 (intra-frequency) and NR MOB-04 (registration update) are INCONCLUSIVE by design. |
| NR SA | a copy of the above with cells 4–6 on the same ARFCNs as 1–3 (different PCI) and TAC 2 on cells 4–6 | MOB-01 intra-frequency and NR MOB-04 (mobility registration update on a TA change) |
| NR SA | `nr-sa-n78-40mhz.cfg` / `testDemo-n78-1cell-100MHz.cfg` | 1 cell: REG-01..04, RRC-01, IDLE-01, KPI-02 |
| LTE | `lte-6cell-4x4-b7-b3-b1.cfg` | 6 cells, `ho_from_meas`, scell_list; LTE MOB-02/03, CA-01/02, SI-01, RRC-02, KPI-01, MOB-04 (load-balancing TAU) |
| LTE | `lte-12cell-2x2.cfg` | 12 cells; every cell is on a different EARFCN, so MOB-01 is INCONCLUSIVE. For intra-frequency, add a second cell on EARFCN 3350 with a different PCI |

## 1. Message names in the live logs (do this first)

With a plan running, open Remote API → `log_get` (or the case's "Signalling evidence" in the report). Check that the first line of each entry matches `src/modules/conformance/lib/signalling.ts`.

- [ ] NR RRC (gNB log, layer RRC): `… RRC setup request`, `RRC setup`, `RRC setup complete`, `RRC reconfiguration`, `RRC reconfiguration complete`, `RRC release`, `RRC reestablishment request`/`RRC reestablishment`/`… complete`, `Measurement report`, `Paging`. The handover reconfiguration body contains `reconfigurationWithSync`. SCell changes contain `sCellToAddModList` / `sCellToReleaseList`.
- [ ] LTE RRC: `RRC connection request/setup/setup complete`, `RRC connection reconfiguration (complete)`, `RRC connection release`, `RRC connection reestablishment request/…/complete`, `Measurement report`, `Paging`. The handover body contains `mobilityControlInfo`.
- [ ] NAS in the **MME** log (layer NAS): NR uses `Registration request/accept/complete`, `Authentication request/response`, `Security mode command/complete`, `PDU session establishment request/accept`, `Service request`, `Deregistration request/accept`. LTE uses `Attach request/accept/complete`, `Tracking area update request/accept`, `Service request`, `Detach request/accept`.
- [ ] The decoded body (ASN.1 lines after the first line) is present at `debug` level. The matchers only need it for `contains` checks: mobility, SCell lists and mt-Access. **Unverified:** whether `log_get` returns the body with the default `max_size`. If it does not, MOB-01/02/03, CA-01 and KPI-01 fail on the "with mobility / sCell…" item. Fix: raise `logs.layers.rrc.max_size`, or drop `contains` in `lib/cases.ts`.
- [ ] If a name differs, fix the regex in `signalling.ts` (one place per RAT). Then re-run `node scripts/qa/qa-conformance.mjs`, adjusting the mock text if needed.
- [ ] `log_get` timestamps and `utc` in replies come from the callbox clock. The evidence offsets (`+N ms` after the stimulus) should be small and positive. If they are negative or huge, the clock offset estimate in `remoteConn.ts` (`clockOffsetMs`) is wrong.

## 2. Automatic cases (plan "Full (all automatic)", or one case at a time)

For each case, open the report row. The verdict reason, the checks and the signalling evidence must make sense on their own.

- [ ] **PC-REG-02** PDU session / default bearer. NR: the MME `ue_get` bearer has `pdu_session_id` and `ip`. LTE: `erab_id` and `ip`.
- [ ] **PC-RRC-01** RRC release. You see `RRC release` DL, then the UE leaves the gNB `ue_get` (or comes back with a new `ran_ue_id`) and stays registered.
- [ ] **PC-RRC-02** RLF → re-establishment (cell gain −200 dB, restored afterwards). Expect PASS with Reestablishment request → Reestablishment → complete on another cell. If the UE does a fresh RRC setup instead, the verdict is INCONCLUSIVE with the explanation. Record which one the UE did. Teardown shows the gain restore.
- [ ] **PC-MOB-01** intra-frequency HO. INCONCLUSIVE "Precondition not met: No two NR cells share a frequency…" on the 2x3CC config. PASS on the same-frequency variant.
- [ ] **PC-MOB-02** inter-frequency HO. The `handover` request carries `ssb_nr_arfcn` (NR) / `dl_earfcn` (LTE). Evidence shows the reconfiguration with `reconfigurationWithSync` / `mobilityControlInfo`, then complete. `ho_rrc_ms` is recorded. If the target was not a neighbour, Teardown shows "remove neighbour PCI …".
- [ ] **PC-MOB-03** A3 HO. The gain ramp fades the serving cell until the PCell changes. Evidence shows Measurement report, then the handover. Gains are restored.
- [ ] **PC-MOB-04** LTE: `load_balancing_tau` → Tracking area update request/accept, UE back in connected. NR: INCONCLUSIVE on single-TAC configs. On the TAC-2 variant, expect Registration request (mobility registration updating) → accept. If the AMF's TAI list covers both TAs, no update is sent, and INCONCLUSIVE is the correct result.
- [ ] **PC-CA-01** SCell release/add. `rrc_cnx_reconf` with `nr_secondary_cell_list: []` then the original list. NR SA uses `nr_…`, LTE uses `eutra_…`. **Unverified live for NR:** the `nr_secondary_cell_list` object form `{cell_id}` only. If lteenb wants more fields, the error shows in the step.
- [ ] **PC-CA-02** MAC CE. The `scells_act_deact` reply lists `activated` [] then all. The verdict is reply-based (no RRC evidence by design).
- [ ] **PC-SI-01** barring. LTE uses `sib_set cells.<id>.sib1.cell_barred`. NR uses `config_set cells.<id>.cell_barred`: **unverified live**, and the docs list `cell_barred` for NR under config_set. The UE must come back on another cell and stay there for 3 s. Afterwards `config_get` shows the cell unbarred (teardown re-sends the original value).
- [ ] **PC-IDLE-01** paging. After the release the UE must be idle before the data starts. Otherwise the result is INCONCLUSIVE "reconnected on its own" (background apps): try again with fewer apps, or airplane-cycle first. Evidence: Paging (optional), RRC setup request, Service request. `mt-Access` is recorded if the body shows it.
- [ ] **PC-KPI-01** HO interruption. `max ho_interruption_ms` against the 100 ms threshold (a SimTool default, not a 3GPP requirement). Compare it with `ho_complete_ms`, which is measured from ue_get polling.
- [ ] **PC-KPI-02** RRC setup latency. `rrc_setup_ms` (setup request → setup complete) for each sample.
- [ ] After the plan: `mock`-style clean check. Baseline gains, barring, ncell_list, SCells (configured + active) and log levels are unchanged. No `iperf` is left on the box (`pgrep -fa iperf`).

## 3. Operator-prompted cases (SimTool never touches the phone)

- [ ] **PC-REG-01** initial registration. Prompt 1: "airplane mode ON" → do it → **Continue**. Prompt 2: "airplane mode OFF" → do it → Continue. PASS needs the full NAS sequence (authentication may be absent), plus for NR the PDU session establishment, then registered with an IP. Try a power cycle too.
- [ ] **PC-REG-04** UE detach. Prompt "airplane mode ON" → the MME log shows `Deregistration request (UE originating)` / `Detach request`. If this FAILs, repeat with a real power-off: some devices do not detach on airplane mode. The restore prompt (airplane OFF) is not part of the verdict.
- [ ] Prompt **Skip** → the case is INCONCLUSIVE "Operator skipped …". **Abort** stops the plan, and the remaining cases are NOT RUN. No answer until the timeout (3 min by default) → INCONCLUSIVE.
- [ ] The prompt dialog appears even when you are on the Catalogue/Plans/Reports tab.

## 4. Network-initiated detach (PC-REG-03) — only with a test SIM you can recover

- [ ] Excluded from default plans. In your own plan it is NOT RUN unless the confirmation box on the Run tab is ticked.
- [ ] When confirmed, the run prompts once more, then sends `ue_detach {imsi, type: 1 (LTE, re-attach required) | 5 (NR, 3GPP access + re-registration required), cause: -1}`. **cause -1 means no cause IE is sent**, so the UE applies no cause-specific handling (#3 "illegal UE" would invalidate the USIM until a power cycle). Check in the MME log that no EMM/5GMM cause IE is present.
- [ ] The UE must accept, then register again within 60 s. If it does not, note the UE model: that is the finding.

## 5. System behaviour

- [ ] While a plan runs, starting a Mobility Scenario on the same system is refused ("busy: pre-conformance plan …"). A plan is refused while a mobility run is active.
- [ ] Stop on fail: a FAIL marks the remaining cases NOT RUN "stop on fail after …".
- [ ] Reports tab: open the report and download HTML (printable, disclaimer at the top and bottom), JSON and CSV (disclaimer row plus a column on every row). The report shows the callbox software version from the `ready` banner, the cells from `config_get` and the IMSI.
- [ ] Every case has its own scenario run (Reports → case row → "Open the scenario run"), including its events log for debugging.
