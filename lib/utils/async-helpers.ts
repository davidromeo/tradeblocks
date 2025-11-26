/**
 * Async Helper Utilities
 *
 * Shared utilities for async operations that need to yield to the main thread
 * to keep the UI responsive during expensive computations.
 */

/**
 * Delay in milliseconds before starting computation to allow React to render
 */
export const RENDER_DELAY_MS = 150;

/**
 * Yield control to the main thread to prevent UI freezing.
 * Uses setTimeout(0) to create a macrotask break, allowing the browser
 * to process pending UI updates and repaints between chunks of work.
 *
 * Note: scheduler.yield() and requestIdleCallback don't reliably allow
 * repaints, so we use setTimeout which guarantees a macrotask boundary.
 */
export async function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Check if the operation has been cancelled via AbortSignal.
 * Throws AbortError if cancelled.
 */
export function checkCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }
}

/**
 * Wait for React to render before starting computation.
 * This ensures progress dialogs are visible before heavy work begins.
 */
export async function waitForRender(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, RENDER_DELAY_MS));
}
