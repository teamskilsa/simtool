// components/dialogs/templates/FormDialog.tsx
import { ReactNode } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useTheme } from '@/components/theme/context/theme-context';
import type { ThemeVariant } from '@/components/theme/themes';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Static lookup — avoids dynamic class strings that Tailwind can't tree-shake
const THEME_HEADER_BG: Record<ThemeVariant, string> = {
  indigo:  'bg-indigo-600',
  rose:    'bg-rose-600',
  amber:   'bg-amber-600',
  emerald: 'bg-emerald-600',
  sky:     'bg-sky-600',
  teal:    'bg-teal-600',
};

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  loading?: boolean;
  error?: string | null;
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  children,
  onSubmit,
  loading = false,
  error
}: FormDialogProps) {
  const { theme } = useTheme();
  const headerBg = THEME_HEADER_BG[theme] ?? 'bg-indigo-600';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-background text-foreground overflow-hidden p-0">
        {/* Coloured header band — adopts the active theme */}
        <DialogHeader className={`${headerBg} px-6 py-4`}>
          <DialogTitle className="text-xl font-semibold text-white">
            {title}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="px-6">
          {/* Form body */}
          <div className="py-5">
            {children}

            {error && (
              <div className="mt-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="whitespace-pre-line leading-relaxed">{error}</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="flex justify-end gap-3 py-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="focus-visible:ring-2 focus-visible:ring-ring"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className={`${headerBg} hover:opacity-90 text-white focus-visible:ring-2 focus-visible:ring-ring`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting…
                </span>
              ) : (
                'Submit'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
