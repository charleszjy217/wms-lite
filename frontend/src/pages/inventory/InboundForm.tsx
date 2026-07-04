import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Form,
  Select,
  InputNumber,
  DatePicker,
  Input,
  Button,
  Typography,
  message,
  Space,
  Divider,
  Table,
} from 'antd';
import { PlusOutlined, DeleteOutlined, InboxOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  inventoryApi,
  type Warehouse,
  type Location,
  type Product,
  type InboundOrderItem,
} from '../../api/inventory';

const { Title, Text } = Typography;

interface FormValues {
  warehouseId: string;
  remark?: string;
}

interface InboundRow {
  key: string;
  productId: string;
  batchNo: string;
  expiryDate: string;
  manufactureDate: string;
  locationId: string;
  quantity: number;
}

export default function InboundForm() {
  const [form] = Form.useForm<FormValues>();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<InboundRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [whRes, prodRes] = await Promise.all([
          inventoryApi.listWarehouses(),
          inventoryApi.listProducts(),
        ]);
        setWarehouses(whRes.data);
        setProducts(prodRes.data);
      } catch {
        message.error('加载基础数据失败');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleWarehouseChange = useCallback(async (whId: string) => {
    if (!whId) {
      setLocations([]);
      return;
    }
    try {
      const res = await inventoryApi.listLocations(whId);
      setLocations(res.data);
    } catch {
      setLocations([]);
    }
  }, []);

  const addRow = () => {
    const newRow: InboundRow = {
      key: Date.now().toString(),
      productId: '',
      batchNo: '',
      expiryDate: '',
      manufactureDate: '',
      locationId: '',
      quantity: 0,
    };
    setRows((prev) => [...prev, newRow]);
  };

  const updateRow = (key: string, field: keyof InboundRow, value: unknown) => {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((row) => row.key !== key));
  };

  const handleSubmit = async (values: FormValues) => {
    if (rows.length === 0) {
      message.warning('请添加至少一条入库商品');
      return;
    }

    const hasInvalid = rows.some(
      (r) => !r.productId || !r.batchNo || !r.locationId || r.quantity <= 0,
    );
    if (hasInvalid) {
      message.warning('请完善每行数据（商品、批次号、库位、数量）');
      return;
    }

    setSubmitting(true);
    try {
      const items: InboundOrderItem[] = rows.map((r) => ({
        productId: r.productId,
        batchNo: r.batchNo,
        expiryDate: r.expiryDate,
        manufactureDate: r.manufactureDate,
        locationId: r.locationId,
        quantity: r.quantity,
      }));

      await inventoryApi.createInbound({
        warehouseId: values.warehouseId,
        items,
        remark: values.remark,
      });

      message.success('入库单创建成功');
      form.resetFields();
      setRows([]);
      setLocations([]);
    } catch {
      message.error('入库单创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<InboundRow> = [
    {
      title: '商品',
      dataIndex: 'productId',
      width: 200,
      render: (val: string, record: InboundRow) => (
        <Select
          showSearch
          placeholder="选择商品"
          style={{ width: '100%' }}
          value={val || undefined}
          onChange={(v) => updateRow(record.key, 'productId', v)}
          optionFilterProp="label"
          options={products.map((p) => ({
            label: p.name + ' (' + p.sku + ')',
            value: p.id,
          }))}
        />
      ),
    },
    {
      title: '批次号',
      dataIndex: 'batchNo',
      width: 150,
      render: (val: string, record: InboundRow) => (
        <Input
          placeholder="批次号"
          value={val}
          onChange={(e) => updateRow(record.key, 'batchNo', e.target.value)}
        />
      ),
    },
    {
      title: '生产日期',
      dataIndex: 'manufactureDate',
      width: 140,
      render: (val: string, record: InboundRow) => (
        <DatePicker
          style={{ width: '100%' }}
          onChange={(d) =>
            updateRow(record.key, 'manufactureDate', d?.format('YYYY-MM-DD') || '')
          }
        />
      ),
    },
    {
      title: '过期日期',
      dataIndex: 'expiryDate',
      width: 140,
      render: (val: string, record: InboundRow) => (
        <DatePicker
          style={{ width: '100%' }}
          onChange={(d) =>
            updateRow(record.key, 'expiryDate', d?.format('YYYY-MM-DD') || '')
          }
        />
      ),
    },
    {
      title: '库位',
      dataIndex: 'locationId',
      width: 160,
      render: (val: string, record: InboundRow) => (
        <Select
          showSearch
          placeholder="选择库位"
          style={{ width: '100%' }}
          value={val || undefined}
          onChange={(v) => updateRow(record.key, 'locationId', v)}
          optionFilterProp="label"
          options={locations.map((l) => ({
            label: l.name,
            value: l.id,
          }))}
        />
      ),
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 120,
      render: (val: number, record: InboundRow) => (
        <InputNumber
          min={1}
          style={{ width: '100%' }}
          value={val || undefined}
          onChange={(v) => updateRow(record.key, 'quantity', v || 0)}
        />
      ),
    },
    {
      title: '操作',
      width: 80,
      render: (_: unknown, record: InboundRow) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeRow(record.key)}
        />
      ),
    },
  ];

  return (
    <Card>
      <Title level={5}>
        <InboxOutlined /> 入库单创建
      </Title>

      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ maxWidth: 900 }}
      >
        <Space size="large" wrap style={{ marginBottom: 24 }}>
          <Form.Item
            name="warehouseId"
            label="目标仓库"
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

          <Form.Item name="remark" label="备注" style={{ minWidth: 300, marginBottom: 0 }}>
            <Input placeholder="入库备注（可选）" />
          </Form.Item>
        </Space>

        <Divider orientation="left" plain>
          <Text type="secondary">入库商品明细</Text>
        </Divider>

        <Table<InboundRow>
          rowKey="key"
          columns={columns}
          dataSource={rows}
          pagination={false}
          size="small"
          scroll={{ x: 1000 }}
          locale={{ emptyText: '暂无入库商品，请点击下方按钮添加' }}
        />

        <Space style={{ marginTop: 16, marginBottom: 24 }}>
          <Button type="dashed" icon={<PlusOutlined />} onClick={addRow}>
            添加入库商品
          </Button>
        </Space>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting} size="large">
            提交入库单
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}
