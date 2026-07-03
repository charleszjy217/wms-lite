import { Card, Typography } from 'antd';
import { StockOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function InventoryPage() {
  return (
    <Card>
      <Title level={4}>
        <StockOutlined /> 库存管理
      </Title>
      <Text type="secondary">库存管理页面 - 正在建设中...</Text>
    </Card>
  );
}
