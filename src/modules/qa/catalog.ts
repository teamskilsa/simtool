// QA test catalog. Generated programmatically from a parameter matrix
// — no hand-rolled JSON. Each entry's id is the canonical case name
// (see TestCase.id format in types.ts) and must be stable across
// rebuilds because Run records reference cases by id.
//
// Design intent: keep this file thin (just the matrix) and let the
// runner derive enb.cfg / ue.cfg from the TestCase via the existing
// generator code in src/modules/testConfig/components/ConfigBuilder.

import type { TestCase, Rat, Duplex } from './types';

// LTE band table — band → duplex + canonical EARFCN center. The runner
// uses this to fill in dl_earfcn during cfg generation. Subset of the
// full 3GPP band list; expand as needed.
const LTE_BANDS: Array<{ band: number; duplex: Duplex; earfcn: number; freqMhz: number }> = [
  { band: 1,  duplex: 'fdd', earfcn: 300,   freqMhz: 2132.5 },
  { band: 2,  duplex: 'fdd', earfcn: 900,   freqMhz: 1960   },
  { band: 3,  duplex: 'fdd', earfcn: 1575,  freqMhz: 1842.5 },
  { band: 4,  duplex: 'fdd', earfcn: 2150,  freqMhz: 2130   },
  { band: 5,  duplex: 'fdd', earfcn: 2525,  freqMhz: 881.5  },
  { band: 7,  duplex: 'fdd', earfcn: 3100,  freqMhz: 2680   },
  { band: 8,  duplex: 'fdd', earfcn: 3625,  freqMhz: 942.5  },
  { band: 12, duplex: 'fdd', earfcn: 5095,  freqMhz: 731    },
  { band: 13, duplex: 'fdd', earfcn: 5230,  freqMhz: 746    },
  { band: 17, duplex: 'fdd', earfcn: 5790,  freqMhz: 734    },
  { band: 20, duplex: 'fdd', earfcn: 6300,  freqMhz: 806    },
  { band: 25, duplex: 'fdd', earfcn: 8365,  freqMhz: 1962.5 },
  { band: 28, duplex: 'fdd', earfcn: 9310,  freqMhz: 763    },
  { band: 38, duplex: 'tdd', earfcn: 37900, freqMhz: 2595   },
  { band: 39, duplex: 'tdd', earfcn: 38250, freqMhz: 1900   },
  { band: 40, duplex: 'tdd', earfcn: 38950, freqMhz: 2350   },
  { band: 41, duplex: 'tdd', earfcn: 40620, freqMhz: 2593   },
  { band: 42, duplex: 'tdd', earfcn: 42590, freqMhz: 3500   },
  { band: 43, duplex: 'tdd', earfcn: 44590, freqMhz: 3700   },
  { band: 48, duplex: 'tdd', earfcn: 55540, freqMhz: 3550   },
];

// NR FR1 bands. Just the popular ones for v1.
const NR_BANDS: Array<{ band: number; duplex: Duplex }> = [
  { band: 1,  duplex: 'fdd' },
  { band: 3,  duplex: 'fdd' },
  { band: 7,  duplex: 'fdd' },
  { band: 28, duplex: 'fdd' },
  { band: 41, duplex: 'tdd' },
  { band: 77, duplex: 'tdd' },
  { band: 78, duplex: 'tdd' },
  { band: 79, duplex: 'tdd' },
];

// LTE bandwidth set. n_rb_dl = bw → 6/15/25/50/75/100.
const LTE_BWS = [1.4, 3, 5, 10, 15, 20] as const;

// NR FR1 bandwidth set (SCS-dependent — ~these are the common ones).
const NR_BWS = [10, 20, 40, 60, 80, 100] as const;

// Antenna counts to sweep. 1 = SISO, 2 = 2x2 MIMO, 4 = 4x4 MIMO.
const ANTENNA_COUNTS: Array<1 | 2 | 4> = [1, 2];

// TDD config IDs we'll exercise per TDD band. Config 2 + special 7
// are the most common defaults — we include 0 (DL-heavy) and 5
// (UL-heavy) too so we catch ratio-specific bugs.
const TDD_CONFIGS = [
  { tddConfig: 0, tddSpecial: 7 },
  { tddConfig: 2, tddSpecial: 7 },
  { tddConfig: 5, tddSpecial: 7 },
];

function bwLabel(mhz: number): string {
  // 1.4 → "1.4mhz", 20 → "20mhz"
  return Number.isInteger(mhz) ? `${mhz}mhz` : `${mhz}mhz`;
}

function describe(c: TestCase): string {
  const parts: string[] = [];
  parts.push(c.rat.toUpperCase());
  parts.push(`B${c.band}`);
  parts.push(`${c.bandwidthMhz} MHz`);
  parts.push(c.duplex.toUpperCase());
  if (c.nAntennaDl > 1) parts.push(`${c.nAntennaDl}x${c.nAntennaUl} MIMO`);
  if (c.tddConfig !== undefined) parts.push(`tdd_cfg=${c.tddConfig}`);
  if (c.scsKhz) parts.push(`SCS=${c.scsKhz}kHz`);
  if (c.nbIotMode) parts.push(c.nbIotMode);
  if (c.catMCeMode) parts.push(`CE-${c.catMCeMode}`);
  if (c.nsaSecondary) parts.push(`+ NR n${c.nsaSecondary.band}`);
  return parts.join(' · ');
}

