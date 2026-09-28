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

import { dlog } from "./modal.js";

let installed = false;
let ignorePops = 0;
let closingViaBack = false;

/** Called by closeModal before it pops one of our own entries via history.go(-1). */
export function markIgnoredPop() {
  ignorePops++;
}

/**
 * Install the single popstate listener. `api` must expose the reactive `modals`
 * stack and the (options-aware) `closeModal`. Safe to call more than once.
 *
 * @param {{ modals: any[], closeModal: (res?: any, send?: boolean, opts?: object) => Promise<boolean> }} api
 */
export function installHistoryManager(api) {
  if (installed || typeof window === "undefined") return;
  installed = true;

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
      "popstate: ignorePops=", ignorePops,
      "closingViaBack=", closingViaBack,
      "modals=", modals.map((m) => m.modalToOpen),
      "len=", window.history.length,
      "state=", window.history.state,
    );

    // 1. One of our own programmatic history.go(-1) calls — consume and ignore.
    if (ignorePops > 0) {
      ignorePops--;
      dlog("  branch=ignorePop -> now", ignorePops);
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
    if (closingViaBack) {
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

    closingViaBack = true;
    let closed = false;
    try {
      closed = await closeModal(undefined, true, { fromPopstate: true });
    } finally {
      closingViaBack = false;
    }
    dlog("  firstBack: closeModal ->", closed);

    // Vetoed → the modal stays open: restore the entry the Back consumed.
    // Closed → its entry is already gone; nothing is left behind.
    if (!closed) rearm();
  });
}
