// Browser-history integration for modal-x.
//
// Each non-transient modal pushes ONE hidden, SAME-URL history entry when it
// opens, so the browser Back button closes the topmost modal through its
// `beforeClose` guard instead of navigating the app away.
//
// `popstate` is NOT cancelable — the browser moves the history pointer before
// the event fires — so we can't "hold" Back. Because every entry shares the
// current URL, a pop is only a *position* change (the URL bar never moves). A
// Back consumes the top modal's entry; if that modal ends up staying open (the
// close was vetoed, or its confirmation is kept) we re-arm exactly one entry.
// So every open modal owns exactly one entry and a closed modal owns none.

import { dlog, sharedState } from "./modal.js";

// Shared across every loaded copy of modal-x: a pop made by one copy's closeModal
// must be recognised by the handler another copy installed.
const state = () =>
  sharedState("popstate", () => ({ installed: false, ignorePops: 0, closingViaBack: false }));

/** Called by closeModal before it pops one of our own entries via history.go(-1). */
export function markIgnoredPop() {
  state().ignorePops++;
}

/**
 * Install the single popstate listener. `api` must expose the reactive `modals`
 * stack and the (options-aware) `closeModal`. Safe to call more than once.
 *
 * @param {{ modals: any[], closeModal: (res?: any, send?: boolean, opts?: object) => Promise<boolean> }} api
 */
export function installHistoryManager(api) {
  if (typeof window === "undefined") return;
  const s = state();
  if (s.installed) return;
  s.installed = true;

  const { modals, closeModal, getModalConfig } = api;

  // Resolve the double-back policy for the modal being guarded: its own
  // `options.onDoubleBack` wins, else the library-wide default, else 'stay'.
  const resolveDoubleBack = (modal) =>
    modal?.options?.onDoubleBack ||
    getModalConfig?.().onDoubleBack ||
    "stay";

  // Restore the single same-URL entry a Back consumed, for a modal that stays
  // open. Reuse the current history.state so we don't disturb an SPA router's
  // position tracking (see the note in store/modal.js openModal).
  const rearm = () => {
    window.history.pushState(window.history.state, "");
    dlog("  re-armed one entry -> len", window.history.length);
  };

  window.addEventListener("popstate", async () => {
    dlog(
      "popstate: ignorePops=", s.ignorePops,
      "closingViaBack=", s.closingViaBack,
      "modals=", modals.map((m) => m.modalToOpen),
      "len=", window.history.length,
      "state=", window.history.state,
    );

    // 1. One of our own programmatic history.go(-1) calls — consume and ignore.
    if (s.ignorePops > 0) {
      s.ignorePops--;
      dlog("  branch=ignorePop -> now", s.ignorePops);
      return;
    }

    // 2. Back pressed AGAIN while a Back-triggered confirmation is showing. This
    //    Back consumed the confirmation's own entry. Policy (per-modal or global):
    //    - 'close': proceed — close the confirmation as "confirm", cascading to
    //      close the edited modal (whose entry the 1st Back already consumed).
    //    - 'stay' (default): cancel the confirmation; the edited modal stays, and
    //      the pending first-Back handler re-arms its entry on the veto.
    //    - 'ignore': keep the confirmation open — re-arm its consumed entry.
    //    fromPopstate on closeModal → don't pop the (already-popped) entry.
    if (s.closingViaBack) {
      const edited = modals[1] || modals[0]; // the guarded modal (confirm is [0])
      const policy = resolveDoubleBack(edited);
      dlog("  branch=re-entrant(2nd back) policy=", policy, "confirm=", modals[0]?.modalToOpen, "edited=", edited?.modalToOpen);
      if (policy === "close") {
        closeModal(true, true, { fromPopstate: true });
      } else if (policy === "stay") {
        closeModal(false, true, { fromPopstate: true });
      } else {
        rearm();
      }
      return;
    }

    // 3. First Back with a modal open — the browser already popped its entry.
    const top = modals[0];
    if (!top || top.options?.skipHistory) {
      dlog("  branch=noop (no modal or skipHistory) top=", top?.modalToOpen);
      return;
    }
    dlog("  branch=firstBack top=", top.modalToOpen);

    s.closingViaBack = true;
    let closed = false;
    try {
      closed = await closeModal(undefined, true, { fromPopstate: true });
    } finally {
      s.closingViaBack = false;
    }
    dlog("  firstBack: closeModal ->", closed);

    // Vetoed → the modal stays open: restore the entry the Back consumed.
    // Closed → its entry is already gone; nothing is left behind.
    if (!closed) rearm();
  });
}
