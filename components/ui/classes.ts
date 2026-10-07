/**
 * Shared class names. Radii: 8px controls (rounded-lg), 12px cards (rounded-xl), 16px dialogs
 * (rounded-2xl). Colours come from the tokens in tailwind.config.ts.
 */

export const surface = "rounded-xl border border-line bg-surface shadow-card";

export const inputBase =
  "block w-full min-h-[44px] rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-[15px] text-primary shadow-control placeholder:text-[#8b88a8] transition-colors focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-muted";

export const selectBase = `${inputBase} appearance-none bg-select-chevron bg-[length:1.1em_1.1em] bg-[right_0.75rem_center] bg-no-repeat pr-10`;

export const inputError = "border-danger focus:border-danger focus:ring-danger/15";

export const labelText = "block text-sm font-semibold text-primary";

export const helpText = "mt-1.5 text-[13px] leading-snug text-muted";

export const errorText = "mt-1.5 text-[13px] font-medium leading-snug text-danger";

export const eyebrowText = "text-[11px] font-semibold uppercase tracking-[0.12em] text-muted";

const buttonBase =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export const buttonPrimary = `${buttonBase} bg-accent text-white shadow-[0_1px_2px_rgba(39,33,71,0.2)] hover:bg-accent-hover active:bg-accent-active`;

export const buttonSecondary = `${buttonBase} border border-line-strong bg-surface text-primary hover:border-[#c9c4e2] hover:bg-surface-hover`;

export const buttonGhost = `${buttonBase} text-ink-nav hover:bg-accent-soft hover:text-primary`;

export const buttonDanger = `${buttonBase} bg-danger text-white shadow-[0_1px_2px_rgba(39,33,71,0.2)] hover:bg-danger-strong`;

/** Compact variant for table rows and toolbars. */
export const buttonSmall = "min-h-[40px] px-3 text-[13px]";

export const alertError = "flex items-start gap-3 rounded-lg border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger-strong";

export const alertSuccess = "flex items-center gap-2.5 rounded-lg border border-success-border bg-success-soft px-4 py-3 text-sm font-medium text-[#185c39]";
