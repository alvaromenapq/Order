export interface CatalogProduct {
  productId: string;
  productName: string;
  unitPrice: number;
  availableStock: number;
  active: boolean;
}

export interface InventoryCatalogProvider {
  getProducts(productIds: string[]): Promise<Map<string, CatalogProduct>>;
  listProducts(): Promise<CatalogProduct[]>;
}

export const INVENTORY_CATALOG = Symbol('INVENTORY_CATALOG');