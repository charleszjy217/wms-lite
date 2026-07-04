import { Typography, Tabs } from 'antd';
import {
  StockOutlined,
  UnorderedListOutlined,
  InboxOutlined,
  ExportOutlined,
  SwapOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import InventoryQuery from './InventoryQuery';
import InboundForm from './InboundForm';
import OutboundForm from './OutboundForm';
import TransferForm from './TransferForm';
import StocktakeForm from './StocktakeForm';

const { Title } = Typography;

export default function InventoryPage() {
  const items = [
    {
      key: 'query',
      label: (
        <span>
          <UnorderedListOutlined /> 库存查询
        </span>
      ),
      children: <InventoryQuery />,
    },
    {
      key: 'inbound',
      label: (
        <span>
          <InboxOutlined /> 入库
        </span>
      ),
      children: <InboundForm />,
    },
    {
      key: 'outbound',
      label: (
        <span>
          <ExportOutlined /> 出库
        </span>
      ),
      children: <OutboundForm />,
    },
    {
      key: 'transfer',
      label: (
        <span>
          <SwapOutlined /> 调拨
        </span>
      ),
      children: <TransferForm />,
    },
    {
      key: 'stocktake',
      label: (
        <span>
          <FileSearchOutlined /> 盘点
        </span>
      ),
      children: <StocktakeForm />,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Title level={4}>
          <StockOutlined /> 库存管理
        </Title>
      </div>
      <Tabs defaultActiveKey="query" items={items} destroyOnHidden />
    </div>
  );
}
