/**
 * Utility function to check if a string has length
 */
export function stringHasLength(
  line: string | null | undefined
): line is string {
  return Boolean(line && line.length);
}

/**
 * Default callback function that returns a no-op function if callback is not provided
 */
export function defaultCallback<T extends unknown[]>(
  callback?: ((...args: T) => void) | null
): (...args: T) => void {
  return typeof callback === "function" ? callback : () => {};
}

/**
 * Removes leading and trailing whitespace from a string
 */
export function removeSpaces(string?: string | null): string {
  return (string || "").replace(/^\s*|\s*$/g, "");
}
