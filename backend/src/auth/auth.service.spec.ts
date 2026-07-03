import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

vi.mock('bcrypt');

type MockPrisma = {
  user: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  role: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

describe('AuthService', () => {
  let authService: AuthService;
  let prisma: MockPrisma;
  let jwtService: { sign: ReturnType<typeof vi.fn> };

  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashed-password',
    displayName: 'Test User',
    status: 'ACTIVE',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    userRoles: [
      {
        id: 'ur-1',
        userId: 'user-1',
        roleId: 'role-1',
        role: { id: 'role-1', code: 'OPERATOR', name: 'Operator' },
      },
    ],
  };

  const mockOperatorRole = {
    id: 'role-1',
    code: 'OPERATOR',
    name: '仓库操作员',
    description: null,
  };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      role: {
        findUnique: vi.fn(),
      },
    };

    jwtService = {
      sign: vi.fn().mockReturnValue('mock-jwt-token'),
    };

    authService = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
    );

    vi.mocked(bcrypt.hash).mockReset();
    vi.mocked(bcrypt.compare).mockReset();
  });

  describe('register', () => {
    const registerDto = {
      username: 'newuser',
      email: 'new@example.com',
      password: 'password123',
    };

    it('should create a user and return without password', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue(mockOperatorRole);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await authService.register(registerDto);

      expect(result).not.toHaveProperty('password');
      expect(result.username).toBe('testuser');
      expect(result.email).toBe('test@example.com');
      expect(result.roles).toEqual(['OPERATOR']);
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    });

    it('should throw ConflictException if username exists', async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...mockUser,
        username: registerDto.username,
      });

      await expect(authService.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if email exists', async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...mockUser,
        email: registerDto.email,
      });

      await expect(authService.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create user without role if OPERATOR role does not exist', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
      prisma.user.create.mockResolvedValue({
        ...mockUser,
        userRoles: [],
      });

      const result = await authService.register(registerDto);

      expect(result.roles).toEqual([]);
    });
  });

  describe('login', () => {
    const loginDto = {
      username: 'testuser',
      password: 'password123',
    };

    it('should return access token and user on valid credentials', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await authService.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user).not.toHaveProperty('password');
      expect(result.user.roles).toEqual(['OPERATOR']);
    });

    it('should throw UnauthorizedException on invalid username', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException on invalid password', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...mockUser,
        status: 'DISABLED',
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should generate JWT with correct payload', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await authService.login(loginDto);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        username: 'testuser',
        roles: ['OPERATOR'],
      });
    });

    it('should allow login by email', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await authService.login({
        username: 'test@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('accessToken');
    });
  });
});
