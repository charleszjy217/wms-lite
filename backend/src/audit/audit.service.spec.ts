import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditService', () => {
  let auditService: AuditService;
  let prisma: {
    auditLog: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
  };

  const mockAuditLog = {
    id: 'log-1',
    entityType: 'Product',
    entityId: 'prod-1',
    action: 'UPDATE',
    before: '{"name":"Old Name"}',
    after: '{"name":"New Name"}',
    operator: 'admin',
    reason: null,
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    prisma = {
      auditLog: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
    };

    auditService = new AuditService(prisma as unknown as PrismaService);
  });

  describe('log', () => {
    it('should create an audit log entry', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue(mockAuditLog);

      const result = await auditService.log({
        entityType: 'Product',
        entityId: 'prod-1',
        action: 'UPDATE',
        before: '{"name":"Old Name"}',
        after: '{"name":"New Name"}',
        operator: 'admin',
        reason: null,
      });

      expect(result).toEqual(mockAuditLog);
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          entityType: 'Product',
          entityId: 'prod-1',
          action: 'UPDATE',
          before: '{"name":"Old Name"}',
          after: '{"name":"New Name"}',
          operator: 'admin',
          reason: null,
        },
      });
    });

    it('should handle null fields', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({
        ...mockAuditLog,
        entityType: 'StockMovement',
        entityId: 'mov-1',
        action: 'CREATE',
        before: null,
        after: '{"quantity":100}',
        reason: null,
      });

      const result = await auditService.log({
        entityType: 'StockMovement',
        entityId: 'mov-1',
        action: 'CREATE',
        before: null,
        after: '{"quantity":100}',
        operator: 'operator1',
        reason: null,
      });

      expect(result.entityType).toBe('StockMovement');
      expect(result.before).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return paginated audit logs', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([mockAuditLog]);
      vi.mocked(prisma.auditLog.count).mockResolvedValue(1);

      const result = await auditService.findAll({ page: 1, limit: 20 });

      expect(result.items).toEqual([mockAuditLog]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by entityType', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([mockAuditLog]);
      vi.mocked(prisma.auditLog.count).mockResolvedValue(1);

      await auditService.findAll({ entityType: 'Product' });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ entityType: 'Product' }),
        }),
      );
    });

    it('should filter by entityId', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([mockAuditLog]);
      vi.mocked(prisma.auditLog.count).mockResolvedValue(1);

      await auditService.findAll({ entityId: 'prod-1' });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ entityId: 'prod-1' }),
        }),
      );
    });

    it('should filter by action', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([mockAuditLog]);
      vi.mocked(prisma.auditLog.count).mockResolvedValue(1);

      await auditService.findAll({ action: 'UPDATE' });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ action: 'UPDATE' }),
        }),
      );
    });

    it('should filter by operator', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([mockAuditLog]);
      vi.mocked(prisma.auditLog.count).mockResolvedValue(1);

      await auditService.findAll({ operator: 'admin' });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ operator: 'admin' }),
        }),
      );
    });

    it('should apply default pagination values', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
      vi.mocked(prisma.auditLog.count).mockResolvedValue(0);

      await auditService.findAll({});

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should calculate totalPages correctly', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue(
        Array(10).fill(mockAuditLog),
      );
      vi.mocked(prisma.auditLog.count).mockResolvedValue(25);

      const result = await auditService.findAll({ page: 1, limit: 10 });

      expect(result.totalPages).toBe(3);
      expect(result.total).toBe(25);
    });

    it('should order by createdAt descending', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
      vi.mocked(prisma.auditLog.count).mockResolvedValue(0);

      await auditService.findAll({});

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });
});
