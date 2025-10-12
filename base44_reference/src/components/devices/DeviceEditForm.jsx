import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save } from 'lucide-react';
import { Device } from '@/api/entities';
import { useLanguage } from '@/components/LanguageProvider';

export default function DeviceEditForm({ device, versions, onClose, onSaved }) {
  const { t } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    device_id: '',
    mac_address: '',
    version_id: '',
    status: 'ready',
    notes: '',
    assembled_by_operator: '',
  });

  useEffect(() => {
    if (device) {
      setFormData({
        device_id: device.device_id || '',
        mac_address: device.mac_address || '',
        version_id: device.version_id || '',
        status: device.status || 'ready',
        notes: device.notes || '',
        assembled_by_operator: device.assembled_by_operator || '',
      });
    }
  }, [device]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await Device.update(device.id, formData);
      onSaved();
      onClose();
    } catch (error) {
      console.error('Error updating device:', error);
      alert('Error actualizando dispositivo: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-indigo-600">
            Editar Dispositivo
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-base mb-2 block">Device ID *</Label>
              <Input
                value={formData.device_id}
                onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                placeholder="Device ID..."
                className="font-mono h-12 text-base"
                required
              />
            </div>

            <div>
              <Label className="text-base mb-2 block">MAC Address *</Label>
              <Input
                value={formData.mac_address}
                onChange={(e) => setFormData({ ...formData, mac_address: e.target.value })}
                placeholder="MAC Address..."
                className="font-mono h-12 text-base"
                required
              />
            </div>
          </div>

          <div>
            <Label className="text-base mb-2 block">{t('version')} *</Label>
            <Select
              value={formData.version_id}
              onValueChange={(value) => setFormData({ ...formData, version_id: value })}
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
                <SelectItem value="ready" className="text-base">
                  {t('ready')} - Listo para usar
                </SelectItem>
                <SelectItem value="used" className="text-base">
                  {t('used')} - Ya usado/ensamblado
                </SelectItem>
                <SelectItem value="defective" className="text-base">
                  {t('defective')} - Defectuoso
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-base mb-2 block">Operador que ensambló</Label>
            <Input
              value={formData.assembled_by_operator}
              onChange={(e) => setFormData({ ...formData, assembled_by_operator: e.target.value })}
              placeholder="Nombre del operador..."
              className="h-12 text-base"
            />
          </div>

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

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>ℹ️ Nota:</strong> Los componentes usados no se pueden modificar aquí. Esta información se establece durante el registro inicial.
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-12 text-base"
              disabled={isSaving}
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              className="flex-1 h-12 text-base bg-indigo-600 hover:bg-indigo-700"
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