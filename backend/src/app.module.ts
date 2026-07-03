import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { PricingModule } from './pricing/pricing.module';
import { ProductsModule } from './products/products.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { BatchesModule } from './batches/batches.module';
import { InboundModule } from './inbound/inbound.module';
import { TransferModule } from './transfer/transfer.module';
import { StocktakeModule } from './stocktake/stocktake.module';
import { OutboundModule } from './outbound/outbound.module';
import { InventoryQueryModule } from './inventory-query/inventory-query.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuditModule,
    PricingModule,
    ProductsModule,
    WarehousesModule,
    BatchesModule,
    InboundModule,
    TransferModule,
    StocktakeModule,
    OutboundModule,
    InventoryQueryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
