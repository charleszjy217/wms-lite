import { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Typography,
  Space,
  Input,
  DatePicker,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { pricingApi, type PriceAdjustmentRecord } from '../../api/pricing';

const { Title } = Typography;
const { RangePicker } = DatePicker;

export default function PricingHistory() {
  const [data, setData] = useState<PriceAdjustmentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.productName = search;
      if (dateRange) {
        params.startDate = dateRange[0];
        params.endDate = dateRange[1];
      }
      const res = await pricingApi.history(params);
      setData(res.data);
    } catch {
      // 静默
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = data.filter((item) => {
    const matchSearch =
      !search ||
      item.productName.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  const columns: ColumnsType<PriceAdjustmentRecord> = [
    {
      title: '商品名',
      dataIndex: 'productName',
      key: 'productName',
      width: 160,
    },
    {
      title: '原价',
      dataIndex: 'oldPrice',
      key: 'oldPrice',
      width: 100,
      align: 'right',
      render: (val: number) => `¥ ${val.toFixed(2)}`,
    },
    {
      title: '新价',
      dataIndex: 'newPrice',
      key: 'newPrice',
      width: 100,
      align: 'right',
      render: (val: number) => `¥ ${val.toFixed(2)}`,
    },
    {
      title: '差价',
      key: 'diff',
      width: 100,
      align: 'right',
      render: (_: unknown, record: PriceAdjustmentRecord) => {
        const diff = record.newPrice - record.oldPrice;
        return (
          <span style={{ color: diff >= 0 ? '#52c41a' : '#ff4d4f' }}>
            {diff >= 0 ? '+' : ''}¥ {diff.toFixed(2)}
          </span>
        );
      },
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 100,
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      width: 200,
      ellipsis: true,
    },
    {
      title: '生效日期',
      dataIndex: 'effectiveDate',
      key: 'effectiveDate',
      width: 120,
    },
    {
      title: '操作时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
    },
  ];

  return (
    <Card>
      <Space
        direction="vertical"
        size="middle"
        style={{ width: '100%' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Title level={5} style={{ margin: 0 }}>
            调价历史
          </Title>
          <Space wrap>
            <Input
              placeholder="搜索商品名"
              prefix={<SearchOutlined />}
              allowClear
              style={{ width: 200 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <RangePicker
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setDateRange([
                    dates[0].format('YYYY-MM-DD'),
                    dates[1].format('YYYY-MM-DD'),
                  ]);
                } else {
                  setDateRange(null);
                }
              }}
            />
          </Space>
        </div>

        <Table<PriceAdjustmentRecord>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Space>
    </Card>
  );
}
