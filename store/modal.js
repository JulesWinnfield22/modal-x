import {
  reactive,
  shallowRef,
  watch,
  defineAsyncComponent,
  nextTick,
  h,
  ref,
} from "vue";
import ModalParent from '../ModalParent.vue'
import Spinner from "../Spinner.vue";
import { markIgnoredPop } from "./history.js";
import { setRouterBypass } from "./routerHistory.js";

// ── Global Singleton State ──
// We use globalThis to ensure that even if the library is imported through different paths
// (e.g., source vs bundled, or relative vs node_modules), there is only ONE reactive state.
const STORE_KEY = "__MODAL_X_STORE__";

if (!globalThis[STORE_KEY]) {
  globalThis[STORE_KEY] = {
    modals: reactive([]),
    fetchedModals: shallowRef([]),
    spinners: shallowRef([]),
    globalSpinner: shallowRef(),
    modalName: ref(""),
    // Library-wide defaults, set at plugin registration (app.use(modal, {...}))
    // and overridable per modal via openModal(..., options).
    //   onDoubleBack: what a browser Back does while a modal's own close
    //   confirmation is showing —
    //     'ignore' (default): absorb Back, keep the confirmation open; the user
    //                resolves it via its Cancel/Confirm buttons. Most robust.
    //     'stay':   the Back closes only the confirmation; the edited modal stays.
    //     'close':  the Back closes the confirmation AND the edited modal.
    //   backCushion: how many same-URL history entries each non-transient modal
    //   pushes. A cushion >1 keeps a rapid *double-click* of the browser Back
    //   button (two history traversals the browser batches before our popstate
    //   handler can re-arm) from overshooting past the app and unloading it.
    //   debugHistory: when true, logs every history/back decision to the console
    //   (prefixed "[modalx]") for diagnosing browser Back behavior. Off by default.
    //   router: (optional) a vue-router instance. When provided, modal-open is a
    //   real (query-param) route change and the browser Back is handled through
    //   vue-router's own navigation guards — reliable in apps where fighting
    //   popstate directly is flaky. Without it, the same-URL popstate scheme runs.
    config: { onDoubleBack: "stay", backCushion: 6, debugHistory: false, router: null },
  };
}

/** Console tracer, active only when config.debugHistory is on. */
export function dlog(...args) {
  if (globalThis[STORE_KEY]?.config?.debugHistory) {
    console.log("[modalx]", ...args);
  }
}

const {
  modals,
  fetchedModals,
  spinners,
  globalSpinner,
  modalName,
} = globalThis[STORE_KEY];

/**
 * Merge library-wide default options. Called by the plugin install with the
 * options passed to `app.use(modal, options)`.
 * @param {{ onDoubleBack?: 'stay' | 'close' }} [partial]
 */
export function setModalConfig(partial) {
  if (partial && typeof partial === "object") {
    Object.assign(globalThis[STORE_KEY].config, partial);
  }
}

/** @returns {{ onDoubleBack: 'stay' | 'close' }} the current library-wide config. */
export function getModalConfig() {
  return globalThis[STORE_KEY].config;
}

/**
 * Opens a modal and returns a Promise that resolves when it is closed.
 * Backward-compatible: an optional callback (3rd arg) is still supported.
 *
 * @param {string} modalToOpen - Modal file name (without extension).
 * @param {*} [data] - Data to pass to the modal component.
 * @param {Function} [cb] - Legacy callback (still supported for backward compat).
 * @param {object} [options] - Modal options (closeonEsc, closeOnOverlayClick).
 * @returns {Promise<any>} Resolves with the value passed to closeModal().
 */
