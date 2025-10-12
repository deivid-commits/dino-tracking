import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Fingerprint, Cpu, Palette, Package } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

export default function DinosaurForm({ dinosaur, versions, onSave, onCancel }) {
  const { t } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    version_id: '',
    device_id: '',
    rfid_code: '',
    color: '',
    color_code: '',
    sku_final: '',
    status: 'available',
    notes: '',
    assembled_by_operator: '',
  });

  useEffect(() => {
    if (dinosaur) {
      setFormData({
        version_id: dinosaur.version_id || '',
        device_id: dinosaur.device_id || '',
        rfid_code: dinosaur.rfid_code || '',
        color: dinosaur.color || '',
        color_code: dinosaur.color_code || '',
        sku_final: dinosaur.sku_final || '',
        status: dinosaur.status || 'available',
        notes: dinosaur.notes || '',
        assembled_by_operator: dinosaur.assembled_by_operator || '',
      });
    }
  }, [dinosaur]);

  const selectedVersion = versions.find(v => v.id === formData.version_id);
  const availableColors = selectedVersion?.available_colors || [];

  const handleColorChange = (colorName) => {
    const colorInfo = availableColors.find(c => c.name === colorName);
    if (colorInfo) {
      const newSKU = selectedVersion?.sku_base && colorInfo.code 
        ? `${selectedVersion.sku_base}-${colorInfo.code}-${selectedVersion.version_number || '01'}`
        : '';
      
      setFormData({
        ...formData,
        color: colorName,
        color_code: colorInfo.code || '',
        sku_final: newSKU
      });
    }
  };

  const handleVersionChange = (versionId) => {
    const version = versions.find(v => v.id === versionId);
    setFormData({
      ...formData,
      version_id: versionId,
      color: '',
      color_code: '',
      sku_final: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await onSave({ ...dinosaur, ...formData });
    } catch (error) {
      console.error('Error saving dinosaur:', error);
      alert('Error guardando dinosaurio: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-emerald-600 flex items-center gap-2">
            🦖 {t('edit_dinosaur')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Version Selection */}
          <div>
            <Label className="text-base mb-2 flex items-center gap-2">
              <Package className="w-4 h-4" />
              {t('version')} *
            </Label>
            <Select
              value={formData.version_id}
              onValueChange={handleVersionChange}
            >
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder={t('select_version')} />
              </SelectTrigger>
              <SelectContent>
                {versions.map(v => (
                  <SelectItem key={v.id} value={v.id} className="text-base">
                    {v.model_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Color Selection */}
          {selectedVersion && availableColors.length > 0 && (
            <div>
              <Label className="text-base mb-2 flex items-center gap-2">
                <Palette className="w-4 h-4" />
                {t('color')} *
              </Label>
              <Select
                value={formData.color}
                onValueChange={handleColorChange}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder={t('select_color')} />
                </SelectTrigger>
                <SelectContent>
                  {availableColors.map(c => (
                    <SelectItem key={c.name} value={c.name} className="text-base capitalize">
                      {c.name} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* RFID Code - EDITABLE */}
          <div>
            <Label className="text-base mb-2 flex items-center gap-2">
              <Fingerprint className="w-4 h-4" />
              RFID Code *
            </Label>
            <Input
              value={formData.rfid_code}
              onChange={(e) => setFormData({ ...formData, rfid_code: e.target.value })}
              placeholder="RFID Code..."
              className="font-mono h-12 text-base"
              required
              maxLength={24}
            />
            <p className="text-xs text-slate-500 mt-1">
              ⚠️ Editar el RFID con cuidado. Este código debe ser único.
            </p>
          </div>

          {/* Device ID */}
          <div>
            <Label className="text-base mb-2 flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              Device ID *
            </Label>
            <Input
              value={formData.device_id}
              onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
              placeholder="Device ID..."
              className="font-mono h-12 text-base"
              required
            />
          </div>

          {/* SKU Preview */}
          {formData.sku_final && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <Label className="text-sm text-indigo-700 mb-2 block">SKU Final:</Label>
              <p className="font-mono text-lg font-bold text-indigo-900">
                {formData.sku_final}
              </p>
            </div>
          )}

          {/* Status */}
          <div>
            <Label className="text-base mb-2 block">{t('status')} *</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder={t('status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available" className="text-base">
                  {t('available')} - Disponible
                </SelectItem>
                <SelectItem value="sold" className="text-base">
                  {t('sold')} - Vendido
                </SelectItem>
                <SelectItem value="maintenance" className="text-base">
                  {t('maintenance')} - En mantenimiento
                </SelectItem>
                <SelectItem value="damaged" className="text-base">
                  {t('damaged')} - Dañado
                </SelectItem>
                <SelectItem value="unverified" className="text-base">
                  {t('unverified')} - Sin verificar
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Assembled By */}
          <div>
            <Label className="text-base mb-2 block">{t('assembled_by')}</Label>
            <Input
              value={formData.assembled_by_operator}
              onChange={(e) => setFormData({ ...formData, assembled_by_operator: e.target.value })}
              placeholder="Nombre del operador..."
              className="h-12 text-base"
            />
          </div>

          {/* Notes */}
          <div>
            <Label className="text-base mb-2 block">{t('notes')}</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notas adicionales..."
              rows={4}
              className="text-base"
            />
          </div>

          {/* Warning Message */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>⚠️ Advertencia:</strong> Cambiar el RFID puede causar problemas de trazabilidad. 
              Asegúrate de que el nuevo RFID sea único y correcto.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1 h-12 text-base"
              disabled={isSaving}
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              className="flex-1 h-12 text-base bg-emerald-600 hover:bg-emerald-700"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  {t('save_changes')}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}