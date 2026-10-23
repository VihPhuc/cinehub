import { Module } from '@nestjs/common';
import { UpstreamModule } from '../upstream/upstream.module';
import { CompatController } from './compat.controller';

@Module({
  imports: [UpstreamModule],
  controllers: [CompatController],
})
export class CompatModule {}
