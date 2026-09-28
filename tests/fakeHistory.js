// A minimal model of the browser's session history: an entry stack plus a
// pointer. Traversals are async like the real thing and fire `popstate`.
export function createFakeHistory() {
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

export const flush = async (rounds = 8) => {
  for (let i = 0; i < rounds; i++) await new Promise((r) => setTimeout(r, 0));
};
