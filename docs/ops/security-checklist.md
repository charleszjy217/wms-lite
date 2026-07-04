# Security Checklist

> 生成日期: 2026-07-04  
> 分支: task/37/1783138766913  
> 范围: backend/, integrations/, docs/ops/

---

## 1. 密钥管理 (Secrets Management)

| # | 检查项 | 状态 | 说明 |
|---|--------|------|------|
| 1.1 | JWT 签名密钥通过环境变量注入 | ✅ 已修复 | `JWT_SECRET` 强制要求, 无 fallback 值; 见 `auth.module.ts`、`jwt.strategy.ts` |
| 1.2 | 数据库连接串通过环境变量配置 | ✅ | Prisma 通过 `DATABASE_URL` 环境变量连接 |
| 1.3 | 无硬编码密钥/令牌/密码 | ✅ | 代码中不包含任何硬编码密钥 |
| 1.4 | 集成层密钥使用 SecretStore 抽象 | ✅ | `integrations/src/secrets/env-store.ts` 提供基于环境变量的密钥存储 |
| 1.5 | CORS 域名通过环境变量配置 | ✅ 已修复 | `CORS_ORIGIN` 环境变量, 默认为 `http://localhost:5173` |

**整改记录**:  
- 移除 `auth.module.ts` 和 `jwt.strategy.ts` 中 `process.env.JWT_SECRET \|\| 'fallback-secret'` 的 fallback 逻辑  
- `main.ts` 中 `enableCors()` 从无限制改为读取 `CORS_ORIGIN` 环境变量

---

## 2. 鉴权检查 (Authentication & Authorization)

| # | 检查项 | 状态 | 说明 |
|---|--------|------|------|
| 2.1 | 全局 JWT 守卫注册 | ✅ | `JwtAuthGuard` 作为 `APP_GUARD` 全局生效 |
| 2.2 | 全局 Roles 守卫注册 | ✅ | `RolesGuard` 作为 `APP_GUARD` 全局生效 |
| 2.3 | 公开端点标记 `@Public()` | ✅ 已修复 | `GET /` (hello) 和 `GET /health` 已添加 `@Public()` 装饰器; 原 `/health` 端点需要 JWT 认证 |
| 2.4 | 认证端点 (`/auth/register`, `/auth/login`) 公开 | ✅ | `@Public()` 已正确标记 |
| 2.5 | 写操作端点有 RBAC 保护 | ✅ | 所有 `POST/PATCH/DELETE` 端点使用 `@Roles('admin')` 或 `@Roles('admin', 'operator')` |
| 2.6 | 读操作端点有 RBAC 保护 | ✅ 已修复 | `InventoryQueryController` 中所有查询端点已添加 `@Roles('admin', 'operator')` |
| 2.7 | Roles 守卫未标记时默认放行 | ✅ | `RolesGuard` 中 `requiredRoles` 为空时返回 `true`, 仅做 JWT 认证 |
| 2.8 | 审计日志查询仅限 admin | ✅ | `AuditController.findAll()` 使用 `@Roles('admin')` |

**整改记录**:  
- `AppController.getHello()` 和 `AppController.health()` 添加 `@Public()`  
- `InventoryQueryController` 导入 `Roles` 并标注所有查询端点

---

## 3. 输入校验 (Input Validation)

| # | 检查项 | 状态 | 说明 |
|---|--------|------|------|
| 3.1 | 全局 ValidationPipe 启用 | ✅ | `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` |
| 3.2 | 所有 DTO 使用 class-validator 装饰器 | ✅ | 共 34 个 DTO 文件, 均使用 `@IsString()`、`@IsNumber()`、`@IsUUID()` 等装饰器 |
| 3.3 | 字符串字段有长度限制 | ✅ | 使用 `@MinLength()` / `@MaxLength()` 限制输入长度 |
| 3.4 | 数值字段有范围限制 | ✅ | 使用 `@Min()` / `@Max()` 限制数值范围 |
| 3.5 | 分页参数有上限限制 | ✅ | `limit` 统一 `@Max(100)` |
| 3.6 | 数组/嵌套对象验证 | ✅ | 使用 `@ValidateNested()` + `@ArrayMinSize()` 校验嵌套结构 |
| 3.7 | SQL/NoSQL 注入防护 | ✅ | 使用 Prisma ORM 参数化查询, 无原生 SQL 拼接 |
| 3.8 | 错误信息不含敏感数据 | ✅ | 业务错误使用统一异常类, 不暴露堆栈或数据库细节 |

