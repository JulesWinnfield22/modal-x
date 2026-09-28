// Router-mode browser-history integration, against a real vue-router on jsdom's
// session history: after a Back-close, the next Back must go to the real
// previous page — never onto a stale `?_mx` modal entry (or a left form page).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import { createRouter, createWebHistory, RouterView } from "vue-router";

const flush = async (rounds = 15) => {
  for (let i = 0; i < rounds; i++) await new Promise((r) => setTimeout(r, 0));
};

const Page = defineComponent({ render: () => h("div") });

let router;
let routerHistory;
let api;
let app;

beforeEach(async () => {
  vi.spyOn(console, "log").mockImplementation(() => {}); // fetchModal: "no modal found"
  // Boot every test on "/" — never on a (guarded) page a previous test ended on.
  window.history.replaceState(null, "", "/");

  delete globalThis.__MODAL_X_STORE__;
  vi.resetModules();
  const modal = await import("../store/modal.js");
  const { installRouterHistory } = await import("../store/routerHistory.js");
  const { makeConfirm } = await import("../guards/shared.js");
  const { useLeaveGuard } = await import("../router/index.js");

  // A route whose form is always dirty, guarded against leaving.
  const Form = defineComponent({
    setup() {
      useLeaveGuard({ isDirty: () => true, beforeUnload: false });
      return () => h("form");
    },
  });

  routerHistory = createWebHistory();
  router = createRouter({
    history: routerHistory,
    routes: [
      { path: "/", component: Page },
      { path: "/start", component: Page },
      { path: "/other", component: Page },
      { path: "/form", component: Form },
    ],
  });
  modal.setModalConfig({ router });
  const store = modal.useModal();
  installRouterHistory(router, store);
  api = { ...store, makeConfirm };

  app = createApp({ render: () => h(RouterView) });
  app.use(router);
  app.mount(document.createElement("div"));
  await router.isReady();
});

afterEach(() => {
  app.unmount();
  routerHistory.destroy();
  vi.restoreAllMocks();
});

const names = () => api.modals.map((m) => m.modalToOpen);
const current = () => router.currentRoute.value.fullPath;

// Mirrors useCloseGuard with a dirty form: closing asks via the built-in
// confirmation (transient in router mode).
function openGuarded(name, options) {
  api.openModal(name, null, undefined, options);
  const confirm = api.makeConfirm({ confirmInHistory: true });
  api.onBeforeModalClose(() => confirm());
}

// Start every scenario on "/", with "/start" as the real previous page.
async function onPageWithHistory() {
  await router.push("/start");
  await router.push("/");
}

describe("router mode: a closed modal leaves no ?_mx entry behind", () => {
  it("Back → Confirm closes both; the next Back goes to the real previous page", async () => {
    await onPageWithHistory();
    openGuarded("Edit");
    await flush();
    expect(router.currentRoute.value.query._mx).toBeTruthy();

    router.back(); // browser Back
    await flush();
    expect(names()).toEqual(["ConfirmationModal", "Edit"]);
    expect(router.currentRoute.value.query._mx).toBeTruthy(); // Back blocked, URL kept

    api.closeModal(true); // Confirm
    await flush();
    expect(names()).toEqual([]);
    expect(current()).toBe("/");

    router.back(); // press Back again
    await flush();
    expect(current()).toBe("/start"); // not "/?_mx=…"
  });

  it("Back → Cancel keeps the modal and its ?_mx entry", async () => {
    await onPageWithHistory();
    openGuarded("Edit");
    await flush();

    router.back();
    await flush();
    api.closeModal(false); // Cancel
    await flush();
    expect(names()).toEqual(["Edit"]);
    expect(router.currentRoute.value.query._mx).toBeTruthy();
  });

  it("an unguarded modal closed by Back leaves nothing behind", async () => {
    await onPageWithHistory();
    api.openModal("Plain");
    await flush();

    router.back();
    await flush();
    expect(names()).toEqual([]);
    expect(current()).toBe("/");

    router.back();
    await flush();
    expect(current()).toBe("/start");
  });

  it("2nd Back with 'close' closes both; the next Back goes to the real previous page", async () => {
    await onPageWithHistory();
    openGuarded("Edit", { onDoubleBack: "close" });
    await flush();

    router.back();
    await flush();
    router.back();
    await flush();
    expect(names()).toEqual([]);
    expect(current()).toBe("/");

    router.back();
    await flush();
    expect(current()).toBe("/start");
  });

  it("2nd Back with 'stay' dismisses only the confirmation", async () => {
    await onPageWithHistory();
    openGuarded("Edit", { onDoubleBack: "stay" });
    await flush();

    router.back();
    await flush();
    router.back();
    await flush();
    expect(names()).toEqual(["Edit"]);
    expect(router.currentRoute.value.query._mx).toBeTruthy();
  });

  it("a link away → Confirm replaces the ?_mx entry with the destination", async () => {
    await onPageWithHistory();
    openGuarded("Edit");
    await flush();

    router.push("/other"); // e.g. a RouterLink inside the modal
    await flush();
    expect(names()).toEqual(["ConfirmationModal", "Edit"]);

    api.closeModal(true);
    await flush();
    expect(current()).toBe("/other");

    router.back();
    await flush();
    expect(current()).toBe("/"); // the page under the modal, not "/?_mx=…"
  });
});

