import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/components/LanguageProvider';
import { useWarehouse } from '@/components/WarehouseProvider';
import { Device, DinosaurVersion, WIPLoading } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ArrowRight, CheckCircle, Cpu, Hash, StickyNote, Wifi } from 'lucide-react';

const STEPS = {
  VERSION: 1,
  DEVICE_ID_MAC: 2,
  NOTES: 3,
  CONFIRM: 4
};

export default function GuidedDeviceRegistration({ versions, onSuccess, onCancel }) {
  const { t } = useLanguage();
  const { activeWarehouse, filterByWarehouse } = useWarehouse();
  const [currentStep, setCurrentStep] = useState(STEPS.VERSION);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeWIP, setActiveWIP] = useState(null);
  const [deviceData, setDeviceData] = useState({
    version_id: '',
    device_id: '',
    mac_address: '',
    notes: '',
    components_used: []
  });

  useEffect(() => {
    if (activeWarehouse) {
      loadActiveWIP();
    }
  }, [activeWarehouse]);

  const loadActiveWIP = async () => {
    try {
      const wips = await WIPLoading.list('-created_at');
      const filteredWIPs = filterByWarehouse(wips);
      
      const today = new Date().toISOString().split('T')[0];
      const todayWIP = filteredWIPs.find(w => {
        const wipDate = new Date(w.created_at).toISOString().split('T')[0];
        return wipDate === today && w.status === 'active';
      });

      setActiveWIP(todayWIP || null);
    } catch (error) {
      console.error("Error loading WIP:", error);
    }
  };

  const selectedVersion = versions.find(v => v.id === deviceData.version_id);

  const handleNext = () => {
    if (currentStep === STEPS.VERSION && !deviceData.version_id) {
      alert(t('select_dinosaur_version'));
      return;
    }
    
    if (currentStep === STEPS.DEVICE_ID_MAC) {
      if (!deviceData.device_id.trim()) {
        alert('Por favor ingresa el Device ID');
        return;
      }
      if (!deviceData.mac_address.trim()) {
        alert('Por favor escanea el MAC Address');
        return;
      }
    }

    if (currentStep < STEPS.CONFIRM) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > STEPS.VERSION) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleRegister = async () => {
    if (!activeWIP) {
      alert('⚠️ No hay WIP Loading activo. Por favor crea uno primero en la sección de WIP Loading.');
      return;
    }

    if (activeWIP.version_id !== deviceData.version_id) {
      alert(`⚠️ El WIP Loading activo es para la versión "${versions.find(v => v.id === activeWIP.version_id)?.model_name}", pero estás intentando registrar un dispositivo de la versión "${selectedVersion?.model_name}".`);
      return;
    }

    setIsSubmitting(true);
    try {
      const operator = JSON.parse(localStorage.getItem('dinotrack-operator') || '{}');
      
      // Use bins from active WIP
      const componentsUsed = (activeWIP.bins_loaded || []).map(bin => ({
        component_id: bin.component_id,
        component_name: bin.component_name,
        tracking_type: 'lote',
        batch_number: bin.bin_number
      }));

      const newDevice = await Device.create({
        warehouse_id: activeWarehouse.id,
        device_id: deviceData.device_id,
        mac_address: deviceData.mac_address,
        version_id: deviceData.version_id,
        components_used: componentsUsed,
        status: 'ready',
        assembly_date: new Date().toISOString(),
        assembled_by_operator: operator.name || 'Unknown',
        notes: deviceData.notes
      });

      // Update WIP consumption
      const updatedBins = activeWIP.bins_loaded.map(bin => ({
        ...bin,
        quantity_consumed: (bin.quantity_consumed || 0) + 1
      }));

      await WIPLoading.update(activeWIP.id, {
        bins_loaded: updatedBins
      });

      alert(`✅ ${t('device_registered_successfully')} ${newDevice.device_id}`);
      
      setDeviceData({
        version_id: deviceData.version_id,
        device_id: '',
        mac_address: '',
        notes: '',
        components_used: []
      });
      setCurrentStep(STEPS.VERSION);
      
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error registering device:', error);
      alert(`❌ Error: ${error.message}`);
    }
    setIsSubmitting(false);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
        <CardTitle className="flex items-center gap-2">
          <Cpu className="w-6 h-6" />
          {t('device_registration_assistant')}
        </CardTitle>
        <p className="text-sm text-purple-100">
          {t('step_x_of_y', { current: currentStep, total: 4 })}
        </p>
      </CardHeader>

      <CardContent className="p-6">
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            {[1, 2, 3, 4].map(step => (
              <div
                key={step}
                className={`h-2 flex-1 mx-1 rounded-full transition-all ${
                  step <= currentStep ? 'bg-purple-600' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {currentStep === STEPS.VERSION && (
            <motion.div
              key="version"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-semibold">{t('select_dinosaur_version')}</h3>
              <Select
                value={deviceData.version_id}
                onValueChange={(value) => setDeviceData({ ...deviceData, version_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('choose_version')} />
                </SelectTrigger>
                <SelectContent>
                  {versions.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.model_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!activeWIP && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800 font-medium">
                    ⚠️ No hay WIP Loading activo. Debes crear uno en la sección de WIP Loading antes de registrar dispositivos.
                  </p>
                </div>
              )}

              {activeWIP && deviceData.version_id && activeWIP.version_id !== deviceData.version_id && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800 font-medium">
                    ⚠️ El WIP Loading activo es para otra versión. Por favor selecciona: {versions.find(v => v.id === activeWIP.version_id)?.model_name}
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {currentStep === STEPS.DEVICE_ID_MAC && (
            <motion.div
              key="device_id_mac"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Hash className="w-5 h-5" />
                {t('scan_device_id')} y MAC Address
              </h3>
              
              <div className="space-y-2">
                <Label htmlFor="device_id">Device ID</Label>
                <Input
                  id="device_id"
                  value={deviceData.device_id}
                  onChange={(e) => setDeviceData({ ...deviceData, device_id: e.target.value })}
                  placeholder={t('scan_or_enter_device_id')}
                  className="font-mono"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mac_address" className="flex items-center gap-2">
                  <Wifi className="w-4 h-4" />
                  MAC Address
                </Label>
                <Input
                  id="mac_address"
                  value={deviceData.mac_address}
                  onChange={(e) => setDeviceData({ ...deviceData, mac_address: e.target.value })}
                  placeholder="Escanear MAC Address..."
                  className="font-mono"
                />
                <p className="text-xs text-slate-500">
                  Escanea el código de barras del MAC Address del dispositivo ESP32
                </p>
              </div>
            </motion.div>
          )}

          {currentStep === STEPS.NOTES && (
            <motion.div
              key="notes"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <StickyNote className="w-5 h-5" />
                {t('additional_notes_optional_device')}
              </h3>
              <Textarea
                value={deviceData.notes}
                onChange={(e) => setDeviceData({ ...deviceData, notes: e.target.value })}
                placeholder={t('special_observations_placeholder')}
                className="h-32"
              />
            </motion.div>
          )}

          {currentStep === STEPS.CONFIRM && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                {t('confirm_and_register')}
              </h3>
              <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                <div>
                  <p className="text-sm text-slate-500">{t('version')}</p>
                  <p className="font-semibold">{selectedVersion?.model_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Device ID</p>
                  <p className="font-semibold font-mono">{deviceData.device_id}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">MAC Address</p>
                  <p className="font-semibold font-mono">{deviceData.mac_address}</p>
                </div>
                {deviceData.notes && (
                  <div>
                    <p className="text-sm text-slate-500">{t('notes')}</p>
                    <p className="text-sm">{deviceData.notes}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-slate-500 mb-2">Componentes (del WIP Loading activo)</p>
                  <div className="space-y-1">
                    {activeWIP?.bins_loaded?.map((bin, idx) => (
                      <div key={idx} className="text-sm bg-white p-2 rounded border">
                        <span className="font-medium">{bin.component_name}</span>
                        <span className="text-slate-500 ml-2">Bin: {bin.bin_number}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-between mt-6 pt-6 border-t">
          <Button variant="outline" onClick={currentStep === STEPS.VERSION ? onCancel : handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {currentStep === STEPS.VERSION ? t('cancel') : t('back')}
          </Button>

          {currentStep < STEPS.CONFIRM ? (
            <Button onClick={handleNext}>
              {t('continue')}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleRegister} disabled={isSubmitting}>
              {isSubmitting ? t('registering') : t('register_device')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}