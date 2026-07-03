import { Card, Typography } from 'antd';
import { ApiOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function IntegrationPage() {
  return (
    <Card>
      <Title level={4}>
        <ApiOutlined /> 集成管理
      </Title>
      <Text type="secondary">集成管理页面 - 正在建设中...</Text>
    </Card>
  );
}
