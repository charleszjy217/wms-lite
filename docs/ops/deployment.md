# Docker Compose 部署步骤

> 最后更新: 2026-07-04  
> 适用环境: 本地开发 / 测试环境 / 单机生产

---

## 目录

1. [前置要求](#1-前置要求)
2. [快速部署（开发环境）](#2-快速部署开发环境)
3. [手动分步部署](#3-手动分步部署)
4. [生产环境部署](#4-生产环境部署)
5. [数据库迁移](#5-数据库迁移)
6. [常见问题](#6-常见问题)

---

## 1. 前置要求

### 1.1 软件依赖

| 组件 | 版本要求 | 用途 |
|------|----------|------|
| Docker | 24+ | 容器运行环境 |
| Docker Compose | 2.20+ | 多容器编排 |
| Git | 2.40+ | 代码拉取 |
| OpenSSL | 1.1+ | 密钥生成（可选） |

### 1.2 检查安装

```bash
docker --version          # Docker version 24.0.7+
docker compose version    # Docker Compose version v2.20+
git --version             # git version 2.40+
```

### 1.3 端口需求

| 端口 | 服务 | 说明 |
|------|------|------|
| 5432 | PostgreSQL | 数据库（可修改） |
| 3000 | Backend API | NestJS 后端（可修改） |
| 5173 | Frontend | Nginx 前端（可修改） |

---

## 2. 快速部署（开发环境）

### 2.1 一键启动

```bash
# 1. 克隆仓库
git clone <repository-url> wms-lite
cd wms-lite

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，至少修改 JWT_SECRET 和 POSTGRES_PASSWORD

# 3. 启动所有服务
docker compose up -d

# 4. 运行数据库迁移
docker compose exec backend npx prisma migrate deploy

# 5. 查看服务状态
docker compose ps
```

### 2.2 验证部署

```bash
# 健康检查
curl http://localhost:3000/api/v1/health
# 预期返回: {"status":"ok"}

# 查看日志
docker compose logs -f

# 查看各服务状态
docker compose ps
```

### 2.3 常用命令

```bash
# 启动所有服务
docker compose up -d

# 启动单个服务
docker compose up -d backend

# 停止所有服务
docker compose down

# 停止并删除数据卷（⚠️ 会清空数据库）
docker compose down -v

# 重新构建镜像
docker compose build

# 查看实时日志
docker compose logs -f

# 进入容器
docker compose exec backend sh
```

---

## 3. 手动分步部署

### 3.1 获取代码

```bash
git clone <repository-url> wms-lite
cd wms-lite
git checkout <target-branch>
```

### 3.2 配置环境变量

```bash
# 创建环境变量文件
cp .env.example .env

# 修改关键变量
# 编辑 .env，确保以下字段已配置：
# - JWT_SECRET（必须修改）
# - POSTGRES_PASSWORD（建议修改）
# - DATABASE_URL（如需自定义）
```

> 完整环境变量清单请参考 [环境变量与密钥清单](./env-vars.md)。

### 3.3 构建镜像

```bash
# 构建所有服务镜像
docker compose build

# 仅构建后端
docker compose build backend

# 仅构建前端
docker compose build frontend
```

### 3.4 启动服务

```bash
# 启动 PostgreSQL（先确保数据库可用）
docker compose up -d postgres

# 等待 PostgreSQL 健康检查通过（约 5-10 秒）
docker compose logs postgres

# 启动后端
docker compose up -d backend

# 启动前端
docker compose up -d frontend
```

### 3.5 运行数据库迁移

```bash
# 部署迁移（生产环境使用）
docker compose exec -T backend npx prisma migrate deploy

# 查看迁移状态
docker compose exec -T backend npx prisma migrate status

# 可选: 填充种子数据
docker compose exec -T backend npx prisma db seed
```

### 3.6 验证服务

```bash
# 1. 后端健康检查
curl -s http://localhost:3000/api/v1/health | jq .
# {"status":"ok"}

# 2. 前端是否可访问
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
# 200

# 3. 数据库连接验证
docker compose exec -T postgres pg_isready -U wms_user -d wms_lite
# localhost:5432 - accepting connections
```

---

## 4. 生产环境部署

### 4.1 前置检查

> 生产部署前请逐项确认[生产切换清单](./production-switch-checklist.md)。

### 4.2 环境变量准备

```bash
# 创建生产环境文件（不建议提交到 Git）
cp .env.example .env.production

# 修改以下关键项：
# - NODE_ENV=production
# - JWT_SECRET=<高强度随机字符串，使用 openssl rand -hex 64 生成>
# - DATABASE_URL=<生产数据库连接串，含 sslmode=require>
# - CORS_ORIGIN=<前端域名>
# - VITE_API_BASE_URL=<生产 API 地址>
# - LOG_LEVEL=info
# - POSTGRES_PASSWORD=<高强度密码>
```

### 4.3 部署步骤

```bash
# 1. 配置环境
cp .env.production .env

# 2. 启动数据库（如使用外部数据库则跳过此步）
docker compose up -d postgres

# 3. 构建并启动所有服务
docker compose up -d --build

# 4. 运行数据库迁移
docker compose exec -T backend npx prisma migrate deploy

# 5. 验证部署
curl -s https://your-domain.com/api/v1/health
```

### 4.4 使用外部 PostgreSQL（推荐生产环境）

修改 `docker-compose.yml` 或使用 `docker-compose.override.yml`：

```yaml
# docker-compose.override.yml
version: "3.9"
services:
  postgres:
    deploy:
      replicas: 0   # 禁用内置 PostgreSQL
```

此时 `DATABASE_URL` 应指向外部数据库实例。

### 4.5 使用反向代理（推荐生产环境）

建议在前端 Nginx 或独立反向代理（如 Nginx / Caddy / Traefik）上配置：

- TLS 终止
- 域名绑定
- 速率限制
- WAF 防护

```nginx
# 示例 Nginx 反向代理配置
server {
    listen 443 ssl;
    server_name wms.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
    }
}
```

---

## 5. 数据库迁移

### 5.1 迁移命令

| 命令 | 环境 | 说明 |
|------|------|------|
| `npx prisma migrate dev` | 开发 | 创建并应用迁移（开发用） |
| `npx prisma migrate deploy` | 生产 | 仅应用未运行的迁移（生产用） |
| `npx prisma migrate status` | 所有 | 查看迁移状态 |
| `npx prisma db push` | 开发 | 直接推送 schema 变更（不生成迁移文件） |
| `npx prisma db seed` | 开发/测试 | 填充种子数据 |

### 5.2 生产环境迁移注意事项

- 始终使用 `npx prisma migrate deploy`（而非 `dev`）
- 迁移前备份数据库
- 迁移在生产窗口时间执行
- 迁移失败后按回滚方案操作（见[生产切换清单](./production-switch-checklist.md#4-回滚方案)）

### 5.3 迁移执行

```bash
# 查看待执行迁移
docker compose exec -T backend npx prisma migrate status

# 执行迁移
docker compose exec -T backend npx prisma migrate deploy
```

---

## 6. 常见问题

### 6.1 数据库连接失败

```
Error: PrismaClientInitializationError: Can't reach database server
```

**排查步骤**:
1. 检查 PostgreSQL 容器是否正常运行: `docker compose ps postgres`
2. 查看数据库日志: `docker compose logs postgres`
3. 验证 `DATABASE_URL` 格式正确
4. 确认 PostgreSQL 容器内 `pg_isready` 正常

### 6.2 端口冲突

```
Error: Port 5432 is already in use
```

**解决方法**:
1. 修改 `.env` 中的 `POSTGRES_PORT` 等端口变量
2. 或停止占用端口的本地服务

### 6.3 权限错误

```
Error: Permission denied (publickey)
```

**解决方法**:
1. 确保已配置 SSH 密钥并添加到 Git 仓库
2. 检查 `.env` 文件权限（不应为 777）

### 6.4 构建失败

```
Error: Could not resolve dependency
```

**解决方法**:
```bash
# 清理后重试
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## 7. 相关文档

- [环境变量与密钥清单](./env-vars.md) — 环境变量完整说明
- [集成端点配置指南](./integration-config.md) — 集成端点配置
- [监控与告警说明](./monitoring.md) — 运行状态监控
- [生产切换清单](./production-switch-checklist.md) — 切生产前检查项
