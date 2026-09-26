// Framework-agnostic dirty-diff helpers for comparing a pristine snapshot of
// form values against their current state. Extracted so any consumer (or the
// guard composables) can reuse the exact same normalization the app relied on.
//
// No Vue / vue-router imports — safe for every consumer.

/**
 * Stable string hash of a value for equality comparison. Handles File, Date,
 * arrays and plain objects (keys sorted so key order doesn't register as a
 * change). `fakeId` keys are ignored — dynamic array-row inputs seed a fresh
 * `fakeId` per row on mount, which would otherwise read as a change.
 *
 * @param {*} val
 * @returns {string}
 */
export function hashForCompare(val) {
  if (val === null) return "null";
  if (val === undefined) return "undefined";
  if (val instanceof File) {
    return `File:${val.name}:${val.size}:${val.lastModified || ""}:${val.type || ""}`;
  }
  if (val instanceof Date) {
    return `Date:${val.toISOString()}`;
  }
  if (Array.isArray(val)) {
    return `[${val.map((v) => hashForCompare(v)).join(",")}]`;
  }
  if (typeof val === "object") {
    const keys = Object.keys(val)
      .filter((k) => k !== "fakeId")
      .sort();
    const parts = keys.map((k) => `${k}:${hashForCompare(val[k])}`);
    return `{${parts.join(",")}}`;
  }
  return String(val);
}

/**
 * Normalize a value for dirty-comparison so cosmetic, non-user changes don't
 * register as edits. Trims strings, strips `fakeId` keys, and drops empty
 * values ("" / null / undefined / empty arrays / all-empty objects). Without
 * this, a dynamic array input that seeds a blank row on mount (e.g.
 * `[{ type: "", amount: "" }]` vs a pristine `[]`), or any empty-string field,
 * would flip the dirty check immediately.
 *
 * @param {*} val
 * @returns {*}
 */
export function normalizeForCompare(val) {
  if (val === "" || val === null || val === undefined) return undefined;
  if (val instanceof File || val instanceof Date) return val;
  if (Array.isArray(val)) {
    const arr = val
      .map((v) => normalizeForCompare(v))
      .filter((v) => v !== undefined);
    return arr.length ? arr : undefined;
  }
  if (typeof val === "object") {
    const out = {};
    for (const key of Object.keys(val)) {
      if (key === "fakeId") continue;
      const nv = normalizeForCompare(val[key]);
      if (nv !== undefined) out[key] = nv;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  return val;
}

/**
 * Returns true if any tracked key differs between `pristine` and `current`,
 * after normalization. By default compares the keys present on `pristine`.
 *
 * @param {Record<string, any>} pristine - Baseline values.
 * @param {Record<string, any>} current  - Current values.
 * @param {string[]} [keys] - Keys to compare (defaults to Object.keys(pristine)).
 * @returns {boolean}
 */
export function isDirty(pristine, current, keys = Object.keys(pristine || {})) {
  const cur = current || {};
  const pri = pristine || {};
  for (const key of keys) {
    if (
      hashForCompare(normalizeForCompare(pri[key])) !==
      hashForCompare(normalizeForCompare(cur[key]))
    ) {
      return true;
    }
  }
  return false;
}
