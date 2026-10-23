import { describe, it, expect } from 'vitest';
import { decideHlsRecovery, HLS_ERROR_TYPES } from './hlsRecovery';

describe('decideHlsRecovery', () => {
  it('retries a network error while under the retry budget', () => {
    expect(decideHlsRecovery(HLS_ERROR_TYPES.network, 0, 3)).toBe('retry-network');
    expect(decideHlsRecovery(HLS_ERROR_TYPES.network, 2, 3)).toBe('retry-network');
  });

  it('asks hls.js to recover a media error while under the retry budget', () => {
    expect(decideHlsRecovery(HLS_ERROR_TYPES.media, 0, 3)).toBe('recover-media');
  });

  it('fails once the retry budget is exhausted instead of looping forever', () => {
    expect(decideHlsRecovery(HLS_ERROR_TYPES.network, 3, 3)).toBe('fail');
    expect(decideHlsRecovery(HLS_ERROR_TYPES.media, 5, 3)).toBe('fail');
  });

  it('fails immediately for unknown fatal errors', () => {
    expect(decideHlsRecovery('someOtherError', 0, 3)).toBe('fail');
  });
});
