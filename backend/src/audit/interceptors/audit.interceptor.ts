import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDIT_LOG_KEY } from '../decorators/audit-log.decorator';
import { AuditService } from '../audit.service';

/**
 * AuditInterceptor — a placeholder interceptor that detects @AuditLog() metadata
 * on route handlers and writes an audit log entry after the handler completes.
 *
 * Currently this is a skeleton implementation. Future work:
 *   - Capture `before` snapshot before handler runs
 *   - Capture `after` / result after handler completes
 *   - Determine entity ID from route params
 *   - Extract operator from request.user
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditMeta = this.reflector.get<{
      entityType: string;
      action: string;
    }>(AUDIT_LOG_KEY, context.getHandler());

    if (!auditMeta) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (result: unknown) => {
        try {
          const request = context.switchToHttp().getRequest();
          const operator = request.user?.username ?? 'system';
          const entityId = request.params?.id ?? 'unknown';

          await this.auditService.log({
            entityType: auditMeta.entityType,
            entityId,
            action: auditMeta.action,
            before: null,
            after: result ? JSON.stringify(result) : null,
            operator,
            reason: null,
          });
        } catch {
          // Silently fail — auditing should never break the main flow
        }
      }),
    );
  }
}
