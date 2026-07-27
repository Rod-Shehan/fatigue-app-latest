/**
 * Helpers for sheet save / dirty races — Start shift must not be cleared when a
 * save started earlier finishes and refetches.
 */

/** Clear React dirty only if no newer local edits landed while the save was in flight. */
export function shouldClearDirtyAfterSave(localEditGen: number, savedEditGen: number): boolean {
  return localEditGen === savedEditGen;
}
