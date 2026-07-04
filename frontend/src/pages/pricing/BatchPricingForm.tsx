import { useEffect, useState, useMemo } from 'react';
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
  Table,
  Space,
  Radio,
  Divider,
  Alert,
} from 'antd';
import { pricingApi, type Product, type PriceListItem } from '../../api/pricing';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface FormValues {
  category?: string;
  productIds?: string[];
  adjustType: 'fixed' | 'percentage';
  adjustValue: number;
  effectiveDate: any; // dayjs object from DatePicker
  reason: string;
}

export default function BatchPricingForm() {
  const [form] = Form.useForm<FormValues>();
  const [products, setProducts] = useState<Product[]>([]);
  const [priceList, setPriceList] = useState<PriceListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [adjustType, setAdjustType] = useState<'fixed' | 'percentage'>('fixed');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [prodRes, priceRes] = await Promise.all([
          pricingApi.listProducts(),
          pricingApi.list(),
        ]);
        setProducts(prodRes.data);
        setPriceList(priceRes.data);
      } catch {
        // 静默
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return Array.from(set).sort();
  }, [products]);

  const filteredPriceList = useMemo(() => {
    if (!selectedCategory) return priceList;
    return priceList.filter(
      (item) => item.category === selectedCategory,
    );
  }, [priceList, selectedCategory]);

  const handleCategoryChange = (value: string | undefined) => {
    setSelectedCategory(value);
    form.setFieldValue('productIds', undefined);
  };

  /** 预览：调整后的价格 */
  const previewData = useMemo(() => {
    const selectedIds: string[] = form.getFieldValue('productIds') || [];
    const adjustValue = form.getFieldValue('adjustValue') || 0;
    return filteredPriceList
      .filter((item) => selectedIds.includes(item.productId))
      .map((item) => {
        let newPrice: number;
        if (adjustType === 'fixed') {
          newPrice = item.currentPrice + adjustValue;
        } else {
          newPrice = item.currentPrice * (1 + adjustValue / 100);
        }
        newPrice = Math.round(newPrice * 100) / 100;
        return {
          ...item,
          newPrice,
          diff: newPrice - item.currentPrice,
        };
      });
  }, [filteredPriceList, adjustType, form]);

  const handleSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await pricingApi.batchAdjust({
        category: values.category,
        productIds: values.productIds,
        adjustType: values.adjustType,
        adjustValue: values.adjustValue,
        effectiveDate: values.effectiveDate?.format?.('YYYY-MM-DD') || '',
        reason: values.reason,
      });
      message.success('批量调价成功');
      form.resetFields();
      setSelectedCategory(undefined);
    } catch {
      message.error('批量调价失败');
    } finally {
      setSubmitting(false);
    }
  };

  const previewColumns = [
    { title: '商品名', dataIndex: 'productName', key: 'productName', width: 180 },
    { title: '类别', dataIndex: 'category', key: 'category', width: 100 },
    {
      title: '当前价格',
      dataIndex: 'currentPrice',
      key: 'currentPrice',
      width: 110,
      align: 'right' as const,
      render: (val: number) => `¥ ${val.toFixed(2)}`,
    },
    {
      title: '调整后价格',
      dataIndex: 'newPrice',
      key: 'newPrice',
      width: 110,
      align: 'right' as const,
      render: (val: number) => `¥ ${val.toFixed(2)}`,
    },
    {
      title: '差价',
      dataIndex: 'diff',
      key: 'diff',
      width: 110,
      align: 'right' as const,
      render: (val: number) => (
        <span style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {val >= 0 ? '+' : ''}¥ {val.toFixed(2)}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <Title level={5}>批量调价</Title>

      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ maxWidth: 700 }}
      >
        {/* 筛选条件 */}
        <div
          style={{
            padding: 16,
            background: '#fafafa',
            borderRadius: 6,
            marginBottom: 24,
          }}
        >
          <Text strong style={{ marginBottom: 12, display: 'block' }}>
            筛选条件
          </Text>
          <Space size="large">
            <Form.Item name="category" label="商品类别" style={{ marginBottom: 0 }}>
              <Select
                allowClear
                placeholder="全部类别"
                style={{ width: 200 }}
                loading={loading}
                onChange={handleCategoryChange}
                options={categories.map((c) => ({ label: c, value: c }))}
              />
            </Form.Item>

            {selectedCategory && (
              <Form.Item
                name="productIds"
                label="选择商品"
                style={{ marginBottom: 0, minWidth: 240 }}
                rules={[{ required: true, message: '请选择至少一个商品' }]}
              >
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="选择要调价的商品"
                  options={filteredPriceList.map((item) => ({
                    label: `${item.productName} (¥${item.currentPrice.toFixed(2)})`,
                    value: item.productId,
                  }))}
                />
              </Form.Item>
            )}
          </Space>
        </div>

        {/* 调价参数 */}
        <div
          style={{
            padding: 16,
            background: '#fafafa',
            borderRadius: 6,
            marginBottom: 24,
          }}
        >
          <Text strong style={{ marginBottom: 12, display: 'block' }}>
            调价参数
          </Text>
          <Space size="large" wrap>
            <Form.Item
              name="adjustType"
              label="调整方式"
              initialValue="fixed"
              style={{ marginBottom: 0 }}
            >
              <Radio.Group onChange={(e) => setAdjustType(e.target.value)}>
                <Radio value="fixed">固定金额</Radio>
                <Radio value="percentage">百分比</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item
              name="adjustValue"
              label={adjustType === 'fixed' ? '调整金额' : '调整百分比'}
              style={{ marginBottom: 0 }}
              rules={[{ required: true, message: '请输入调整值' }]}
            >
              <Space.Compact>
                <InputNumber
                  style={{ width: 150 }}
                  precision={adjustType === 'fixed' ? 2 : 1}
                  placeholder={
                    adjustType === 'fixed' ? '例如: 10 (涨价)' : '例如: 10 (涨10%)'
                  }
                />
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0 11px',
                    background: '#f5f5f5',
                    border: '1px solid #d9d9d9',
                    borderLeft: 0,
                    borderRadius: '0 6px 6px 0',
                    fontSize: 14,
                    color: 'rgba(0,0,0,0.65)',
                  }}
                >
                  {adjustType === 'fixed' ? '元' : '%'}
                </span>
              </Space.Compact>
            </Form.Item>
          </Space>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">
              {adjustType === 'fixed'
                ? '输入正数涨价，负数降价'
                : '输入正数涨价百分比，负数降价百分比'}
            </Text>
          </div>
        </div>

        <Form.Item
          name="effectiveDate"
          label="生效日期"
          rules={[{ required: true, message: '请选择生效日期' }]}
        >
          <DatePicker style={{ width: 260 }} placeholder="选择生效日期" />
        </Form.Item>

        <Form.Item
          name="reason"
          label="调价原因"
          rules={[{ required: true, message: '请填写调价原因' }]}
        >
          <TextArea rows={3} placeholder="请输入调价原因" maxLength={200} showCount />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>
            提交批量调价
          </Button>
        </Form.Item>
      </Form>

      {/* 预览 */}
      {previewData.length > 0 && (
        <>
          <Divider />
          <Alert
            type="info"
            showIcon
            message={`共 ${previewData.length} 个商品将被调价`}
            style={{ marginBottom: 16 }}
          />
          <Table
            rowKey="id"
            columns={previewColumns}
            dataSource={previewData}
            pagination={false}
            size="small"
          />
        </>
      )}
    </Card>
  );
}
