import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { INVENTORY_CATALOG } from './catalog.provider';
import { InMemoryInventoryCatalogProvider } from './in-memory-inventory-catalog.provider';

@Module({
  controllers: [CatalogController],
  providers: [
    CatalogService,
    InMemoryInventoryCatalogProvider,
    {
      provide: INVENTORY_CATALOG,
      useExisting: InMemoryInventoryCatalogProvider,
    },
  ],
  exports: [CatalogService, INVENTORY_CATALOG],
})
export class CatalogModule {}