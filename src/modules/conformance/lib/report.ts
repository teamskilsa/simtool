// Pre-conformance report exports: printable HTML, CSV (JSON is the stored
// PlanRunView itself). Pure functions, used by the API route and the UI.
// Every export carries the "not certified" disclaimer.
import type { CaseResult, PlanRunSummary, PlanRunView, Verdict } from '../types';
import { DISCLAIMER, DISCLAIMER_LONG } from '../types';
import { specText } from './cases';

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const iso = (t?: number) => (t ? new Date(t).toISOString() : '');
export const fmtDuration = (ms?: number) => {
  if (ms === undefined || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 120_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`;
};

export const summarizePlanRun = (r: PlanRunView): PlanRunSummary => ({
  id: r.id, planId: r.planId, planName: r.planName, state: r.state, host: r.host, systemName: r.systemName,
  imsi: r.imsi, rat: r.rat, startedAt: r.startedAt, endedAt: r.endedAt, counts: r.counts, total: r.cases.length,
  softwareVersion: r.callbox.enb?.version,
});

export const VERDICT_LABEL: Record<Verdict, string> = { PASS: 'PASS', FAIL: 'FAIL', INCONCLUSIVE: 'INCONCLUSIVE', NOT_RUN: 'NOT RUN' };

const measurementText = (c: CaseResult) => (c.measurement
  ? `${c.measurement.stat}(${c.measurement.metric}) = ${c.measurement.value} ${c.measurement.unit} (threshold ${c.measurement.threshold} ${c.measurement.unit}, n=${c.measurement.samples})`
  : '');

export function reportToCsv(r: PlanRunView): string {
  const cell = (v: unknown) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows: unknown[][] = [
    [`# ${DISCLAIMER}`],
    ['report_id', 'plan', 'system', 'host', 'imsi', 'rat', 'software', 'index', 'case_id', 'title', 'category', 'automation', 'verdict', 'reason',
      'spec_references', 'started_iso', 'duration_ms', 'measurement', 'metrics', 'evidence', 'run_id', 'disclaimer'],
  ];
  for (const c of r.cases) {
    rows.push([
      r.id, r.planName, r.systemName ?? '', `${r.host}:${r.enbPort}/${r.mmePort}`, r.imsi, r.rat ?? '', r.callbox.enb?.version ?? '',
      c.index + 1, c.caseId, c.title, c.category, c.automation, VERDICT_LABEL[c.verdict], c.reason,
      c.specs.map(specText).join(' | '), iso(c.startedAt), c.startedAt && c.endedAt ? c.endedAt - c.startedAt : '',
      measurementText(c), c.metrics.map(m => `${m.name}=${m.value}${m.unit}`).join('; '), c.evidence.join(' | '), c.runId ?? '', DISCLAIMER,
    ]);
  }
  return rows.map(row => row.map(cell).join(',')).join('\n') + '\n';
}

const VERDICT_COLOR: Record<Verdict, string> = { PASS: '#0f7b4d', FAIL: '#b42318', INCONCLUSIVE: '#a15c07', NOT_RUN: '#667085' };

