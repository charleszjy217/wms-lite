import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Select,
  DatePicker,
  InputNumber,
  Row,
  Col,
  Alert,
  Tooltip,
  Typography,
  message,
  Modal,
  Form,
  Input,
} from 'antd';
import {
  ExperimentOutlined,
  ReloadOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
  SearchOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { RangePickerProps } from 'antd/es/date-picker';
import client from '../../api/client';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

/* ------------------------------------------------------------------ */
/*  Date helpers (avoid dayjs dependency)                              */
/* ------------------------------------------------------------------ */

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BatchItem {
  id: string;
  batchNo: string;
  productId: string;
  productionDate: string | null;
  expiryDate: string | null;
  status: 'ACTIVE' | 'NEAR_EXPIRY' | 'EXPIRED';
  remainingDays: number | null;
  isExpired: boolean;
  isNearExpiry: boolean;
  createdAt: string;
  product?: {
    id: string;
    name: string;
    skuCode: string;
  };
}

interface ProductOption {
  id: string;
  name: string;
  skuCode: string;
}

interface PaginatedResult {
  items: BatchItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* ------------------------------------------------------------------ */
/*  Constants / Helpers                                                */
/* ------------------------------------------------------------------ */

const STATUS_MAP: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  ACTIVE: { color: 'green', label: '正常', icon: <CheckCircleOutlined /> },
  NEAR_EXPIRY: { color: 'orange', label: '临期', icon: <ClockCircleOutlined /> },
  EXPIRED: { color: 'red', label: '过期', icon: <StopOutlined /> },
};

function expiryTag(record: BatchItem): React.ReactNode {
  const { remainingDays, isExpired, isNearExpiry, expiryDate } = record;

  if (!expiryDate) {
    return <Tag>无有效期</Tag>;
  }

  if (isExpired) {
    return (
      <Tooltip title={`已过期 ${Math.abs(remainingDays ?? 0)} 天`}>
        <Tag color="red">
          <StopOutlined /> 已过期
          {remainingDays !== null && ` (${remainingDays}天)`}
        </Tag>
      </Tooltip>
    );
  }

  if (isNearExpiry) {
    return (
      <Tooltip title={`距过期还有 ${remainingDays} 天`}>
        <Tag color="orange">
          <WarningOutlined /> 临期
          {remainingDays !== null && ` (${remainingDays}天)`}
        </Tag>
      </Tooltip>
    );
  }

  return (
    <Tag color="green">
      <CheckCircleOutlined /> {remainingDays !== null ? `${remainingDays}天` : '有效'}
    </Tag>
  );
}

function statusTag(status: string): React.ReactNode {
  const info = STATUS_MAP[status] ?? { color: 'default', label: status, icon: null };
  return <Tag color={info.color}>{info.icon} {info.label}</Tag>;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function BatchListPage() {
  /* ── State ────────────────────────────────────────────────────── */

  const [data, setData] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  // Filters
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [filterProductId, setFilterProductId] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterExpiryRange, setFilterExpiryRange] = useState<[string, string] | null>(null);
  const [filterBatchNo, setFilterBatchNo] = useState<string>('');

  // Warning threshold (days)
  const [warnDays, setWarnDays] = useState<number>(30);
  const [warnModalOpen, setWarnModalOpen] = useState(false);

  // Expiring batch summary
  const [expiringCount, setExpiringCount] = useState<number>(0);
  const [expiredCount, setExpiredCount] = useState<number>(0);

  // Update status modal
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string>('ACTIVE');

  /* ── API helpers ──────────────────────────────────────────────── */

  const fetchData = useCallback(async (pageNum = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = {
        page: pageNum,
        limit: 20,
        sortByExpiry: 'asc',
      };

      if (filterProductId) params.productId = filterProductId;
      if (filterStatus) params.status = filterStatus;
      if (filterExpiryRange) {
        params.expiryDateFrom = filterExpiryRange[0];
        params.expiryDateTo = filterExpiryRange[1];
      }
      if (filterBatchNo.trim()) params.batchNo = filterBatchNo.trim();

      const res = await client.get<PaginatedResult>('/batches', { params });
      const result = res.data;

      setData(result.items);
      setPagination({
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      message.error(axiosErr?.response?.data?.message ?? '获取批次列表失败');
    } finally {
      setLoading(false);
    }
  }, [filterProductId, filterStatus, filterExpiryRange, filterBatchNo]);

  const fetchExpiringSummary = useCallback(async () => {
    try {
      const [expiringRes, expiredRes] = await Promise.all([
        client.get<BatchItem[]>('/batches/expiring', { params: { days: warnDays } }),
        client.get<PaginatedResult>('/batches', { params: { expired: true, limit: 1 } }),
      ]);
      setExpiringCount(expiringRes.data.length);
      setExpiredCount(expiredRes.data.total);
    } catch {
      // silently fail for summary
    }
  }, [warnDays]);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await client.get<{ items: ProductOption[] }>('/products', {
        params: { limit: 200, status: 'ACTIVE' },
      });
      setProducts(res.data.items ?? []);
    } catch {
      // silently fail
    }
  }, []);

  /* ── Lifecycle ───────────────────────────────────────────────── */

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  useEffect(() => {
    fetchExpiringSummary();
  }, [fetchExpiringSummary]);

  /* ── Handlers ─────────────────────────────────────────────────── */

  const handleRefresh = () => {
    fetchData(pagination.page);
    fetchExpiringSummary();
  };

  const handlePageChange = (pageNum: number) => {
    fetchData(pageNum);
  };

  const handleFilterReset = () => {
    setFilterProductId(undefined);
    setFilterStatus(undefined);
    setFilterExpiryRange(null);
    setFilterBatchNo('');
    // fetchData will be called via useEffect
  };

  const handleRangeChange: RangePickerProps['onChange'] = (dates) => {
    if (dates && dates[0] && dates[1]) {
      setFilterExpiryRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]);
    } else {
      setFilterExpiryRange(null);
    }
  };

  /* Update status */
  const handleOpenUpdate = (record: BatchItem) => {
    setSelectedBatch(record);
    setUpdateStatus(record.status);
    setUpdateModalOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedBatch) return;
    try {
      await client.patch(`/batches/${selectedBatch.id}`, { status: updateStatus });
      message.success('批次状态已更新');
      setUpdateModalOpen(false);
      setSelectedBatch(null);
      fetchData(pagination.page);
      fetchExpiringSummary();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      message.error(axiosErr?.response?.data?.message ?? '更新失败');
    }
  };

  /* Validate outbound (interception hint) */
  const handleValidateOutbound = async (record: BatchItem) => {
    try {
      await client.post(`/batches/${record.id}/validate-outbound`);
      message.success(`批次 ${record.batchNo} 可用于出库`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      Modal.error({
        title: '出库拦截',
        icon: <ExclamationCircleOutlined />,
        content: axiosErr?.response?.data?.message ?? '该批次已过期，不可用于出库',
      });
    }
  };

  /* ── Columns ──────────────────────────────────────────────────── */

  const columns: ColumnsType<BatchItem> = [
    {
      title: '批次号',
      dataIndex: 'batchNo',
      key: 'batchNo',
      width: 150,
      ellipsis: true,
      render: (text: string, record: BatchItem) => (
        <Tooltip title={`ID: ${record.id}`}>
          <Text code>{text}</Text>
        </Tooltip>
      ),
    },
    {
      title: '商品',
      key: 'product',
      width: 220,
      render: (_: unknown, record: BatchItem) => (
        <Space direction="vertical" size={0}>
          <Text>{record.product?.name ?? '—'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.product?.skuCode ?? ''}
          </Text>
        </Space>
      ),
    },
    {
      title: '生产日期',
      dataIndex: 'productionDate',
      key: 'productionDate',
      width: 120,
      render: (val: string | null) => formatDate(val),
    },
    {
      title: '有效期',
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      width: 120,
      sorter: true,
      defaultSortOrder: 'ascend',
      render: (val: string | null) => formatDate(val),
    },
    {
      title: '剩余天数',
      key: 'remainingDays',
      width: 140,
      align: 'center',
      render: (_: unknown, record: BatchItem) => expiryTag(record),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      filters: [
        { text: '正常', value: 'ACTIVE' },
        { text: '临期', value: 'NEAR_EXPIRY' },
        { text: '过期', value: 'EXPIRED' },
      ],
      filterMultiple: false,
      onFilter: (value) => {
        setFilterStatus(value as string);
        return true; // handled via API
      },
      render: (status: string) => statusTag(status),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: unknown, record: BatchItem) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleOpenUpdate(record)}>
            修改状态
          </Button>
          {record.isExpired ? (
            <Tooltip title="批次已过期，不可用于出库">
              <Button type="link" size="small" danger disabled>
                出库验证
              </Button>
            </Tooltip>
          ) : (
            <Button type="link" size="small" onClick={() => handleValidateOutbound(record)}>
              出库验证
            </Button>
          )}
        </Space>
      ),
    },
  ];

  /* ── Render ───────────────────────────────────────────────────── */

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <Card>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={4} style={{ margin: 0 }}>
              <ExperimentOutlined /> 批次管理
            </Title>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
                刷新
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Warning Summaries */}
      <Row gutter={16}>
        <Col span={12}>
          <Card
            size="small"
            style={{
              borderLeft: `4px solid ${expiringCount > 0 ? '#faad14' : '#d9d9d9'}`,
            }}
          >
            <Space>
              <WarningOutlined style={{ fontSize: 20, color: expiringCount > 0 ? '#faad14' : '#d9d9d9' }} />
              <div>
                <Text type="secondary">临期预警</Text>
                <div>
                  <Text strong style={{ color: expiringCount > 0 ? '#faad14' : undefined, fontSize: 16 }}>
                    {expiringCount}
                  </Text>
                  <Text style={{ marginLeft: 4 }}>
                    个批次将在 {warnDays} 天内过期
                  </Text>
                  <Button
                    type="link"
                    size="small"
                    style={{ marginLeft: 8 }}
                    onClick={() => setWarnModalOpen(true)}
                  >
                    配置阈值
                  </Button>
                </div>
              </div>
            </Space>
          </Card>
        </Col>
        <Col span={12}>
          <Card
            size="small"
            style={{
              borderLeft: `4px solid ${expiredCount > 0 ? '#ff4d4f' : '#d9d9d9'}`,
            }}
          >
            <Space>
              <StopOutlined style={{ fontSize: 20, color: expiredCount > 0 ? '#ff4d4f' : '#d9d9d9' }} />
              <div>
                <Text type="secondary">过期批次</Text>
                <div>
                  <Text strong style={{ color: expiredCount > 0 ? '#ff4d4f' : undefined, fontSize: 16 }}>
                    {expiredCount}
                  </Text>
                  <Text style={{ marginLeft: 4 }}>个批次已过期</Text>
                </div>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Expired alert */}
      {expiredCount > 0 && (
        <Alert
          message={
            <span>
              共有 <strong>{expiredCount}</strong> 个批次已过期。过期批次无法用于出库操作，建议及时处理。
            </span>
          }
          type="error"
          showIcon
          closable
        />
      )}

      {/* Filters */}
      <Card size="small">
        <Row gutter={[16, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Text strong style={{ fontSize: 12 }}>
              批次号
            </Text>
            <Input
              placeholder="搜索批次号"
              prefix={<SearchOutlined />}
              allowClear
              value={filterBatchNo}
              onChange={(e) => setFilterBatchNo(e.target.value)}
              onPressEnter={() => fetchData(1)}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Text strong style={{ fontSize: 12 }}>
              商品
            </Text>
            <Select
              placeholder="选择商品"
              allowClear
              showSearch
              style={{ width: '100%' }}
              value={filterProductId}
              onChange={(val) => setFilterProductId(val)}
              filterOption={(input, option) =>
                (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={products.map((p) => ({
                value: p.id,
                label: `[${p.skuCode}] ${p.name}`,
              }))}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Text strong style={{ fontSize: 12 }}>
              有效期范围
            </Text>
            <RangePicker
              style={{ width: '100%' }}
              onChange={handleRangeChange}
              value={null}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Text strong style={{ fontSize: 12 }}>
              状态
            </Text>
            <Select
              placeholder="选择状态"
              allowClear
              style={{ width: '100%' }}
              value={filterStatus}
              onChange={(val) => setFilterStatus(val)}
              options={[
                { value: 'ACTIVE', label: '正常' },
                { value: 'NEAR_EXPIRY', label: '临期' },
                { value: 'EXPIRED', label: '过期' },
              ]}
            />
          </Col>
          <Col xs={24}>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={() => fetchData(1)}>
                查询
              </Button>
              <Button onClick={handleFilterReset}>重置</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card styles={{ body: { padding: 0 } }}>
        <Table<BatchItem>
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          locale={{ emptyText: '暂无批次数据' }}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条`,
            onChange: handlePageChange,
          }}
        />
      </Card>

      {/* ── Warning Threshold Modal ──────────────────────────────── */}
      <Modal
        title="配置临期预警阈值"
        open={warnModalOpen}
        onOk={() => {
          setWarnModalOpen(false);
          fetchExpiringSummary();
          fetchData(1);
        }}
        onCancel={() => setWarnModalOpen(false)}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>设置提前多少天预警临期批次：</Text>
          <InputNumber
            min={1}
            max={365}
            value={warnDays}
            onChange={(val) => setWarnDays(val ?? 30)}
            addonAfter="天"
            style={{ width: 200 }}
          />
          <Text type="secondary">
            当前设置：提前 {warnDays} 天预警。
            系统将对有效期在 {warnDays} 天内的批次标记为「临期」状态。
          </Text>
        </Space>
      </Modal>

      {/* ── Update Status Modal ──────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <ExperimentOutlined />
            修改批次状态
          </Space>
        }
        open={updateModalOpen}
        onOk={handleUpdateStatus}
        onCancel={() => {
          setUpdateModalOpen(false);
          setSelectedBatch(null);
        }}
      >
        {selectedBatch && (
          <Form layout="vertical">
            <Form.Item label="批次号">
              <Text code>{selectedBatch.batchNo}</Text>
            </Form.Item>
            <Form.Item label="商品">
              <Text>{selectedBatch.product?.name ?? '—'}</Text>
            </Form.Item>
            <Form.Item label="有效期">
              <Text>
                {formatDate(selectedBatch.expiryDate)}
              </Text>
            </Form.Item>
            <Form.Item label="当前状态">
              {statusTag(selectedBatch.status)}
            </Form.Item>
            <Form.Item label="新状态" required>
              <Select
                value={updateStatus}
                onChange={(val) => setUpdateStatus(val)}
                options={[
                  { value: 'ACTIVE', label: '正常' },
                  { value: 'NEAR_EXPIRY', label: '临期' },
                  { value: 'EXPIRED', label: '过期' },
                ]}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
