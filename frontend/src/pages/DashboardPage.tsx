import { useEffect, useState } from 'react';
import {
  Card,
  Col,
  Row,
  Statistic,
  Table,
  Tag,
  Typography,
  Spin,
  Alert,
  Space,
  Segmented,
} from 'antd';
import {
  HomeOutlined,
  ShoppingCartOutlined,
  StockOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  DollarOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import type { TableProps } from 'antd';
import {
  dashboardApi,
  type DashboardOverview,
  type NearExpiryBatch,
  type InventoryValuation,
  type TrendItem,
  type TrendGranularity,
} from '../api/dashboard';

const { Title, Text } = Typography;

/* ------------------------------------------------------------------ */
/*  Mock data (fallback when API is unavailable)                        */
/* ------------------------------------------------------------------ */

const MOCK_OVERVIEW: DashboardOverview = {
  totalProducts: 128,
  totalInventory: 45680,
  nearExpiryCount: 9,
  lowStockCount: 5,
};

const MOCK_NEAR_EXPIRY: NearExpiryBatch[] = [
  { id: 'B001', productName: '鲜牛奶', warehouseName: '一号冷库', quantity: 200, unit: '箱', expiryDate: '2026-07-10', daysUntilExpiry: 6 },
  { id: 'B002', productName: '酸奶', warehouseName: '一号冷库', quantity: 150, unit: '箱', expiryDate: '2026-07-12', daysUntilExpiry: 8 },
  { id: 'B003', productName: '面包', warehouseName: '常温仓', quantity: 80, unit: '袋', expiryDate: '2026-07-08', daysUntilExpiry: 4 },
  { id: 'B004', productName: '鲜肉', warehouseName: '二号冷库', quantity: 300, unit: '公斤', expiryDate: '2026-07-09', daysUntilExpiry: 5 },
  { id: 'B005', productName: '豆制品', warehouseName: '二号冷库', quantity: 120, unit: '箱', expiryDate: '2026-07-14', daysUntilExpiry: 10 },
  { id: 'B006', productName: '果汁', warehouseName: '常温仓', quantity: 60, unit: '箱', expiryDate: '2026-07-11', daysUntilExpiry: 7 },
  { id: 'B007', productName: '蛋糕', warehouseName: '一号冷库', quantity: 40, unit: '个', expiryDate: '2026-07-07', daysUntilExpiry: 3 },
  { id: 'B008', productName: '熟食', warehouseName: '二号冷库', quantity: 90, unit: '盒', expiryDate: '2026-07-13', daysUntilExpiry: 9 },
  { id: 'B009', productName: '冰淇淋', warehouseName: '一号冷库', quantity: 500, unit: '箱', expiryDate: '2026-07-15', daysUntilExpiry: 11 },
];

const MOCK_VALUATION: InventoryValuation = {
  byWarehouse: [
    { warehouse: '一号冷库', value: 285000 },
    { warehouse: '二号冷库', value: 192000 },
    { warehouse: '常温仓', value: 98000 },
    { warehouse: '冷冻仓', value: 156000 },
  ],
  byCategory: [
    { category: '乳制品', value: 165000 },
    { category: '肉类', value: 142000 },
    { category: '烘焙食品', value: 88000 },
    { category: '饮料', value: 96000 },
    { category: '冷冻食品', value: 156000 },
    { category: '其他', value: 84000 },
  ],
};

const MOCK_TRENDS: TrendItem[] = [
  { date: '07-01', inQuantity: 1200, outQuantity: 980 },
  { date: '07-02', inQuantity: 980, outQuantity: 1050 },
  { date: '07-03', inQuantity: 1500, outQuantity: 1200 },
  { date: '07-04', inQuantity: 1100, outQuantity: 1350 },
  { date: '07-05', inQuantity: 870, outQuantity: 920 },
  { date: '07-06', inQuantity: 1350, outQuantity: 1100 },
  { date: '07-07', inQuantity: 1050, outQuantity: 980 },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** 根据剩余天数返回对应的 Tag 颜色 */
function expiryTagColor(days: number): string {
  if (days <= 3) return 'red';
  if (days <= 7) return 'orange';
  return 'green';
}

/** 格式化金额 */
function formatCurrency(value: number): string {
  return '¥ ' + value.toLocaleString('zh-CN');
}

/* ------------------------------------------------------------------ */
/*  Columns                                                           */
/* ------------------------------------------------------------------ */

const nearExpiryColumns: TableProps<NearExpiryBatch>['columns'] = [
  {
    title: '商品名称',
    dataIndex: 'productName',
    key: 'productName',
    width: 140,
  },
  {
    title: '仓库',
    dataIndex: 'warehouseName',
    key: 'warehouseName',
    width: 120,
  },
  {
    title: '数量',
    dataIndex: 'quantity',
    key: 'quantity',
    width: 80,
    render: (qty: number, record: NearExpiryBatch) => qty + ' ' + record.unit,
  },
  {
    title: '到期日',
    dataIndex: 'expiryDate',
    key: 'expiryDate',
    width: 110,
  },
  {
    title: '倒计时',
    dataIndex: 'daysUntilExpiry',
    key: 'daysUntilExpiry',
    width: 100,
    render: (days: number) => (
      <Tag color={expiryTagColor(days)}>
        {days <= 0 ? '已过期' : days + ' 天'}
      </Tag>
    ),
  },
];

const warehouseValuationColumns: TableProps<{ warehouse: string; value: number }>['columns'] = [
  { title: '仓库', dataIndex: 'warehouse', key: 'warehouse' },
  {
    title: '估值',
    dataIndex: 'value',
    key: 'value',
    align: 'right',
    render: (val: number) => formatCurrency(val),
  },
];

const categoryValuationColumns: TableProps<{ category: string; value: number }>['columns'] = [
  { title: '品类', dataIndex: 'category', key: 'category' },
  {
    title: '估值',
    dataIndex: 'value',
    key: 'value',
    align: 'right',
    render: (val: number) => formatCurrency(val),
  },
];

/* ------------------------------------------------------------------ */
/*  DashboardPage Component                                            */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<DashboardOverview>(MOCK_OVERVIEW);
  const [nearExpiry, setNearExpiry] = useState<NearExpiryBatch[]>(MOCK_NEAR_EXPIRY);
  const [valuation, setValuation] = useState<InventoryValuation>(MOCK_VALUATION);
  const [trends, setTrends] = useState<TrendItem[]>(MOCK_TRENDS);
  const [granularity, setGranularity] = useState<TrendGranularity>('day');

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [overviewRes, nearExpiryRes, valuationRes] = await Promise.all([
          dashboardApi.overview(),
          dashboardApi.nearExpiry(),
          dashboardApi.valuation(),
        ]);

        if (!cancelled) {
          setOverview(overviewRes.data);
          setNearExpiry(nearExpiryRes.data);
          setValuation(valuationRes.data);
        }
      } catch {
        // API 不可用时使用 mock 数据（已在 state 初始值中预设）
        if (!cancelled) {
          setError(null); // 静默降级，不显示错误
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchTrends() {
      try {
        const res = await dashboardApi.trends(granularity);
        if (!cancelled) setTrends(res.data);
      } catch {
        // 保持当前 trends 状态
      }
    }

    fetchTrends();
    return () => { cancelled = true; };
  }, [granularity]);

  /* ---- 临期批次表格小计 ---- */
  const sortedNearExpiry = [...nearExpiry].sort(
    (a, b) => a.daysUntilExpiry - b.daysUntilExpiry,
  );

  /* ---- 出入库趋势表格 ---- */
  const trendColumns: TableProps<TrendItem>['columns'] = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 100,
    },
    {
      title: '入库量',
      dataIndex: 'inQuantity',
      key: 'inQuantity',
      align: 'right',
      render: (val: number) => (
        <span>
          <ArrowUpOutlined style={{ color: '#52c41a', marginRight: 6 }} />
          {val.toLocaleString()}
        </span>
      ),
    },
    {
      title: '出库量',
      dataIndex: 'outQuantity',
      key: 'outQuantity',
      align: 'right',
      render: (val: number) => (
        <span>
          <ArrowDownOutlined style={{ color: '#ff4d4f', marginRight: 6 }} />
          {val.toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* 页面标题 */}
      <Title level={3} style={{ marginTop: 0, marginBottom: 24 }}>
        <HomeOutlined /> 首页仪表盘
      </Title>

      {error && (
        <Alert
          message="数据加载异常"
          description={error}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      <Spin spinning={loading} tip="加载中…" size="large">
        {/* ============================================================ */}
        {/* 1. 库存总览看板                                               */}
        {/* ============================================================ */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable>
              <Statistic
                title="总商品数"
                value={overview.totalProducts}
                prefix={<ShoppingCartOutlined style={{ color: '#1677ff' }} />}
                suffix="种"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable>
              <Statistic
                title="总库存量"
                value={overview.totalInventory}
                prefix={<StockOutlined style={{ color: '#52c41a' }} />}
                suffix="件"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable>
              <Statistic
                title="临期批次数"
                value={overview.nearExpiryCount}
                prefix={<WarningOutlined style={{ color: '#faad14' }} />}
                suffix="批"
                valueStyle={
                  overview.nearExpiryCount > 0
                    ? { color: '#faad14' }
                    : { color: '#52c41a' }
                }
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable>
              <Statistic
                title="低库存预警"
                value={overview.lowStockCount}
                prefix={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
                suffix="项"
                valueStyle={
                  overview.lowStockCount > 0
                    ? { color: '#ff4d4f' }
                    : { color: '#52c41a' }
                }
              />
            </Card>
          </Col>
        </Row>

        {/* ============================================================ */}
        {/* 2. 临期预警看板                                               */}
        {/* ============================================================ */}
        <Card
          title={
            <Space>
              <WarningOutlined style={{ color: '#faad14' }} />
              <span>临期预警 — 即将过期批次</span>
              {sortedNearExpiry.filter((b) => b.daysUntilExpiry <= 3).length > 0 && (
                <Tag color="red">
                  {sortedNearExpiry.filter((b) => b.daysUntilExpiry <= 3).length} 批紧急
                </Tag>
              )}
            </Space>
          }
          style={{ marginBottom: 24 }}
        >
          <Table<NearExpiryBatch>
            rowKey="id"
            columns={nearExpiryColumns}
            dataSource={sortedNearExpiry}
            pagination={false}
            size="small"
            scroll={{ x: 550 }}
          />
        </Card>

        {/* ============================================================ */}
        {/* 3. 库存估值汇总                                               */}
        {/* ============================================================ */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <DollarOutlined style={{ color: '#1677ff' }} />
                  <span>按仓库估值</span>
                </Space>
              }
            >
              <Table<{ warehouse: string; value: number }>
                rowKey="warehouse"
                columns={warehouseValuationColumns}
                dataSource={valuation.byWarehouse}
                pagination={false}
                size="small"
              />
              <div style={{ textAlign: 'right', marginTop: 12 }}>
                <Text strong>
                  合计：{formatCurrency(
                    valuation.byWarehouse.reduce((s, w) => s + w.value, 0),
                  )}
                </Text>
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <DollarOutlined style={{ color: '#1677ff' }} />
                  <span>按品类估值</span>
                </Space>
              }
            >
              <Table<{ category: string; value: number }>
                rowKey="category"
                columns={categoryValuationColumns}
                dataSource={valuation.byCategory}
                pagination={false}
                size="small"
              />
              <div style={{ textAlign: 'right', marginTop: 12 }}>
                <Text strong>
                  合计：{formatCurrency(
                    valuation.byCategory.reduce((s, c) => s + c.value, 0),
                  )}
                </Text>
              </div>
            </Card>
          </Col>
        </Row>

        {/* ============================================================ */}
        {/* 4. 出入库趋势                                                 */}
        {/* ============================================================ */}
        <Card
          title={
            <Space>
              <StockOutlined style={{ color: '#1677ff' }} />
              <span>出入库趋势</span>
            </Space>
          }
          extra={
            <Segmented
              value={granularity}
              onChange={(val) => setGranularity(val as TrendGranularity)}
              options={[
                { label: '按日', value: 'day' },
                { label: '按周', value: 'week' },
                { label: '按月', value: 'month' },
              ]}
            />
          }
        >
          <Table<TrendItem>
            rowKey="date"
            columns={trendColumns}
            dataSource={trends}
            pagination={false}
            size="small"
            scroll={{ x: 400 }}
          />
        </Card>
      </Spin>
    </div>
  );
}
