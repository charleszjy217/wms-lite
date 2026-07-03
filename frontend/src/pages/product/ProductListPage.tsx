import { Card, Typography } from 'antd';
import { ShoppingOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function ProductListPage() {
  return (
    <Card>
      <Title level={4}>
        <ShoppingOutlined /> 商品管理
      </Title>
      <Text type="secondary">商品列表页面 - 正在建设中...</Text>
    </Card>
  );
}
