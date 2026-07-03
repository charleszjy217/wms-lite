import { Module } from '@nestjs/common';
import { StocktakeController } from './stocktake.controller';
import { StocktakeService } from './stocktake.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [StocktakeController],
  providers: [StocktakeService],
  exports: [StocktakeService],
})
export class StocktakeModule {}
