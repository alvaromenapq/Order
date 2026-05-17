import { Controller, Get } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogProduct } from './catalog.provider';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('products')
  findAll(): Promise<CatalogProduct[]> {
    return this.catalogService.listProducts();
  }
}