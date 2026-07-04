import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Typography,
  Space,
  Select,
  Input,
  Tag,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  inventoryApi,
  type Warehouse,
  type Location,
  type InventoryItem,
} from '../../api/inventory';

const { Title, Text } = Typography;

export default function InventoryQuery() {
  const [data, setData] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // 筛选条件
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | undefined>();
  const [selectedLocation, setSelectedLocation] = useState<string | undefined>();
  const [searchProduct, setSearchProduct] = useState('');
  const [searchBatch, setSearchBatch] = useState('');

  // 分页
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page,
        pageSize,
      };
      if (selectedWarehouse) params.warehouseId = selectedWarehouse;
      if (selectedLocation) params.locationId = selectedLocation;
      if (searchProduct) params.productName = searchProduct;
      if (searchBatch) params.batchNo = searchBatch;

      const res = await inventoryApi.list(params);
      setData(res.data.records || []);
      setTotal(res.data.total || 0);
    } catch {
      // 静默处理
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, selectedWarehouse, selectedLocation, searchProduct, searchBatch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    (async () => {
      try {
        const whRes = await inventoryApi.listWarehouses();
        setWarehouses(whRes.data);
      } catch {
        // 静默
      }
    })();
  }, []);

  const handleWarehouseChange = async (whId: string | undefined) => {
    setSelectedWarehouse(whId);
    setSelectedLocation(undefined);
    setLocations([]);
    if (whId) {
      try {
        const locRes = await inventoryApi.listLocations(whId);
        setLocations(locRes.data);
      } catch {
        setLocations([]);
      }
    }
  };

  const columns: ColumnsType<InventoryItem> = [
    {
      title: '商品',
      dataIndex: 'productName',
      key: 'productName',
      width: 160,
      sorter: (a, b) => a.productName.localeCompare(b.productName),
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120,
    },
    {
      title: '批次号',
      dataIndex: 'batchNo',
      key: 'batchNo',
      width: 130,
    },
    {
      title: '过期日期',
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      width: 110,
      render: (val: string) => {
        if (!val) return '-';
        const expired = new Date(val) < new Date();
        return (
          <Text style={{ color: expired ? '#ff4d4f' : undefined }}>
            {val.slice(0, 10)}
          </Text>
        );
      },
    },
    {
      title: '仓库',
      dataIndex: 'warehouseName',
      key: 'warehouseName',
      width: 120,
    },
    {
      title: '库位',
      dataIndex: 'locationName',
      key: 'locationName',
      width: 120,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'right' as const,
      render: (val: number, record: InventoryItem) =>
        val + ' ' + (record.unit || ''),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (val: string) => (val ? val.slice(0, 19).replace('T', ' ') : '-'),
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
            库存列表
          </Title>
          <Space wrap>
            <Select
              allowClear
              placeholder="选择仓库"
              style={{ width: 160 }}
              value={selectedWarehouse}
              onChange={handleWarehouseChange}
              options={warehouses.map((w) => ({
                label: w.name,
                value: w.id,
              }))}
            />
            <Select
              allowClear
              placeholder="选择库位"
              style={{ width: 160 }}
              value={selectedLocation}
              onChange={setSelectedLocation}
              options={locations.map((l) => ({
                label: l.name,
                value: l.id,
              }))}
            />
            <Input
              placeholder="搜索商品"
              prefix={<SearchOutlined />}
              allowClear
              style={{ width: 160 }}
              value={searchProduct}
              onChange={(e) => {
                setSearchProduct(e.target.value);
                setPage(1);
              }}
            />
            <Input
              placeholder="搜索批次"
              prefix={<SearchOutlined />}
              allowClear
              style={{ width: 160 }}
              value={searchBatch}
              onChange={(e) => {
                setSearchBatch(e.target.value);
                setPage(1);
              }}
            />
          </Space>
        </div>

        <Table<InventoryItem>
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => '共 ' + t + ' 条记录',
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          scroll={{ x: 1100 }}
        />
      </Space>
    </Card>
  );
}
