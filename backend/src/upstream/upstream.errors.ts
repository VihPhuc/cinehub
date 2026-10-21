export type UpstreamErrorCode =
  | 'NOT_FOUND'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'BAD_RESPONSE'
  | 'UNAVAILABLE';

export class UpstreamError extends Error {
  constructor(
    public readonly code: UpstreamErrorCode,
    message: string,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}
