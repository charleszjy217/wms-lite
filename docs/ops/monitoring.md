# 监控与告警说明

> 最后更新: 2026-07-04  
> 适用版本: WMS-lite v0.1.0

---

## 目录

1. [健康检查](#1-健康检查)
2. [服务日志](#2-服务日志)
3. [数据库监控](#3-数据库监控)
4. [集成同步状态](#4-集成同步状态)
5. [审计日志](#5-审计日志)
6. [告警配置](#6-告警配置)
7. [Prometheus 指标](#7-prometheus-指标)
8. [常见排查步骤](#8-常见排查步骤)

---

## 1. 健康检查

### 1.1 后端服务健康检查端点

```
GET /api/v1/health
```

**响应示例 (正常)**:

```json
{
  "status": "ok"
}
```

**响应示例 (异常)**:

```json
{
  "statusCode": 503,
  "message": "Service Unavailable"
}
```

### 1.2 Docker Compose 健康检查

PostgreSQL 容器已配置健康检查：

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-wms_user} -d ${POSTGRES_DB:-wms_lite}"]
  interval: 10s
  timeout: 5s
  retries: 5
```

### 1.3 检查所有服务状态

```bash
# 查看容器状态
docker compose ps

# 查看所有容器健康状态
docker inspect --format='{{.Name}} -> {{.State.Health.Status}}' $(docker ps -q)

# 实时监控资源使用
docker stats

# 检查特定服务日志
docker compose logs --tail=100 backend
```

### 1.4 预期输出示例

```
NAME                IMAGE               SERVICE           STATUS          PORTS
wms-postgres        postgres:16-alpine  postgres          running (healthy)   5432/tcp
wms-backend         wms-lite-backend    backend           running             0.0.0.0:3000->3000/tcp
wms-frontend        wms-lite-frontend   frontend          running             0.0.0.0:5173->80/tcp
```

---

## 2. 服务日志

### 2.1 日志级别

| 级别 | 说明 | 使用场景 |
|------|------|----------|
| `debug` | 调试信息 | 开发/故障排查 |
| `info` | 常规信息 | 生产环境默认 |
| `warn` | 警告信息 | 异常但不影响运行 |
| `error` | 错误信息 | 需要关注的问题 |

通过 `LOG_LEVEL` 环境变量控制（见 [环境变量清单](./env-vars.md)）。

### 2.2 查看日志

```bash
# 查看所有服务日志（实时）
docker compose logs -f

# 查看后端日志
docker compose logs -f backend

# 查看最近 N 行
docker compose logs --tail=200 backend

# 按时间过滤
docker compose logs --since="2026-07-04T10:00:00" backend

# 搜索关键词
docker compose logs backend | grep -i error

# 结构化日志（JSON 格式）
docker compose logs backend | jq '.level'
```

### 2.3 日志格式

后端日志采用 JSON 结构化格式：

```json
{
  "level": "info",
  "message": "Backend running on http://localhost:3000/api/v1",
  "timestamp": "2026-07-04T10:00:00.000Z",
  "context": "NestFactory"
}

{
  "level": "error",
  "message": "Sync job failed, scheduled retry 2/3",
  "timestamp": "2026-07-04T10:01:00.000Z",
  "endpointId": "erp-product-sync",
  "jobId": "sync-42-1743140138104",
  "retryCount": 2,
  "errorCode": "TIMEOUT",
  "sandbox": true
}
```

### 2.4 日志持久化

对于生产环境，建议：

1. **Docker 日志驱动**: 配置 `json-file`（默认）或 `syslog`、`fluentd`
2. **日志收集**: 使用 ELK Stack (Elasticsearch + Logstash + Kibana) 或 Loki + Grafana
3. **日志轮转**: 避免磁盘写满

```yaml
# docker-compose.override.yml 示例 — 日志轮转配置
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## 3. 数据库监控

### 3.1 连接检查

```bash
# 检查数据库连接
docker compose exec postgres pg_isready -U wms_user -d wms_lite

# 查看活跃连接
docker compose exec postgres psql -U wms_user -d wms_lite -c "SELECT count(*) FROM pg_stat_activity;"

# 查看连接详情
docker compose exec postgres psql -U wms_user -d wms_lite -c "
SELECT pid, usename, application_name, state, query_start, query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start DESC;
"
```

### 3.2 数据库大小

```bash
# 查看数据库大小
docker compose exec postgres psql -U wms_user -d wms_lite -c "
SELECT
  pg_database_size('wms_lite') as db_bytes,
  pg_size_pretty(pg_database_size('wms_lite')) as db_size;
"

# 查看表大小
docker compose exec postgres psql -U wms_user -d wms_lite -c "
SELECT
  relname as table_name,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
"
```

### 3.3 慢查询监控

```bash
# 启用慢查询日志（需在 PostgreSQL 配置中启用）
docker compose exec postgres psql -U wms_user -d wms_lite -c "
SELECT
  query,
  calls,
  total_time / calls as avg_time_ms,
  rows / calls as avg_rows
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
"
```

---

## 4. 集成同步状态

### 4.1 查看同步任务

集成同步任务记录在 `SyncJob` 数据库表中，可通过 API 查询：

```
GET /api/v1/integration/sync-jobs?status=FAILED&limit=20
```

同步任务状态说明：

| 状态 | 含义 |
|------|------|
| `PENDING` | 等待执行 |
| `RUNNING` | 执行中 |
| `COMPLETED` | 执行成功 |
| `FAILED` | 执行失败 |
| `RETRYING` | 重试中 |
| `CANCELLED` | 已取消 |

### 4.2 查看端点状态

```bash
# 查询所有集成端点状态
docker compose exec backend npx prisma studio

# 或通过数据库查询
docker compose exec postgres psql -U wms_user -d wms_lite -c "
SELECT code, name, status, environment, last_sync_at
FROM integration_endpoint
ORDER BY code;
"
```

### 4.3 同步任务监控指标

每个端点的同步任务追踪以下指标：

| 指标 | 说明 |
|------|------|
| 总执行次数 | 端点到目前为止的同步次数 |
| 成功率 | `COMPLETED / (COMPLETED + FAILED)` |
| 最近一次执行时间 | 最近一次同步的开始时间 |
| 最近一次执行状态 | 最近一次同步的最终状态 |
| 平均执行时长 | 同步任务的平均耗时 |
| 重试次数 | 因失败触发的重试累计次数 |

### 4.4 查看同步日志

```bash
# 查看与集成相关的日志
docker compose logs backend | grep -E "(SyncJob|Integration|SyncTask)"

# 查看特定端点的日志
docker compose logs backend | grep "erp-product-sync"

# 查看最近的失败记录
docker compose logs backend | grep -i "FAILED"
```

---

## 5. 审计日志

### 5.1 审计日志查询

所有重要的库存和价格变更均写入审计日志，可通过 API 查询：

```
GET /api/v1/audit?entityType=Product&action=UPDATE&limit=50
```

### 5.2 审计日志字段

| 字段 | 说明 |
|------|------|
| `entityType` | 实体类型 (Product, InventoryBalance, ProductPrice 等) |
| `entityId` | 实体 ID |
| `action` | 操作类型 (CREATE, UPDATE, DELETE) |
| `operator` | 操作人 |
| `before` | 变更前快照 (JSON) |
| `after` | 变更后快照 (JSON) |
| `timestamp` | 操作时间 |

### 5.3 审计日志查询示例

```bash
# 直接数据库查询
docker compose exec postgres psql -U wms_user -d wms_lite -c "
SELECT entity_type, action, operator, created_at
FROM audit_log
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;
"
```

---

## 6. 告警配置

### 6.1 需要设置告警的场景

| 场景 | 严重级别 | 建议告警方式 |
|------|----------|-------------|
| 后端服务不可用 (health check 失败) | **Critical** | PagerDuty / 短信 / 电话 |
| 数据库连接失败 | **Critical** | PagerDuty / 短信 / 电话 |
| 集成同步连续失败 (3次+) | **High** | 邮件 + 即时消息 |
| 集成同步延迟超过阈值 (30分钟+) | **High** | 邮件 + 即时消息 |
| 磁盘使用率超过 80% | **Warning** | 邮件 |
| 熔断器打开 | **High** | 邮件 + 即时消息 |
| 审计日志异常写入失败 | **Warning** | 邮件 |

### 6.2 告警检查脚本示例

```bash
#!/bin/bash
# health-check.sh — 健康检查告警脚本

BACKEND_URL="http://localhost:3000/api/v1/health"

# 检查后端健康
if ! curl -sf "$BACKEND_URL" > /dev/null; then
    echo "ALERT: Backend health check failed at $(date)"
    # 发送告警 (示例: 写入日志，实际集成 PagerDuty/Slack)
    logger -t wms-alert "Backend health check failed"
    exit 1
fi

echo "OK: Backend is healthy"
```

### 6.3 Docker 容器监控

```bash
# 检查容器重启次数
docker inspect --format='{{.Name}} {{.RestartCount}}' $(docker ps -q)

# 检查容器资源使用
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

# 设置 Docker 自动重启策略（已在 compose 中配置 restart: unless-stopped）
```

### 6.4 告警集成建议

| 工具 | 用途 | 集成方式 |
|------|------|----------|
| **Healthchecks.io** | 定时健康检查告警 | HTTP 调用 `/api/v1/health` |
| **Uptime Kuma** | 服务可用性监控 | HTTP 监控 |
| **Prometheus + Alertmanager** | 指标采集 + 告警 | Prometheus exporter |
| **Grafana** | 可视化仪表盘 | Prometheus / Loki 数据源 |
| **Slack / 钉钉 / 飞书** | 即时消息通知 | Webhook |

---

## 7. Prometheus 指标

### 7.1 计划指标（需集成 prometheus 模块）

| 指标名 | 类型 | 说明 |
|--------|------|------|
| `wms_http_requests_total` | Counter | HTTP 请求总数 |
| `wms_http_request_duration_ms` | Histogram | 请求耗时分布 |
| `wms_db_connections_active` | Gauge | 活跃数据库连接数 |
| `wms_integration_sync_total` | Counter | 集成同步执行次数，标签：`endpoint`, `status` |
| `wms_integration_sync_duration_ms` | Histogram | 同步任务耗时，标签：`endpoint` |
| `wms_integration_circuit_breaker_state` | Gauge | 熔断器状态（0=closed, 1=open, 2=half-open），标签：`endpoint` |
| `wms_integration_retry_count` | Counter | 重试次数，标签：`endpoint` |

### 7.2 指标端点

```
GET /api/v1/metrics
```

> **注意**: Prometheus 指标模块为计划功能，当前版本未集成。上方为指标体系参考。

---

## 8. 常见排查步骤

### 8.1 服务无法启动

```bash
# 1. 检查所有容器状态
docker compose ps

# 2. 查看完整启动日志
docker compose logs --tail=100

# 3. 检查端口冲突
netstat -tlnp | grep -E "(3000|5173|5432)"

# 4. 检查环境变量
docker compose config
```

### 8.2 数据库连接问题

```bash
# 1. 检查数据库是否就绪
docker compose exec postgres pg_isready

# 2. 测试用户登录
docker compose exec postgres psql -U wms_user -d wms_lite -c "SELECT 1;"

# 3. 检查连接数
docker compose exec postgres psql -U wms_user -d wms_lite -c "SELECT count(*) FROM pg_stat_activity;"
```

### 8.3 集成同步失败

```bash
# 1. 查看同步任务错误信息
docker compose logs backend | grep -i "sync.*fail"

# 2. 检查端点可达性
docker compose exec backend wget -q -O - https://erp-sandbox.example.com/health 2>&1

# 3. 检查密钥是否配置
docker compose exec backend sh -c "echo \$INTEGRATION_ERP_API_KEY"
```

### 8.4 磁盘空间不足

```bash
# 1. 检查 Docker 磁盘使用
docker system df

# 2. 清理未使用的镜像/容器/卷
docker system prune -f

# 3. 检查日志文件大小
docker compose logs --tail=0 backend | wc -c

# 4. 清理构建缓存
docker builder prune -f
```

---

## 9. 相关文档

- [环境变量与密钥清单](./env-vars.md) — 日志级别配置
- [部署步骤](./deployment.md) — 服务部署与重启
- [集成端点配置指南](./integration-config.md) — 同步状态追踪
- [生产切换清单](./production-switch-checklist.md) — 切换前后监控配置
