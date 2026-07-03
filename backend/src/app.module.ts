import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { PricingModule } from './pricing/pricing.module';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, PricingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
