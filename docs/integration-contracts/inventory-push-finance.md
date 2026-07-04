# 库存/价值变动出站推送至财务 — 接口契约

> **文档版本:** 1.0.0  
> **链路编号:** LK-002  
> **方向:** 出站 (OUTBOUND)  
> **触发方式:** 事件驱动 (EVENT)  
> **最后更新:** 2026-07-04

---

## 1. 概述

监听库存变动事件（StockMovement 创建后），组装包含库存估值的 payload，通过 HTTP/REST 推送至财务系统（沙箱端点）。采用 HMAC 签名认证确保数据完整性。

### 1.1 架构位置

```
[StockMovement 创建事件]
        │
        ▼
[InventoryPushFinanceLink]
        │
        ├─→ 组装 payload (含估值计算)
        ├─→ HmacAuthAdapter (HMAC 签名)
        ├─→ IdempotencyStore (去重)
        ├─→ Retry (指数退避)
        ├─→ InMemorySyncTaskTracker (状态)
        └─→ InMemoryDeadLetterQueue (失败)
        │
        ▼
[财务系统沙箱]  ←── HTTP POST ──
```

### 1.2 端点基础 URL

| 环境 | URL |
|------|-----|
| **沙箱 (默认)** | `https://sandbox.finance.example.com/api/v1` |
| 开发 | `http://localhost:9001/api/v1` |
| 生产 | 由运维配置注入 |

> **注:** 端点 URL 通过环境变量 `INTEGRATION_FINANCE_BASE_URL` 注入，严禁硬编码。

---

## 2. 请求

### 2.1 库存价值变动推送

```
POST {baseUrl}/inventory-valuation
```

**请求头:**

| 头名称 | 值 | 必填 |
|--------|-----|:----:|
| `Content-Type` | `application/json` | 是 |
| `Accept` | `application/json` | 是 |
| `X-Hmac-Signature` | `sha256={signature}` | 是 |
| `X-Idempotency-Key` | `{movementId}` | 是 |
| `X-Event-Id` | `{eventId}` | 是 |
| `X-Source-System` | `wms-lite` | 是 |

### 2.2 请求体 (JSON)

```json
{
  "eventType": "stock_movement.created",
  "occurredAt": "2026-07-04T10:30:00Z",
  "movement": {
    "movementId": "mov-001",
    "movementType": "RECEIPT",
    "productSku": "MCU-STM32F103",
    "productName": "STM32F103C8T6 微控制器",
    "batchNo": "BATCH-2024-001",
    "fromLocationCode": null,
    "toLocationCode": "WH-MAIN-A-01-A-1-01",
    "quantity": 500,
    "unit": "PCS",
    "unitPrice": 12.50,
    "referenceType": "PO",
    "referenceNo": "PO-2026-0001",
    "operator": "admin"
  },
  "valuation": {
    "totalValue": 6250.00,
    "currency": "CNY",
    "valuationMethod": "MOVING_AVERAGE"
  }
}
```

**字段说明:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `eventType` | string | 是 | 事件类型标识 |
| `occurredAt` | string (ISO 8601) | 是 | 事件发生时间 |
| `movement.movementId` | string | 是 | 库存变动唯一 ID |
| `movement.movementType` | string | 是 | 变动类型: RECEIPT/SHIPMENT/TRANSFER/ADJUSTMENT_PLUS/ADJUSTMENT_MINUS |
| `movement.productSku` | string | 是 | 商品 SKU |
| `movement.productName` | string | 是 | 商品名称 |
| `movement.batchNo` | string | 否 | 批次号 |
| `movement.fromLocationCode` | string | 否 | 来源库位 |
| `movement.toLocationCode` | string | 否 | 目标库位 |
| `movement.quantity` | number | 是 | 变动数量 |
| `movement.unit` | string | 是 | 计量单位 |
| `movement.unitPrice` | number | 是 | 单价 |
| `movement.referenceType` | string | 是 | 单据类型 |
| `movement.referenceNo` | string | 是 | 单据编号 |
| `valuation.totalValue` | number | 是 | 估值总额 (= qty × unitPrice) |
| `valuation.currency` | string | 是 | 货币代码 (ISO 4217) |
| `valuation.valuationMethod` | string | 是 | 估值方法 |

---

## 3. 响应

### 3.1 成功响应 (200 OK)

```json
{
  "code": 0,
  "message": "accepted",
  "data": {
    "receiptId": "fin-rec-001",
    "status": "PROCESSED"
  }
}
```

### 3.2 通用错误响应

```json
{
  "code": 40001,
  "message": "HMAC 签名验证失败",
  "traceId": "req-abc-123"
}
```

### 3.3 错误码

| 错误码 | 说明 |
|:------:|------|
| 0 | 成功 |
| 40001 | HMAC 签名无效或缺失 |
| 40002 | 请求体格式错误 |
| 40003 | 幂等键重复（已处理过该事件） |
| 40004 | 请求频率超限 (429) |
| 50001 | 财务系统内部错误 |
| 50002 | 超时 |

---

## 4. 本系统推送说明

### 4.1 推送流程

1. StockMovement 创建后触发事件
2. 组装 payload，查询 product 获取单价、名称等信息
3. 计算估值 totalValue = quantity × unitPrice
4. 通过 HMAC 适配器对请求体签名
5. 附加幂等键（使用 movementId）
6. 向财务系统沙箱端点发送 POST 请求
7. 记录推送状态到 SyncTaskTracker

### 4.2 重试策略

| 参数 | 值 |
|------|-----|
| 最大尝试次数 | 3 |
| 基础延迟 | 1s |
| 最大延迟 | 15s |
| 抖动 | 是 |

### 4.3 死信队列

当单次推送连续重试 3 次失败后，自动推入死信队列。通过管理界面可手动重试或归档。

---

## 5. 配置参考

```env
# 财务系统端点 URL（沙箱默认）
INTEGRATION_FINANCE_BASE_URL=https://sandbox.finance.example.com/api/v1

# HMAC 签名密钥
INTEGRATION_FINANCE_HMAC_KEY=hmac-sandbox-key

# HMAC 算法
INTEGRATION_FINANCE_HMAC_ALGORITHM=sha256

# 重试配置
INTEGRATION_FINANCE_RETRY_MAX_ATTEMPTS=3
INTEGRATION_FINANCE_RETRY_BASE_DELAY_MS=1000
INTEGRATION_FINANCE_RETRY_MAX_DELAY_MS=15000

# 货币代码
INTEGRATION_FINANCE_CURRENCY=CNY
```

---

## 6. 安全注意事项

- HMAC 密钥通过 SecretStore 获取，不记录日志
- 幂等键确保财务系统不会重复记账
- 请求体签名保证传输完整性（防篡改）
- 沙箱和生产使用不同的 HMAC 密钥