---

## 4. 审计日志 (Audit Trail)

| # | 检查项 | 状态 | 说明 |
|---|--------|------|------|
| 4.1 | AuditService 提供统一日志接口 | ✅ | `audit.service.ts` 的 `log()` 方法 |
| 4.2 | Products 模块写入审计日志 | ✅ | `create/update/remove` 操作记录 |
| 4.3 | Warehouses 模块写入审计日志 | ✅ | `createWarehouse/removeWarehouse/createZone/removeZone/createLocation/removeLocation` 等操作 |
| 4.4 | Batches 模块写入审计日志 | ✅ | `create/update/remove` 操作记录 |
| 4.5 | Inbound 模块写入审计日志 | ✅ | `create/submit/complete/cancel/remove` 操作记录 |
| 4.6 | Outbound 模块写入审计日志 | ✅ | `create/submit/complete/cancel/remove` 操作记录 |
| 4.7 | Transfer 模块写入审计日志 | ✅ | `create/submit/complete/cancel` 操作记录 |
| 4.8 | Stocktake 模块写入审计日志 | ✅ | `create/recordCount/confirm/cancel` 操作记录 |
| 4.9 | Pricing 模块写入审计日志 | ✅ | 服务层 + `@AuditLog()` 装饰器双保险 |
| 4.10 | AuditLog 不可绕过 (服务层写入) | ✅ | 审计日志在 Service 层写入, 控制器装饰器为补充 |
| 4.11 | AuditInterceptor 已全局注册 | ✅ 已修复 | 在 `AuditModule` 中通过 `APP_INTERCEPTOR` 注册 |
| 4.12 | 审计日志查询仅限 admin 角色 | ✅ | `@Roles('admin')` |

**整改记录**:  
- `AuditInterceptor` 全局注册, 使 `@AuditLog()` 装饰器生效

---

## 5. 依赖安全 (npm Audit)

| # | 检查项 | 状态 | 说明 |
|---|--------|------|------|
| 5.1 | 运行 `npm audit --audit-level=high` 无高危漏洞 | ✅ | 0 high / 0 critical |
| 5.2 | 应用安全补丁/覆盖 | ✅ | `overrides` 中锁定 `multer@2.2.0` 和 `path-to-regexp@8.4.2` |

**修复记录**:
- `multer@2.1.1` → `2.2.0` (GHSA-72gw-mp4g-v24j, GHSA-3p4h-7m6x-2hcm)
- `path-to-regexp@8.2.0` → `8.4.2` (GHSA-j3q9-mxjg-w52f, GHSA-27v5-c462-wpq7)

---

## 6. 附加检查

| # | 检查项 | 状态 | 说明 |
|---|--------|------|------|
| 6.1 | Helmet/安全头中间件 | ⚠️ 建议 | 可考虑添加 `helmet` 中间件增强 HTTP 安全头 |
| 6.2 | 速率限制 | ⚠️ 建议 | 可考虑添加 `@nestjs/throttler` 防止暴力破解 |
| 6.3 | CSRF 保护 | ⚠️ 建议 | 可考虑添加 CSRF 令牌 (如使用 cookie 认证) |
| 6.4 | 请求体大小限制 | ⚠️ 建议 | 可通过 `NestFactory.create` 配置 `bodyParser` 限制 |

---

## 检查结果汇总

- ✅ 通过: 28 项
- ⚠️ 建议: 4 项
- ❌ 未通过: 0 项