function buildLte(): TestCase[] {
  const out: TestCase[] = [];
  for (const b of LTE_BANDS) {
    for (const bw of LTE_BWS) {
      for (const ant of ANTENNA_COUNTS) {
        if (b.duplex === 'fdd') {
          const id = `lte-b${b.band}-${bwLabel(bw)}-fdd${ant > 1 ? `-mimo${ant}` : ''}`;
          out.push({
            id,
            rat: 'lte',
            band: b.band,
            bandwidthMhz: bw,
            duplex: 'fdd',
            nAntennaDl: ant,
            nAntennaUl: ant,
            expectAttachWithinSec: 30,
            expectDataPlane: true,
            description: '',
          });
        } else {
          // TDD: sweep a small set of uldl_config values to catch
          // ratio-specific bugs without exploding the matrix.
          for (const t of TDD_CONFIGS) {
            const id = `lte-b${b.band}-${bwLabel(bw)}-tdd-cfg${t.tddConfig}${ant > 1 ? `-mimo${ant}` : ''}`;
            out.push({
              id,
              rat: 'lte',
              band: b.band,
              bandwidthMhz: bw,
              duplex: 'tdd',
              nAntennaDl: ant,
              nAntennaUl: ant,
              tddConfig: t.tddConfig,
              tddSpecial: t.tddSpecial,
              expectAttachWithinSec: 30,
              expectDataPlane: true,
              description: '',
            });
          }
        }
      }
    }
  }
  return out;
}

function buildNr(): TestCase[] {
  const out: TestCase[] = [];
  // NR SCS varies by deployment band. FR1 typically uses 15 or 30 kHz.
  // 30 kHz is the dominant choice for n78/n77/n79; 15 for FDD bands.
  for (const b of NR_BANDS) {
    for (const bw of NR_BWS) {
      const validScs: Array<15 | 30> = b.duplex === 'tdd' ? [30] : [15];
      for (const scs of validScs) {
        for (const ant of ANTENNA_COUNTS) {
          const id = `nr-n${b.band}-${bwLabel(bw)}-${b.duplex}-sa-scs${scs}${ant > 1 ? `-mimo${ant}` : ''}`;
          out.push({
            id,
            rat: 'nr',
            band: b.band,
            bandwidthMhz: bw,
            duplex: b.duplex,
            nAntennaDl: ant,
            nAntennaUl: ant,
            scsKhz: scs,
            expectAttachWithinSec: 30,
            expectDataPlane: true,
            description: '',
          });
        }
      }
    }
  }
  return out;
}

function buildNbIot(): TestCase[] {
  // NB-IoT only on a handful of bands; PRB index varies. Single BW
  // (200 kHz / 1 PRB) is the standard.
  const out: TestCase[] = [];
  const nbBands = [5, 8, 20];
  const modes: Array<'standalone' | 'inband' | 'guardband'> = ['standalone', 'inband', 'guardband'];
  for (const band of nbBands) {
    for (const mode of modes) {
      out.push({
        id: `nbiot-b${band}-200khz-fdd-${mode}`,
        rat: 'nbiot',
        band,
        bandwidthMhz: 0.2,
        duplex: 'fdd',
        nAntennaDl: 1,
        nAntennaUl: 1,
        nbIotMode: mode,
        expectAttachWithinSec: 60,
        expectDataPlane: false,
        description: '',
      });
    }
  }
  return out;
}

function buildCatM(): TestCase[] {
  const out: TestCase[] = [];
  for (const band of [3, 5, 8, 20]) {
    for (const ce of ['A', 'B'] as const) {
      out.push({
        id: `catm-b${band}-1.4mhz-fdd-ce${ce.toLowerCase()}`,
        rat: 'catm',
        band,
        bandwidthMhz: 1.4,
        duplex: 'fdd',
        nAntennaDl: 1,
        nAntennaUl: 1,
        catMCeMode: ce,
        expectAttachWithinSec: 60,
        expectDataPlane: false,
        description: '',
      });
    }
  }
  return out;
}

function buildNsa(): TestCase[] {
  // Common NSA combos: LTE B7 anchor + NR n78/n41 secondary.
  const out: TestCase[] = [];
  const anchors = [{ band: 7, bw: 20 }, { band: 3, bw: 20 }];
  const secondaries = [{ band: 78, bw: 100, scs: 30 as const }, { band: 41, bw: 40, scs: 30 as const }];
  for (const a of anchors) {
    for (const s of secondaries) {
      for (const ant of ANTENNA_COUNTS) {
        out.push({
          id: `nsa-b${a.band}-${bwLabel(a.bw)}-fdd-anchor-n${s.band}-${bwLabel(s.bw)}-tdd-secondary${ant > 1 ? `-mimo${ant}` : ''}`,
          rat: 'nsa',
          band: a.band,
          bandwidthMhz: a.bw,
          duplex: 'fdd',
          nAntennaDl: ant,
          nAntennaUl: ant,
          nsaSecondary: { band: s.band, bandwidthMhz: s.bw, scsKhz: s.scs },
          expectAttachWithinSec: 45,
          expectDataPlane: true,
          description: '',
        });
      }
    }
  }
  return out;
}

// Module-level singleton — built lazily so we don't pay the matrix
// generation on import. UI hits this via /api/qa/catalog.
let _catalog: TestCase[] | null = null;
export function getCatalog(): TestCase[] {
  if (_catalog) return _catalog;
  const all = [...buildLte(), ...buildNr(), ...buildNbIot(), ...buildCatM(), ...buildNsa()];
  for (const c of all) c.description = describe(c);
  _catalog = all;
  return all;
}

export function getCase(id: string): TestCase | undefined {
  return getCatalog().find((c) => c.id === id);
}

// Helper for the UI: which RATs do we ship cases for? Drives the
// filter chips in the catalog browser.
export function getCatalogRats(): Rat[] {
  return ['lte', 'nr', 'nbiot', 'catm', 'nsa'];
}
