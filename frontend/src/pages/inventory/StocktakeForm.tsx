import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Form,
  Select,
  InputNumber,
  Input,
  Button,
  Typography,
  message,
  Space,
  Divider,
  Table,
  Tag,
  Alert,
} from 'antd';
import { CheckCircleOutlined, WarningOutlined, FileSearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  inventoryApi,
  type Warehouse,
  type Location,
  type StocktakeItem,
  type InventoryItem,
} from '../../api/inventory';

const { Title, Text } = Typography;

interface FormValues {
  warehouseId: string;
  locationId: string;
  remark?: string;
}

interface StocktakeRow {
  key: string;
  inventoryId: string;
  productId: string;
  productName: string;
  batchId: string;
  batchNo: string;
  expiryDate: string;
  systemQuantity: number;
  actualQuantity: number;
  diff: number;
}

export default function StocktakeForm() {
  const [form] = Form.useForm<FormValues>();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [rows, setRows] = useState<StocktakeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [warehouseId, setWarehouseId] = useState<string>('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await inventoryApi.listWarehouses();
        setWarehouses(res.data);
      } catch {
        message.error('加载仓库列表失败');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleWarehouseChange = useCallback(async (whId: string) => {
    setWarehouseId(whId);
    setRows([]);
    setInventoryData([]);
    if (!whId) {
      setLocations([]);
      return;
    }
    try {
      const [locRes] = await Promise.all([
        inventoryApi.listLocations(whId),
      ]);
      setLocations(locRes.data);
    } catch {
      setLocations([]);
    }
  }, []);

  const handleLocationChange = useCallback(async (locId: string) => {
    setRows([]);
    if (!locId || !warehouseId) return;

    setLoading(true);
    try {
      const res = await inventoryApi.list({ locationId: locId, warehouseId: warehouseId, pageSize: 1000 });
      const items: InventoryItem[] = res.data.records || [];
      setInventoryData(items);

      const stockRows: StocktakeRow[] = items.map((item) => ({
        key: item.id,
        inventoryId: item.id,
        productId: item.productId,
        productName: item.productName,
        batchId: item.id, // 使用库存记录 ID 作为批次标识
        batchNo: item.batchNo,
        expiryDate: item.expiryDate,
        systemQuantity: item.quantity,
        actualQuantity: item.quantity,
        diff: 0,
      }));
      setRows(stockRows);
    } catch {
      message.error('加载库存数据失败');
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  const updateActualQuantity = (key: string, value: number) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const actualQuantity = value >= 0 ? value : 0;
        const diff = actualQuantity - row.systemQuantity;
        return { ...row, actualQuantity, diff };
      }),
    );
  };

  const handleSubmit = async (values: FormValues) => {
    if (rows.length === 0) {
      message.warning('请先选择库位加载库存数据');
      return;
    }

    setSubmitting(true);
    try {
      const items: StocktakeItem[] = rows.map((r) => ({
        locationId: values.locationId,
        productId: r.productId,
        batchId: r.batchId,
        actualQuantity: r.actualQuantity,
      }));

      await inventoryApi.createStocktake({
        warehouseId: values.warehouseId,
        locationId: values.locationId,
        items,
        remark: values.remark,
      });

      message.success('盘点数据提交成功');
      form.resetFields();
      setRows([]);
      setInventoryData([]);
    } catch {
      message.error('盘点数据提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const differenceCount = rows.filter((r) => r.diff !== 0).length;

  const columns: ColumnsType<StocktakeRow> = [
    {
      title: '商品',
      dataIndex: 'productName',
      width: 160,
    },
    {
      title: '批次号',
      dataIndex: 'batchNo',
      width: 130,
    },
    {
      title: '过期日期',
      dataIndex: 'expiryDate',
      width: 110,
      render: (val: string) => (val ? val.slice(0, 10) : '-'),
    },
    {
      title: '系统数量',
      dataIndex: 'systemQuantity',
      width: 100,
      align: 'right' as const,
    },
    {
      title: '实盘数量',
      dataIndex: 'actualQuantity',
      width: 120,
      render: (val: number, record: StocktakeRow) => (
        <InputNumber
          min={0}
          style={{ width: '100%' }}
          value={val}
          onChange={(v) => updateActualQuantity(record.key, v || 0)}
        />
      ),
    },
    {
      title: '差异',
      dataIndex: 'diff',
      width: 100,
      align: 'right' as const,
      render: (val: number) => (
        <Text
          style={{
            color: val === 0 ? undefined : val > 0 ? '#52c41a' : '#ff4d4f',
            fontWeight: val !== 0 ? 600 : undefined,
          }}
        >
          {val > 0 ? '+' : ''}{val}
        </Text>
      ),
    },
    {
      title: '状态',
      width: 100,
      render: (_: unknown, record: StocktakeRow) =>
        record.diff === 0 ? (
          <Tag icon={<CheckCircleOutlined />} color="success">一致</Tag>
        ) : (
          <Tag icon={<WarningOutlined />} color="warning">差异</Tag>
        ),
    },
  ];

  return (
    <Card>
      <Title level={5}>
        <FileSearchOutlined /> 盘点录入
      </Title>

      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ maxWidth: 1100 }}
      >
        <Space size="large" wrap style={{ marginBottom: 24 }}>
          <Form.Item
            name="warehouseId"
            label="盘点仓库"
            rules={[{ required: true, message: '请选择仓库' }]}
            style={{ minWidth: 240, marginBottom: 0 }}
          >
            <Select
              showSearch
              placeholder="选择仓库"
              loading={loading}
              optionFilterProp="label"
              onChange={handleWarehouseChange}
              options={warehouses.map((w: Warehouse) => ({
                label: w.name,
                value: w.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="locationId"
            label="盘点库位"
            rules={[{ required: true, message: '请选择库位' }]}
            style={{ minWidth: 240, marginBottom: 0 }}
          >
            <Select
              showSearch
              placeholder="选择库位"
              loading={loading}
              optionFilterProp="label"
              onChange={handleLocationChange}
              options={locations.map((l) => ({
                label: l.name,
                value: l.id,
              }))}
            />
          </Form.Item>

          <Form.Item name="remark" label="备注" style={{ minWidth: 240, marginBottom: 0 }}>
            <Input placeholder="盘点备注（可选）" />
          </Form.Item>
        </Space>

        {rows.length > 0 && (
          <>
            <Divider orientation="left" plain>
              <Text type="secondary">盘点明细 — 请录入实盘数量</Text>
            </Divider>

            {differenceCount > 0 && (
              <Alert
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                message={'发现 ' + differenceCount + ' 项差异，请确认后提交'}
                style={{ marginBottom: 16 }}
              />
            )}

            {differenceCount === 0 && (
              <Alert
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
                message="所有库存数量与系统一致"
                style={{ marginBottom: 16 }}
              />
            )}

            <Table<StocktakeRow>
              rowKey="key"
              columns={columns}
              dataSource={rows}
              pagination={false}
              size="small"
              scroll={{ x: 800 }}
            />

            <Form.Item style={{ marginTop: 24 }}>
              <Button type="primary" htmlType="submit" loading={submitting} size="large">
                提交盘点数据
              </Button>
            </Form.Item>
          </>
        )}
      </Form>
    </Card>
  );
}
