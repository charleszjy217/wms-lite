import { Card, Typography } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function WarehouseListPage() {
  return (
    <Card>
      <Title level={4}>
        <DatabaseOutlined /> 仓库管理
      </Title>
      <Text type="secondary">仓库列表页面 - 正在建设中...</Text>
    </Card>
  );
}
