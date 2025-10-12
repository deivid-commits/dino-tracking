import React, { useState, useEffect } from 'react';
import { PurchaseOrder, Component } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, CheckCircle, TruckIcon, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/components/LanguageProvider';
import { useWarehouse } from '@/components/WarehouseProvider';

export default function Receiving() {
  const { t } = useLanguage();
  const { activeWarehouse, filterByWarehouse } = useWarehouse();
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [components, setComponents] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [receivingData, setReceivingData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isReceiving, setIsReceiving] = useState(false);

  useEffect(() => {
    if (activeWarehouse) {
      loadData();
    }
  }, [activeWarehouse]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [pos, comps] = await Promise.all([
        PurchaseOrder.list('-order_date'),
        Component.list('name')
      ]);
      
      const filteredPOs = filterByWarehouse(pos);
      const filteredComps = filterByWarehouse(comps);
      
      // Solo mostrar POs que tienen items pendientes de recibir
      const openPOs = filteredPOs.filter(po => {
        return po.items?.some(item => 
          (item.quantity_received || 0) < item.quantity_ordered
        );
      });
      
      setPurchaseOrders(openPOs);
      setComponents(filteredComps);
    } catch (error) {
      console.error("Error loading receiving data:", error);
    }
    setIsLoading(false);
  };

  const handleSelectPO = (po) => {
    setSelectedPO(po);
    // Inicializar receivingData con cantidades pendientes por defecto
    const initialData = {};
    po.items?.forEach(item => {
      const pending = item.quantity_ordered - (item.quantity_received || 0);
      initialData[item.component_id] = pending;
    });
    setReceivingData(initialData);
  };

  const handleReceivingChange = (componentId, value) => {
    setReceivingData(prev => ({
      ...prev,
      [componentId]: parseInt(value) || 0
    }));
  };

  const handleReceiveItems = async () => {
    if (!selectedPO) return;

    setIsReceiving(true);
    try {
      const operator = JSON.parse(localStorage.getItem('dinotrack-operator') || '{}');
      
      console.log('📦 Iniciando proceso de receiving para PO:', selectedPO.po_number);
      console.log('📦 Cantidades a recibir:', receivingData);

      // Actualizar cada componente
      for (const item of selectedPO.items) {
        const quantityToReceive = receivingData[item.component_id] || 0;
        
        if (quantityToReceive > 0) {
          const component = components.find(c => c.id === item.component_id);
          
          if (!component) {
            console.error(`❌ Componente no encontrado: ${item.component_id}`);
            continue;
          }

          console.log(`📦 Recibiendo ${quantityToReceive} unidades de ${component.name}`);
          console.log(`📦 Stock actual: ${component.quantity || 0}`);

          // Calcular nuevo stock
          const newQuantity = (component.quantity || 0) + quantityToReceive;
          
          console.log(`📦 Nuevo stock: ${newQuantity}`);

          // Actualizar componente
          await Component.update(component.id, {
            quantity: newQuantity
          });

          console.log(`✅ Componente ${component.name} actualizado exitosamente`);
        }
      }

      // Actualizar PO con cantidades recibidas
      const updatedItems = selectedPO.items.map(item => {
        const quantityToReceive = receivingData[item.component_id] || 0;
        return {
          ...item,
          quantity_received: (item.quantity_received || 0) + quantityToReceive
        };
      });

      await PurchaseOrder.update(selectedPO.id, {
        items: updatedItems
      });

      console.log('✅ Purchase Order actualizada exitosamente');

      alert(`✅ Recibidos exitosamente!\n\nSe han agregado los componentes al inventario.`);
      
      // Recargar datos
      await loadData();
      setSelectedPO(null);
      setReceivingData({});
      
    } catch (error) {
      console.error('❌ Error receiving items:', error);
      alert('Error recibiendo items: ' + error.message);
    }
    setIsReceiving(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-10">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!activeWarehouse) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">
            {t('select_warehouse')}
          </h3>
          <p className="text-sm text-slate-600">
            Por favor selecciona un warehouse para ver las órdenes de compra
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Instrucciones */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <h3 className="font-semibold text-blue-900 mb-2">📦 Proceso de Receiving</h3>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Selecciona una Purchase Order pendiente</li>
            <li>Ingresa las cantidades recibidas (por defecto se muestra lo pendiente)</li>
            <li>Confirma el receiving</li>
            <li>El stock se agregará automáticamente al inventario de cada componente</li>
          </ol>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Lista de POs */}
        <div>
          <h2 className="text-xl font-bold mb-4">{t('select_po_to_receive')}</h2>
          
          {purchaseOrders.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center">
                <Package className="mx-auto h-12 w-12 text-slate-400 mb-3" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  {t('no_open_pos')}
                </h3>
                <p className="text-sm text-slate-600">
                  {t('create_po_to_receive')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {purchaseOrders.map(po => {
                const totalItems = po.items?.length || 0;
                const itemsPending = po.items?.filter(item => 
                  (item.quantity_received || 0) < item.quantity_ordered
                ).length || 0;
                const progressPercent = totalItems > 0 
                  ? ((totalItems - itemsPending) / totalItems) * 100 
                  : 0;

                return (
                  <Card 
                    key={po.id}
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                      selectedPO?.id === po.id ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''
                    }`}
                    onClick={() => handleSelectPO(po)}
                  >
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{po.po_number}</CardTitle>
                          <p className="text-sm text-slate-600">{po.supplier_name}</p>
                        </div>
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                          {itemsPending} {t('pending')}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">{t('progress')}</span>
                          <span className="font-medium">{Math.round(progressPercent)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div 
                            className="bg-indigo-600 h-2 rounded-full transition-all"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500">
                          {totalItems - itemsPending} / {totalItems} {t('items')}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel de Receiving */}
        <div>
          <h2 className="text-xl font-bold mb-4">{t('receiving_items_for')}</h2>
          
          {!selectedPO ? (
            <Card>
              <CardContent className="p-10 text-center">
                <TruckIcon className="mx-auto h-12 w-12 text-slate-400 mb-3" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  {t('select_po_to_start_receiving')}
                </h3>
                <p className="text-sm text-slate-600">
                  {t('click_on_po_card_above')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-xl">
              <CardHeader className="bg-indigo-50">
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  {selectedPO.po_number}
                </CardTitle>
                <p className="text-sm text-slate-600">{selectedPO.supplier_name}</p>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4 mb-6">
                  {selectedPO.items?.map(item => {
                    const pending = item.quantity_ordered - (item.quantity_received || 0);
                    const component = components.find(c => c.id === item.component_id);
                    
                    if (pending <= 0) return null;

                    return (
                      <div key={item.component_id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-800">{item.component_name}</h4>
                            <p className="text-xs text-slate-500 font-mono mt-1">
                              Stock actual: {component?.quantity || 0} unidades
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                          <div>
                            <span className="text-slate-600">Ordenado:</span>
                            <p className="font-semibold">{item.quantity_ordered}</p>
                          </div>
                          <div>
                            <span className="text-slate-600">Recibido:</span>
                            <p className="font-semibold text-green-600">{item.quantity_received || 0}</p>
                          </div>
                          <div>
                            <span className="text-slate-600">Pendiente:</span>
                            <p className="font-semibold text-amber-600">{pending}</p>
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-medium text-slate-700 block mb-2">
                            Cantidad a recibir ahora:
                          </label>
                          <Input
                            type="number"
                            min="0"
                            max={pending}
                            value={receivingData[item.component_id] || 0}
                            onChange={(e) => handleReceivingChange(item.component_id, e.target.value)}
                            className="font-mono"
                          />
                          {receivingData[item.component_id] > pending && (
                            <p className="text-xs text-red-600 mt-1">
                              ⚠️ No puedes recibir más de lo pendiente
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t pt-4">
                  <Button
                    onClick={handleReceiveItems}
                    disabled={isReceiving || Object.values(receivingData).every(v => v === 0)}
                    className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  >
                    {isReceiving ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Recibiendo...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Confirmar Receiving
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}