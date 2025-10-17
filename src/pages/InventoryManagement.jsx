import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, Package, TruckIcon, BarChart3, Calendar } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/components/LanguageProvider';

import PurchaseOrders from '@/components/inventory/PurchaseOrders';
import Receiving from '@/components/inventory/Receiving';
import StockControl from '@/components/inventory/StockControl';
import ProductionPlan from '@/components/inventory/ProductionPlan';

export default function InventoryManagement() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('purchase-orders');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                {t('inventory_management_hub')}
              </h1>
              <p className="text-slate-600">{t('central_hub_for_inventory')}</p>
            </div>
          </div>
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="purchase-orders" className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">{t('purchase_orders')}</span>
              <span className="sm:hidden">POs</span>
            </TabsTrigger>
            <TabsTrigger value="receiving" className="flex items-center gap-2">
              <TruckIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{t('receiving')}</span>
              <span className="sm:hidden">Receiving</span>
            </TabsTrigger>
            <TabsTrigger value="stock-control" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">{t('stock_control')}</span>
              <span className="sm:hidden">Stock</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="purchase-orders" className="mt-6">
            <PurchaseOrders />
          </TabsContent>

          <TabsContent value="receiving" className="mt-6">
            <Receiving />
          </TabsContent>

          <TabsContent value="stock-control" className="mt-6">
            <StockControl />
          </TabsContent>

          <TabsContent value="production-plan" className="mt-6">
            <ProductionPlan />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