export function reportToHtml(r: PlanRunView): string {
  const badge = (v: Verdict) => `<span class="v" style="background:${VERDICT_COLOR[v]}">${VERDICT_LABEL[v]}</span>`;
  const duration = r.endedAt ? fmtDuration(r.endedAt - r.startedAt) : 'still running';
  const total = r.cases.length;
  const caseRows = r.cases.map(c => `
    <tr><td class="num">${c.index + 1}</td><td><a href="#${esc(c.caseId)}">${esc(c.caseId)}</a></td><td>${esc(c.title)}</td><td>${esc(c.automation)}</td>
    <td>${badge(c.verdict)}</td><td>${esc(c.reason)}</td></tr>`).join('');
  const caseSections = r.cases.map(c => `
  <section class="case" id="${esc(c.caseId)}">
    <h3>${esc(c.caseId)} — ${esc(c.title)} ${badge(c.verdict)}</h3>
    <p class="muted">${esc(c.category)} · ${esc(c.automation)}${c.startedAt ? ` · started ${esc(new Date(c.startedAt).toLocaleString())}` : ''}${c.startedAt && c.endedAt ? ` · ${fmtDuration(c.endedAt - c.startedAt)}` : ''}${c.runId ? ` · run ${esc(c.runId)}` : ''}</p>
    <p><b>Verdict reason:</b> ${esc(c.reason)}</p>
    ${c.specs.length ? `<p><b>Procedure reference:</b> ${c.specs.map(s => esc(specText(s))).join('; ')}</p>` : ''}
    ${c.measurement ? `<p><b>Measurement:</b> ${esc(measurementText(c))} — ${c.measurement.pass ? 'within threshold' : 'over threshold'}</p>` : ''}
    ${c.checks.length ? `<table><thead><tr><th>Check</th><th>Result</th><th>Detail</th></tr></thead><tbody>${c.checks.map(k => `<tr><td>${esc(k.label)}</td><td>${k.passed ? 'pass' : k.optional ? 'warn (not required)' : 'FAIL'}</td><td class="mono">${esc(k.detail)}</td></tr>`).join('')}</tbody></table>` : ''}
    ${c.evidence.length ? `<p><b>Signalling evidence</b> (callbox logs, ms after the stimulus):</p><pre>${c.evidence.map(esc).join('\n')}</pre>` : ''}
    ${c.metrics.length ? `<p><b>Metrics:</b> ${c.metrics.map(m => `${esc(m.name)} = ${m.value} ${esc(m.unit)}`).join(' · ')}</p>` : ''}
    ${Object.keys(c.params).length ? `<p class="muted"><b>Parameters:</b> ${esc(Object.entries(c.params).filter(([, v]) => typeof v !== 'object').map(([k, v]) => `${k}=${v}`).join(', '))}</p>` : ''}
    ${c.teardown.length ? `<p class="muted"><b>Teardown:</b> ${c.teardown.map(t => `${esc(t.what)}${t.ok ? '' : ' (FAILED)'}`).join('; ')}</p>` : ''}
  </section>`).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Pre-conformance report — ${esc(r.planName)} — ${esc(iso(r.startedAt).slice(0, 10))}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body{font:13px/1.45 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d2939;margin:24px auto;max-width:1100px;padding:0 16px}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:15px;margin:22px 0 8px;border-bottom:1px solid #d0d5dd;padding-bottom:4px} h3{font-size:14px;margin:0 0 4px}
  .disclaimer{border:2px solid #b54708;background:#fffaeb;color:#7a2e0e;padding:10px 12px;border-radius:6px;margin:12px 0;font-weight:600}
  .disclaimer p{font-weight:400;margin:4px 0 0}
  table{border-collapse:collapse;width:100%;margin:6px 0} th,td{border:1px solid #e4e7ec;padding:4px 6px;text-align:left;vertical-align:top} th{background:#f9fafb;font-weight:600}
  .v{display:inline-block;color:#fff;border-radius:10px;padding:1px 8px;font-size:11px;font-weight:700;letter-spacing:.02em}
  .muted{color:#667085} .num{text-align:right;font-variant-numeric:tabular-nums} .mono,pre{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px}
  pre{background:#f9fafb;border:1px solid #e4e7ec;padding:8px;white-space:pre-wrap;word-break:break-word}
  .kpis{display:flex;gap:8px;flex-wrap:wrap} .kpi{border:1px solid #e4e7ec;border-radius:6px;padding:6px 10px;min-width:110px} .kpi b{display:block;font-size:18px}
  .case{border:1px solid #e4e7ec;border-radius:6px;padding:10px 12px;margin:10px 0;page-break-inside:avoid}
  footer{margin-top:24px;color:#667085;font-size:11px;border-top:1px solid #e4e7ec;padding-top:8px}
  @media print{body{margin:0} a{color:inherit;text-decoration:none} .case{break-inside:avoid}}
</style></head><body>
<h1>Pre-conformance report — ${esc(r.planName)}</h1>
<div class="disclaimer">${esc(DISCLAIMER)}<p>${esc(DISCLAIMER_LONG.replace(DISCLAIMER, '').trim())}</p></div>

<h2>Summary</h2>
<div class="kpis">
  <div class="kpi"><span class="muted">PASS</span><b style="color:${VERDICT_COLOR.PASS}">${r.counts.PASS}</b></div>
  <div class="kpi"><span class="muted">FAIL</span><b style="color:${VERDICT_COLOR.FAIL}">${r.counts.FAIL}</b></div>
  <div class="kpi"><span class="muted">INCONCLUSIVE</span><b style="color:${VERDICT_COLOR.INCONCLUSIVE}">${r.counts.INCONCLUSIVE}</b></div>
  <div class="kpi"><span class="muted">NOT RUN</span><b style="color:${VERDICT_COLOR.NOT_RUN}">${r.counts.NOT_RUN}</b></div>
  <div class="kpi"><span class="muted">Cases</span><b>${total}</b></div>
  <div class="kpi"><span class="muted">Duration</span><b>${esc(duration)}</b></div>
</div>
<table><tbody>
  <tr><th>Report</th><td class="mono">${esc(r.id)} (${esc(r.state)})</td></tr>
  <tr><th>Plan</th><td>${esc(r.planName)} <span class="muted">(${esc(r.planId)}, stop on fail: ${r.stopOnFail ? 'yes' : 'no'})</span></td></tr>
  <tr><th>Started / ended</th><td>${esc(new Date(r.startedAt).toLocaleString())} → ${r.endedAt ? esc(new Date(r.endedAt).toLocaleString()) : '—'}</td></tr>
  <tr><th>Test system</th><td>${esc(r.systemName ?? '')} ${esc(r.host)} (eNB/gNB API :${r.enbPort}, MME/AMF API :${r.mmePort})</td></tr>
  <tr><th>Callbox software</th><td>${esc(r.callbox.enb?.name ?? '?')} ${esc(r.callbox.enb?.version ?? '?')} · ${esc(r.callbox.mme?.name ?? '?')} ${esc(r.callbox.mme?.version ?? '?')} <span class="muted">(remote API "ready" banners)</span></td></tr>
  <tr><th>RAT</th><td>${r.rat === 'nr' ? 'NR SA' : r.rat === 'lte' ? 'LTE' : '—'}</td></tr>
  <tr><th>UE</th><td>IMSI ${esc(r.ue.imsi)}${r.ue.imeisv ? ` · IMEISV ${esc(r.ue.imeisv)}` : ''}${r.ue.ip ? ` · IP ${esc(r.ue.ip)}` : ''}${r.ue.rat ? ` · ${esc(r.ue.rat)}` : ''}</td></tr>
  <tr><th>Cells (config_get)</th><td>${r.cellSummary.map(esc).join('<br>') || '—'}</td></tr>
  ${r.confirmedRisky.length ? `<tr><th>Operator-confirmed</th><td>${r.confirmedRisky.map(esc).join(', ')}</td></tr>` : ''}
  ${r.error ? `<tr><th>Error</th><td>${esc(r.error)}</td></tr>` : ''}
</tbody></table>
${r.preflight.some(p => !p.ok) ? `<p><b>Pre-checks:</b></p><ul>${r.preflight.filter(p => !p.ok).map(p => `<li>${esc(p.plain)}</li>`).join('')}</ul>` : ''}

<h2>Verdicts</h2>
<table><thead><tr><th>#</th><th>Case</th><th>Title</th><th>Automation</th><th>Verdict</th><th>Reason</th></tr></thead><tbody>${caseRows}</tbody></table>

<h2>Cases</h2>
${caseSections}

<footer>${esc(DISCLAIMER)} Generated by SimTool on ${esc(new Date().toISOString())}. Verdicts: PASS — the observed signalling/state matched the procedure as SimTool checks it; FAIL — it did not; INCONCLUSIVE — a precondition, the test system or the operator prevented a verdict; NOT RUN — not applicable, not confirmed, skipped after a failure (stop on fail) or aborted.</footer>
</body></html>
`;
}
