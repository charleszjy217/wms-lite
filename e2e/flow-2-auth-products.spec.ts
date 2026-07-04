// ============================================================================
// E2E Flow 2: 用户注册 → 登录 → 创建商品 → 查询商品
// ============================================================================
//
// This test verifies the user authentication and product management flow:
//   1. Register a new user
//   2. Login with credentials
//   3. Create a product
//   4. Query/List products
//   5. Get product by ID
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../backend/src/auth/auth.service';
import { ProductsService } from '../backend/src/products/products.service';
import { PrismaService } from '../backend/src/prisma/prisma.service';
import { AuditService } from '../backend/src/audit/audit.service';
import {
  MockPrisma,
  createMockPrisma,
  IDS,
  NOW,
  mockUser,
  mockRole,
  mockProduct,
  mockProductCategory,
} from './helpers/mock-factory';

vi.mock('bcrypt');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Flow 2: 用户注册 → 登录 → 创建商品 → 查询商品', () => {
  let authService: AuthService;
  let productsService: ProductsService;
  let prisma: MockPrisma;
  let jwtService: { sign: ReturnType<typeof vi.fn> };
  let auditService: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    prisma = createMockPrisma();
    auditService = { log: vi.fn() };

    jwtService = {
      sign: vi.fn().mockReturnValue('mock-jwt-token-e2e'),
    };

    authService = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
    );

    productsService = new ProductsService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );

    vi.mocked(bcrypt.hash).mockReset();
    vi.mocked(bcrypt.compare).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // Step 1: Register
  // =========================================================================
  describe('Step 1: 注册新用户', () => {
    const registerDto = {
      username: 'e2euser',
      email: 'e2e@example.com',
      password: 'SecurePass123!',
      displayName: 'E2E User',
    };

    it('1a. 成功注册用户，返回不含密码的用户信息', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue(mockRole());
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
      prisma.user.create.mockResolvedValue(mockUser({
        username: registerDto.username,
        email: registerDto.email,
        displayName: registerDto.displayName,
      }));

      const result = await authService.register(registerDto);

      expect(result).not.toHaveProperty('password');
      expect(result.username).toBe(registerDto.username);
      expect(result.email).toBe(registerDto.email);
      expect(result.displayName).toBe(registerDto.displayName);
      expect(result.roles).toEqual(['OPERATOR']);
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
    });

    it('1b. 用户名已存在时抛出 ConflictException', async () => {
      prisma.user.findFirst.mockResolvedValue(
        mockUser({ username: registerDto.username }),
      );

      await expect(authService.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('1c. 邮箱已存在时抛出 ConflictException', async () => {
      prisma.user.findFirst.mockResolvedValue(
        mockUser({ email: registerDto.email }),
      );

      await expect(authService.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('1d. OPERATOR角色不存在时，用户无角色', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
      prisma.user.create.mockResolvedValue(
        mockUser({
          username: registerDto.username,
          email: registerDto.email,
          userRoles: [],
        }),
      );

      const result = await authService.register(registerDto);

      expect(result.roles).toEqual([]);
    });
  });

  // =========================================================================
  // Step 2: Login
  // =========================================================================
  describe('Step 2: 用户登录', () => {
    const loginDto = {
      username: 'e2euser',
      password: 'SecurePass123!',
    };

    it('2a. 成功登录，返回 accessToken 和用户信息', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser());
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await authService.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result.accessToken).toBe('mock-jwt-token-e2e');
      expect(result.user).not.toHaveProperty('password');
      expect(result.user.username).toBe('testuser');
      expect(result.user.roles).toEqual(['OPERATOR']);
    });

    it('2b. 无效用户名抛出 UnauthorizedException', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('2c. 无效密码抛出 UnauthorizedException', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser());
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('2d. 被禁用用户抛出 UnauthorizedException', async () => {
      prisma.user.findFirst.mockResolvedValue(
        mockUser({ status: 'DISABLED' }),
      );
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('2e. JWT payload 包含正确的 sub、username、roles', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser());
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await authService.login(loginDto);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: IDS.userId,
        username: 'testuser',
        roles: ['OPERATOR'],
      });
    });

    it('2f. 支持使用邮箱登录', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser());
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await authService.login({
        username: 'test@example.com',
        password: 'SecurePass123!',
      });

      expect(result).toHaveProperty('accessToken');
    });
  });

  // =========================================================================
  // Step 3: Create Product
  // =========================================================================
  describe('Step 3: 创建商品', () => {
    const createDto = {
      skuCode: 'SKU-E2E-001',
      name: '端到端测试商品',
      description: '用于端到端测试',
      categoryId: IDS.categoryId,
      brand: 'TestBrand',
      unitOfMeasure: 'PCS',
      barcode: '6901234567890',
    };

    it('3a. 成功创建商品', async () => {
      prisma.product.findUnique
        .mockResolvedValueOnce(null) // skuCode check
        .mockResolvedValueOnce(null); // barcode check
      prisma.product.create.mockResolvedValue(mockProduct());

      const result = await productsService.create(createDto, 'e2euser');

      expect(result).toMatchObject({
        skuCode: 'SKU-E2E-001',
        name: '端到端测试商品',
        status: 'ACTIVE',
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entityType: 'Product' }),
      );
    });

    it('3b. SKU编码已存在抛出 ConflictException', async () => {
      prisma.product.findUnique
        .mockResolvedValueOnce(mockProduct()); // skuCode conflict

      await expect(
        productsService.create(createDto, 'e2euser'),
      ).rejects.toThrow(ConflictException);
    });

    it('3c. 条码已存在抛出 ConflictException', async () => {
      prisma.product.findUnique
        .mockResolvedValueOnce(null) // skuCode check passes
        .mockResolvedValueOnce(mockProduct()); // barcode conflict

      await expect(
        productsService.create(createDto, 'e2euser'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================================
  // Step 4: Query Products
  // =========================================================================
  describe('Step 4: 查询商品', () => {
    it('4a. 查询商品列表（分页）', async () => {
      const products = [
        mockProduct({ id: 'prod-1', skuCode: 'SKU-001' }),
        mockProduct({ id: 'prod-2', skuCode: 'SKU-002' }),
      ];
      prisma.product.findMany.mockResolvedValue(products);
      prisma.product.count.mockResolvedValue(2);

      const result = await productsService.findAll({
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('4b. 按名称模糊搜索', async () => {
      const filtered = [mockProduct()];
      prisma.product.findMany.mockResolvedValue(filtered);
      prisma.product.count.mockResolvedValue(1);

      const result = await productsService.findAll({ name: '端到端' });

      expect(result.items).toHaveLength(1);
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: expect.objectContaining({ contains: '端到端' }),
          }),
        }),
      );
    });

    it('4c. 按 SKU 搜索', async () => {
      const filtered = [mockProduct()];
      prisma.product.findMany.mockResolvedValue(filtered);
      prisma.product.count.mockResolvedValue(1);

      const result = await productsService.findAll({
        skuCode: 'SKU-E2E-001',
      });

      expect(result.items).toHaveLength(1);
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            skuCode: expect.objectContaining({ contains: 'SKU-E2E-001' }),
          }),
        }),
      );
    });

    it('4d. 通过ID查询单个商品', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct());

      const result = await productsService.findOne(IDS.productId);

      expect(result).toMatchObject({
        id: IDS.productId,
        skuCode: 'SKU-E2E-001',
      });
    });

    it('4e. 查询不存在的商品抛出 NotFoundException', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        productsService.findOne('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('4f. 空结果返回空列表', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      const result = await productsService.findAll({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // =========================================================================
  // Step 5: Update & Delete Product (bonus)
  // =========================================================================
  describe('Step 5: 商品更新与删除', () => {
    it('5a. 更新商品信息', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct());
      prisma.product.update.mockResolvedValue(
        mockProduct({ name: '更新后的商品名', brand: 'NewBrand' }),
      );

      const result = await productsService.update(
        IDS.productId,
        { name: '更新后的商品名', brand: 'NewBrand' },
        'e2euser',
      );

      expect(result.name).toBe('更新后的商品名');
      expect(result.brand).toBe('NewBrand');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE' }),
      );
    });

    it('5b. 删除商品', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct());
      prisma.product.delete.mockResolvedValue(mockProduct());

      await productsService.remove(IDS.productId, 'e2euser');

      expect(prisma.product.delete).toHaveBeenCalledWith({
        where: { id: IDS.productId },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE' }),
      );
    });
  });
});
