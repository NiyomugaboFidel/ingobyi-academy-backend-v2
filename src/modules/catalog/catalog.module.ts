import { Module } from '@nestjs/common';
import { CatalogReviewsController } from './catalog-reviews.controller';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [CatalogController, CatalogReviewsController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
