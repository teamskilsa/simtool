// components/dialogs/templates/FormDialog.tsx
import { ReactNode } from 'react';
import { Loader } from 'lucide-react';  // Changed from RefreshCw to Loader
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
  const { theme, mode } = useTheme();
  const themeConfig = themes[theme];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader className="bg-indigo-600 -mx-6 -mt-6 px-6 py-4 rounded-t-lg">
          <DialogTitle className="text-xl font-semibold text-white">
            {title}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit}>
          <div className="py-6">
            {children}

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                <span>⚠️</span>
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-end gap-3 pt-4 mt-6 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {loading ? (
                <div className="flex items-center">
                  <Loader className="w-4 h-4 mr-2 animate-spin" /> {/* Changed from RefreshCw to Loader */}
                  <span>Submitting...</span>
                </div>
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