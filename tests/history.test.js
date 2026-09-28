// Popstate-mode (no router) browser-history integration: a closed modal must
// leave no history entries behind, so the next Back goes to the real previous
// page.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// A minimal model of the browser's session history: an entry stack plus a
// pointer. Traversals are async like the real thing and fire `popstate`.
function createFakeHistory() {
  const entries = [{ state: { page: "base" } }];
  let pointer = 0;
  const traverse = (delta) =>
    setTimeout(() => {
      const next = Math.min(entries.length - 1, Math.max(0, pointer + delta));
      if (next === pointer) return;
      pointer = next;
      window.dispatchEvent(new PopStateEvent("popstate", { state: entries[pointer].state }));
    }, 0);
  return {
    get state() { return entries[pointer].state; },
    get length() { return entries.length; },
    /** Index of the current entry; 0 is the page the modals were opened on. */
    get pointer() { return pointer; },
    pushState(state) {
      entries.splice(pointer + 1);
      entries.push({ state });
      pointer++;
    },
    replaceState(state) { entries[pointer] = { state }; },
    go: (delta = 0) => traverse(delta),
    back: () => traverse(-1),
    forward: () => traverse(1),
  };
}

const flush = async (rounds = 8) => {
  for (let i = 0; i < rounds; i++) await new Promise((r) => setTimeout(r, 0));
};

let history;
let api;
let listeners;

beforeEach(async () => {
  vi.spyOn(console, "log").mockImplementation(() => {}); // fetchModal: "no modal found"

  history = createFakeHistory();
  Object.defineProperty(window, "history", { configurable: true, get: () => history });

  // Track listeners so each test's popstate manager is removed afterwards.
  listeners = [];
  const add = window.addEventListener.bind(window);
  vi.spyOn(window, "addEventListener").mockImplementation((type, fn, opts) => {
    listeners.push([type, fn, opts]);
    add(type, fn, opts);
  });

  delete globalThis.__MODAL_X_STORE__;
  vi.resetModules();
  const { useModal } = await import("../store/modal.js");
  const { installHistoryManager } = await import("../store/history.js");
  const { makeConfirm } = await import("../guards/shared.js");
  const store = useModal();
  installHistoryManager(store);
  api = { ...store, makeConfirm };
});

afterEach(() => {
  for (const [type, fn, opts] of listeners) window.removeEventListener(type, fn, opts);
  vi.restoreAllMocks();
});

const names = () => api.modals.map((m) => m.modalToOpen);

// Mirrors useCloseGuard with a dirty form: closing asks via the built-in
// confirmation, which (in popstate mode) owns its own history entry.
function openGuarded(name, options) {
  api.openModal(name, null, undefined, options);
  const confirm = api.makeConfirm({ confirmInHistory: true });
  api.onBeforeModalClose(() => confirm());
}

describe("popstate mode: a closed modal leaves no history behind", () => {
  it("Back → Confirm closes both and returns to the page", async () => {
    openGuarded("Edit");
    expect(history.pointer).toBe(1);

    history.back();
    await flush();
    expect(names()).toEqual(["ConfirmationModal", "Edit"]);

    api.closeModal(true); // the confirmation's Confirm button
    await flush();
    expect(names()).toEqual([]);
    expect(history.pointer).toBe(0); // next Back leaves the page — no modal history
  });

  it("Back → Cancel keeps the modal with exactly one entry", async () => {
    openGuarded("Edit");
    history.back();
    await flush();

    api.closeModal(false); // Cancel
    await flush();
    expect(names()).toEqual(["Edit"]);
    expect(history.pointer).toBe(1);
  });

  it("Back → Back with 'stay' dismisses only the confirmation", async () => {
    openGuarded("Edit", { onDoubleBack: "stay" });
    history.back();
    await flush();

    history.back();
    await flush();
    expect(names()).toEqual(["Edit"]);
    expect(history.pointer).toBe(1);
  });

  it("Back → Back with 'close' closes both and returns to the page", async () => {
    openGuarded("Edit", { onDoubleBack: "close" });
    history.back();
    await flush();

    history.back();
    await flush();
    expect(names()).toEqual([]);
    expect(history.pointer).toBe(0);
  });

  it("Back → Back with 'ignore' keeps the confirmation; Confirm then returns to the page", async () => {
    openGuarded("Edit", { onDoubleBack: "ignore" });
    history.back();
    await flush();

    history.back();
    await flush();
    expect(names()).toEqual(["ConfirmationModal", "Edit"]);
    expect(history.pointer).toBe(1);

    api.closeModal(true);
    await flush();
    expect(names()).toEqual([]);
    expect(history.pointer).toBe(0);
  });

  it("an unguarded modal closed by Back leaves nothing behind", async () => {
    api.openModal("Plain");
    history.back();
    await flush();
    expect(names()).toEqual([]);
    expect(history.pointer).toBe(0);
  });

  it("button close → Confirm removes both entries", async () => {
    openGuarded("Edit");
    api.closeModal(); // X button → guard → confirmation
    await flush();
    expect(names()).toEqual(["ConfirmationModal", "Edit"]);
    expect(history.pointer).toBe(2);

    api.closeModal(true);
    await flush();
    expect(names()).toEqual([]);
    expect(history.pointer).toBe(0);
  });

  it("repeated open → Back → Confirm cycles don't accumulate entries", async () => {
    for (let i = 0; i < 3; i++) {
      openGuarded("Edit");
      history.back();
      await flush();
      api.closeModal(true);
      await flush();
      expect(history.pointer).toBe(0);
    }
    expect(history.length).toBeLessThanOrEqual(2);
  });
});
