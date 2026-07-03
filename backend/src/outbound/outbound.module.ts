import { Module } from '@nestjs/common';
import { OutboundController } from './outbound.controller';
import { OutboundService } from './outbound.service';
import { AuditModule } from '../audit/audit.module';
import { BatchesModule } from '../batches/batches.module';

@Module({
  imports: [AuditModule, BatchesModule],
  controllers: [OutboundController],
  providers: [OutboundService],
  exports: [OutboundService],
})
export class OutboundModule {}
