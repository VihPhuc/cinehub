import { Module } from '@nestjs/common';
import { UpstreamModule } from '../upstream/upstream.module';
import { CatalogController } from './catalog.controller';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { SearchController } from './search.controller';

@Module({
  imports: [UpstreamModule],
  controllers: [MoviesController, CatalogController, SearchController],
  providers: [MoviesService],
})
export class MoviesModule {}