function openModal(modalToOpen, data, cb, options) {
  return new Promise((resolve) => {
    modals.forEach((modal) => {
      modal.active = false;
    });

    const item = {
      id: Math.random().toString(36).substring(2, 9),
      modalToOpen,
      data,
      cb,           // keep legacy callback support
      _resolve: resolve,  // Promise resolve
      active: true,
      options,
    };

    modals.unshift(item);

    // Push a hidden, SAME-URL history entry so the browser Back button closes
    // this modal (via its beforeClose guard). Transient modals — confirmations,
    // spinners — opt out with `{ skipHistory: true }`.
    //
    // Reuse the CURRENT history.state (don't invent our own) so we don't clobber
    // an SPA router's bookkeeping — e.g. Vue Router keeps a `position` counter in
    // history.state and miscomputes its back/forward delta if we drop it, which
    // makes a later Back over-navigate past the underlying page.
    const router = getModalConfig().router;
    if (router && !options?.skipHistory) {
      // ROUTER MODE: opening a modal is a real (query-param) route change, so the
      // browser Back becomes a genuine vue-router navigation we intercept via a
      // global guard (see store/routerHistory.js). Cooperates with vue-router
      // instead of fighting popstate.
      const cur = router.currentRoute.value;
      item._mxRouted = true;
      item._mxId = item.id;
      router.push({ query: { ...cur.query, _mx: item.id } });
      dlog("openModal", modalToOpen, "(router) query._mx=", item.id);
    } else if (typeof window !== "undefined" && !options?.skipHistory) {
      // POPSTATE FALLBACK (no router): same-URL cushion scheme.
      const depth = Math.max(1, options?.historyDepth ?? getModalConfig().backCushion ?? 1);
      for (let i = 0; i < depth; i++) {
        window.history.pushState(window.history.state, "");
      }
      item._historyPushed = true;
      item._historyDepth = depth;
      dlog("openModal", modalToOpen, "pushed cushion", depth, "-> len", window.history.length);
    } else {
      dlog("openModal", modalToOpen, options?.skipHistory ? "(skipHistory)" : "(no window)");
    }
  });
}

/**
 * Closes the topmost modal, running its `beforeClose` guard first.
 *
 * The guard (registered via {@link onBeforeModalClose}) may return a boolean or
 * a Promise<boolean>: a falsy result vetoes the close (the modal stays open).
 * This is the single interception point for every close path — X button,
 * overlay click, ESC, browser Back, and programmatic close.
 *
 * @param {*} [response] - Data to return to the opener.
 * @param {boolean} [sendResponse=true] - If false, resolves with undefined.
 * @param {{ fromPopstate?: boolean, force?: boolean }} [opts]
 *   - `fromPopstate`: the browser Back already popped the history entry, so
 *     don't pop again (the history manager handles it).
 *   - `force`: skip the `beforeClose` guard entirely.
 * @returns {Promise<boolean>} Whether the modal actually closed.
 */
async function closeModal(response, sendResponse = true, opts = {}) {
  const { fromPopstate = false, force = false, fromRoute = false } = opts;

  const modal = modals[0];
  dlog("closeModal", modal?.modalToOpen, "fromPopstate=", fromPopstate, "force=", force, "fromRoute=", fromRoute, "stack=", modals.map((m) => m.modalToOpen));
  if (!modal) return false;
  if (modal._closing) return false;      // guard against re-entrant close

  // ROUTER MODE: a GUARDED routed modal being closed by a button/X/ESC/overlay
  // (not via the router guard, not forced) is routed THROUGH vue-router so the
  // browser Back and the button close share one path (the beforeEach guard runs
  // the confirmation). Prevents a stale confirmation-close from "unrouting" it.
  if (!fromRoute && !force && modal._mxRouted && typeof modal.beforeClose === "function") {
    const router = getModalConfig().router;
    if (router) {
      dlog("closeModal: delegating guarded routed close to router.back()");
      router.back(); // → beforeEach runs the guard uniformly
      return false;
    }
  }

  modal._closing = true;

  // beforeClose lifecycle hook — lets a modal veto or defer its own close.
  if (!force && typeof modal.beforeClose === "function") {
    let allow;
    try {
      allow = await modal.beforeClose(response);
    } catch {
      allow = false;
    }
    if (!allow) {
      modal._closing = false;
      return false;
    }
  }

  // Remove this SPECIFIC modal by identity — an async guard may have opened and
  // closed a transient modal (e.g. a confirmation) during the await, so the
  // topmost is no longer guaranteed to be `modal`.
  const idx = modals.indexOf(modal);
  if (idx !== -1) modals.splice(idx, 1);
  modals.length && (modals[0].active = true);

  // Resolve the Promise (always resolve to avoid hanging)
  if (modal._resolve) {
    modal._resolve(sendResponse ? response : undefined);
  }

  // Legacy callback support
  if (sendResponse && ![undefined, null].includes(response) && modal.cb) {
    modal.cb(response);
  }

  // History cleanup.
  if (modal._mxRouted) {
    // ROUTER MODE: drop this modal's `?_mx` route entry — unless the router guard
    // is already navigating (fromRoute), in which case it owns the navigation.
    if (!fromRoute) {
      const router = getModalConfig().router;
      if (router) {
        dlog("closeModal cleanup (router): back() to drop ?_mx");
        setRouterBypass();
        router.back();
      }
    }
  } else if (modal._historyPushed && !fromPopstate && typeof window !== "undefined") {
    // POPSTATE FALLBACK: pop our same-URL entries. `history.go(-n)` fires a single
    // popstate, so one markIgnoredPop.
    const depth = modal._historyDepth || 1;
    dlog("closeModal cleanup: go(-", depth, ") len", window.history.length);
    markIgnoredPop();
    window.history.go(-depth);
  }

  dlog("closeModal done", modal.modalToOpen, "remaining stack=", modals.map((m) => m.modalToOpen));
  return true;
}

