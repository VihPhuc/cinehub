import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CatalogIndexSnapshot } from '../src/catalog-index/catalog-index.types';

export async function writeCatalogIndexFixture(
  snapshot: CatalogIndexSnapshot
): Promise<{ dir: string; path: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'cinehub-index-fixture-'));
  const path = join(dir, 'catalog-index.json');
  await writeFile(path, JSON.stringify(snapshot));
  return { dir, path };
}
