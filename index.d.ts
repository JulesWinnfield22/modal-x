import { Component, Plugin } from "vue";
import { FileNames, ModalRegistry } from "./FileNameEnums";

export interface ModalOptions {
  closeonEsc?: boolean;
  closeOnOverlayClick?: boolean;
  /** Opt this modal out of the browser-history integration (confirmations, spinners). */
  skipHistory?: boolean;
  /**
   * What a browser Back does while this modal's close-confirmation is showing.
   * `'stay'` (default) dismisses only the confirmation and keeps this modal open
   * (normal-modal feel; a later Back re-shows it); `'close'` closes both;
   * `'ignore'` keeps the confirmation open until a button is pressed. Overrides
   * the library-wide default. Applies to both router and popstate modes.
   */
  onDoubleBack?: "ignore" | "stay" | "close";
  [key: string]: any;
}

/** Options for `app.use(modal, options)`. */
export interface ModalPluginOptions {
  /**
   * A vue-router instance. When provided, modal-x runs in **router mode**:
   * opening a modal is a real `?_mx=<id>` query-param navigation and the browser
   * Back is handled through vue-router's own guards (reliable in vue-router apps).
   * Omit it in apps without vue-router — the popstate fallback is used instead.
   * Typed loosely to avoid a hard vue-router type dependency in the core package.
   */
  router?: any;
  /**
   * Library-wide default for what a 2nd Back does while a close-confirmation is
   * showing (applies to both router and popstate modes): `'stay'` (default —
   * dismiss only the confirmation, keep the modal open), `'close'` (close both),
   * `'ignore'` (keep the confirmation open until a button is pressed).
   */
  onDoubleBack?: "ignore" | "stay" | "close";
  /** Popstate fallback: same-URL history entries each non-transient modal pushes (default 6). */
  backCushion?: number;
  /** Log every history/Back decision to the console ("[modalx]"). Default false. */
  debugHistory?: boolean;
}

/** Merge library-wide modal defaults (usually done via the plugin options). */
export function setModalConfig(config: ModalPluginOptions): void;

/** Read the current library-wide modal config. */
export function getModalConfig(): Required<ModalPluginOptions>;

export type ModalCallback<T> = (response: T) => void;

/** Return `false` (or a Promise resolving to `false`) to veto/keep the modal open. */
export type BeforeCloseGuard = (response?: any) => boolean | Promise<boolean>;

export interface ModalItem<T = any, D = any> {
  id: string;
  modalToOpen: string;
  data: D;
  cb?: ModalCallback<T>;
  _resolve?: (res: T) => void;
  active: boolean;
  options?: ModalOptions;
  /** Guard consulted before this modal closes; set via onBeforeModalClose. */
  beforeClose?: BeforeCloseGuard;
  /** @internal true once a history entry was pushed for this modal. */
  _historyPushed?: boolean;
  /** @internal re-entrancy latch while a close is in progress. */
  _closing?: boolean;
}

export interface Spinner {
  id: string;
  modal: Component;
  group: string;
}

export interface FetchedModals {
  id: string;
  modal: Component;
}

/**
 * Composable to access the modal store.
 */
export function useModal(): {
  modals: ModalItem[];
  spinners: Spinner[];
  fetchedModals: FetchedModals[];
  modalName: { value: string };
  openModal: <K extends FileNames>(
    filename: K,
    data?: ModalRegistry[K]["Props"],
    cb?: ModalCallback<ModalRegistry[K]["ReturnType"]>,
    options?: ModalOptions,
  ) => Promise<ModalRegistry[K]["ReturnType"]>;
  closeModal: (
    response?: any,
    sendResponse?: boolean,
    opts?: { fromPopstate?: boolean; force?: boolean },
  ) => Promise<boolean>;
  forceCloseModal: (response?: any, sendResponse?: boolean) => Promise<boolean>;
  onBeforeModalClose: (fn: BeforeCloseGuard) => () => void;
  getModal: (name: FileNames | string) => ModalItem | undefined;
  loadSpinners: (modal: any, name: string, group?: string) => Promise<void>;
  loadModal: (modal: any, name: string, render?: boolean) => Promise<void>;
  loadGlobalSpinner: (modal: any, name: string) => Promise<void>;
};

/**
 * Retrieves a modal component instance by its name.
 */
export function getModal(filename: FileNames | string): ModalItem | undefined;

/**
 * Opens a modal component and returns a promise that resolves when the modal is closed.
 */
export function openModal<K extends FileNames>(
  filename: K,
  data?: ModalRegistry[K]["Props"],
  cb?: ModalCallback<ModalRegistry[K]["ReturnType"]>,
  options?: ModalOptions,
): Promise<ModalRegistry[K]["ReturnType"]>;

/**
 * Closes the topmost open modal, running its `beforeClose` guard first.
 * Resolves to whether the modal actually closed.
 */
export function closeModal(response?: any, sendResponse?: boolean): Promise<boolean>;

/**
 * Closes the topmost open modal WITHOUT running its `beforeClose` guard.
 */
export function forceCloseModal(response?: any, sendResponse?: boolean): Promise<boolean>;

/**
 * Registers a `beforeClose` guard on the current topmost modal (call during the
 * modal content's setup). The guard runs for every close path — X, overlay, ESC,
 * browser Back, and programmatic close. Return `false` to keep the modal open.
 * Returns an unregister function.
 */
export function onBeforeModalClose(fn: BeforeCloseGuard): () => void;

/** Dirty-diff helpers (also usable standalone). */
export { normalizeForCompare, hashForCompare, isDirty } from "./dirty";

export interface CloseGuardOptions {
  track?: () => any;
  pristine?: () => any;
  isDirty?: () => boolean;
  onConfirm?: (signal: AbortSignal) => boolean | Promise<boolean>;
  modal?: string;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  enabled?: () => boolean;
  isSubmitting?: () => boolean;
  beforeUnload?: boolean;
  /** Double-back policy for this modal (default 'stay'). */
  onDoubleBack?: "ignore" | "stay" | "close";
}

/**
 * Guard the closing of the host modal (runs for X / overlay / ESC / Back /
 * programmatic close) when tracked values are dirty. Router-free. For route
 * navigation guarding use `useLeaveGuard` / `useUnsavedGuard` from
 * `@customizer/modal-x/router`.
 */
export function useCloseGuard(opts: CloseGuardOptions): {
  isDirty: () => boolean;
  markPristine: () => void;
};

/**
 * Constant object for all modal names (generated by Vite plugin).
 */
export const MODALS: typeof import("./FileNameEnums").MODALS;

export const ModalParent: Component;

declare const modal: Plugin;
export default modal;
