import { useEffect, useState, useCallback } from 'react';
import { Table, Card, Tag, Input, Space, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { pricingApi, type PriceListItem } from '../../api/pricing';

const { Title } = Typography;

export default function PriceListTab() {
  const [data, setData] = useState<PriceListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await pricingApi.list();
      setData(res.data);
    } catch {
      // 静默处理
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const filtered = data.filter(
    (item) =>
      item.productName.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase()),
  );

  const columns: ColumnsType<PriceListItem> = [
    {
      title: '商品名',
      dataIndex: 'productName',
      key: 'productName',
      width: 200,
    },
    {
      title: '商品类别',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (text: string) => <Tag>{text}</Tag>,
    },
    {
      title: '当前价格',
      dataIndex: 'currentPrice',
      key: 'currentPrice',
      width: 120,
      align: 'right',
      render: (val: number) => `¥ ${val.toFixed(2)}`,
    },
    {
      title: '价目表',
      dataIndex: 'priceList',
      key: 'priceList',
      width: 120,
    },
    {
      title: '生效日期',
      dataIndex: 'effectiveDate',
      key: 'effectiveDate',
      width: 140,
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
          }}
        >
          <Title level={5} style={{ margin: 0 }}>
            商品价格列表
          </Title>
          <Input
            placeholder="搜索商品名或类别"
            prefix={<SearchOutlined />}
            allowClear
            style={{ width: 260 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Table<PriceListItem>
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