describe("router mode: a guarded modal closed by a button", () => {
  // Opens a guarded modal and returns its result promise. `guard` stands in for
  // useCloseGuard; by default it always asks (a dirty form).
  function openWith(name, guard, options) {
    const result = api.openModal(name, null, undefined, options);
    const confirm = api.makeConfirm({ confirmInHistory: true });
    api.onBeforeModalClose(() => (guard ? guard(confirm) : confirm()));
    return result;
  }

  it("resolves the opener with the response when the guard allows", async () => {
    await onPageWithHistory();
    const result = openWith("Edit", () => true);
    await flush();

    api.closeModal({ amount: 5 }); // e.g. a submit handler closing with its result
    await flush();
    expect(await result).toEqual({ amount: 5 });
    expect(names()).toEqual([]);
    expect(current()).toBe("/");

    router.back();
    await flush();
    expect(current()).toBe("/start");
  });

  it("runs the guard when closeModal is called, not after", async () => {
    await onPageWithHistory();
    let submitting = true; // a form's isSubmitting, true only inside its handler
    const result = openWith("Edit", (confirm) => (submitting ? true : confirm()));
    await flush();

    api.closeModal(true);
    submitting = false; // the submit handler returns right after closing
    await flush();
    expect(names()).toEqual([]); // no "discard changes?" after a successful submit
    expect(await result).toBe(true);
  });

  it("X on a dirty modal → Confirm resolves with the close's response", async () => {
    await onPageWithHistory();
    const result = openWith("Edit");
    await flush();

    api.closeModal("closed-by-x");
    await flush();
    expect(names()).toEqual(["ConfirmationModal", "Edit"]);

    api.closeModal(true); // Confirm
    await flush();
    expect(names()).toEqual([]);
    expect(await result).toBe("closed-by-x");
    expect(current()).toBe("/");

    router.back();
    await flush();
    expect(current()).toBe("/start");
  });

  it("X on a dirty modal → Cancel keeps the modal and its ?_mx entry", async () => {
    await onPageWithHistory();
    openWith("Edit");
    await flush();

    api.closeModal();
    await flush();
    api.closeModal(false); // Cancel
    await flush();
    expect(names()).toEqual(["Edit"]);
    expect(router.currentRoute.value.query._mx).toBeTruthy();
  });

  it("X → Back while asking, with 'stay', dismisses only the confirmation", async () => {
    await onPageWithHistory();
    openWith("Edit", undefined, { onDoubleBack: "stay" });
    await flush();

    api.closeModal();
    await flush();
    router.back();
    await flush();
    expect(names()).toEqual(["Edit"]);
    expect(router.currentRoute.value.query._mx).toBeTruthy();
  });

  it("X → Back while asking, with 'close', closes both and leaves no ?_mx entry", async () => {
    await onPageWithHistory();
    const result = openWith("Edit", undefined, { onDoubleBack: "close" });
    await flush();

    api.closeModal("closed-by-x");
    await flush();
    router.back();
    await flush();
    expect(names()).toEqual([]);
    expect(await result).toBe("closed-by-x");
    expect(current()).toBe("/");

    router.back();
    await flush();
    expect(current()).toBe("/start");
  });
});

describe("route-leave guard (useLeaveGuard)", () => {
  it("Back → Confirm leaves; the next Back goes further back, not to the form", async () => {
    await router.push("/");
    await router.push("/start");
    await router.push("/form");

    router.back(); // Back off the dirty form
    await flush();
    expect(names()).toEqual(["ConfirmationModal"]);
    expect(current()).toBe("/form"); // blocked while asking

    api.closeModal(true); // Confirm leaving
    await flush();
    expect(current()).toBe("/start");

    router.back();
    await flush();
    expect(current()).toBe("/"); // not back onto "/form"
  });

  it("a link away → Confirm navigates forward; Back returns to the form", async () => {
    await router.push("/start");
    await router.push("/form");

    router.push("/other");
    await flush();
    api.closeModal(true);
    await flush();
    expect(current()).toBe("/other");

    router.back(); // standard link semantics: the form is the previous page
    await flush();
    expect(current()).toBe("/form");
  });
});
