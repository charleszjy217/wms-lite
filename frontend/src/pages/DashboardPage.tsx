import { Card, Typography } from 'antd';
import { HomeOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function DashboardPage() {
  return (
    <Card>
      <Title level={4}>
        <HomeOutlined /> 首页
      </Title>
      <Text type="secondary">库存管理系统 - 正在建设中...</Text>
    </Card>
  );
}
