import { useEffect, useState } from 'react';
import type dayjs from 'dayjs';
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
} from 'antd';
import { pricingApi, type Product } from '../../api/pricing';

const { Title } = Typography;
const { TextArea } = Input;

interface FormValues {
  productId: string;
  newPrice: number;
  effectiveDate: dayjs.Dayjs | null;
  reason: string;
}

export default function SinglePricingForm() {
  const [form] = Form.useForm<FormValues>();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await pricingApi.listProducts();
        setProducts(res.data);
      } catch {
        // 静默
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleProductChange = (productId: string) => {
    const product = products.find((p) => p.id === productId) || null;
    setSelectedProduct(product);
  };

  const handleSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await pricingApi.adjust({
        productId: values.productId,
        newPrice: values.newPrice,
        effectiveDate: values.effectiveDate?.format?.('YYYY-MM-DD') || '',
        reason: values.reason,
      });
      message.success('调价成功');
      form.resetFields();
      setSelectedProduct(null);
    } catch {
      message.error('调价失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <Title level={5}>单品调价</Title>

      {selectedProduct && (
        <div
          style={{
            marginBottom: 24,
            padding: 16,
            background: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: 6,
          }}
        >
          <Space>
            <span>当前价格：</span>
            <strong style={{ fontSize: 18, color: '#52c41a' }}>
              ¥ {selectedProduct.currentPrice.toFixed(2)}
            </strong>
          </Space>
        </div>
      )}

      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ maxWidth: 500 }}
      >
        <Form.Item
          name="productId"
          label="选择商品"
          rules={[{ required: true, message: '请选择商品' }]}
        >
          <Select
            showSearch
            placeholder="搜索并选择商品"
            loading={loading}
            optionFilterProp="label"
            onChange={handleProductChange}
            options={products.map((p) => ({
              label: `${p.name} (${p.category})`,
              value: p.id,
            }))}
          />
        </Form.Item>

        <Form.Item
          name="newPrice"
          label="新价格"
          rules={[
            { required: true, message: '请输入新价格' },
            {
              type: 'number',
              min: 0.01,
              message: '价格必须大于 0',
            },
          ]}
        >
          <InputNumber
            prefix="¥"
            style={{ width: '100%' }}
            precision={2}
            placeholder="输入新价格"
          />
        </Form.Item>

        <Form.Item
          name="effectiveDate"
          label="生效日期"
          rules={[{ required: true, message: '请选择生效日期' }]}
        >
          <DatePicker style={{ width: '100%' }} placeholder="选择生效日期" />
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
            提交调价
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}
