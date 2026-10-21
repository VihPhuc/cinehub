/**
 * Recovery policy for fatal HLS errors.
 *
 * hls.js keeps emitting fatal errors while the network is down, so an unbounded
 * `startLoad()`/`recoverMediaError()` loop hangs the player on a spinner forever.
 * This caps the number of automatic retries and turns the last one into a
 * user-visible failure the player can recover from (retry / switch to iframe).
 */
export type HlsRecoveryAction = 'retry-network' | 'recover-media' | 'fail';

/** Mirrors hls.js `ErrorTypes`. Kept as plain strings to avoid importing hls.js here. */
export const HLS_ERROR_TYPES = {
  network: 'networkError',
  media: 'mediaError',
} as const;

export function decideHlsRecovery(
  errorType: string,
  attempt: number,
  maxRetries: number
): HlsRecoveryAction {
  if (attempt >= maxRetries) return 'fail';
  if (errorType === HLS_ERROR_TYPES.network) return 'retry-network';
  if (errorType === HLS_ERROR_TYPES.media) return 'recover-media';
  // Unknown fatal error: retrying will not help.
  return 'fail';
}
