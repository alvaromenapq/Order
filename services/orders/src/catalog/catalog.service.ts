import { Inject, Injectable } from '@nestjs/common';
import {
  CatalogProduct,
  INVENTORY_CATALOG,
  InventoryCatalogProvider,
} from './catalog.provider';

@Injectable()
export class CatalogService {
  constructor(
    @Inject(INVENTORY_CATALOG)
    private readonly inventoryCatalog: InventoryCatalogProvider,
  ) {}

  async listProducts(): Promise<CatalogProduct[]> {
    return this.inventoryCatalog.listProducts();
  }
}