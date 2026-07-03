import { Module } from '@nestjs/common';
import { InventoryQueryController } from './inventory-query.controller';
import { InventoryQueryService } from './inventory-query.service';

@Module({
  controllers: [InventoryQueryController],
  providers: [InventoryQueryService],
  exports: [InventoryQueryService],
})
export class InventoryQueryModule {}
