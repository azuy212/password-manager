/**
 * Retry a function with exponential backoff.
 * Throws the last error if all retries fail.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      console.log('[SupabaseRetry] Attempt', i + 1, 'of', maxRetries + 1);
      return await fn();
    } catch (error: any) {
      console.error('[SupabaseRetry] Attempt', i + 1, 'failed:', error?.message || error, 'status:', error?.status);
      lastError = error;
      // Don't retry client errors (4xx)
      if (error?.status >= 400 && error?.status < 500) {
        console.log('[SupabaseRetry] Client error (4xx), not retrying');
        throw error;
      }
      if (i < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, i);
        console.log('[SupabaseRetry] Retrying in', delay, 'ms...');
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

/**
 * Wrap a Supabase operation with retry logic.
 * Retries on transient errors (5xx, network) with exponential backoff.
 * Does not retry on client errors (4xx) — those fail immediately.
 */
export async function supabaseWithRetry<T>(
  fn: () => Promise<T>,
  operationName: string,
  maxRetries: number = 2
): Promise<T> {
  try {
    console.log('[SupabaseRetry] Starting operation:', operationName, 'maxRetries:', maxRetries);
    return await retryWithBackoff(fn, maxRetries);
  } catch (error: any) {
    console.error('[SupabaseRetry] Operation failed:', operationName, 'error:', error?.message || error);
    const message = error?.message || 'Unknown error';
    if (message.includes('Network request failed') || message.includes('fetch')) {
      throw new Error('No internet connection. Please check your network and try again.');
    }
    throw new Error(`Failed to ${operationName}: ${message}`);
  }
}
