import { Module } from '@nestjs/common';
import { UpstreamModule } from '../upstream/upstream.module';
import { CatalogIndexController } from './catalog-index.controller';
import { CatalogIndexService } from './catalog-index.service';
import { CatalogIndexerService } from './catalog-indexer.service';

@Module({
  imports: [UpstreamModule],
  controllers: [CatalogIndexController],
  providers: [CatalogIndexService, CatalogIndexerService],
  exports: [CatalogIndexService, CatalogIndexerService],
})
export class CatalogIndexModule {}
