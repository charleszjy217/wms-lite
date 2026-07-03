import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles('admin', 'operator')
  async create(@Body() dto: CreateProductDto, @Request() req: { user?: { username: string } }) {
    const operator = req.user?.username ?? 'system';
    return this.productsService.create(dto, operator);
  }

  @Get()
  async findAll(@Query() query: QueryProductDto) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin', 'operator')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    return this.productsService.update(id, dto, operator);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Request() req: { user?: { username: string } }) {
    const operator = req.user?.username ?? 'system';
    await this.productsService.remove(id, operator);
  }
}
