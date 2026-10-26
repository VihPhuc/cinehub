import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CatalogIndexerService } from './catalog-indexer.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const result = await app.get(CatalogIndexerService).refresh();
    Logger.log(
      `Catalog index refreshed: ${result.totalItems} movies, ${result.pagesFetched} pages -> ${result.path}`,
      'RefreshCatalogIndex'
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  Logger.error('Catalog index refresh failed', error, 'RefreshCatalogIndex');
  process.exitCode = 1;
});
