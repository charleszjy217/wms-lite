import { ConfigProvider, Layout, Typography } from 'antd';
import zhCN from 'antd/locale/zh_CN';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const themeConfig = {
  token: {
    colorPrimary: '#1677FF',
    borderRadius: 6,
  },
};

function App() {
  return (
    <ConfigProvider locale={zhCN} theme={themeConfig}>
      <Layout style={{ minHeight: '100vh' }}>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 24px',
          }}
        >
          <Title level={4} style={{ color: '#fff', margin: 0 }}>
            WMS-lite
          </Title>
        </Header>
        <Content style={{ padding: 24 }}>
          <Text type="secondary">库存管理系统 - 正在建设中...</Text>
        </Content>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
