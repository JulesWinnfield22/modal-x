// modal-x loaded twice. In Vite dev, app code can import a pre-bundled copy of
// the library while Modal.vue (not pre-bundlable) pulls in the raw store files,
// so the Back handler is installed by one copy and modals are opened/closed by
// the other. History bookkeeping must be shared, or each copy's own history
// moves look like user Backs to the other.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createFakeHistory, flush } from "./fakeHistory.js";

let history;
let app; // the copy app code imports (e.g. Vite's pre-bundle)
let listeners;

// Load a second, independent copy of the store modules. The modal stack is
// shared through globalThis; everything module-level is not.
async function loadCopy() {
  vi.resetModules();
  return {
    ...(await import("../store/modal.js")),
    ...(await import("../store/history.js")),
    ...(await import("../store/routerHistory.js")),
    ...(await import("../guards/shared.js")),
  };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {}); // fetchModal: "no modal found"
  history = createFakeHistory();
  Object.defineProperty(window, "history", { configurable: true, get: () => history });

  listeners = [];
  const add = window.addEventListener.bind(window);
  vi.spyOn(window, "addEventListener").mockImplementation((type, fn, opts) => {
    listeners.push([type, fn, opts]);
    add(type, fn, opts);
  });
  delete globalThis.__MODAL_X_STORE__;
});

afterEach(() => {
  for (const [type, fn, opts] of listeners) window.removeEventListener(type, fn, opts);
  vi.restoreAllMocks();
});

const names = () => app.useModal().modals.map((m) => m.modalToOpen);

function openGuarded(name) {
  const { openModal, onBeforeModalClose } = app.useModal();
  openModal(name);
  const confirm = app.makeConfirm({ confirmInHistory: true });
  onBeforeModalClose(() => confirm());
}

describe("popstate mode, Back handler installed by another copy", () => {
  beforeEach(async () => {
    const modalVue = await loadCopy(); // what Modal.vue imports
    modalVue.installHistoryManager(modalVue.useModal());
    app = await loadCopy();
  });

  it("X → Confirm leaves no history behind", async () => {
    openGuarded("Edit");
    app.useModal().closeModal(); // X → guard → confirmation (own entry)
    await flush();
    expect(names()).toEqual(["ConfirmationModal", "Edit"]);

    app.useModal().closeModal(true); // Confirm
    await flush();
    expect(names()).toEqual([]);
    expect(history.pointer).toBe(0);
  });

  it("closing a stacked modal doesn't also close its parent", async () => {
    app.useModal().openModal("Parent");
    app.useModal().openModal("Child");
    expect(history.pointer).toBe(2);

    app.useModal().closeModal();
    await flush();
    expect(names()).toEqual(["Parent"]);
    expect(history.pointer).toBe(1);
  });
});

describe("router mode, Back guard installed by another copy", () => {
  it("honors a navigation bypass set by the app's copy", async () => {
    let guard;
    const router = {
      beforeEach: (fn) => { guard = fn; },
      currentRoute: { value: { fullPath: "/", query: {} } },
      push: vi.fn(),
      back: vi.fn(),
      replace: vi.fn(),
    };
    const modalVue = await loadCopy();
    modalVue.setModalConfig({ router });
    modalVue.installRouterHistory(router, modalVue.useModal());
    app = await loadCopy();

    app.useModal().openModal("Edit");
    app.setRouterBypass(); // e.g. closeModal's own cleanup navigation
    expect(guard({ fullPath: "/other", query: {} })).toBe(true);
  });
});
