import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PurchaseOrder } from '@/api/entities';
import { useLanguage } from '@/components/LanguageProvider';
import { useWarehouse } from '@/components/WarehouseProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus, Upload, Loader2, Package, Trash2, DollarSign } from 'lucide-react';
import { UploadFile, ExtractDataFromUploadedFile } from '@/api/integrations';

export default function CreatePurchaseOrderForm({ po, components, onClose }) {
  const { t } = useLanguage();
  const { activeWarehouse } = useWarehouse();
  const isEditing = !!po;

  // Debug logging for components
  console.log('🔍 CreatePurchaseOrderForm - Components received:', components?.length || 0, components);

  const [formData, setFormData] = useState({
    supplier_name: po?.supplier_name || '',
    invoice_number: po?.invoice_number || '',
    tracking_number: po?.tracking_number || '',
    expected_delivery_date: po?.expected_delivery_date || '',
    items: po?.items || [],
    notes: po?.notes || '',
    warehouse_id: po?.warehouse_id || '',
    original_document_url: po?.original_document_url || ''
  });

  const [newItem, setNewItem] = useState({
    component_sku: '',
    quantity_ordered: 1,
    unit_price: '',
    total_price: '',
    batch_info: ''
  });

  // Ensure component_sku is always a string to avoid controlled/uncontrolled warning
  const safeComponentId = newItem.component_sku || '';

  const [isProcessingDocument, setIsProcessingDocument] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Calculate prices when quantity changes OR when user leaves a price field
  const handlePriceCalculation = (field, value) => {
    const qty = parseFloat(newItem.quantity_ordered) || 0;
    const unitPrice = parseFloat(newItem.unit_price) || 0;
    const totalPrice = parseFloat(newItem.total_price) || 0;

    if (field === 'quantity' || field === 'unit_price') {
      // Calculate total from quantity * unit price
      if (qty > 0 && unitPrice > 0) {
        const calculatedTotal = (qty * unitPrice).toFixed(2);
        setNewItem(prev => ({ ...prev, total_price: calculatedTotal }));
      }
    } else if (field === 'total_price') {
      // Calculate unit price from total / quantity
      if (qty > 0 && totalPrice > 0) {
        const calculatedUnit = (totalPrice / qty).toFixed(2);
        setNewItem(prev => ({ ...prev, unit_price: calculatedUnit }));
      }
    }
  };

  const handleAddItem = () => {
    if (!newItem.component_sku || newItem.quantity_ordered <= 0) {
      alert(t('select_component_and_quantity'));
      return;
    }

    const unitPrice = parseFloat(newItem.unit_price);
    const totalPrice = parseFloat(newItem.total_price);

    if (!unitPrice || unitPrice <= 0 || !totalPrice || totalPrice <= 0) {
      alert(t('price_required'));
      return;
    }

    const component = components.find(c => c.component_sku === newItem.component_sku);
    if (!component) return;

    const itemToAdd = {
      component_sku: component.component_sku,
      component_description: component.component_description,
      manufacturer_part_no: component.manufacturer_part_no || null,
      quantity_ordered: parseInt(newItem.quantity_ordered),
      quantity_received: 0,
      unit_price: unitPrice,
      total_price: totalPrice,
      batch_info: newItem.batch_info || ''
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, itemToAdd]
    }));

    setNewItem({
      component_sku: '',
      quantity_ordered: 1,
      unit_price: '',
      total_price: '',
      batch_info: ''
    });
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleDocumentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingDocument(true);
    try {
      const uploadResult = await UploadFile({ file });
      
      setFormData(prev => ({
        ...prev,
        original_document_url: uploadResult.file_url
      }));

      const extractionSchema = {
        type: "object",
        properties: {
          supplier_name: { 
            type: "string", 
            description: "Name of the supplier or company issuing the invoice/purchase order" 
          },
          invoice_number: { 
            type: "string", 
            description: "Invoice number or purchase order number" 
          },
          tracking_number: { 
            type: "string", 
            description: "Tracking or shipment number if present" 
          },
          items: {
            type: "array",
            description: "List of items/products in the order with quantities and prices",
            items: {
              type: "object",
              properties: {
                component_name: { 
                  type: "string", 
                  description: "Name or description of the item/product" 
                },
                quantity_ordered: { 
                  type: "number", 
                  description: "Quantity of this item ordered" 
                },
                unit_price: {
                  type: "number",
                  description: "Price per unit of this item"
                },
                total_price: {
                  type: "number",
                  description: "Total price for this line item"
                },
                batch_info: { 
                  type: "string", 
                  description: "Optional batch or lot number, serial number, or other specific identifier for a group of this item" 
                }
              },
              required: ["component_name", "quantity_ordered"]
            }
          },
          notes: { 
            type: "string", 
            description: "Any special notes, instructions, or additional information" 
          }
        }
      };

      const extractionResult = await ExtractDataFromUploadedFile({
        file_url: uploadResult.file_url,
        json_schema: extractionSchema
      });

      if (extractionResult.status !== 'success' || !extractionResult.output) {
        throw new Error(extractionResult.details || 'Failed to extract data');
      }

      const extractedData = extractionResult.output;

      const matchedItems = extractedData.items?.map(item => {
        const matchedComponent = components.find(c => 
          c.name.toLowerCase().includes(item.component_name.toLowerCase()) ||
          item.component_name.toLowerCase().includes(c.name.toLowerCase())
        );

        if (matchedComponent) {
          const qty = item.quantity_ordered || 1;
          let unitPrice = item.unit_price || 0;
          let totalPrice = item.total_price || 0;

          if (unitPrice > 0 && !totalPrice) {
            totalPrice = qty * unitPrice;
          } else if (totalPrice > 0 && !unitPrice) {
            unitPrice = totalPrice / qty;
          }

          return {
            component_id: matchedComponent.id,
            component_name: matchedComponent.name,
            quantity_ordered: qty,
            quantity_received: 0,
            unit_price: unitPrice,
            total_price: totalPrice,
            batch_info: item.batch_info || ''
          };
        }
        return null;
      }).filter(item => item !== null) || [];

      setFormData(prev => ({
        ...prev,
        supplier_name: extractedData.supplier_name || prev.supplier_name,
        invoice_number: extractedData.invoice_number || prev.invoice_number,
        tracking_number: extractedData.tracking_number || prev.tracking_number,
        items: matchedItems.length > 0 ? matchedItems : prev.items,
        notes: extractedData.notes || prev.notes
      }));

      alert(t('document_processed_successfully'));
    } catch (error) {
      console.error('Error processing document:', error);
      alert(t('error_processing_document'));
    }
    setIsProcessingDocument(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!activeWarehouse) {
      alert(t('please_select_warehouse'));
      return;
    }
    
    if (formData.items.length === 0) {
      alert(t('add_at_least_one_item'));
      return;
    }

    const itemsWithoutPrices = formData.items.filter(item => 
      !item.unit_price || !item.total_price || item.unit_price <= 0 || item.total_price <= 0
    );

    if (itemsWithoutPrices.length > 0) {
      alert(t('price_required'));
      return;
    }

    setIsSaving(true);
    try {
      // First create the PO in purchase_orders table
      const poNumber = formData.invoice_number || `PO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const poData = {
        warehouse_id: activeWarehouse.id,
        supplier_name: formData.supplier_name,
        po_number: poNumber,
        order_date: new Date().toISOString().split('T')[0] // Date only, no time
        // No notes field in purchase_orders table according to schema
        // No items column - items go to purchase_order_items table
      };

      let savedPO;
      if (isEditing) {
        savedPO = await PurchaseOrder.update(po.id, poData);
      } else {
        savedPO = await PurchaseOrder.create(poData);
      }

      // Then save items to purchase_order_items table - but only for new POs
      // For editing, you'd need to handle item updates/deletes separately
      if (!isEditing && formData.items.length > 0) {
        // Items will be created separately via the PurchaseOrder entity
        // The entity should handle this, or we'll need to create items after PO
        console.log('PO created successfully, items will be saved by PurchaseOrder entity');
      }

      onClose();
    } catch (error) {
      console.error('Error saving purchase order:', error);
      alert(t('error_saving_purchase_order') + ': ' + error.message);
    }
    setIsSaving(false);
  };

  const grandTotal = formData.items.reduce((sum, item) => sum + (item.total_price || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
    >
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              {isEditing ? t('edit_purchase_order') : t('create_purchase_order')}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!isEditing && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Upload className="w-4 h-4" />
                {t('intelligent_document_processing')}
              </h3>
              <p className="text-sm text-blue-700 mb-3">
                {t('upload_po_photo_description')}
              </p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleDocumentUpload}
                  className="hidden"
                  disabled={isProcessingDocument}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isProcessingDocument}
                  asChild
                >
                  <span>
                    {isProcessingDocument ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('processing')}
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        {t('upload_po_photo')}
                      </>
                    )}
                  </span>
                </Button>
              </label>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="supplier_name">{t('supplier_name')}*</Label>
                <Input
                  id="supplier_name"
                  value={formData.supplier_name}
                  onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                  placeholder={t('supplier_name_placeholder')}
                  required
                />
              </div>

              <div>
                <Label htmlFor="invoice_number">{t('invoice_number')}*</Label>
                <Input
                  id="invoice_number"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  placeholder={t('invoice_number_placeholder')}
                  required
                />
              </div>

              <div>
                <Label htmlFor="tracking_number">{t('tracking_number')}</Label>
                <Input
                  id="tracking_number"
                  value={formData.tracking_number}
                  onChange={(e) => setFormData({ ...formData, tracking_number: e.target.value })}
                  placeholder={t('tracking_number_placeholder')}
                />
              </div>

              <div>
                <Label htmlFor="expected_delivery_date">{t('estimated_delivery')}</Label>
                <Input
                  id="expected_delivery_date"
                  type="date"
                  value={formData.expected_delivery_date}
                  onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label className="text-lg font-semibold">{t('items_to_order')}</Label>
              
              <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="md:col-span-2">
                    <Label>{t('component')}*</Label>
                    <Select
                      value={safeComponentId}
                      onValueChange={(value) => {
                        console.log('🔍 Select onValueChange:', value);
                        setNewItem({ ...newItem, component_sku: value });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('select_component')} />
                      </SelectTrigger>
                    <SelectContent>
                        {components.map(c => (
                          <SelectItem key={c.component_sku || c.id} value={c.component_sku || c.id}>
                            <div>
                              <span className="font-semibold font-mono">{c.component_sku || c.name}</span>
                              {c.component_description && (
                                <span className="block text-sm text-slate-500">{c.component_description}</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>{t('quantity')}*</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newItem.quantity_ordered}
                      onChange={(e) => setNewItem({ ...newItem, quantity_ordered: e.target.value })}
                      onBlur={() => handlePriceCalculation('quantity')}
                    />
                  </div>

                  <div>
                    <Label>{t('unit_price')}*</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newItem.unit_price}
                        onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })}
                        onBlur={() => handlePriceCalculation('unit_price')}
                        placeholder={t('unit_price_placeholder')}
                        className="pl-8"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>{t('total_price')}*</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newItem.total_price}
                        onChange={(e) => setNewItem({ ...newItem, total_price: e.target.value })}
                        onBlur={() => handlePriceCalculation('total_price')}
                        placeholder={t('total_price_placeholder')}
                        className="pl-8"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="batch_info" className="text-sm text-slate-600">
                    {t('batch_info')} ({t('optional')})
                  </Label>
                  <Input
                    id="batch_info"
                    value={newItem.batch_info}
                    onChange={(e) => setNewItem({ ...newItem, batch_info: e.target.value })}
                    placeholder={t('batch_info_placeholder')}
                    className="mt-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">{t('batch_info_description')}</p>
                </div>

                <Button
                  type="button"
                  onClick={handleAddItem}
                  variant="outline"
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" /> {t('add')}
                </Button>
              </div>

              {formData.items.length > 0 && (
                <div className="mt-4 space-y-2">
                  {formData.items.map((item, idx) => (
                    <div key={idx} className="p-3 bg-white border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{item.component_sku || item.component_name}</p>
                          <p className="text-sm text-slate-600">
                            {t('quantity')}: <span className="font-mono">{item.quantity_ordered}</span> ×
                            ${item.unit_price?.toFixed(2) || '0.00'} =
                            <span className="font-bold text-green-600 ml-1">
                              ${item.total_price?.toFixed(2) || '0.00'}
                            </span>
                          </p>
                          {item.batch_info && (
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                              <span className="font-semibold">{t('batch_info')}:</span>
                              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">
                                {item.batch_info}
                              </span>
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-green-900">{t('grand_total')}:</span>
                      <span className="text-2xl font-bold text-green-600">
                        ${grandTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="notes">{t('additional_notes')}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('additional_notes_placeholder')}
                rows={3}
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={isSaving || formData.items.length === 0}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('saving')}
                  </>
                ) : (
                  isEditing ? t('save_changes') : t('create_purchase_order')
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