/**
 * Closes the topmost modal WITHOUT running its `beforeClose` guard. Handy for
 * intentional teardown (e.g. after a successful submit) where a dirty-form
 * confirmation would be inappropriate.
 */
function forceCloseModal(response, sendResponse = true) {
  return closeModal(response, sendResponse, { force: true });
}

/**
 * Registers `fn` as the CURRENT topmost modal's beforeClose guard. Call it from
 * a modal's content component during setup. `fn` returns boolean | Promise<boolean>
 * (true = allow the close). Returns an unregister function.
 */
function onBeforeModalClose(fn) {
  const modal = modals[0];
  if (modal) modal.beforeClose = fn;
  return () => {
    if (modal) delete modal.beforeClose;
  };
}

function getModal(name) {
  return modals.find((modal) => modal.modalToOpen == name);
}

async function loadModal(modal, name, render = true) {
  if (
    fetchedModals.value.find((mod) =>
      [name, modal.__name?.match(/.*\/(.+)\.(amdl|mdl)\.vue$/)?.[1]].includes(mod.id)
    )
  ) {
    return;
  }

  let com;
  if (render) {
    com = await modal.__asyncLoader();
  } else {
    com = modal;
  }
  fetchedModals.value = [
    {
      id: name || "",
      modal: h(ModalParent, {
        name
      }, () => {
        return h(com, {
          data: getModal(name)?.data,
          close: (res) => closeModal(res),
          ...(`${getModal(name)?.data}` == "[object Object]" ? getModal(name)?.data : {})
        })
      }),
    },
    ...fetchedModals.value,
  ];
}

async function loadSpinners(modal, name, group, render = true) {
  if (
    spinners.value.find((mod) => {
      return [name, modal.__name?.match(/.*\/(.+)\.s\.vue$/)?.[1]?.split('.')?.[0]].includes(
        mod.id
      );
    })
  )
    return;
  
  let com;
  if (render) {
    com = await modal.__asyncLoader();
  } else {
    com = modal;
  }

  spinners.value = [
    {
      id: name || modal.__name?.match(/.*\/(.+)\.s\.vue$/)?.[1] || "",
      modal: com,
      group
    },
    ...spinners.value,
  ];
}

async function loadGlobalSpinner(modal, name, render = true) {
  let com;
  if (render) {
    com = await modal.__asyncLoader();
  } else {
    com = modal;
  }
  globalSpinner.value = {
    id: name || modal.__name?.match(/.*\/(.+)\.g\.vue$/)?.[1] || "",
    modal: com,
  };
}

function fetchModal(name) {
  if (
    fetchedModals.value.find(
      (modal) => modal.id == `${name}.mdl` || modal.id == name
    )
  )
    return;

  const asyncModules = import.meta.glob([
    '/**/*.amdl.vue',
    '/**/*.mdl.vue',
    '!**/node_modules/**',
  ]);

  let mods = { ...asyncModules };

  let group;
  const modalPath = Object.keys(mods).find((module) => {
    const filename = module.split('/').pop();
    const nameParts = filename.replace(/\.(amdl|mdl)\.vue$/, '').split('.');
    const fileName = nameParts[0];

    if (fileName === name) {
      group = nameParts[1]; // Extract group if it exists (e.g. AddUser.user.amdl.vue)
      return true;
    }
    return false;
  });

  if (!modalPath)
    return console.log(
      `%cno modal found with name [${name}]`,
      "font-size: 14px; color: red;"
    );

  const spinnerModal = spinners.value.find((m) => m.id == name || (group && m?.group == group))?.modal;
  let modal = defineAsyncComponent({
    loader: () => mods[modalPath](),
    loadingComponent: spinnerModal || globalSpinner.value?.modal || Spinner,
    delay: 0,
  });

  loadModal(modal, name, false);
}

watch(modals, (modals) => {
  if(modals?.[0]) fetchModal(modals?.[0]?.modalToOpen);
});

/**
 * Composable that returns all modal state and actions.
 * Drop-in replacement for the old Pinia-based useModal().
 */
export function useModal() {
  return {
    modals,
    loadSpinners,
    spinners,
    fetchedModals,
    openModal,
    closeModal,
    forceCloseModal,
    onBeforeModalClose,
    getModal,
    loadModal,
    loadGlobalSpinner,
    modalName,
    setModalConfig,
    getModalConfig,
  };
}
