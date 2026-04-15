// src/components/dialog-styles.ts

export const DIALOG_STYLES = {
  // Default glass morphism settings
  glass: {
    opacity: {
      background: '60',    // Base background opacity
      input: '80',         // Form input background opacity
      border: '20'         // Border opacity
    },
    blur: 'md' as const,   // Backdrop blur amount
    saturation: '150'      // Backdrop saturation percentage
  },

  // Size variations
  size: {
    sm: {
      width: '400px',
      maxWidth: '90vw'
    },
    md: {
      width: '540px',
      maxWidth: '90vw'
    },
    lg: {
      width: '640px',
      maxWidth: '90vw'
    },
    xl: {
      width: '840px',
      maxWidth: '95vw'
    }
  },

  // Spacing configuration
  spacing: {
    padding: {
      sm: '4',    // 16px
      md: '6',    // 24px
      lg: '8'     // 32px
    },
    gap: {
      sm: '2',    // 8px
      md: '4',    // 16px
      lg: '6'     // 24px
    }
  },

  // Border radius options
  rounded: {
    sm: 'lg',
    md: 'xl',
    lg: '2xl'
  },

  // Transition effects
  transition: {
    default: 'transition-all duration-200',
    slow: 'transition-all duration-300'
  }
} as const;

// Reusable class generator functions
export const getDialogClasses = (options: {
  mode: 'light' | 'dark';
  size?: keyof typeof DIALOG_STYLES.size;
  padding?: keyof typeof DIALOG_STYLES.spacing.padding;
  rounded?: keyof typeof DIALOG_STYLES.rounded;
}) => {
  const {
    mode,
    size = 'md',
    padding = 'md',
    rounded = 'md'
  } = options;

  return {
    container: `
      w-[${DIALOG_STYLES.size[size].width}]
      !max-w-[${DIALOG_STYLES.size[size].maxWidth}]
      ${mode === 'light' 
        ? `bg-white/${DIALOG_STYLES.glass.opacity.background}` 
        : `bg-slate-900/${DIALOG_STYLES.glass.opacity.background}`
      }
      shadow-xl
      border
      ${mode === 'light' 
        ? `border-white/${DIALOG_STYLES.glass.opacity.border}` 
        : `border-slate-700/${DIALOG_STYLES.glass.opacity.border}`
      }
      backdrop-blur-${DIALOG_STYLES.glass.blur}
      backdrop-saturate-${DIALOG_STYLES.glass.saturation}
      rounded-${DIALOG_STYLES.rounded[rounded]}
      ${DIALOG_STYLES.transition.default}
    `,
    header: `px-${DIALOG_STYLES.spacing.padding[padding]} pt-${DIALOG_STYLES.spacing.padding[padding]}`,
    content: `px-${DIALOG_STYLES.spacing.padding[padding]} space-y-${DIALOG_STYLES.spacing.gap.md}`,
    footer: `px-${DIALOG_STYLES.spacing.padding[padding]} pb-${DIALOG_STYLES.spacing.padding[padding]} pt-2`,
    input: `
      ${mode === 'light'
        ? `bg-white/${DIALOG_STYLES.glass.opacity.input} border-slate-200 hover:bg-white`
        : `bg-slate-800/${DIALOG_STYLES.glass.opacity.input} border-slate-700 hover:bg-slate-800`
      }
      placeholder:text-slate-400
      ${DIALOG_STYLES.transition.default}
    `
  };
};

// Reusable dialog components
export const DialogComponents = {
  ErrorMessage: ({ error, mode }: { error: string; mode: 'light' | 'dark' }) => (
    <div className={`
      flex items-center gap-2 p-3 rounded-lg text-sm
      ${mode === 'light' 
        ? 'bg-red-50/90 text-red-600 border border-red-100' 
        : 'bg-red-900/20 text-red-400 border border-red-900/30'
      }
      backdrop-blur-sm
    `}>
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      {error}
    </div>
  )
};
