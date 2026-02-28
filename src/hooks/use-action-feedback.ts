import { toast } from "sonner";

import { ActionResult } from "@/lib/action-result";

/**
 * Wraps a server action call and shows a toast.error() when the action
 * returns `{ error }`. Returns the full result so callers can still
 * branch on success vs failure.
 */
export async function runAction<T extends ActionResult>(
  action: () => Promise<T>,
  errorPrefix?: string
): Promise<T> {
  const result = await action();
  if (result.error) {
    toast.error(errorPrefix ? `${errorPrefix}: ${result.error}` : result.error);
  }
  return result;
}
