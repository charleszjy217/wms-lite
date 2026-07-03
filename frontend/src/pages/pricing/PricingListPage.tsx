import { Card, Typography } from 'antd';
import { DollarOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function PricingListPage() {
  return (
    <Card>
      <Title level={4}>
        <DollarOutlined /> 价格管理
      </Title>
      <Text type="secondary">价格管理页面 - 正在建设中...</Text>
    </Card>
  );
}
