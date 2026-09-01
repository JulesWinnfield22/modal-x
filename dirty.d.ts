/** Stable string hash of a value for equality comparison (File/Date/array/object aware). */
export function hashForCompare(val: any): string;

/**
 * Normalize a value for dirty-comparison: trims strings, strips `fakeId` keys,
 * and drops empty values so cosmetic changes don't register as edits.
 */
export function normalizeForCompare(val: any): any;

/**
 * Returns true if any tracked key differs between `pristine` and `current`
 * after normalization. Defaults to comparing the keys present on `pristine`.
 */
export function isDirty(
  pristine: Record<string, any>,
  current: Record<string, any>,
  keys?: string[],
): boolean;
