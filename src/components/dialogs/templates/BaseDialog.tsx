import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
import { DialogSize } from '../styles/theme-extensions';
import { useDialogStyles } from '../styles/glass';

interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  size?: DialogSize;
  className?: string;
}

export function BaseDialog({
  open,
  onOpenChange,
  children,
  size = 'md',
  className
}: BaseDialogProps) {
  const { theme } = useTheme();
  const themeConfig = themes[theme];
  const styles = useDialogStyles();
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`
        w-[${themeConfig.dialogs.sizes[size].width}]
        !max-w-[${themeConfig.dialogs.sizes[size].maxWidth}]
        ${styles.getBackgroundStyle()}
        ${styles.getBorderStyle()}
        ${styles.getEffects()}
        ${className || ''}
      `}>
        {children}
      </DialogContent>
    </Dialog>
  );
}
