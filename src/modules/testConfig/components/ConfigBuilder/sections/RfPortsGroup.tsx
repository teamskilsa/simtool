// cfg root: rf_ports[] — shared by the NR and LTE builders.
//
// One row per RF port. The generators assign `rf_port: i` to cell i, so rows
// are labelled with the matching cell's name.
import { Button } from '@/components/ui/button';
import { BoxedSection } from '../BoxedSection';
import { Field } from './Field';
import type { RfPortEntry } from '../constants';

interface Props {
  ports: RfPortEntry[];
  /** Cell names, index-aligned with rf_port numbers. */
  cellNames: string[];
  /** Show a row per cell even before any port exists (NR under FR2, where
   *  the external frequency translator needs these). Otherwise the group
   *  only appears when the config already had rf_ports. */
  showEmpty: boolean;
  hint: string;
  onChange: (ports: RfPortEntry[]) => void;
}

/** Blank means "not set", not zero. Field's number input turns '' into 0,
 *  which would emit `rf_dl_freq: 0`, so these are parsed here from text. */
function parseFreq(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function RfPortsGroup({ ports, cellNames, showEmpty, hint, onChange }: Props) {
  if (!showEmpty && ports.length === 0) return null;

  const rowCount = Math.max(ports.length, showEmpty ? Math.max(1, cellNames.length) : 0);
  const rows: RfPortEntry[] = Array.from(
    { length: rowCount },
    (_, i) => ports[i] ?? { dlFreq: null, ulFreq: null },
  );

  const setPort = (idx: number, key: 'dlFreq' | 'ulFreq', raw: unknown) =>
    onChange(rows.map((p, i) => (i === idx ? { ...p, [key]: parseFreq(raw) } : p)));

  return (
    <BoxedSection
      title="RF Ports"
      hint={hint}
      action={
        ports.length > 0 ? (
          <Button
            size="sm" variant="ghost" className="h-7 text-xs"
            onClick={() => onChange([])}
            title="Remove rf_ports from the generated config"
          >
            Clear
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-2.5">
        {/* Three columns, not the shared field grid: a port is a label plus
            exactly two fields, and the four-column grid split them across
            two lines. */}
        {rows.map((p, i) => {
          const extraCount = Object.keys(p.extra ?? {}).length;
          return (
            <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2.5">
              <div className="flex flex-col justify-center min-h-8">
                <span className="text-xs font-medium text-muted-foreground">
                  Port {i}{cellNames[i] ? ` — ${cellNames[i]}` : ''}
                </span>
                {extraCount > 0 && (
                  <span
                    className="text-[11px] text-muted-foreground/70"
                    title={Object.keys(p.extra ?? {}).join(', ')}
                  >
                    +{extraCount} other key{extraCount === 1 ? '' : 's'} kept from import
                  </span>
                )}
              </div>
              <Field
                label="DL Freq (MHz)"
                value={p.dlFreq ?? ''}
                onChange={v => setPort(i, 'dlFreq', v)}
                placeholder="auto"
              />
              <Field
                label="UL Freq (MHz)"
                value={p.ulFreq ?? ''}
                onChange={v => setPort(i, 'ulFreq', v)}
                placeholder="auto"
              />
            </div>
          );
        })}
      </div>
    </BoxedSection>
  );
}
