export interface GuardOptions {
  /** Getter for the current values to watch (used when `isDirty` is omitted). */
  track?: () => any;
  /** Getter for the baseline values (defaults to the first `track()` value). */
  pristine?: () => any;
  /** Bring-your-own dirty check; takes precedence over `track`/`pristine`. */
  isDirty?: () => boolean;
  /**
   * Custom confirmation. Receives an AbortSignal that fires when the guard wants
   * to cancel (e.g. a second browser Back). Return `true` to proceed, `false` to
   * stay. When omitted, a built-in modal-x confirmation is opened.
   */
  onConfirm?: (signal: AbortSignal) => boolean | Promise<boolean>;
  /** Built-in confirmation modal name (default "ConfirmationModal"). */
  modal?: string;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** Disable the guard entirely when this returns false. */
  enabled?: () => boolean;
  /** Skip the guard while a submit is in flight. */
  isSubmitting?: () => boolean;
  /** Also guard tab close / refresh via `beforeunload` (default true). */
  beforeUnload?: boolean;
  /** Double-back policy when guarding a modal close (default 'stay'). */
  onDoubleBack?: "ignore" | "stay" | "close";
}

export interface GuardHandle {
  /** Current dirty state. */
  isDirty: () => boolean;
  /** Re-capture the pristine baseline (after async load or successful submit). */
  markPristine: () => void;
}

/** Guard browser Back / route navigation away from the current route. */
export function useLeaveGuard(opts: GuardOptions): GuardHandle;

/**
 * Context-aware guard: guards route navigation when on a route, or modal close
 * when inside a modal. Also wires `beforeunload`.
 */
export function useUnsavedGuard(opts: GuardOptions): GuardHandle;

/** Guard the closing of the host modal (re-exported from core). */
export function useCloseGuard(opts: GuardOptions): GuardHandle;
