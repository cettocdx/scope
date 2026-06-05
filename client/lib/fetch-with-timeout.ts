/**
 * fetch wrapper that aborts the request after a timeout so callers never hang
 * indefinitely on a stalled network request.
 *
 * Throws a regular Error with a meaningful message when the timeout fires so
 * callers can surface it to the user (or swallow it in fire-and-forget paths).
 *
 * @param input        The fetch URL/Request.
 * @param init         Standard fetch options.
 * @param timeoutMs    Milliseconds to wait before aborting.
 * @param timeoutError Message used when the request times out.
 */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs: number,
  timeoutError = "Request timed out, please try again",
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (e: unknown) {
    // AbortController surfaces an AbortError when the timer fires; translate it
    // into a clear, user-facing message instead of a generic "Aborted".
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(timeoutError);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
