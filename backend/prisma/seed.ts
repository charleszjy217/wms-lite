import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding WMS-lite database ...\n');

  // ── 1. Product Categories ──────────────────────────────────────
  const categoryElectronics = await prisma.productCategory.upsert({
    where: { code: 'ELECTRONICS' },
    update: {},
    create: {
      code: 'ELECTRONICS',
      name: '电子产品',
      path: 'ELECTRONICS',
    },
  });

  const categoryComponents = await prisma.productCategory.upsert({
    where: { code: 'COMPONENTS' },
    update: {},
    create: {
      code: 'COMPONENTS',
      name: '电子元器件',
      parentId: categoryElectronics.id,
      path: 'ELECTRONICS.COMPONENTS',
    },
  });

  console.log('  ✓ Product categories created');

  // ── 2. Products (SKUs) ─────────────────────────────────────────
  const product1 = await prisma.product.upsert({
    where: { skuCode: 'MCU-STM32F103' },
    update: {},
    create: {
      skuCode: 'MCU-STM32F103',
      name: 'STM32F103C8T6 微控制器',
      description: 'ARM Cortex-M3 内核，72MHz，64KB Flash',
      categoryId: categoryComponents.id,
      brand: 'STMicroelectronics',
      unitOfMeasure: 'PCS',
      barcode: '6901234567890',
      specifications: {
        package: 'LQFP-48',
        flash: '64KB',
        ram: '20KB',
        frequency: '72MHz',
      },
      status: 'ACTIVE',
    },
  });

  const product2 = await prisma.product.upsert({
    where: { skuCode: 'RES-10K-0603' },
    update: {},
    create: {
      skuCode: 'RES-10K-0603',
      name: '贴片电阻 10KΩ 0603',
      description: '厚膜贴片电阻，±1% 精度，100ppm',
      categoryId: categoryComponents.id,
      brand: 'Yageo',
      unitOfMeasure: 'REEL',
      barcode: '6901234567891',
      specifications: {
        package: '0603',
        resistance: '10KΩ',
        tolerance: '±1%',
        power: '0.1W',
      },
      status: 'ACTIVE',
    },
  });

  console.log('  ✓ Products created');

  // ── 3. Warehouse & Locations ───────────────────────────────────
  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'WH-MAIN' },
    update: {},
    create: {
      code: 'WH-MAIN',
      name: '主仓库',
      type: 'PHYSICAL',
      address: '广东省深圳市南山区科技园南路1号',
      status: 'ACTIVE',
    },
  });

  const locationA1 = await prisma.location.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      warehouseId: warehouse.id,
      area: 'A',
      aisle: '01',
      rack: 'A',
      level: '1',
      position: '01',
      barcode: 'WH-MAIN-A-01-A-1-01',
      status: 'ACTIVE',
      maxCapacity: 1000,
    },
  });

  const locationA2 = await prisma.location.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      warehouseId: warehouse.id,
      area: 'A',
      aisle: '01',
      rack: 'A',
      level: '1',
      position: '02',
      barcode: 'WH-MAIN-A-01-A-1-02',
      status: 'ACTIVE',
      maxCapacity: 1000,
    },
  });

  console.log('  ✓ Warehouse & locations created');

  // ── 4. Batches ─────────────────────────────────────────────────
  const batch1 = await prisma.batch.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      batchNo: 'BATCH-2024-001',
      productId: product1.id,
      productionDate: new Date('2024-01-15'),
      expiryDate: new Date('2026-01-15'),
      status: 'ACTIVE',
    },
  });

  const batch2 = await prisma.batch.upsert({
    where: { id: '00000000-0000-0000-0000-000000000004' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000004',
      batchNo: 'BATCH-2024-002',
      productId: product2.id,
      productionDate: new Date('2024-03-01'),
      expiryDate: new Date('2028-03-01'),
      status: 'ACTIVE',
    },
  });

  console.log('  ✓ Batches created');

  // ── 5. Inventory Balances ──────────────────────────────────────
  await prisma.inventoryBalance.upsert({
    where: {
      productId_locationId_batchId: {
        productId: product1.id,
        locationId: locationA1.id,
        batchId: batch1.id,
      },
    },
    update: {},
    create: {
      productId: product1.id,
      locationId: locationA1.id,
      batchId: batch1.id,
      quantity: 500,
    },
  });

  await prisma.inventoryBalance.upsert({
    where: {
      productId_locationId_batchId: {
        productId: product2.id,
        locationId: locationA2.id,
        batchId: batch2.id,
      },
    },
    update: {},
    create: {
      productId: product2.id,
      locationId: locationA2.id,
      batchId: batch2.id,
      quantity: 1000,
    },
  });

  console.log('  ✓ Inventory balances created');

  // ── 6. Price List & Prices ─────────────────────────────────────
  const priceList = await prisma.priceList.upsert({
    where: { code: 'PL-STANDARD' },
    update: {},
    create: {
      code: 'PL-STANDARD',
      name: '标准价目表',
      status: 'ACTIVE',
    },
  });

  await prisma.productPrice.upsert({
    where: { id: '00000000-0000-0000-0000-000000000005' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000005',
      priceListId: priceList.id,
      productId: product1.id,
      unitPrice: 12.5,
      effectiveDate: new Date('2024-01-01'),
      endDate: new Date('2025-12-31'),
    },
  });

  await prisma.productPrice.upsert({
    where: { id: '00000000-0000-0000-0000-000000000006' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000006',
      priceListId: priceList.id,
      productId: product2.id,
      unitPrice: 0.05,
      effectiveDate: new Date('2024-01-01'),
      endDate: null,
    },
  });

  console.log('  ✓ Price list & prices created');

  // ── 7. User / Role / Permission (RBAC) ─────────────────────────
  const adminRole = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: {},
    create: {
      code: 'ADMIN',
      name: '系统管理员',
      description: '拥有所有权限的系统管理员角色',
    },
  });

  const operatorRole = await prisma.role.upsert({
    where: { code: 'OPERATOR' },
    update: {},
    create: {
      code: 'OPERATOR',
      name: '仓库操作员',
      description: '可执行日常仓库操作',
    },
  });

  const permInventoryRead = await prisma.permission.upsert({
    where: { code: 'inventory:read' },
    update: {},
    create: {
      code: 'inventory:read',
      name: '库存查询',
      description: '查看库存余额与流水',
    },
  });

  const permInventoryWrite = await prisma.permission.upsert({
    where: { code: 'inventory:write' },
    update: {},
    create: {
      code: 'inventory:write',
      name: '库存操作',
      description: '入库、出库、移库等操作',
    },
  });

  const permAdmin = await prisma.permission.upsert({
    where: { code: 'admin:all' },
    update: {},
    create: {
      code: 'admin:all',
      name: '系统管理',
      description: '系统级管理权限',
    },
  });

  // Assign all permissions to admin
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: adminRole.id,
        permissionId: permAdmin.id,
      },
    },
    update: {},
    create: {
      roleId: adminRole.id,
      permissionId: permAdmin.id,
    },
  });

  // Assign inventory permissions to operator
  for (const perm of [permInventoryRead, permInventoryWrite]) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: operatorRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: operatorRole.id,
        permissionId: perm.id,
      },
    });
  }

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@wms-lite.local',
      password: '$2b$10$placeholder_hashed_password_please_change_in_production',
      displayName: '系统管理员',
      status: 'ACTIVE',
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });

  console.log('  ✓ Users, roles & permissions created');

  // ── 8. Integration Endpoints ───────────────────────────────────
  await prisma.integrationEndpoint.upsert({
    where: { code: 'ERP-SYNC' },
    update: {},
    create: {
      code: 'ERP-SYNC',
      name: 'ERP 同步接口',
      url: 'https://erp.example.com/api/v1/sync',
      method: 'POST',
      headers: JSON.stringify({
        'Content-Type': 'application/json',
        'X-API-Key': '${ERP_API_KEY}',
      }),
      authType: 'API_KEY',
      authConfig: JSON.stringify({
        headerName: 'X-API-Key',
      }),
      status: 'ACTIVE',
    },
  });

  console.log('  ✓ Integration endpoints created');

  console.log('\n✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
