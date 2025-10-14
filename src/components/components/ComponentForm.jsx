
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/components/LanguageProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Save, Plus, Trash2 } from 'lucide-react';
// REMOVED: Component entity - will use PURCHASE_ORDER_ITEMS instead
// import { Component } from "@/api/entities";
import { useWarehouse } from "@/components/WarehouseProvider";

// TODO: Adaptar para schema REAL - usar PURCHASE_ORDER_ITEMS
// Por ahora, temporalmente disabled hasta actualizar base44Client.js
export default function ComponentForm({ component, onClose, onSave }) {
  const { t } = useLanguage();
  const { activeWarehouse } = useWarehouse();
  const isEditing = !!component;

  const [formData, setFormData] = useState(component || {
    component_sku: '',
    component_description: '',
    quantity_ordered: 0,
    quantity_received: 0,
    lot_number: '',
    unit_price: 0,
    supplier_name: '',
    po_number: '',
    line_number: 1
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    alert('⚠️ COMPONENTES TEMPORALMENTE DISABLED\n\nEsta funcionalidad necesita ser adaptada al schema REAL de traceability.\n\nLos componentes ahora se manejan como PURCHASE_ORDER_ITEMS, no como tabla separada.');

    setIsSaving(true);
    setIsSubmitting(true);

    try {
      // TODO: Implementar lógica para PURCHASE_ORDER_ITEMS
      // const componentData = {
      //   po_number: formData.po_number,
      //   line_number: formData.line_number,
      //   component_sku: formData.component_sku,
      //   component_description: formData.component_description,
      //   quantity_ordered: formData.quantity_ordered,
      //   quantity_received: formData.quantity_received,
      //   lot_number: formData.lot_number,
      //   unit_price: formData.unit_price
      // };

      if (onSave) onSave();
      onClose();
    } catch (error) {
      console.error('Error saving component:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsSaving(false);
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto"
      >
        <Card className="bg-white">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-t-lg">
            <div className="flex justify-between items-center">
              <CardTitle>{component ? t('edit') : t('add_component')}</CardTitle>
              <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20" disabled={isSubmitting}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">{t('component')} *</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={e => handleChange('name', e.target.value)}
                  placeholder="e.g., ESP32 Chip"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier">{t('supplier')}</Label>
                <Input
                  id="supplier"
                  value={formData.supplier || ''}
                  onChange={e => handleChange('supplier', e.target.value)}
                  placeholder="e.g., Supplier Inc."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('description')}</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={e => handleChange('description', e.target.value)}
                placeholder={t('description')}
                className="h-20"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="category">{t('category')}</Label>
                <Select value={formData.category || 'otros'} onValueChange={value => handleChange('category', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chips">{t('chips')}</SelectItem>
                    <SelectItem value="baterias">{t('batteries')}</SelectItem>
                    <SelectItem value="sensores">{t('sensors')}</SelectItem>
                    <SelectItem value="motores">{t('motors')}</SelectItem>
                    <SelectItem value="estructuras">{t('structures')}</SelectItem>
                    <SelectItem value="otros">{t('others')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tracking_type">{t('tracking')} *</Label>
                <Select value={formData.tracking_type || 'lote'} onValueChange={value => handleChange('tracking_type', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lote">{t('by_batch')}</SelectItem>
                    <SelectItem value="unidad">{t('by_unit')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Batch tracking */}
            {formData.tracking_type === 'lote' && (
              <div className="space-y-4">
                <Label className="text-lg font-semibold">{t('batch')} {t('tracking')}</Label>
                <div className="bg-slate-50 p-4 rounded-lg border space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Input
                      placeholder={t('batch') + " #"}
                      value={newBatchNumber}
                      onChange={e => setNewBatchNumber(e.target.value)}
                    />
                    <Input
                      placeholder={t('description')}
                      value={newBatchDescription}
                      onChange={e => setNewBatchDescription(e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Quantity"
                      value={newBatchQuantity}
                      onChange={e => setNewBatchQuantity(e.target.value)}
                    />
                    <Button onClick={handleAddBatch} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="w-4 h-4 mr-2" />
                      {t('add')}
                    </Button>
                  </div>

                  {formData.batches && formData.batches.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {formData.batches.map((batch, index) => (
                        <div key={index} className="flex items-center justify-between bg-white p-3 rounded border">
                          <div>
                            <div className="font-semibold">{batch.batch_number}</div>
                            <div className="text-sm text-slate-600">{batch.description}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{batch.quantity} units</Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveBatch(index)}
                              className="h-8 w-8 text-red-500 hover:bg-red-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Serial number tracking */}
            {formData.tracking_type === 'unidad' && (
              <div className="space-y-4">
                <Label className="text-lg font-semibold">{t('by_unit')} {t('tracking')}</Label>
                <div className="bg-slate-50 p-4 rounded-lg border space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Input
                      placeholder="Serial Number"
                      value={newSerialNumber}
                      onChange={e => setNewSerialNumber(e.target.value)}
                      className="font-mono"
                    />
                    <Input
                      placeholder={t('notes')}
                      value={newSerialNotes}
                      onChange={e => setNewSerialNotes(e.target.value)}
                    />
                    <Button onClick={handleAddSerial} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="w-4 h-4 mr-2" />
                      {t('add')}
                    </Button>
                  </div>

                  {formData.serial_numbers && formData.serial_numbers.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {formData.serial_numbers.map((serial, index) => (
                        <div key={index} className="flex items-center justify-between bg-white p-3 rounded border">
                          <div>
                            <div className="font-mono font-semibold">{serial.serial_number}</div>
                            {serial.notes && <div className="text-sm text-slate-600 italic">{serial.notes}</div>}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveSerial(index)}
                            className="h-8 w-8 text-red-500 hover:bg-red-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <div className="text-lg font-semibold text-slate-700">
                Total Quantity: <span className="text-blue-600">{formData.quantity || 0}</span> units
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-3 bg-slate-50">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>{t('cancel')}</Button>
            <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('saving')}...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {t('save_changes')}
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </motion.div>
  );
}
