import { Tabs, Typography } from 'antd';
import { DollarOutlined, OrderedListOutlined, EditOutlined, GroupOutlined, HistoryOutlined } from '@ant-design/icons';
import PriceListTab from './PriceListTab';
import SinglePricingForm from './SinglePricingForm';
import BatchPricingForm from './BatchPricingForm';
import PricingHistory from './PricingHistory';

const { Title } = Typography;

export default function PricingListPage() {
  const items = [
    {
      key: 'price-list',
      label: (
        <span>
          <OrderedListOutlined /> 价格列表
        </span>
      ),
      children: <PriceListTab />,
    },
    {
      key: 'single-adjust',
      label: (
        <span>
          <EditOutlined /> 单品调价
        </span>
      ),
      children: <SinglePricingForm />,
    },
    {
      key: 'batch-adjust',
      label: (
        <span>
          <GroupOutlined /> 批量调价
        </span>
      ),
      children: <BatchPricingForm />,
    },
    {
      key: 'history',
      label: (
        <span>
          <HistoryOutlined /> 调价历史
        </span>
      ),
      children: <PricingHistory />,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Title level={4}>
          <DollarOutlined /> 价格管理
        </Title>
      </div>
      <Tabs defaultActiveKey="price-list" items={items} destroyOnHidden />
    </div>
  );
}
