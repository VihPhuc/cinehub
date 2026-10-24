function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFailedEnvelope(value: Record<string, unknown>): boolean {
  return value.status === false;
}

function hasListItems(value: Record<string, unknown>): boolean {
  if (Array.isArray(value.items)) return true;
  return isRecord(value.data) && Array.isArray(value.data.items);
}

function isListPath(path: string): boolean {
  return (
    path === '/danh-sach/phim-moi-cap-nhat' ||
    path === '/v1/api/tim-kiem' ||
    path.startsWith('/v1/api/danh-sach/') ||
    path.startsWith('/v1/api/the-loai/') ||
    path.startsWith('/v1/api/quoc-gia/')
  );
}

function isDetailPath(path: string): boolean {
  return path.startsWith('/phim/');
}

export function isCacheableUpstreamPayload(path: string, value: unknown): boolean {
  if (!isRecord(value) || isFailedEnvelope(value)) return false;
  if (isListPath(path)) return hasListItems(value);
  if (isDetailPath(path)) return isRecord(value.movie);
  return true;
}
