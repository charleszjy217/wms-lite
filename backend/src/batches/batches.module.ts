import { Module } from '@nestjs/common';
import { BatchesController } from './batches.controller';
import { BatchesService } from './batches.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [BatchesController],
  providers: [BatchesService],
  exports: [BatchesService],
})
export class BatchesModule {}
