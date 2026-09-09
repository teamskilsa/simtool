// One tab language for the whole app.
//
// There were four: a Radix segmented pill (Stats, SW Management, Test
// Execution, UE Sim), an underline bar (config builders), and two sizes of
// hand-rolled sub-tab pill. Same control, four looks, so nothing felt like
// one product.
//
// The underline bar wins: it is what the builders already used, it is what
// Simnovator uses, and unlike the segmented pill it does not need a filled
// background that fights the page. Both the Radix primitives in tabs.tsx and
// the hand-rolled bars import these strings, so they cannot drift apart again.

/** The strip the triggers sit on. */
export const TAB_LIST =
  'flex flex-wrap items-end gap-1 border-b border-border -mb-px';

/** A trigger, in either state. Metrics are identical in both so the label
 *  does not shift by a pixel when it becomes active. */
export const TAB_TRIGGER =
  'inline-flex items-center gap-2 whitespace-nowrap px-3 py-2 text-sm font-medium ' +
  'border-b-2 -mb-px transition-colors focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ' +
  'disabled:pointer-events-none disabled:opacity-50';

export const TAB_TRIGGER_ACTIVE = 'border-primary text-primary';

export const TAB_TRIGGER_IDLE =
  'border-transparent text-muted-foreground hover:text-foreground hover:border-border';

/** Radix drives state through data attributes rather than a boolean. */
export const TAB_TRIGGER_RADIX =
  `${TAB_TRIGGER} ${TAB_TRIGGER_IDLE} ` +
  'data-[state=active]:border-primary data-[state=active]:text-primary';

/** Icon size inside a trigger. Every tab icon in the app is this size. */
export const TAB_ICON = 'w-4 h-4';
