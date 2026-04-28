// Dependencies — external files referenced by the main .cfg.
// Surfaced so the user knows which auxiliary files (drb.cfg, sib*.asn,
// rf_driver/config.cfg) need to live alongside the main cfg on the target
// system for the eNB/gNB to start.
import { FileText, AlertTriangle, FileCheck2, Database, Radio } from 'lucide-react';
import { BoxedSection } from '../BoxedSection';
import type { ReferencedFile } from '../cfgParser';

interface Props {
  refs: ReferencedFile[];
  /** Optional: list of filenames already present in storage (so we can mark each as ✓) */
  available?: string[];
}

const TYPE_META: Record<ReferencedFile['type'], { label: string; icon: any; color: string }> = {
  drb_config:    { label: 'DRB',           icon: Database, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  sib_filename:  { label: 'SIB schedule',  icon: Radio,    color: 'text-amber-700 bg-amber-50 border-amber-200' },
  include:       { label: 'Include',       icon: FileText, color: 'text-purple-700 bg-purple-50 border-purple-200' },
  meas_config:   { label: 'Meas config',   icon: FileText, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  other:         { label: 'Other',         icon: FileText, color: 'text-gray-700 bg-gray-50 border-gray-200' },
};

export function DependenciesSection({ refs, available = [] }: Props) {
  if (!refs || refs.length === 0) {
    return (
      <BoxedSection
        title="Dependencies"
        subtitle="External files referenced by this config"
      >
        <p className="text-sm text-muted-foreground">
          No external files referenced. This config is self-contained.
        </p>
      </BoxedSection>
    );
  }

  const availableSet = new Set(available.map(f => f.toLowerCase()));
  const missingCount = refs.filter(r => !availableSet.has(r.filename.toLowerCase()) && !availableSet.has((r.filename.split('/').pop() || '').toLowerCase())).length;

  return (
    <BoxedSection
      title="Dependencies"
      subtitle={`${refs.length} file${refs.length === 1 ? '' : 's'} referenced — these must exist on the target system for eNB/gNB to start.`}
      action={missingCount > 0 ? (
        <span className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
          <AlertTriangle className="w-3 h-3" />
          {missingCount} missing
        </span>
      ) : undefined}
    >
      <div className="space-y-2">
        {refs.map((r, i) => {
          const meta = TYPE_META[r.type] ?? TYPE_META.other;
          const Icon = meta.icon;
          const baseName = r.filename.split('/').pop() || r.filename;
          const isAvailable = availableSet.has(r.filename.toLowerCase()) || availableSet.has(baseName.toLowerCase());
          return (
            <div
              key={`${r.filename}-${i}`}
              className="flex items-center gap-3 p-2.5 rounded-md border border-gray-200 bg-white"
            >
              <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 border ${meta.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-gray-900 truncate">{r.filename}</span>
                  <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border ${meta.color}`}>
                    {meta.label}
                  </span>
                </div>
                {r.source && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">{r.source}</div>
                )}
              </div>
              {isAvailable ? (
                <span className="flex items-center gap-1 text-xs text-green-700 shrink-0">
                  <FileCheck2 className="w-3.5 h-3.5" />
                  available
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-amber-700 shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  not in storage
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Tip: when importing from a callbox via SSH, dependencies are auto-fetched. For uploaded
        files, drag & drop them in the same import to bundle them with the main config.
      </p>
      <p className="text-[11px] text-muted-foreground mt-2 italic">
        Scope: drb_config and SIB filenames are <strong>per-cell</strong> in Amarisoft
        (each cell_list[i] can reference different files). The builder currently emits
        the same drb.cfg / SIB set for every cell — for per-cell overrides edit cell_list[].drb_config
        and sib_sched_list[] directly.
      </p>
    </BoxedSection>
  );
}
