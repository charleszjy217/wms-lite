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
} from 'antd';
import { PlusOutlined, DeleteOutlined, SwapOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  inventoryApi,
  type Warehouse,
  type Location,
  type Product,
  type TransferOrderItem,
  type Batch,
} from '../../api/inventory';

const { Title, Text } = Typography;

interface FormValues {
  sourceWarehouseId: string;
  sourceLocationId: string;
  targetWarehouseId: string;
  targetLocationId: string;
  remark?: string;
}

interface TransferRow {
  key: string;
  productId: string;
  batchId: string;
  batchNo: string;
  quantity: number;
  availableQuantity?: number;
}

export default function TransferForm() {
  const [form] = Form.useForm<FormValues>();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [sourceLocations, setSourceLocations] = useState<Location[]>([]);
  const [targetLocations, setTargetLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [rows, setRows] = useState<TransferRow[]>([]);
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

  const loadLocations = useCallback(async (warehouseId: string): Promise<Location[]> => {
    if (!warehouseId) return [];
    try {
      const res = await inventoryApi.listLocations(warehouseId);
      return res.data;
    } catch {
      return [];
    }
  }, []);

  const loadBatches = useCallback(async (locationId: string) => {
    if (!locationId) {
      setBatches([]);
      return;
    }
    try {
      const res = await inventoryApi.listBatches({ locationId });
      setBatches(res.data);
    } catch {
      setBatches([]);
    }
  }, []);

  const handleSourceWarehouseChange = async (whId: string) => {
    const locs = await loadLocations(whId);
    setSourceLocations(locs);
    form.setFieldValue('sourceLocationId', undefined);
  };

  const handleTargetWarehouseChange = async (whId: string) => {
    const locs = await loadLocations(whId);
    setTargetLocations(locs);
    form.setFieldValue('targetLocationId', undefined);
  };

  const handleSourceLocationChange = (locId: string) => {
    loadBatches(locId);
  };

  const addRow = () => {
    const newRow: TransferRow = {
      key: Date.now().toString(),
      productId: '',
      batchId: '',
      batchNo: '',
      quantity: 1,
    };
    setRows((prev) => [...prev, newRow]);
  };

  const updateRow = (key: string, field: keyof TransferRow, value: unknown) => {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((row) => row.key !== key));
  };

  /** 选择批次时，自动填充商品和可用数量 */
  const handleBatchSelect = (rowKey: string, batchId: string) => {
    const batch = batches.find((b) => b.id === batchId);
    if (batch) {
      updateRow(rowKey, 'batchId', batch.id);
      updateRow(rowKey, 'batchNo', batch.batchNo);
      updateRow(rowKey, 'productId', batch.productId);
      updateRow(rowKey, 'availableQuantity', batch.quantity);
    }
  };

  const handleSubmit = async (values: FormValues) => {
    if (rows.length === 0) {
      message.warning('请添加至少一条调拨商品');
      return;
    }

    const hasInvalid = rows.some(
      (r) => !r.productId || !r.batchId || r.quantity <= 0,
    );
    if (hasInvalid) {
      message.warning('请完善每行数据（商品、批次、数量）');
      return;
    }

    if (values.sourceWarehouseId === values.targetWarehouseId &&
        values.sourceLocationId === values.targetLocationId) {
      message.warning('来源库位与目标库位不能相同');
      return;
    }

    setSubmitting(true);
    try {
      const items: TransferOrderItem[] = rows.map((r) => ({
        productId: r.productId,
        batchId: r.batchId,
        quantity: r.quantity,
      }));

      await inventoryApi.createTransfer({
        sourceWarehouseId: values.sourceWarehouseId,
        sourceLocationId: values.sourceLocationId,
        targetWarehouseId: values.targetWarehouseId,
        targetLocationId: values.targetLocationId,
        items,
        remark: values.remark,
      });

      message.success('调拨单创建成功');
      form.resetFields();
      setRows([]);
      setSourceLocations([]);
      setTargetLocations([]);
      setBatches([]);
    } catch {
      message.error('调拨单创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const sourceWarehouseId = Form.useWatch('sourceWarehouseId', form);

  const columns: ColumnsType<TransferRow> = [
    {
      title: '批次',
      dataIndex: 'batchId',
      width: 200,
      render: (val: string, record: TransferRow) => (
        <Select
          showSearch
          placeholder="选择批次"
          style={{ width: '100%' }}
          value={val || undefined}
          onChange={(v) => handleBatchSelect(record.key, v)}
          optionFilterProp="label"
          options={batches.map((b) => ({
            label: b.batchNo + ' (' + b.productName + ') - 余' + b.quantity,
            value: b.id,
          }))}
        />
      ),
    },
    {
      title: '商品',
      dataIndex: 'productId',
      width: 180,
      render: (val: string) => {
        const product = products.find((p) => p.id === val);
        return <Text>{product ? product.name + ' (' + product.sku + ')' : '-'}</Text>;
      },
    },
    {
      title: '可用数量',
      dataIndex: 'availableQuantity',
      width: 100,
      align: 'right' as const,
      render: (val: number) => <Text>{val ?? '-'}</Text>,
    },
    {
      title: '调拨数量',
      dataIndex: 'quantity',
      width: 120,
      render: (val: number, record: TransferRow) => (
        <InputNumber
          min={1}
          max={record.availableQuantity || 99999}
          style={{ width: '100%' }}
          value={val}
          onChange={(v) => updateRow(record.key, 'quantity', v || 0)}
        />
      ),
    },
    {
      title: '操作',
      width: 80,
      render: (_: unknown, record: TransferRow) => (
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
        <SwapOutlined /> 调拨单创建
      </Title>

      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ maxWidth: 1000 }}
      >
        <Space size="large" wrap style={{ marginBottom: 24 }}>
          <Form.Item
            name="sourceWarehouseId"
            label="来源仓库"
            rules={[{ required: true, message: '请选择来源仓库' }]}
            style={{ minWidth: 200, marginBottom: 0 }}
          >
            <Select
              showSearch
              placeholder="选择来源仓库"
              loading={loading}
              optionFilterProp="label"
              onChange={handleSourceWarehouseChange}
              options={warehouses.map((w: Warehouse) => ({
                label: w.name,
                value: w.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="sourceLocationId"
            label="来源库位"
            rules={[{ required: true, message: '请选择来源库位' }]}
            style={{ minWidth: 200, marginBottom: 0 }}
          >
            <Select
              showSearch
              placeholder="选择来源库位"
              optionFilterProp="label"
              onChange={handleSourceLocationChange}
              options={sourceLocations.map((l) => ({
                label: l.name,
                value: l.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="targetWarehouseId"
            label="目标仓库"
            rules={[{ required: true, message: '请选择目标仓库' }]}
            style={{ minWidth: 200, marginBottom: 0 }}
          >
            <Select
              showSearch
              placeholder="选择目标仓库"
              loading={loading}
              optionFilterProp="label"
              onChange={handleTargetWarehouseChange}
              options={warehouses.map((w: Warehouse) => ({
                label: w.name,
                value: w.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="targetLocationId"
            label="目标库位"
            rules={[{ required: true, message: '请选择目标库位' }]}
            style={{ minWidth: 200, marginBottom: 0 }}
          >
            <Select
              showSearch
              placeholder="选择目标库位"
              optionFilterProp="label"
              options={targetLocations.map((l) => ({
                label: l.name,
                value: l.id,
              }))}
            />
          </Form.Item>
        </Space>

        <Form.Item name="remark" label="备注" style={{ marginBottom: 16 }}>
          <Input placeholder="调拨备注（可选）" />
        </Form.Item>

        <Divider orientation="left" plain>
          <Text type="secondary">调拨商品明细</Text>
        </Divider>

        <Table<TransferRow>
          rowKey="key"
          columns={columns}
          dataSource={rows}
          pagination={false}
          size="small"
          scroll={{ x: 700 }}
          locale={{ emptyText: '暂无调拨商品，请点击下方按钮添加' }}
        />

        <Space style={{ marginTop: 16, marginBottom: 24 }}>
          <Button type="dashed" icon={<PlusOutlined />} onClick={addRow}>
            添加调拨商品
          </Button>
        </Space>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting} size="large">
            提交调拨单
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}
