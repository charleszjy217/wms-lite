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
} from 'antd';
import { PlusOutlined, DeleteOutlined, ExportOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  inventoryApi,
  type Warehouse,
  type Location,
  type Product,
  type OutboundOrderItem,
  type FefoBatchSuggestion,
} from '../../api/inventory';

const { Title, Text } = Typography;

interface FormValues {
  warehouseId: string;
  remark?: string;
}

interface OutboundRow {
  key: string;
  productId: string;
  productName?: string;
  batchId?: string;
  batchNo?: string;
  locationId?: string;
  locationName?: string;
  quantity: number;
  fefoSuggestions?: FefoBatchSuggestion[];
}

export default function OutboundForm() {
  const [form] = Form.useForm<FormValues>();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<OutboundRow[]>([]);
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
    const newRow: OutboundRow = {
      key: Date.now().toString(),
      productId: '',
      quantity: 1,
    };
    setRows((prev) => [...prev, newRow]);
  };

  const updateRow = (key: string, field: keyof OutboundRow, value: unknown) => {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((row) => row.key !== key));
  };

  /** 选择商品后，自动获取 FEFO 批次建议 */
  const handleProductSelect = async (rowKey: string, productId: string, warehouseId: string) => {
    updateRow(rowKey, 'productId', productId);
    const product = products.find((p) => p.id === productId);

    if (!productId || !warehouseId) return;

    try {
      const res = await inventoryApi.getFefoSuggestions(productId, warehouseId);
      const suggestions = res.data;

      if (suggestions.length > 0) {
        // 自动选择第一个批次
        const first = suggestions[0];
        updateRow(rowKey, 'batchId', first.batchId);
        updateRow(rowKey, 'batchNo', first.batchNo);
        updateRow(rowKey, 'locationId', first.locationId);
        updateRow(rowKey, 'locationName', first.locationName);
        updateRow(rowKey, 'productName', first.productName);
        updateRow(rowKey, 'fefoSuggestions', suggestions);
      } else {
        updateRow(rowKey, 'fefoSuggestions', []);
        message.info(product?.name + ' 暂无可用批次库存');
      }
    } catch {
      // 静默处理
    }
  };

  const handleSubmit = async (values: FormValues) => {
    if (rows.length === 0) {
      message.warning('请添加至少一条出库商品');
      return;
    }

    const hasInvalid = rows.some(
      (r) => !r.productId || !r.batchId || !r.locationId || r.quantity <= 0,
    );
    if (hasInvalid) {
      message.warning('请完善每行数据（商品、批次、库位、数量）');
      return;
    }

    setSubmitting(true);
    try {
      const items: OutboundOrderItem[] = rows.map((r) => ({
        productId: r.productId,
        batchId: r.batchId!,
        locationId: r.locationId!,
        quantity: r.quantity,
      }));

      await inventoryApi.createOutbound({
        warehouseId: values.warehouseId,
        items,
        remark: values.remark,
      });

      message.success('出库单创建成功');
      form.resetFields();
      setRows([]);
      setLocations([]);
    } catch {
      message.error('出库单创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const warehouseId = Form.useWatch('warehouseId', form);

  const columns: ColumnsType<OutboundRow> = [
    {
      title: '商品',
      dataIndex: 'productId',
      width: 200,
      render: (val: string, record: OutboundRow) => (
        <Select
          showSearch
          placeholder="选择商品"
          style={{ width: '100%' }}
          value={val || undefined}
          onChange={(v) => handleProductSelect(record.key, v, warehouseId)}
          optionFilterProp="label"
          options={products.map((p) => ({
            label: p.name + ' (' + p.sku + ')',
            value: p.id,
          }))}
        />
      ),
    },
    {
      title: 'FEFO 批次建议',
      width: 220,
      render: (_: unknown, record: OutboundRow) => {
        const suggestions = record.fefoSuggestions;
        if (!suggestions || suggestions.length === 0) {
          return <Text type="secondary">请先选择商品</Text>;
        }
        return (
          <Space size={4} wrap>
            {suggestions.map((s) => (
              <Tag
                key={s.batchId}
                color={s.batchId === record.batchId ? 'blue' : 'default'}
                style={{ cursor: 'pointer', marginBottom: 2 }}
                onClick={() => {
                  updateRow(record.key, 'batchId', s.batchId);
                  updateRow(record.key, 'batchNo', s.batchNo);
                  updateRow(record.key, 'locationId', s.locationId);
                  updateRow(record.key, 'locationName', s.locationName);
                }}
              >
                {s.batchNo + ' (' + s.availableQuantity + ') ' + s.expiryDate?.slice(0, 10)}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '批次号',
      dataIndex: 'batchNo',
      width: 130,
      render: (val: string) => <Text>{val || '-'}</Text>,
    },
    {
      title: '库位',
      dataIndex: 'locationName',
      width: 120,
      render: (val: string) => <Text>{val || '-'}</Text>,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 120,
      render: (val: number, record: OutboundRow) => (
        <Select
          style={{ width: '100%' }}
          value={val}
          onChange={(v) => updateRow(record.key, 'quantity', v)}
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <Select.Option key={n} value={n}>{n}</Select.Option>
          ))}
          <Select.Option value={20}>20</Select.Option>
          <Select.Option value={50}>50</Select.Option>
          <Select.Option value={100}>100</Select.Option>
        </Select>
      ),
    },
    {
      title: '操作',
      width: 80,
      render: (_: unknown, record: OutboundRow) => (
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
        <ExportOutlined /> 出库单创建
      </Title>

      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        选择商品后，系统将按 FEFO（先到期先出）原则推荐批次
      </Text>

      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ maxWidth: 1000 }}
      >
        <Space size="large" wrap style={{ marginBottom: 24 }}>
          <Form.Item
            name="warehouseId"
            label="出库仓库"
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
            <Input placeholder="出库备注（可选）" />
          </Form.Item>
        </Space>

        <Divider orientation="left" plain>
          <Text type="secondary">出库商品明细</Text>
        </Divider>

        <Table<OutboundRow>
          rowKey="key"
          columns={columns}
          dataSource={rows}
          pagination={false}
          size="small"
          scroll={{ x: 900 }}
          locale={{ emptyText: '暂无出库商品，请点击下方按钮添加' }}
        />

        <Space style={{ marginTop: 16, marginBottom: 24 }}>
          <Button type="dashed" icon={<PlusOutlined />} onClick={addRow}>
            添加出库商品
          </Button>
        </Space>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting} size="large">
            提交出库单
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}
