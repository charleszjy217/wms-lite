import { Controller, Get, Query } from '@nestjs/common';
import { AuditService, AuditLogQuery } from './audit.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('admin')
  async findAll(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('operator') operator?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const query: AuditLogQuery = {
      entityType,
      entityId,
      action,
      operator,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    };
    return this.auditService.findAll(query);
  }
}
