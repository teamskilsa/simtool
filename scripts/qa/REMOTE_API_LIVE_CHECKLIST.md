# Remote API live checklist (callbox 192.168.1.80)

Run this when the callbox is back online. It checks SimTool's Remote API console
(`src/modules/remoteAPI`, catalogue in `src/shared/default/templates/remoteapi`)
against the real servers. The offline harness (`npx tsx scripts/qa/qa-remote-api.ts`)
already covers the protocol against a mock. This list covers what a mock cannot
prove.

Order: **read-only first, then safe runtime changes. Every change has a restore
step.** Phase 4 needs a free box and an explicit go-ahead.

Known box: Amarisoft CBX **2026-06-12**. eNB `:9001`, MME `:9000`, IMS `:9003`
(in-process with ltemme), MBMSGW `:9004` if enabled, license server `:9006`.
The catalogue follows the **2026-09-11** docs. If the box has been upgraded, run
it all again and tick the 2026-09-11 lines in Phase 3.

## 0. Setup

1. Open SimTool, go to **Remote API**. Pick ENB, host `192.168.1.80`, port `9001`, then **Connect**.
2. Keep a shell on the box for cross-checks with Amarisoft's own client. Redirect to a file: `ws.js` truncates piped stdout at about 68 KB.
   ```
   ssh <user>@192.168.1.80
   cd /root/ltemme-linux-*   # ws.js + node_modules ship here
   node ws.js 127.0.0.1:9001 '{"message":"config_get"}' > /tmp/cfg.json
   ```
3. **Save a baseline before changing anything.** From the console, send and Export the log (or keep the ws.js files):
   - ENB: `{"message":"config_get"}` (restore source for logs, cell gains)
   - ENB: `{"message":"rf"}` (tx_gain/rx_gain per channel)
   - ENB: `{"message":"ue_get","stats":true}` (enb_ue_id, PCell, SCells)
   - MME: `{"message":"ue_get"}`
   - Note which UE (IMSI, enb_ue_id) is attached. Phase 2 needs one attached UE, ideally one you can power cycle.

Record each result as PASS / FAIL / NOTE in a copy of this file.

## 1. Connection and protocol (read-only)

| # | Step | Expect |
|---|------|--------|
| 1.1 | Connect ENB :9001 | Banner card shows TYPE `ENB`, NAME = com_name, VERSION `2026-06-12`, SESSION `ready`. **Note whether PRODUCT, `time` and `utc` exist** (the docs list only type/name/version/product; the live banner had time and utc). |
| 1.2 | Connect MME :9000, IMS :9003, license :9006, and MBMSGW :9004 if enabled | Types `MME`, `IMS`, `LICENSE`, `MBMSGW`. With ENB still selected on port 9000 you get the "answered as MME" warning. |
| 1.3 | On the box: `node -e "const W=require('nodejs-websocket');const c=W.connect('ws://127.0.0.1:9001/');c.on('error',e=>console.log('ERR',e.message));c.on('text',t=>console.log(t))"` (no Origin header) | The handshake is refused. Compare with `ws.js`, which sends `origin: Test` and connects. |
| 1.4 | ENB `{"message":"help"}` | Save `messages[]` and `events[]`. **Diff them against the catalogue.** Anything the server lists that the catalogue lacks is a gap. Anything the catalogue has that the server lacks must be version-gated. |
| 1.5 | Same `help` on MME, IMS, license | Same diff. |
| 1.6 | ENB `{"message":"bogus"}` | Log entry is ERROR and shows the full response `{"message":"bogus","message_id":…,"error":"Unknown message…"}`. Copy the exact error text. |
| 1.7 | ENB `{"message":"monitor","data":"t g\n"}` (from ws.js or raw JSON in the console; confirm the prompt) | **Expected error: Unknown message.** If it works, the Screen Monitor could offer raw console passthrough again. Record the exact reply. |
| 1.8 | Password (only if com_auth is set on any server) | Wrong password: "Authentication failed". Right password: connects, and VERSION fills in from config_get. SimTool over plain http from another host has no WebCrypto; the error must say to use https/localhost or `unsecure: true`. |
| 1.9 | Two browser tabs on the Remote API page, both on ENB | Both connect. Note any "Too many connections" error. |

## 2a. Read-only messages

Send each from **Commands** (pick category, then command). Check the pre-send panel shows no errors, the response parses, and **Log** shows RESPONSE.

