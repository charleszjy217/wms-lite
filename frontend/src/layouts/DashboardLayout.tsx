import { ProLayout } from '@ant-design/pro-layout';
import { Outlet, useLocation, Link } from 'react-router-dom';
import {
  HomeOutlined,
  ShoppingOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  StockOutlined,
  DollarOutlined,
  ApiOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Dropdown, theme } from 'antd';
import { useAuth } from '../hooks/useAuth';
import type { MenuDataItem } from '@ant-design/pro-layout';

/* ------------------------------------------------------------------ */
/*  Menu 配置                                                           */
/* ------------------------------------------------------------------ */

const menuItems: MenuDataItem[] = [
  { path: '/', name: '首页', icon: <HomeOutlined /> },
  { path: '/products', name: '商品管理', icon: <ShoppingOutlined /> },
  { path: '/warehouses', name: '仓库管理', icon: <DatabaseOutlined /> },
  { path: '/batches', name: '批次管理', icon: <ExperimentOutlined /> },
  { path: '/inventory', name: '库存管理', icon: <StockOutlined /> },
  { path: '/pricing', name: '价格管理', icon: <DollarOutlined /> },
  { path: '/integration', name: '集成管理', icon: <ApiOutlined /> },
];

/* ------------------------------------------------------------------ */
/*  Dashboard Layout                                                   */
/* ------------------------------------------------------------------ */

export default function DashboardLayout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { token } = theme.useToken();

  return (
    <ProLayout
      logo="https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg"
      title="WMS-lite"
      layout="side"
      location={{ pathname: location.pathname }}
      menuDataRender={() => menuItems}
      menuItemRender={(item, dom) => (
        <Link to={item.path || '/'} style={{ textDecoration: 'none' }}>
          {dom}
        </Link>
      )}
      fixSiderbar
      fixedHeader
      siderWidth={220}
      siderMenuType="group"
      collapsedButtonRender={(collapsed) =>
        collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
      }
      headerTitleRender={() => (
        <span style={{ fontWeight: 600, fontSize: 16 }}>
          WMS-lite 库存管理系统
        </span>
      )}
      avatarProps={{
        icon: <UserOutlined />,
        size: 'small',
        title: user?.displayName || user?.username || '用户',
        render: (_props, dom) => (
          <Dropdown
            menu={{
              items: [
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                  onClick: logout,
                },
              ],
            }}
          >
            {dom}
          </Dropdown>
        ),
      }}
      actionsRender={() => []}
    >
      <Outlet />
    </ProLayout>
  );
}
