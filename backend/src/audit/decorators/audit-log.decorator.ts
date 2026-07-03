import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'auditLog';
export const AUDIT_ENTITY_TYPE_KEY = 'auditEntityType';

/**
 * @AuditLog() decorator — marks a route handler for automatic audit logging.
 *
 * Usage (future, when the AuditInterceptor is fully wired):
 *   @AuditLog('Product', 'UPDATE')
 *   async updateProduct(@Param('id') id: string, @Body() dto: UpdateDto) { ... }
 *
 * The interceptor will capture `before` / `after` state snapshots
 * and write an AuditLog entry via AuditService.
 */
export const AuditLog = (entityType: string, action: string) =>
  SetMetadata(AUDIT_LOG_KEY, { entityType, action });