| # | Component | Request | Check |
|---|-----------|---------|-------|
| 2a.1 | ENB | `{"message":"config_get"}` | `cells.<id>.gain`, `n_id_cell`, `dl_earfcn` present. Screen Monitor `cell` renders the table. Note whether `version` is present (the console reads it after password auth). |
| 2a.2 | ENB | `{"message":"stats","samples":true,"rf":true,"initial_delay":0.7}` | The first call answers after about 0.7 s with `duration` 0.7. Monitor `t g 2` repeats every 2 s and Enter stops it. |
| 2a.3 | ENB | Per-connection stats window: call `stats` in tab A, wait 5 s, call in tab B, wait 1 s, call in A again | A's second `duration` is about 6 s. The windows are per connection, as documented. |
| 2a.4 | ENB | `{"message":"ue_get","stats":true}` | `enb_ue_id`/`ran_ue_id`, `cells[].dl_bitrate`. **Shared window (live finding):** poll `ue_get` in tab A and B within 1 s of each other. Bitrates in B come out much lower or near 0 because A reset the window. Confirm this. |
| 2a.5 | ENB | `erab_get`, `qos_flow_get`, `s1`, `ng`, `x2`, `xn`, `m2`, `mbs_session_info` | Each responds. `s1_list[0].state` is `setup_done`. |
| 2a.6 | ENB | `{"message":"rf"}` | `tx_gain[]`, `rx_gain[]`, `rf_info`. Keep these values for 2b.4. |
| 2a.7 | ENB / MME / IMS / license | `{"message":"license"}` | products, user, validity. |
| 2a.8 | ENB | `{"message":"log_get","min":1,"max":50,"timeout":1,"allow_empty":true}` twice | The second call returns only newer `idx` values (per connection). Monitor `logs` streams and Enter stops it. Note whether logs carry `timestamp` or `timestamp_us`. |
| 2a.9 | ENB | `{"message":"log_get","min":100000,"timeout":2}` without allow_empty on a quiet box | The response is held (long-poll) and the console does not time out before timeout + 30 s. |
| 2a.10 | MME | `{"message":"ue_get"}`, `{"message":"enb"}`, `{"message":"ng_ran"}`, `{"message":"s6"}`, `{"message":"sgs"}`, `{"message":"stats"}` | `bearers[].ip` present for attached UEs. **MME stats reset on each call**, so do not poll it from two places. |
| 2a.11 | IMS | `{"message":"users_get","registered_only":true}`, `{"message":"dialog_get"}`, `{"message":"mms_server"}` | users[] with bindings. Note whether the server accepts `registered_only` (the doc spells it `registered_only.`). |
| 2a.12 | license :9006 | `{"message":"list"}` | licenses[].connections lists lteenb/ltemme. |
| 2a.13 | ENB | Batch: `[{"message":"s1"},{"message":"nope"},{"message":"ng"}]` | Three log entries: ok, error, ok. Confirms that array frames work. |

## 2b. Safe runtime commands (each with its restore)

The console asks for confirmation on each one. Destructive ones need the checkbox.

