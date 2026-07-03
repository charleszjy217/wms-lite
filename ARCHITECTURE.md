# WMS-lite 架构文档

> 版本: 1.0  
> 对应 Wave 0 T0.1: 调研与架构定案  
> 最后更新: 2026-07-03

---

## 目录

1. [技术栈决策](#1-技术栈决策)
2. [UI 选型](#2-ui-选型)
3. [设计令牌 (Design Tokens)](#3-设计令牌-design-tokens)
4. [集成框架设计](#4-集成框架设计)
5. [规范模型 (Canonical Model)](#5-规范模型-canonical-model)
6. [模块划分与目录结构](#6-模块划分与目录结构)
7. [接口契约示例](#7-接口契约示例)

---

## 1. 技术栈决策

### 1.1 后端: TypeScript + NestJS

| 维度 | TypeScript + NestJS | Python + FastAPI |
|------|---------------------|-------------------|
| **类型安全** | 原生 TypeScript 编译时检查, 全栈复用同一类型系统 | 通过 Pydantic 模型实现, 但前后端类型需独立维护 |
| **ORM / 数据库生态** | Prisma (类型安全的查询引擎), TypeORM, Drizzle — 均成熟 | SQLAlchemy + Alembic, 成熟但 Python 类型体系不如 TS 严格 |
| **集成层适配器** | Node.js 对 HTTP/SOAP/gRPC/消息队列均有成熟客户端库 | Python 同样丰富, 但 gRPC/Pulsar 等现代协议生态略逊 |
| **全栈一致性** | 前后端同一语言, 类型定义可跨层复用 (validation, DTO, 规范模型) | 前后端分离, 需维护两套类型定义 |
| **企业共识** | NestJS 以 Angular 风格模块化见长, DI 容器 + 装饰器 + 面向接口编程, 适合长期演进的中大型项目 | FastAPI 简洁高效, 适合快速迭代, 但在复杂模块化/插件体系上需自行组织 |
| **可插拔框架需求** | NestJS 的 Dynamic Module / custom provider / decorator 可天然支撑 Connector 插件注册与 IoC | FastAPI 无内置 DI 容器, 需依赖注入库或手动 `lifespan` 管理 |
| **社区活跃度** | 极高 (GitHub 79k+ stars), enterprise 采用率上升中 | 极高 (GitHub 85k+ stars), ML/AI 领域首选 |
| **部署成本** | Node.js 运行时轻量, Docker 镜像 ~150MB | Python 镜像需包含 runtime + deps, 通常 >300MB |

**结论: 选用 TypeScript + NestJS**

核心原因:
1. **全栈类型一致性** — 前后端共享 TypeScript 类型, 规范模型可在 `packages/shared` 中统一定义, 减少集成时的字段映射错误
2. **可插拔框架支撑** — NestJS 的 `DynamicModule.register()` / `@Injectable()` 装饰器体系与集成层 Connector 插件注册机制天然契合, 无需额外造 IoC 容器
3. **企业级模块化** — 每个集成端点可封装为一个 NestJS Module, 通过配置注册, 按需加载; FastAPI 的 lifespan + router 方案在面对 20+ 集成端点时组织成本更高
4. **Prisma ORM** — 提供类型安全的数据库客户端, 迁移工具成熟, 与 TypeScript 结合极为紧密

> **备注**: 如部署环境已有 Python 技术栈且团队 Python 能力更强, 可推翻此决策。FastAPI + SQLAlchemy 同样是合理选项, 仅集成层的插件注册机制需额外实现。

### 1.2 数据库: PostgreSQL (默认, 不可推翻)

| 特性 | 理由 |
|------|------|
| 版本 | PostgreSQL 16+ |
| 迁移工具 | Prisma Migrate (与 NestJS + TypeScript 生态匹配) |
| 扩展 | `pgcrypto` (UUID 生成)、`pg_trgm` (模糊搜索)、`btree_gin` (复合索引) |
| 连接池 | Prisma 内置连接池 / 或 PgBouncer for 高并发 |

约束:
- 所有表变更通过迁移文件, 不允许手改 schema
- 库存余额表使用 `SELECT ... FOR UPDATE` 行锁保证并发安全

### 1.3 前端基础栈

- **框架**: React 18+ + TypeScript (strict mode)
- **构建**: Vite (HMR 快速, ESM 原生)
- **路由**: React Router v7+
- **HTTP 客户端**: TanStack Query (React Query) + fetch/axios

---

## 2. UI 选型

### 2.1 GitHub 调研结果

按 §7 标准逐一调研以下候选方案:

| 候选方案 | Stars | 许可证 | 最后推送 | 说明 |
|---------|-------|--------|---------|------|
| **Ant Design Pro** | 38,495 | MIT | 2026-07-03 | 企业级 admin 框架, 含布局/权限/i18n/图表 |
| **Ant Design** | 98,551 | MIT | 2026-07-02 | 组件库, 非 admin 模板 |
| **Refine** | 35,136 | MIT | 2026-06-05 | React admin 框架, 数据提供者模式 |
| **shadcn/ui** | 117,993 | MIT | 2026-07-03 | 组件集合, 非 admin 模板 |
| **satnaing/shadcn-admin** | 12,525 | MIT | 2026-06-16 | 基于 shadcn/ui 的 admin 模板 |
| **Kiranism/next-shadcn-dashboard** | 6,636 | MIT | 2026-06-22 | 基于 shadcn/ui 的 dashboard 启动器 |
| **Tremor** | 3,502 | Apache-2.0 | 2025-10 | 仅图表组件, 非全功能 admin |
| **MUI (Material UI)** | 98,529 | MIT | 2026-07-03 | 组件库, 需自行组装 admin 框架 |
| **react-admin** | 26,825 | MIT | 2026-07-02 | Admin 框架, 但商业使用需企业授权 (核心框架 MIT, 专业组件付费) |
| **HeroUI (NextUI)** | 尚不可查 | Apache-2.0 | — | 较新, 生态尚未稳定 |

### 2.2 选型结论

**选型: Ant Design Pro + Ant Design 组件库**

| 评判标准 | Ant Design Pro | shadcn-admin | Refine |
|----------|---------------|--------------|--------|
| 许可证允许商用 | ✅ MIT | ✅ MIT | ✅ MIT |
| 表格/表单/图表/权限布局 | ✅ 全部内置 | 表格/表单需额外集成 | ✅ 内置, 需配数据提供者 |
| 中文场景友好 | ✅ 原生中文文档、locale、社区 | ❌ 英文为主 | ❌ 英文为主 |
| 活跃维护 | ✅ 2.6k commits/年 | ✅ 活跃 | ✅ 活跃 |
| 与 React+Vite 契合 | ✅ Ant Design 组件库完美支持 Vite; Pro 默认 UmiJS 但可拆用其设计模式 | ✅ 基于 Tailwind + Vite | ✅ 支持 |
| 组件覆盖度 | 极高 (50+ 企业级组件) | 基础 (需自行补齐) | 高 (30+ 组件) |
| 设计 Token 体系 | ✅ 成熟的 ConfigProvider + Design Token 机制 | ⚠️ CSS 变量, 较基础 | ⚠️ 有限 |

**核心理由**:

1. **中文场景原生友好** — Ant Design 由蚂蚁集团维护, 中文文档、中文社区、中文 locale 开箱即用; 库存管理系统的用户界面以中文为主, 选择 Ant Design 可减少 90% 的 i18n 适配工作

2. **企业级组件覆盖** — 库存管理涉及大量:
   - **复合表格**: 可编辑表格、树形表格、批量操作、筛选排序
   - **复杂表单**: 商品/批次录入、调价表单、级联选择
   - **日期时间**: 生产日期、有效期选择, 中文日期格式原生支持
   - **图表/仪表盘**: @ant-design/charts 基于 G2, 满足库存趋势、临期分布等可视化

3. **权限布局** — Ant Design Pro 开箱提供:
   - 菜单权限控制 (路由级 + 按钮级)
   - 多角色布局切换
   - 标签式导航 (多页签)

4. **设计 Token 体系成熟** — Ant Design 5.x 的 `ConfigProvider` + `theme` 支持细粒度自定义, 可直接抽取设计规范

### 2.3 未选理由说明

- **shadcn-admin** 被否决: Dashboard 层面美观, 但缺少企业级表单/表格/权限管理组件, 需从零集成太多生态库, 不符合 "不从零手搓样式" 的目标
- **Refine** 被否决: 英文生态, 数据提供者模式对已有后端接口存在适配成本, 中文场景支持弱
- **react-admin** 被否决: 商业授权不清晰, 核心免费但企业组件需付费, 合规风险
- **Tremor** 被否决: 仅图表组件, 不足以支撑完整 admin

### 2.4 Ant Design Pro 使用方式

鉴于 Ant Design Pro 默认使用 UmiJS, 而项目前端栈已定为 Vite, 采用以下策略:

| 组件 | 来源 | 说明 |
|------|------|------|
| **基础组件** | `antd` (Ant Design 5.x) | Vite + React 原生支持, 零额外配置 |
| **布局/权限** | `@ant-design/pro-layout`, `@ant-design/pro-provider` | 独立 npm 包, 不与 UmiJS 耦合 |
| **高级表格/表单** | `@ant-design/pro-table`, `@ant-design/pro-form` | 声明式配置, 减少样板代码 |
| **图表** | `@ant-design/charts` | 基于 G2, 支持常见业务图表 |
| **i18n** | `react-intl` + antd locale | 中文为主, 兼顾国际化扩展 |

> **设计原则**: 使用 Ant Design 生态组件, 但不引入 UmiJS; 采用 Pro 系列的独立包, 与 Vite 构建链兼容。

---

## 3. 设计令牌 (Design Tokens)

从 Ant Design 5.x 设计体系中抽取, 后续所有页面统一引用, 确保视觉一致性。

### 3.1 配色方案

```yaml
# 基于 Ant Design 默认主题 + 库存管理场景微调
color:
  primary:      "#1677FF"    # Ant Design 蓝 — 主品牌色, 按钮/链接/激活态
  success:      "#52C41A"    # 成功/入库/已同步
  warning:      "#FAAD14"    # 警告/临期预警
  danger:       "#FF4D4F"    # 危险/过期/同步失败
  info:         "#1677FF"    # 信息

  # 中性色
  text:         "#1F2937"    # 主要文字
  textSecondary:"#6B7280"    # 次要文字
  textDisabled: "#9CA3AF"    # 禁用文字
  border:       "#D1D5DB"    # 边框
  bg:           "#FFFFFF"    # 页面背景
  bgLayout:     "#F5F5F5"    # 布局背景
  bgContainer:  "#FFFFFF"    # 容器/卡片背景

  # 语义色
  inventoryPositive: "#16A34A"   # 库存正变动 (入库/盘盈)
  inventoryNegative: "#DC2626"   # 库存负变动 (出库/盘亏)
  expiryNormal:      "#22C55E"   # 有效期正常
  expiryWarning:     "#F59E0B"   # 临期预警 (30天内)
  expiryCritical:    "#EF4444"   # 临期紧急 (7天内) / 已过期
```

### 3.2 字体

```yaml
typography:
  fontFamily:
    base:   "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif"
    mono:   "'JetBrains Mono', 'SF Mono', 'Monaco', 'Consolas', monospace"
    code:   "'Source Code Pro', 'Courier New', monospace"

  fontSize:
    xs:        "0.75rem"     # 12px — 辅助文字/标签
    sm:        "0.875rem"    # 14px — 正文默认
    base:      "1rem"        # 16px — 大段文字
    lg:        "1.125rem"    # 18px — 次级标题
    xl:        "1.25rem"     # 20px — 标题
    "2xl":     "1.5rem"      # 24px — 页面标题
    "3xl":     "1.875rem"    # 30px — 大标题

  lineHeight:
    tight:    "1.25"
    base:     "1.5"
    relaxed:  "1.75"
```

### 3.3 间距 (Spacing Scale)

```yaml
spacing:
  xs:   "4px"     # 紧凑间距, 表格单元格内
  sm:   "8px"     # 元素间间距
  md:   "16px"    # 默认间距, 组件内间距
  lg:   "24px"    # 卡片/区块间距
  xl:   "32px"    # 页面区块间距
  "2xl":"48px"    # 大区块间距
  "3xl":"64px"    # 页面边距
```

### 3.4 阴影与圆角

```yaml
borderRadius:
  sm:   "4px"     # 输入框/按钮
  base: "6px"     # 卡片
  lg:   "8px"     # 模态框/抽屉
  xl:   "12px"    # 弹窗
  full: "9999px"  # 标签/徽标

shadow:
  sm:   "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
  base: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)"
  lg:   "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)"
  xl:   "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)"
  drawer:"-4px 0 8px rgba(0, 0, 0, 0.1)"
  modal: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
```

### 3.5 Ant Design ConfigProvider 配置

```tsx
// 前端设计令牌 - 通过 Ant Design ConfigProvider 注入
const themeConfig = {
  token: {
    colorPrimary: '#1677FF',
    colorSuccess: '#52C41A',
    colorWarning: '#FAAD14',
    colorError: '#FF4D4F',
    colorInfo: '#1677FF',
    borderRadius: 6,
    fontSize: 14,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  components: {
    Table: {
      headerBg: '#FAFAFA',
      headerBorderRadius: 6,
      rowHoverBg: '#F0F5FF',
    },
    Card: {
      borderRadius: 8,
    },
    // ... 按需覆盖
  },
};
```

### 3.6 组件设计规范

| 组件 | 规范 |
|------|------|
| **页面布局** | 左侧导航栏 240px (collapsible to 64px), 顶部 header 56px, 内容区域 padding 24px |
| **卡片 (Card)** | 圆角 8px, 背景白, 内边距 24px, 标题栏 16px 字重 600 |
| **表格 (Table)** | 斑马纹(alternate)可选, 每行 48px 高度, 操作列右对齐, 分页器在右下 |
| **表单 (Form)** | 标签左对齐, 标签宽度 120px, 必填项标红色星号, 校验反馈 inline |
| **按钮 (Button)** | 主按钮 #1677FF, 次按钮白色边框, 危险按钮红色, 最小宽度 80px |
| **标签 (Tag/Badge)** | 状态标签统一使用 Badge 点 + 颜色: 绿色(正常)、黄色(预警)、红色(过期/错误) |
| **模态框 (Modal)** | 宽度 520px(默认)/800px(宽), 确定按钮在左, 取消在右 |
| **抽屉 (Drawer)** | 从右侧滑出, 宽度 400px(详情)/600px(编辑表单) |
| **日期选择** | 中文格式 "YYYY-MM-DD", 生产日期/有效期专用 DatePicker |
| **空状态** | 表格/列表无数据时显示空状态插画 + 提示文字 |

---

## 4. 集成框架设计

### 4.1 架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    业务层 (Business)                       │
│  ProductService / InventoryService / PriceService ...    │
│  只依赖规范模型 (Canonical Model), 不感知外部系统           │
└────────────────────┬────────────────────────────────────┘
                     │ 调用
┌────────────────────▼────────────────────────────────────┐
│              防腐层 (Anti-Corruption Layer)               │
│  每个外部系统一个 xxxAclService                           │
│  职责: 字段映射 / 编码转换 / 单位换算 / 日期格式化        │
│  入站: External → Canonical                              │
│  出站: Canonical → External                              │
└────────────────────┬────────────────────────────────────┘
                     │ 委托
┌────────────────────▼────────────────────────────────────┐
│             Connector 插件层 (可插拔)                     │
│                                                          │
│  ┌────────────────┐  ┌────────────────┐                  │
│  │ HttpConnector  │  │ AmqpConnector  │  ... (新协议)     │
│  │ (REST/SOAP)    │  │ (RabbitMQ)     │                  │
│  └────────────────┘  └────────────────┘                  │
│                                                          │
│  统一 ConnectorPort 接口                                  │
│  注册: ConnectorRegistry.register('http', HttpConnector) │
└────────────────────┬────────────────────────────────────┘
                     │ 配置驱动
┌────────────────────▼────────────────────────────────────┐
│            IntegrationEndpoint 配置 (运行时)              │
│  endpoint.yaml / 管理 API 动态注册                        │
│  每端点: 协议 / 认证 / 方向 / 触发 / 映射 / 可靠性         │
│  默认指向沙箱, 切生产需显式确认                            │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Connector 插件接口

每个传输协议适配器需实现 `ConnectorPort` 接口:

```typescript
// === packages/integration-framework/src/connector/connector-port.ts ===

/**
 * Connector 插件接口
 * 所有传输协议适配器必须实现此接口
 */
export interface ConnectorPort {
  /** 协议唯一标识, 如 'http', 'amqp', 'kafka', 'file-sftp' */
  readonly protocol: string;

  /** 初始化 (生命周期: 应用启动时调用) */
  initialize?(config: ConnectorConfig): Promise<void>;

  /** 销毁 (生命周期: 应用关闭时调用) */
  destroy?(): Promise<void>;

  /** 出站: 发送数据到外部系统 */
  send<TReq, TRes>(ctx: SendContext<TReq>): Promise<SendResult<TRes>>;

  /** 入站: 接收数据 (仅监听类协议需要) */
  receive?(handler: ReceiveHandler): Promise<void>;
}

// === 类型定义 ===
export interface ConnectorConfig {
  baseUrl?: string;
  endpoints?: Record<string, EndpointConfig>;
  auth?: AuthConfig;
  timeout?: number;
  retry?: RetryConfig;
  circuitBreaker?: CircuitBreakerConfig;
  sandbox: boolean; // 强制: 默认 true, 切生产需显式 confirm
}

export interface SendContext<T = unknown> {
  endpointKey: string;
  payload: T;
  idempotencyKey?: string;
  metadata?: Record<string, string>;
}

export interface SendResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: IntegrationError;
  syncJobId?: string;
}

export interface ReceiveHandler {
  (message: InboundMessage): Promise<ReceiveAck>;
}

export interface InboundMessage {
  payload: unknown;
  sourceSystem: string;
  receivedAt: string;
  idempotencyKey?: string;
}

export interface ReceiveAck {
  accepted: boolean;
  error?: string;
}
```

### 4.3 Connector 注册机制

```typescript
// === packages/integration-framework/src/connector/connector-registry.ts ===

/**
 * 全局 Connector 注册表
 * 采用策略模式: 新增协议 = 实现 ConnectorPort + registry.register()
 */
export class ConnectorRegistry {
  private static connectors = new Map<string, ConnectorPort>();

  /** 注册一个协议适配器实例 */
  static register(connector: ConnectorPort): void {
    if (this.connectors.has(connector.protocol)) {
      throw new Error(`Connector '${connector.protocol}' already registered`);
    }
    this.connectors.set(connector.protocol, connector);
  }

  /** 获取指定协议的适配器 */
  static get(protocol: string): ConnectorPort {
    const conn = this.connectors.get(protocol);
    if (!conn) {
      throw new Error(`No connector registered for protocol '${protocol}'`);
    }
    return conn;
  }

  /** 列出所有已注册协议 */
  static listProtocols(): string[] {
    return Array.from(this.connectors.keys());
  }
}
```

### 4.4 配置驱动端点定义

端点通过配置声明, 不作代码硬编码:

```yaml
# === config/integrations/erp-sync.yaml ===
# 每端点一份配置, 控制同步方向、触发方式、协议、认证、映射

endpoint:
  id: "erp-product-sync"
  name: "ERP 商品主数据同步"
  description: "从 ERP 系统同步商品基础信息"

  # 默认沙箱, 切生产需要显式确认 (在管理端操作)
  environment: "sandbox"    # sandbox | production
  requireConfirm: true      # 切 production 时需二次确认

  # 协议
  protocol: "http"
  connector: "rest"         # 对应注册的 ConnectorPort.protocol

  # 同步方向: inbound(入) | outbound(出) | bidirectional(双向)
  direction: "inbound"

  # 触发方式
  trigger:
    type: "polling"         # webhook | polling | scheduled | manual
    interval: "*/5 * * * *" # cron expression
    webhookPath: "/webhook/erp/product"   # 仅 webhook 类型需要

  # 认证
  auth:
    type: "oauth2"          # api-key | bearer | oauth2 | basic | mtls | hmac
    clientCredentials:
      tokenUrl: "https://erp-sandbox.example.com/oauth/token"
    scopes: ["products:read"]

  # 端点地址 (默认指向沙箱)
  baseUrl: "https://erp-sandbox.example.com/api/v2"
  endpoints:
    products: "/products"
    categories: "/categories"

  # 字段映射: external → canonical
  mapping:
    product:
      externalSchema: "erp_product_v2"
      fieldMappings:
        - external: "material_code"
          canonical: "skuCode"
          transformer: "trim+uppercase"
        - external: "material_desc"
          canonical: "name"
        - external: "base_uom"
          canonical: "unitOfMeasure"
          transformer: "mapUom"    # 编码字典映射
        - external: "prod_date_format"
          canonical: ""            # 无对应, 忽略

  # 可靠性
  reliability:
    idempotencyKey:
      source: "header"      # header | bodyField
      field: "X-Request-Id"
    retry:
      maxAttempts: 3
      backoffBaseMs: 1000
      backoffMultiplier: 2      # 指数退避: 1s → 2s → 4s
      maxBackoffMs: 30000
    deadLetterQueue:
      enabled: true
      maxRetries: 5
    circuitBreaker:
      failureThreshold: 5
      resetTimeoutMs: 30000     # 30s 后尝试恢复
      halfOpenMaxRequests: 3

  # 可观测
  observability:
    metricsEnabled: true
    logLevel: "info"
    alertOnFailure: true
    alertOnRecovery: true
```

### 4.5 认证适配器

```typescript
// === packages/integration-framework/src/auth/auth-adapter-port.ts ===

export interface AuthAdapter {
  readonly type: string;
  authenticate(request: AuthRequest): Promise<AuthCredential>;
  refresh?(credential: AuthCredential): Promise<AuthCredential>;
}

export interface AuthRequest {
  systemId: string;
  config: Record<string, unknown>;
}

export interface AuthCredential {
  token: string;
  type: 'bearer' | 'api-key' | 'basic';
  expiresAt?: number; // timestamp ms
  refreshToken?: string;
}
```

### 4.6 密钥抽象

密钥从不与应用配置混合, 通过 `secrets` 抽象层获取:

```typescript
// === packages/integration-framework/src/secrets/secrets-manager.ts ===

export interface SecretsManager {
  /** 获取密钥, 如系统密码/API Token */
  getSecret(key: string): Promise<string>;

  /** 获取密钥对 (如 mTLS 证书) */
  getSecretAsBuffer(key: string): Promise<Buffer>;

  /** 密钥轮换通知 */
  onSecretRotated?(key: string, newValue: string): Promise<void>;
}

// 默认实现: 环境变量
export class EnvSecretsManager implements SecretsManager {
  async getSecret(key: string): Promise<string> {
    const value = process.env[key];
    if (!value) throw new Error(`Secret '${key}' not found in environment`);
    return value;
  }

  async getSecretAsBuffer(key: string): Promise<Buffer> {
    const value = await this.getSecret(key);
    return Buffer.from(value, 'base64');
  }
}
```

### 4.7 防腐层 (ACL) 模式

每个外部系统对应一个 ACL Service:

```typescript
// === src/integration/acl/erp-product-acl.service.ts ===

@Injectable()
export class ErpProductAclService {
  constructor(
    private readonly mapper: FieldMapper,
    private readonly uomConverter: UomConverter,
  ) {}

  /**
   * 入站: ERP 商品 → 规范模型 Product
   * 字段映射 + 编码转换 + 数据清洗
   */
  async toCanonical(external: ErpProductDto): Promise<Product> {
    return {
      skuCode: this.mapper.map(external.material_code, { trim: true, uppercase: true }),
      name: external.material_desc,
      category: await this.mapper.mapCategory(external.category_id),
      unitOfMeasure: this.uomConverter.toCanonical(external.base_uom),
      barcode: external.ean_code,
      status: this.mapStatus(external.status_code),
      // ... 忽略无关字段
    };
  }

  /**
   * 出站: 规范模型 Product → ERP 格式
   */
  async toExternal(canonical: Product): Promise<ErpProductDto> {
    return {
      material_code: canonical.skuCode.toUpperCase(),
      material_desc: canonical.name,
      base_uom: this.uomConverter.toExternal(canonical.unitOfMeasure),
      ean_code: canonical.barcode || '',
      // ...
    };
  }

  private mapStatus(code: string): ProductStatus {
    const map: Record<string, ProductStatus> = {
      'A': ProductStatus.ACTIVE,
      'I': ProductStatus.INACTIVE,
      'D': ProductStatus.DISCONTINUED,
    };
    return map[code] ?? ProductStatus.UNKNOWN;
  }
}
```

### 4.8 同步任务引擎

```
┌──────────────┐     ┌────────────────┐     ┌──────────────┐
│  触发器       │────▶│  SyncJobEngine  │────▶│  Connector   │
│  (cron/webhook)│    │  (任务编排)      │    │  (传输)      │
└──────────────┘     └───────┬────────┘     └──────────────┘
                             │
                     ┌───────▼────────┐
                     │  SyncJobRecord │ (数据库持久化, 追踪每次执行)
                     │  - idempotency │
                     │  - status      │
                     │  - retry count │
                     │  - error log   │
                     └────────────────┘
```

```typescript
// === packages/integration-framework/src/job/sync-job.service.ts ===

@Injectable()
export class SyncJobService {
  constructor(
    @InjectRepository(SyncJobRecord)
    private readonly jobRepo: Repository<SyncJobRecord>,
    private readonly registry: ConnectorRegistry,
    private readonly deadLetterQueue: DeadLetterQueue,
  ) {}

  async execute(config: EndpointConfig): Promise<SyncResult> {
    // 1. 幂等键检查
    const existing = await this.jobRepo.findOneBy({
      idempotencyKey: config.idempotencyKey,
    });
    if (existing) {
      return { skipped: true, reason: 'duplicate', existingJobId: existing.id };
    }

    // 2. 获取 Connector
    const connector = this.registry.get(config.protocol);

    // 3. 执行发送/接收
    try {
      const result = await connector.send({ ... });

      // 4. 记录成功
      await this.recordJob(config, result);
      return result;
    } catch (error) {
      // 5. 指数退避重试
      if (this.shouldRetry(config, error)) {
        await this.scheduleRetry(config, error);
      } else {
        // 6. 死信队列
        await this.deadLetterQueue.enqueue(config, error);
      }
      throw error;
    }
  }
}
```

### 4.9 可观测

```typescript
// 每端点 Prometheus 指标 (通过 @willsoto/nestjs-prometheus)
metric_integration_sync_total{endpoint="erp-product",status="success|failure"} 100
metric_integration_sync_duration_ms{endpoint="erp-product"} 1250
metric_integration_sync_retries{endpoint="erp-product"} 2
metric_integration_circuit_breaker_state{endpoint="erp-product"} "closed|open|half-open"

// 结构化日志 (JSON)
{
  "level": "error",
  "message": "ERP sync failed, scheduled retry 2/3",
  "endpointId": "erp-product-sync",
  "jobId": "job-abc-123",
  "retryCount": 2,
  "errorCode": "TIMEOUT",
  "nextRetryMs": 4000,
  "sandbox": true
}
```

---

## 5. 规范模型 (Canonical Model)

防腐层 (ACL) 的目标模型, 业务层唯一依赖的数据结构。所有外部系统差异在 ACL 中翻译为规范模型。

### 5.1 Product (商品/SKU)

```typescript
interface Product {
  id: string;                   // UUID
  skuCode: string;              // SKU 编码, 唯一
  name: string;                 // 商品名称
  description?: string;         // 描述
  category?: ProductCategory;   // 分类 (引用)
  brand?: string;               // 品牌
  unitOfMeasure: string;        // 计量单位 (规范: 规范单位编码)
  barcode?: string;             // 条码 (EAN-13 / UPC / GTIN)
  specAttributes?: SpecAttribute[];  // 规格属性 (如: 颜色/尺寸/口味)
  images?: string[];            // 图片 URL
  status: ProductStatus;        // active | inactive | discontinued
  customsInfo?: CustomsInfo;    // 报关信息 (可选)
  externalReferences?: ExternalRef[]; // 外部系统 ID 映射
  createdAt: string;            // ISO 8601
  updatedAt: string;
}

type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED' | 'UNKNOWN';

interface SpecAttribute {
  name: string;        // 如 "颜色"
  value: string;       // 如 "红色"
  sortOrder?: number;
}

interface ExternalRef {
  systemCode: string;  // 如 "ERP", "WMS_OLD"
  externalId: string;  // 外部系统中的 ID
}

interface ProductCategory {
  id: string;
  code: string;
  name: string;
  parentId?: string;
  path: string;        // 如 "食品/调味品/酱油"
}
```

### 5.2 Warehouse / Location (仓库/库位)

```typescript
interface Warehouse {
  id: string;
  code: string;              // 仓库编码
  name: string;              // 仓库名称
  type: WarehouseType;       // physical | virtual
  address?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

type WarehouseType = 'PHYSICAL' | 'VIRTUAL';

interface Location {
  id: string;
  warehouseId: string;
  area: string;              // 库区
  aisle: string;             // 巷道
  rack: string;              // 货架
  level: string;             // 层
  position: string;          // 位
  barcode?: string;          // 库位条码
  status: 'ACTIVE' | 'LOCKED' | 'INACTIVE';
  maxCapacity?: number;      // 最大容量 (按单位)
}
```

### 5.3 Batch (批次)

```typescript
interface Batch {
  id: string;
  batchNo: string;           // 批次号
  productId: string;         // 商品
  productionDate: string;    // 生产日期 (ISO 8601)
  expiryDate: string;        // 有效期 / 到期日
  shelfLifeDays: number;     // 保质期 (天)
  status: BatchStatus;
  supplier?: string;         // 供应商
  externalBatchNo?: string;  // 外部批次号
  createdAt: string;
  updatedAt: string;
}

type BatchStatus = 'ACTIVE' | 'EXPIRED' | 'QUARANTINED' | 'RECALLED';

// 派生状态 (由业务层计算)
interface BatchExpiryInfo {
  batchId: string;
  daysUntilExpiry: number;   // 负值表示已过期
  warningLevel: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'EXPIRED';
}
```

### 5.4 StockMovement (库存流水)

```typescript
interface StockMovement {
  id: string;
  movementType: MovementType;
  productId: string;
  batchId?: string;           // 批次 (批次管理必填)
  fromLocationId?: string;    // 来源库位 (出库/调拨)
  toLocationId?: string;      // 目标库位 (入库/调拨)
  quantity: number;           // 数量 (正数)
  quantityDelta: number;      // 库存变化量: 入库 +, 出库 -, 盘盈 +, 盘亏 -
  unitOfMeasure: string;
  unitPrice?: number;         // 移动单价 (成本核算用)
  totalAmount?: number;       // 移动总金额
  referenceType: string;      // 单据类型: 'PO' | 'SO' | 'TRANSFER' | 'ADJUSTMENT'
  referenceNo: string;        // 单据编号
  operatorId: string;         // 操作人
  reason?: string;            // 原因/备注
  occurredAt: string;         // 实际业务时间
  recordedAt: string;         // 系统记录时间
}

type MovementType = 'RECEIPT' | 'SHIPMENT' | 'TRANSFER' | 'ADJUSTMENT_PLUS' | 'ADJUSTMENT_MINUS';
```

### 5.5 InventoryBalance (库存余额)

```typescript
interface InventoryBalance {
  id: string;
  productId: string;
  locationId: string;         // 库位
  batchId: string;            // 批次
  quantityOnHand: number;     // 现存量 (≥ 0, 由行锁保证)
  quantityReserved: number;   // 预占量 (出库单已确认未发货)
  quantityAvailable: number;  // 可用量 = onHand - reserved
  unitOfMeasure: string;
  lastMovementAt?: string;    // 最后变动时间
  version: number;            // 乐观锁版本号
}

// 复合主键: (productId, locationId, batchId)
// 并发安全: 更新时 SELECT ... FOR UPDATE 行锁
// 约束: quantityOnHand >= 0, 任何扣减操作先加锁再检查
```

### 5.6 PriceList / ProductPrice (价目)

```typescript
interface PriceList {
  id: string;
  code: string;               // 价目表编码
  name: string;               // 价目表名称
  type: PriceListType;        // standard | promotion | contract
  currency: string;           // 货币代码 ISO 4217
  status: 'ACTIVE' | 'INACTIVE';
  validFrom?: string;
  validTo?: string;
}

type PriceListType = 'STANDARD' | 'PROMOTION' | 'CONTRACT';

interface ProductPrice {
  id: string;
  priceListId: string;
  productId: string;
  unitPrice: number;           // 单价 (含税或不含税, 由配置决定)
  taxRate?: number;            // 税率
  minQuantity?: number;        // 起订量
  currency: string;
  validFrom?: string;
  validTo?: string;
  priority: number;            // 价格优先级 (相同商品多价目时取优先级高者)
}
```

### 5.7 PriceChangeLog (调价记录)

```typescript
interface PriceChangeLog {
  id: string;
  productId: string;
  priceListId: string;
  oldPrice: number;
  newPrice: number;
  changeType: 'MANUAL' | 'BATCH' | 'INTEGRATION';
  operatorId: string;
  reason?: string;
  approvalId?: string;          // 审批单号 (如有审批流程)
  effectiveAt: string;          // 生效时间
  createdAt: string;            // 记录时间
}
```

### 5.8 User / Role / Permission (用户/角色/权限)

```typescript
interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  status: 'ACTIVE' | 'DISABLED';
  roles: Role[];
}

interface Role {
  id: string;
  code: string;               // 如 'WAREHOUSE_OPERATOR', 'FINANCE', 'ADMIN'
  name: string;
  permissions: Permission[];
}

interface Permission {
  code: string;               // 如 'inventory:read', 'inventory:write', 'price:approve'
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'approve' | 'export';
  constraints?: Record<string, unknown>;  // 如: { warehouseId: ['WH01', 'WH02'] }
}

// RBAC 模型: User ──m:m──> Role ──m:m──> Permission
// 前端按钮级权限: 通过 Permission code 控制显隐
```

### 5.9 IntegrationEndpoint / SyncJob (集成端点/同步任务)

```typescript
interface IntegrationEndpoint {
  id: string;
  code: string;               // 端点编码, 唯一
  name: string;
  protocol: string;           // 协议标识
  direction: 'INBOUND' | 'OUTBOUND' | 'BIDIRECTIONAL';
  triggerType: 'WEBHOOK' | 'POLLING' | 'SCHEDULED' | 'MANUAL';
  environment: 'SANDBOX' | 'PRODUCTION';
  config: Record<string, unknown>;  // JSON 配置 (加密存储敏感字段)
  status: 'ACTIVE' | 'PAUSED' | 'DISABLED';
  lastSyncAt?: string;
}

interface SyncJob {
  id: string;
  endpointId: string;
  idempotencyKey: string;      // 幂等键
  status: SyncJobStatus;
  startedAt: string;
  completedAt?: string;
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  nextRetryAt?: string;
  recordsProcessed?: number;
  recordsFailed?: number;
}

type SyncJobStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'RETRYING' | 'DEAD_LETTER';
```

### 5.10 AuditLog (审计日志)

```typescript
interface AuditLog {
  id: string;
  entityType: string;         // 如 'Product', 'InventoryBalance', 'ProductPrice'
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'SYNC';
  operatorId: string;
  operatorIp?: string;
  before?: Record<string, unknown>;  // 变更前快照
  after?: Record<string, unknown>;   // 变更后快照
  changes?: ChangeDetail[];          // 变更字段明细
  timestamp: string;
  traceId?: string;            // 分布式追踪
}

interface ChangeDetail {
  field: string;
  from: unknown;
  to: unknown;
}
```

### 5.11 实体关系图 (ER)

```
Product 1──N Batch
Product 1──N ProductPrice
Product 1──N StockMovement
Product 1──N InventoryBalance
Product N──1 ProductCategory

Batch 1──N StockMovement
Batch 1──N InventoryBalance

Location 1──N InventoryBalance
Location 1──N StockMovement (fromLocation / toLocation)
Warehouse 1──N Location

PriceList 1──N ProductPrice

StockMovement = MovementType
  ├── RECEIPT: toLocation + (batch) + operator
  ├── SHIPMENT: fromLocation + (batch) + operator
  ├── TRANSFER: fromLocation → toLocation + batch + operator
  └── ADJUSTMENT_PLUS/MINUS: location + batch + reason

InventoryBalance = (Product × Location × Batch) → quantity

(补充: 每个实体变更都有 AuditLog 记录)
```

---

## 6. 模块划分与目录结构

### 6.1 Monorepo 总览

```
wms-lite/
├── backend/                  # NestJS 后端服务
│   ├── prisma/               # Prisma schema + 迁移文件
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── common/           # 共享模块 (guard/interceptor/filter/decorator)
│   │   │   ├── auth/         # JWT / RBAC
│   │   │   ├── audit/        # 审计日志拦截器
│   │   │   └── prisma/       # Prisma 模块
│   │   ├── modules/          # 业务模块
│   │   │   ├── product/      # Product CRUD + 分类
│   │   │   ├── warehouse/    # 仓库 + 库位
│   │   │   ├── batch/        # 批次管理 + 临期逻辑
│   │   │   ├── inventory/    # 余额 + 流水 (+ 入库/出库/调拨/盘点)
│   │   │   └── pricing/      # 价目表 + 调价
│   │   └── integration/      # 集成层 (详见 §6.3)
│   ├── test/                 # e2e / 集成测试
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                 # React + Vite 前端
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── layout/           # 基于 Ant Design Pro Layout
│   │   ├── pages/            # 页面组件
│   │   │   ├── product/
│   │   │   ├── warehouse/
│   │   │   ├── batch/
│   │   │   ├── inventory/
│   │   │   ├── pricing/
│   │   │   ├── integration/
│   │   │   └── auth/
│   │   ├── components/       # 业务通用组件
│   │   ├── hooks/            # 自定义 hooks
│   │   ├── api/              # API 客户端 + TanStack Query
│   │   ├── i18n/             # 国际化 (中文为主)
│   │   ├── store/            # 全局状态 (可选)
│   │   └── theme/            # 设计令牌配置
│   ├── Dockerfile
│   └── package.json
│
├── integrations/             # 集成框架包
│   ├── framework/            # 核心框架 (被 backend 引用)
│   │   ├── src/
│   │   │   ├── connector/    # ConnectorPort + Registry
│   │   │   ├── auth/         # AuthAdapter 接口 + 实现
│   │   │   ├── mapping/      # 字段映射引擎
│   │   │   ├── secrets/      # 密钥抽象
│   │   │   ├── job/          # SyncJob 引擎
│   │   │   ├── reliability/  # 重试 / 熔断 / 死信队列
│   │   │   └── observability/# 指标 / 日志 / 告警
│   │   └── package.json
│   ├── adapters/             # 参考适配器实现
│   │   ├── http/             # HTTP/REST + SOAP over HTTP
│   │   │   ├── src/
│   │   │   └── package.json
│   │   ├── amqp/             # RabbitMQ / AMQP
│   │   ├── file/             # CSV/Excel/EDI via SFTP
│   │   └── template/         # 新适配器模板 (脚手架)
│   ├── acl/                  # 防腐层实现 (每个系统一个)
│   │   ├── erp/              # ERP 系统 ACL
│   │   ├── finance/          # 财务系统 ACL
│   │   └── sso/              # SSO 认证 ACL
│   └── config/               # 端点配置示例
│       ├── erp-sync.yaml
│       ├── finance-push.yaml
│       └── sso-oidc.yaml
│
├── shared/                   # 全栈共享
│   ├── types/                # 规范模型类型定义 (TypeScript)
│   │   └── canonical/
│   ├── constants/            # 枚举 / 业务常量
│   ├── validators/           # Zod / class-validator 校验规则
│   └── package.json
│
├── docs/                     # 文档
│   ├── ARCHITECTURE.md       # 本文档
│   ├── api/                  # OpenAPI / 接口文档
│   ├── integration/          # 集成适配器开发指南
│   └── deploy/               # 部署运维文档
│
├── docker-compose.yml        # 本地一键起全栈
├── .env.example              # 环境变量模板
└── package.json              # workspace root (pnpm workspace)
```

### 6.2 依赖方向 (严格禁止循环依赖)

```
shared ──────────────────────────────────────────────────────┐
  │                                                          │
  ├──→ backend  (可 import shared/types, shared/constants)    │
  ├──→ frontend (可 import shared/types, shared/constants)    │
  └──→ integrations/framework (可 import shared/types)        │
                                                              │
integrations/framework ──→ integrations/adapters (实现接口)    │
integrations/framework ──→ integrations/acl (ACL 使用 Connector)│
                                                                      │
backend ──→ integrations/framework (NestJS 调用同步引擎)        │
backend ──→ integrations/acl (业务层调用 ACL)                   │
                                                                      │
frontend ──→ backend (HTTP API, 通过 TanStack Query)           │
                                                                      │
docs ──→ (纯文档, 无代码依赖)                                   │
└──────────────────────────────────────────────────────────────┘
```

**规则**:
- `shared` 禁止依赖 `backend` / `frontend` / `integrations`
- `backend` 可依赖 `shared` 和 `integrations/framework`
- `frontend` 仅可依赖 `shared`
- `integrations/*` 内部: `framework` 是内核, `adapters` / `acl` 依赖 `framework`
- `docs` 纯文档, 无代码依赖

### 6.3 集成层内部结构

```
src/integration/
├── integration.module.ts        # 根模块, 动态注册端点
├── registry/
│   └── endpoint-registry.service.ts   # 从配置加载端点, 关联 Connector
├── acl/
│   ├── erp-product.acl.ts
│   ├── erp-customer.acl.ts
│   └── finance-ledger.acl.ts
├── endpoints/
│   ├── erp-product-sync/
│   │   ├── erp-product-sync.service.ts      # 同步编排
│   │   └── erp-product-sync.controller.ts   # webhook 入站
│   └── finance-push/
│       └── finance-push.service.ts
└── config/
    └── integration-config.service.ts  # 读取 YAML/DB 配置
```

### 6.4 职责边界

| 目录 | 职责 | 禁止 |
|------|------|------|
| `backend/src/modules/` | 业务逻辑, 只操作规范模型, 调用 ACL 获取/推送外部数据 | 直接调用外部 API, 直接处理外部数据格式 |
| `backend/src/integration/acl/` | 字段映射/编码转换/数据清洗, 将外部格式 ↔ 规范模型 | 执行业务逻辑, 访问数据库 (只做纯转换) |
| `integrations/framework/` | Connector 接口/注册/重试/熔断/密钥/可观测 | 包含业务逻辑, 包含业务实体 |
| `integrations/adapters/` | 具体协议实现 (HTTP/AMQP/File) | 包含配置, 包含业务映射 |
| `frontend/src/` | UI 渲染/用户交互/路由/状态管理 | 直接读写数据库, 直接访问外部系统 |
| `shared/` | 类型/常量/校验规则, 全栈复用 | 包含业务逻辑, 基础设施代码 |

---

## 7. 接口契约示例

### 7.1 集成端点接口契约

每个集成端点对接前产出以下契约文档:

```yaml
# === docs/integration/contracts/erp-product-sync-contract.yaml ===
---
contract:
  id: "erp-product-sync-v1"
  version: "1.0.0"
  status: "draft"
  lastUpdated: "2026-07-03"

  # 系统间接口摘要
  summary:
    sourceSystem: "ERP (SAP S/4HANA)"
    targetSystem: "WMS-lite"
    direction: "ERP → WMS (inbound)"
    trigger: "每5分钟轮询 / ERP侧变更后推送webhook"
    dataVolume: "~2000 商品, 日均变更 ~50"

  # 请求 (从 ERP 拉取 / ERP 推送)
  request:
    method: "GET"
    path: "/api/v2/products?updatedSince={lastSyncAt}"
    headers:
      - name: "Authorization"
        type: "Bearer"
        description: "OAuth2 access token"
      - name: "X-Request-Id"
        type: "string"
        description: "幂等键 (UUIDv4)"
      - name: "Accept"
        value: "application/json"
    queryParams:
      - name: "updatedSince"
        type: "ISO 8601 datetime"
        required: false
        description: "增量同步: 只返回此时间后更新的商品"

  # 响应
  response:
    status: 200
    body:
      contentType: "application/json"
      schema:
        type: "object"
        properties:
          items:
            type: "array"
            items:
              $ref: "#/components/schemas/ErpProduct"
          totalCount:
            type: "integer"
          page:
            type: "integer"
          pageSize:
            type: "integer"

  # 错误码
  errors:
    - code: "AUTH_FAILED"
      httpStatus: 401
      description: "认证令牌无效或过期"
    - code: "RATE_LIMITED"
      httpStatus: 429
      description: "请求频率超限, Retry-After header 指示等待秒数"
    - code: "INTERNAL_ERROR"
      httpStatus: 500
      description: "ERP 服务端异常, WMS 应退避重试"

  # 规范模型映射
  canonicalMappings:
    - from: "$.items[*].material_code"
      to: "Product.skuCode"
      transform: "uppercase + trim"
    - from: "$.items[*].material_desc"
      to: "Product.name"
    - from: "$.items[*].base_uom"
      to: "Product.unitOfMeasure"
      transform: "UOM编码映射表"
    # ... 其余字段

components:
  schemas:
    ErpProduct:
      type: "object"
      properties:
        material_code:
          type: "string"
          maxLength: 40
        material_desc:
          type: "string"
          maxLength: 255
        base_uom:
          type: "string"
          description: "ERP 计量单位编码"
        category_id:
          type: "string"
        ean_code:
          type: "string"
        status_code:
          type: "string"
          enum: ["A", "I", "D"]
        created_date:
          type: "string"
          format: "date"
        changed_date:
          type: "string"
          format: "date-time"
```

### 7.2 内部 REST API 契约示例

```yaml
# === docs/api/inventory-balance.yaml ===
openapi: "3.0.3"
info:
  title: "WMS-lite API — 库存余额"
  version: "1.0.0"

paths:
  /api/v1/inventory/balances:
    get:
      summary: "查询库存余额"
      parameters:
        - name: "productId"
          in: "query"
          schema: { type: "string", format: "uuid" }
        - name: "locationId"
          in: "query"
          schema: { type: "string", format: "uuid" }
        - name: "batchId"
          in: "query"
          schema: { type: "string", format: "uuid" }
        - name: "includeZeroStock"
          in: "query"
          schema: { type: "boolean", default: false }
        - name: "page"
          in: "query"
          schema: { type: "integer", default: 1 }
        - name: "pageSize"
          in: "query"
          schema: { type: "integer", default: 20 }
      responses:
        "200":
          description: "库存余额列表"
          content:
            application/json:
              schema:
                type: "object"
                properties:
                  items:
                    type: "array"
                    items:
                      $ref: "#/components/schemas/InventoryBalance"
                  total:
                    type: "integer"
                  page:
                    type: "integer"
                  pageSize:
                    type: "integer"

components:
  schemas:
    InventoryBalance:
      type: "object"
      properties:
        id: { type: "string", format: "uuid" }
        productId: { type: "string", format: "uuid" }
        productCode: { type: "string" }
        productName: { type: "string" }
        locationId: { type: "string", format: "uuid" }
        locationCode: { type: "string" }
        batchId: { type: "string", format: "uuid" }
        batchNo: { type: "string" }
        expiryDate: { type: "string", format: "date" }
        quantityOnHand: { type: "number", minimum: 0 }
        quantityReserved: { type: "number", minimum: 0 }
        quantityAvailable: { type: "number", minimum: 0 }
        unitOfMeasure: { type: "string" }
```

---

## 附录 A: 调研引用

| 方案 | 仓库地址 | 调研日期 |
|------|---------|---------|
| Ant Design | https://github.com/ant-design/ant-design | 2026-07-03 |
| Ant Design Pro | https://github.com/ant-design/ant-design-pro | 2026-07-03 |
| shadcn/ui | https://github.com/shadcn-ui/ui | 2026-07-03 |
| satnaing/shadcn-admin | https://github.com/satnaing/shadcn-admin | 2026-07-03 |
| Kiranism/next-shadcn-dashboard | https://github.com/Kiranism/next-shadcn-dashboard-starter | 2026-07-03 |
| Refine | https://github.com/refinedev/refine | 2026-07-03 |
| Tremor | https://github.com/tremorlabs/tremor | 2026-07-03 |
| react-admin | https://github.com/marmelab/react-admin | 2026-07-03 |

## 附录 B: 待确认项 (可暂缓)

| 项 | 说明 | 依赖 |
|----|------|------|
| 具体 ERP 系统型号 / 版本 | 影响 ACL 字段映射细节 | T2.5 集成开发前确认 |
| 财务系统接口规范 | 影响 finance-ledger ACL 设计 | T2.5 集成开发前确认 |
| SSO / OIDC 提供商 | 影响 AuthAdapter 实现 | T0.4 RBAC 实现后确认 |
| 生产环境密钥管理方案 | Vault / AWS Secrets Manager / K8s Secrets | 部署前确认 |
| 消息队列中间件 | RabbitMQ / Kafka / Pulsar 选型 | T2.5 消息队列适配器实现前确认 |
| 部署环境 | 物理机 / K8s / 云主机 | Wave 3 部署前确认 |

---

> **文档维护**: 本文档随架构演进持续更新, 每次技术选型变更需同步修订。
