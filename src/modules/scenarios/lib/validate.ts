// Structural validation of a MobilityScenario. Mirrors
// schema/mobility-scenario.schema.json and adds what a JSON schema can't say:
// placeholder syntax, blocked messages, mandatory remote API fields, gain range.
import type { Condition, MobilityScenario, Step } from '../types';
import { BLOCKED, GAIN_MAX, GAIN_MIN, MESSAGES, isSafeDetach } from './catalog';
import { checkExpr, hasPlaceholder, placeholderExprs } from './expr';

export interface Issue { level: 'error' | 'warn'; path: string; msg: string }

const OPS = new Set(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'exists', 'absent', 'truthy', 'falsy', 'match', 'contains']);
const PHONE_OPS = new Set(['airplane_on', 'airplane_off', 'ping', 'ping_start', 'ping_stop', 'wake', 'radio_info', 'cell_info']);
const SOURCES = new Set(['ue', 'mme', 'log', 'reply', 'phone', 'vars', 'sequence']);
const DIRS = new Set(['UL', 'DL', 'TO', 'FROM']);
export const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const isNumOrExpr = (v: unknown) => isNum(v) || (typeof v === 'string' && v.includes('${'));

export function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'scenario';
}

export function validateScenario(s: unknown): Issue[] {
  const issues: Issue[] = [];
  const err = (path: string, msg: string) => issues.push({ level: 'error', path, msg });
  const warn = (path: string, msg: string) => issues.push({ level: 'warn', path, msg });

  if (!s || typeof s !== 'object' || Array.isArray(s)) { err('', 'Scenario must be a JSON object'); return issues; }
  const sc = s as MobilityScenario;
  if (typeof sc.id !== 'string' || !ID_RE.test(sc.id)) err('id', 'id must be a lowercase slug (a-z, 0-9, -)');
  if (typeof sc.name !== 'string' || !sc.name.trim()) err('name', 'name is required');
  if (typeof sc.description !== 'string') err('description', 'description must be a string');
  if (sc.schemaVersion !== 1) err('schemaVersion', 'schemaVersion must be 1');
  const r = sc.requirements as any;
  if (!r || typeof r !== 'object') err('requirements', 'requirements is required');
  else {
    if (!Number.isInteger(r.minCells) || r.minCells < 1) err('requirements.minCells', 'minCells must be an integer ≥ 1');
    if (r.needsPhone !== undefined && typeof r.needsPhone !== 'boolean') err('requirements.needsPhone', 'needsPhone, if present, must be true/false');
    if (typeof r.needsHoConfig !== 'boolean') err('requirements.needsHoConfig', 'needsHoConfig must be true/false');
    if (r.needsCa !== undefined && typeof r.needsCa !== 'boolean') err('requirements.needsCa', 'needsCa must be true/false');
  }
  if (sc.params !== undefined && (typeof sc.params !== 'object' || Array.isArray(sc.params))) err('params', 'params must be an object');
  if (sc.logs !== undefined) {
    for (const [t, layers] of Object.entries(sc.logs ?? {})) {
      if (t !== 'enb' && t !== 'mme') err(`logs.${t}`, 'logs keys are enb or mme');
      for (const [layer, lvl] of Object.entries(layers ?? {})) {
        if (!['error', 'warn', 'info', 'debug'].includes(String(lvl))) err(`logs.${t}.${layer}`, 'level must be error|warn|info|debug');
      }
    }
  }
  if (!Array.isArray(sc.steps) || sc.steps.length === 0) err('steps', 'steps must be a non-empty array');
  else checkSteps(sc.steps, 'steps', 0);

  function checkExprs(v: unknown, path: string) {
    for (const e of placeholderExprs(v)) {
      const m = checkExpr(e);
      if (m) err(path, `\${${e}}: ${m}`);
    }
  }

  function checkCond(c: Condition | undefined, path: string) {
    if (c === undefined) return;
    if (!c || typeof c !== 'object') { err(path, 'condition must be an object'); return; }
    if ('all' in c || 'any' in c) {
      const list = (c as any).all ?? (c as any).any;
      if (!Array.isArray(list) || list.length === 0) err(path, 'all/any needs a non-empty array');
      else list.forEach((x: Condition, i: number) => checkCond(x, `${path}[${i}]`));
      return;
    }
    if ('not' in c) { checkCond((c as any).not, `${path}.not`); return; }
    const leaf = c as any;
    if (typeof leaf.path !== 'string' || !leaf.path) { err(path, 'condition needs path (e.g. "ue.pcell")'); return; }
    const m = checkExpr(leaf.path);
    if (m) err(`${path}.path`, m);
    if (!OPS.has(leaf.op)) err(`${path}.op`, `op must be one of ${[...OPS].join(', ')}`);
    if (['in', 'nin'].includes(leaf.op) && !Array.isArray(leaf.value) && !hasPlaceholder(leaf.value)) err(`${path}.value`, `${leaf.op} needs an array value`);
    if (leaf.op === 'match' && typeof leaf.value === 'string' && !leaf.value.includes('${')) {
      try { new RegExp(leaf.value); } catch { err(`${path}.value`, 'invalid regex'); }
    }
    checkExprs(leaf.value, `${path}.value`);
  }

  function checkSteps(steps: Step[], base: string, depth: number) {
    if (depth > 4) { err(base, 'loops nest at most 4 deep'); return; }
    steps.forEach((st, i) => {
      const p = `${base}[${i}]`;
      if (!st || typeof st !== 'object') { err(p, 'step must be an object'); return; }
      const any = st as any;
      checkCond(any.when, `${p}.when`);
      if (any.onFail !== undefined && any.onFail !== 'fail' && any.onFail !== 'inconclusive') err(`${p}.onFail`, 'onFail must be fail or inconclusive');
      if (any.capture !== undefined) {
        if (typeof any.capture !== 'object') err(`${p}.capture`, 'capture must map var names to expressions');
        else for (const [k, e] of Object.entries(any.capture)) {
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) err(`${p}.capture`, `bad var name "${k}"`);
          const m = typeof e === 'string' ? checkExpr(e) : 'expression must be a string';
          if (m) err(`${p}.capture.${k}`, m);
        }
      }
      switch (st.type) {
        case 'action': {
          if (any.target === 'phone') {
            if (!any.phone || !PHONE_OPS.has(any.phone.op)) err(`${p}.phone.op`, `phone.op must be one of ${[...PHONE_OPS].join(', ')}`);
            if (any.phone?.host && !/^\d+\.\d+\.\d+\.\d+$/.test(any.phone.host) && !String(any.phone.host).includes('${')) err(`${p}.phone.host`, 'host must be IPv4');
            break;
          }
          if (any.target !== 'enb' && any.target !== 'mme') { err(`${p}.target`, 'target must be enb, mme or phone'); break; }
          const msg = any.message;
          if (!msg || typeof msg !== 'object' || typeof msg.message !== 'string') { err(`${p}.message`, 'message must be an object with a "message" name'); break; }
          for (const [label, m] of [['message', msg], ['undo', any.undo]] as const) {
            if (!m) continue;
            if (typeof m.message !== 'string') { err(`${p}.${label}`, `${label} needs a "message" name`); continue; }
            if (BLOCKED[m.message]) {
              if (label === 'message' && isSafeDetach(m)) warn(`${p}.message`, 'ue_detach (no cause IE, re-attach required) only runs when the operator confirms network detach for the run');
              else { err(`${p}.${label}.message`, BLOCKED[m.message]); continue; }
            }
            const spec = MESSAGES[m.message];
            if (!spec) warn(`${p}.${label}.message`, `"${m.message}" is not in the verified catalog — check the Amarisoft docs`);
            else {
              if (spec.target !== any.target && !(any.target === 'mme' && ['ue_get', 'config_get', 'config_set', 'log_get'].includes(m.message))) {
                err(`${p}.target`, `${m.message} is a ${spec.target} message`);
              }
              for (const f of spec.required) if (!(f in m)) err(`${p}.${label}`, `${m.message} requires "${f}"`);
            }
            if (m.message === 'cell_gain' && isNum(m.gain) && (m.gain < GAIN_MIN || m.gain > GAIN_MAX)) err(`${p}.${label}.gain`, `gain must be in [${GAIN_MIN}, ${GAIN_MAX}]`);
            if ('message_id' in m) warn(`${p}.${label}`, 'message_id is set by the runner and will be replaced');
          }
          if (any.ensureNeighbour && msg.message !== 'handover') warn(`${p}.ensureNeighbour`, 'ensureNeighbour only applies to handover');
          if (msg.message === 'handover' && !('dl_earfcn' in msg)) warn(`${p}.message`, 'handover without dl_earfcn uses the UE current EARFCN — set it for inter-frequency targets');
          if (any.expectError !== undefined) { try { new RegExp(any.expectError); } catch { err(`${p}.expectError`, 'invalid regex'); } }
          checkExprs(msg, `${p}.message`);
          checkExprs(any.undo, `${p}.undo`);
          break;
        }
        case 'wait':
          if (!isNumOrExpr(any.ms) || (isNum(any.ms) && any.ms < 0)) err(`${p}.ms`, 'ms must be a number ≥ 0');
          checkExprs(any.ms, `${p}.ms`);
          break;
        case 'assert': {
          const src = any.source ?? 'ue';
          if (!SOURCES.has(src)) err(`${p}.source`, `source must be one of ${[...SOURCES].join(', ')}`);
          if (src === 'log') {
            if (!any.log || (any.log.target !== 'enb' && any.log.target !== 'mme') || typeof any.log.pattern !== 'string') err(`${p}.log`, 'log assert needs {target: enb|mme, pattern}');
            else { try { new RegExp(any.log.pattern, 'i'); } catch { err(`${p}.log.pattern`, 'invalid regex'); } }
          } else if (src === 'sequence') {
            const q = any.sequence;
            if (!q || !Array.isArray(q.items) || q.items.length === 0) err(`${p}.sequence`, 'sequence assert needs sequence.items[]');
            else {
              if (q.target !== undefined && q.target !== 'enb' && q.target !== 'mme') err(`${p}.sequence.target`, 'target must be enb or mme');
              if (!q.items.some((it: any) => !it?.optional)) err(`${p}.sequence.items`, 'at least one item must be required');
              q.items.forEach((it: any, j: number) => {
                const ip = `${p}.sequence.items[${j}]`;
                if (!it || typeof it.msg !== 'string' || !it.msg) { err(ip, 'item needs msg (regex)'); return; }
                for (const k of ['msg', 'contains'] as const) if (typeof it[k] === 'string') { try { new RegExp(it[k], 'i'); } catch { err(`${ip}.${k}`, 'invalid regex'); } }
                if (it.target !== undefined && it.target !== 'enb' && it.target !== 'mme') err(`${ip}.target`, 'target must be enb or mme');
                if (it.dir !== undefined && !DIRS.has(it.dir)) err(`${ip}.dir`, 'dir must be UL, DL, TO or FROM');
              });
              if (q.withinMs !== undefined && !isNumOrExpr(q.withinMs)) err(`${p}.sequence.withinMs`, 'withinMs must be a number');
              for (const [j, m] of (Array.isArray(q.metrics) ? q.metrics : []).entries()) {
                if (typeof m?.name !== 'string' || !Number.isInteger(m.from) || !Number.isInteger(m.to) || m.from < -1 || m.to < 0 || m.to >= q.items.length || m.from >= q.items.length) {
                  err(`${p}.sequence.metrics[${j}]`, 'metric needs name, from (-1 = since mark, or an item index) and to (an item index)');
                }
              }
            }
          } else if (!any.expect) err(`${p}.expect`, 'assert needs expect');
          checkCond(any.expect, `${p}.expect`);
          if (!isNumOrExpr(any.timeoutMs)) err(`${p}.timeoutMs`, 'timeoutMs is required');
          if (any.holdMs !== undefined && !isNumOrExpr(any.holdMs)) err(`${p}.holdMs`, 'holdMs must be a number');
          if (any.metric && typeof any.metric.name !== 'string') err(`${p}.metric.name`, 'metric needs a name');
          break;
        }
        case 'ramp':
          if (!Array.isArray(any.cells) || any.cells.length === 0) err(`${p}.cells`, 'ramp needs cells[]');
          else any.cells.forEach((c: any, j: number) => {
            for (const k of ['cell', 'from', 'to']) if (!isNumOrExpr(c?.[k])) err(`${p}.cells[${j}].${k}`, `${k} is required`);
            for (const k of ['from', 'to']) if (isNum(c?.[k]) && (c[k] < GAIN_MIN || c[k] > GAIN_MAX)) err(`${p}.cells[${j}].${k}`, `gain must be in [${GAIN_MIN}, ${GAIN_MAX}]`);
          });
          if (!isNumOrExpr(any.stepDb) || (isNum(any.stepDb) && any.stepDb <= 0)) err(`${p}.stepDb`, 'stepDb must be > 0');
          if (!isNumOrExpr(any.dwellMs) || (isNum(any.dwellMs) && any.dwellMs < 100)) err(`${p}.dwellMs`, 'dwellMs must be ≥ 100');
          checkCond(any.stopWhen, `${p}.stopWhen`);
          checkExprs(any.cells, `${p}.cells`);
          break;
        case 'loop':
          if (any.count === undefined && any.until === undefined) err(p, 'loop needs count or until');
          if (any.count !== undefined && !isNumOrExpr(any.count)) err(`${p}.count`, 'count must be a number');
          checkCond(any.until, `${p}.until`);
          if (!Array.isArray(any.steps) || any.steps.length === 0) err(`${p}.steps`, 'loop needs steps');
          else checkSteps(any.steps, `${p}.steps`, depth + 1);
          break;
        case 'traffic':
          if (any.op !== 'start' && any.op !== 'stop') err(`${p}.op`, 'op must be start or stop');
          if (any.generator === 'phone') warn(`${p}.generator`, 'SimTool does not drive phones — use the callbox generator');
          if (isNum(any.bitrateMbps) && any.bitrateMbps > 200) warn(`${p}.bitrateMbps`, 'more than 200 Mbps — make sure the cell can carry it');
          break;
        case 'operator':
          if (typeof any.prompt !== 'string' || !any.prompt.trim()) err(`${p}.prompt`, 'operator step needs a prompt');
          if (!isNumOrExpr(any.timeoutMs) || (isNum(any.timeoutMs) && any.timeoutMs < 1000)) err(`${p}.timeoutMs`, 'timeoutMs must be ≥ 1000');
          if (any.onTimeout !== undefined && any.onTimeout !== 'inconclusive' && any.onTimeout !== 'fail') err(`${p}.onTimeout`, 'onTimeout must be inconclusive or fail');
          break;
        default:
          err(`${p}.type`, 'type must be action, wait, assert, ramp, loop, traffic or operator');
      }
    });
  }
  return issues;
}
