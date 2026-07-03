import { Card, Typography } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function BatchListPage() {
  return (
    <Card>
      <Title level={4}>
        <ExperimentOutlined /> 批次管理
      </Title>
      <Text type="secondary">批次管理页面 - 正在建设中...</Text>
    </Card>
  );
}
