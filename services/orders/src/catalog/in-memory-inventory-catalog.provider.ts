import { Injectable } from '@nestjs/common';
import {
  CatalogProduct,
  InventoryCatalogProvider,
} from './catalog.provider';

export const DEFAULT_CATALOG_PRODUCTS: CatalogProduct[] = [
  {
    productId: 'SKU-1234',
    productName: 'Cafetera espresso',
    unitPrice: 129.9,
    availableStock: 8,
    active: true,
  },
  {
    productId: 'SKU-5678',
    productName: 'Molinillo electrico',
    unitPrice: 49.9,
    availableStock: 15,
    active: true,
  },
  {
    productId: 'SKU-9012',
    productName: 'Tazas termicas x2',
    unitPrice: 24.5,
    availableStock: 30,
    active: true,
  },
  {
    productId: 'SKU-4040',
    productName: 'Filtro premium V60',
    unitPrice: 15.75,
    availableStock: 0,
    active: true,
  },
  {
    productId: 'SKU-0000',
    productName: 'Producto descontinuado demo',
    unitPrice: 9.99,
    availableStock: 5,
    active: false,
  },
];

@Injectable()
export class InMemoryInventoryCatalogProvider
  implements InventoryCatalogProvider
{
  private readonly products = new Map(
    DEFAULT_CATALOG_PRODUCTS.map((product) => [product.productId, product]),
  );

  async getProducts(productIds: string[]): Promise<Map<string, CatalogProduct>> {
    return new Map(
      productIds
        .map((productId) => [productId, this.products.get(productId)] as const)
        .filter((entry): entry is [string, CatalogProduct] => Boolean(entry[1])),
    );
  }

  async listProducts(): Promise<CatalogProduct[]> {
    return Array.from(this.products.values());
  }
}