| # | Do | Expect | Restore / verify restore |
|---|----|--------|--------------------------|
| 2b.1 | ENB `{"message":"log_set","log":"SimTool live QA start","layer":"PROD","level":"info"}` | ok. The line appears in `log_get` and on the web GUI. | n/a |
| 2b.2 | ENB `{"message":"config_set","logs":{"layers":{"PHY":{"level":"debug","max_size":1}}}}` | ok (no confirm: logs-only is safe). With com_log_lock the response has `logs: "locked"`; note it. | Send the baseline `config_get.logs.layers.PHY` back with config_set. |
| 2b.3 | ENB `{"message":"cell_gain","cell_id":1,"gain":-10}` | ok. `config_get.cells.1.gain` is -10 and UE RSRP drops about 10 dB. Try `"gain":-201`: the console blocks it. Send it with ws.js too and record the server's error text. | `{"message":"cell_gain","cell_id":1,"gain":<baseline>}` (normally 0). |
| 2b.4 | ENB `{"message":"rf","tx_gain":<baseline-1>,"tx_channel_index":0}` | Response `tx_gain[0]` changed. | `rf` with the baseline value. Check with plain `{"message":"rf"}`. |
| 2b.5 | ENB `{"message":"rrc_ue_cap_enquiry","ran_ue_id":<id>,"text":true}` | `text` holds the decoded UE capability. Also try `enb_ue_id` instead of `ran_ue_id` and record whether the alias works. | n/a |
| 2b.6 | ENB `{"message":"rrc_ue_info_req","enb_ue_id":<id>,"req_mask":3}` | ok; the UEInformationRequest shows in the RRC log. | n/a |
| 2b.7 | ENB `{"message":"scells_act_deact","enb_ue_id":<id>,"activate":[<scell>]}` (a CA-configured UE) | `scells`, `activated` include the SCell. | `deactivate` the same SCell, or leave as baseline. |
| 2b.8 | ENB `{"message":"rrc_cnx_reconf","enb_ue_id":<id>,"eutra_secondary_cell_list":[{"cell_id":<scell>}]}` | ok; RRCConnectionReconfiguration in the log. | Send the baseline SCell list from ue_get. |
| 2b.9 | ENB `{"message":"ncell_list_add","cell_id":1,"ncell":{"rat":"eutra","n_id_cell":<pci2>,"dl_earfcn":<earfcn2>,"cell_id":<eci2>,"tac":<tac>}}` | ok. | 2b.11 |
| 2b.10 | ENB `{"message":"handover","ran_ue_id":<id>,"pci":<pci2>,"dl_earfcn":<earfcn2>}`. **Try first without 2b.9** and record the error text. | Before 2b.9 an error; after it the UE moves (ue_get PCell changes). Also try the `enb_ue_id` alias. | Hand over back: add cell 2's ncell for cell 1, then handover to pci1/earfcn1. |
| 2b.11 | ENB `{"message":"ncell_list_del","cell_id":1,"n_id_cell":<pci2>,"dl_arfcn":<earfcn2>}` | ok; a second del returns an error. | n/a |
| 2b.12 | ENB `{"message":"rrc_cnx_release","ran_ue_id":<id>}` | UE goes idle, then reconnects on traffic. | Ping from the UE to bring it back. |
| 2b.13 | ENB `{"message":"page_ue","type":"normal","cn_domain":"ps","imsi":"<imsi>","cell_id":[1]}` with the UE idle | ok. Try without imsi: the console blocks it; record the server's error from ws.js. | n/a |
| 2b.14 | ENB `{"message":"sib_set","cells":{"1":{"sib1":{"p_max":<baseline-1>}}}}` | ok; SIB1 p-Max changes in the BCCH log. | Set p_max back to the baseline value from the cell config. |
| 2b.15 | ENB `{"message":"config_set","cells":{"1":{"pdsch_mcs":10}}}` | DL MCS pinned at 10 (ue_get dl_mcs). | `{"message":"config_set","cells":{"1":{"pdsch_mcs":-1}}}` |
| 2b.16 | ENB `{"message":"trx_iq_dump","duration":100,"rx_filename":"/tmp/simtool_rx%d.bin"}` | A NOTIFICATION log entry (`notification`) arrives first, then the RESPONSE with `rf_ports[].rx_files`. Record the notification's exact shape. | `ssh … rm /tmp/simtool_rx*.bin` |
| 2b.17 | MME `{"message":"load_balancing_tau","imsi":"<imsi>","imei":"<imei>"}` | ok; the UE does a TAU. | n/a |
| 2b.18 | ENB loop: `{"message":"s1","loop_count":3,"loop_delay":1}` | **Record how many responses arrive and their `loop_index` values** (the console assumes loop_count responses with index 0..n-1; any extra shows as an EVENT). | `cancel` if it keeps going. |
| 2b.19 | ENB cancel: send `{"message":"stats","start_time":30,"group_id":7}`, then `{"message":"cancel","group_id":7}` | The delayed request completes with `cancel: true`. Record whether `cancel` itself returns anything extra. | n/a |
| 2b.20 | ENB `{"message":"register","register":"ue_measurement_report"}` | EVENT entries while the UE measures. | `{"message":"register","unregister":"ue_measurement_report"}` |

## 3. Version gating

| # | Check | Expect |
|---|-------|--------|
| 3.1 | On the 2026-06-12 box, pick ENB `ntn_satellite_update` with `t_service` | The console blocks it ("needs release 2026-09-11"). |
| 3.2 | The console note under the banner | "Server 2026-06-12 is older than the catalogue…". |
| 3.3 | **After an upgrade to 2026-09-11:** repeat 1.1, 1.4 (help diff), 2a.2, 2a.8, 2b.3, 2b.10, 2b.16 | Same results. The version note disappears. `help` lists nothing new beyond the catalogue. |
| 3.4 | After the upgrade, on an NTN cell only: `ntn_satellite_update` with `distance_threshold` | Accepted (new in 2026-09-11). |

## 4. Destructive (free box, explicit go-ahead only)

Do these only with the box reserved and a restore path in hand.

| # | Command | Restore |
|---|---------|---------|
| 4.1 | MME `ue_detach` with **`"cause":-1`** and `"type":1` on a test UE | The UE re-attaches by itself. **Do not use the default cause**: #3 locks the SIM until power cycle (live finding 2026-06-12). |
| 4.2 | MME `ue_del` on a *throwaway* IMSI, after copying its `ue_db` entry from mme.cfg | `ue_add` with the saved entry. Then check `ue_get` and a fresh attach. |
| 4.3 | ENB `s1disconnect` | `s1connect`, then `s1` shows setup_done. |
| 4.4 | ENB `cell_gain -200` on one cell | `cell_gain 0` |
| 4.5 | Never: `quit`, `log_reset` on a shared box, `ue_del_all` on the UE sim, `config_set attach_reject_error` without a planned reset to 0. |

## 5. Feed results back

- Wrong or missing messages from 1.4/1.5: update `src/shared/default/templates/remoteapi/<component>/index.ts` (docRef + notes).
- Error texts from 1.6, 2b.3, 2b.10, 2b.13: copy them into `scripts/qa/mock-remote-api.mjs` so the offline harness matches.
- Loop, notification and banner shapes from 2b.16, 2b.18, 1.1: adjust `websocket-client.ts` (`handleMessage`) if they differ.
- Re-run `npx tsx scripts/qa/qa-remote-api.ts`.
