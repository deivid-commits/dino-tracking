
import React, { useState, useEffect } from "react";
import { Device, DinosaurVersion, Component } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Cpu, CheckCircle, Package, AlertTriangle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";
import { useWarehouse } from "@/components/WarehouseProvider";
import DevicesList from "@/components/devices/DevicesList";

export default function DevicesPage() {
  const { t } = useLanguage();
  const { activeWarehouse, filterByWarehouse } = useWarehouse();

  const [devices, setDevices] = useState([]);
  const [versions, setVersions] = useState([]);
  const [components, setComponents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [currentStep, setCurrentStep] = useState('version');
  const [lastRegistered, setLastRegistered] = useState(null);
  const [editingDevice, setEditingDevice] = useState(null);

  const [stepFormData, setStepFormData] = useState({
    version_id: "",
    device_id: "",
    mac_address: "",
    notes: ""
  });
  
  const registrationSteps = ['version', 'device_id', 'notes', 'submit'];

  useEffect(() => {
    if (activeWarehouse) {
      loadData();
    }
  }, [activeWarehouse]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allDevices, allVersions, allComponents] = await Promise.all([
        Device.list('-assembly_date'),
        DinosaurVersion.list('-created_date'),
        Component.list('name')
      ]);

      setDevices(filterByWarehouse(allDevices));
      setVersions(allVersions);
      setComponents(filterByWarehouse(allComponents));
    } catch (error) {
      console.error("Error loading devices data:", error);
    }
    setIsLoading(false);
  };

  const loadDevices = async () => {
    try {
      const allDevices = await Device.list('-assembly_date');
      setDevices(filterByWarehouse(allDevices));
    } catch (error) {
      console.error("Error loading devices:", error);
    }
  };

  const resetStepForm = () => {
    setStepFormData({
      version_id: "",
      device_id: "",
      mac_address: "",
      notes: ""
    });
    setCurrentStep('version');
    setIsRegistering(false);
    setEditingDevice(null);
  };

  const getCurrentOperator = () => {
    try {
      return JSON.parse(localStorage.getItem('dinotrack-operator') || '{}');
    } catch {
      return { name: 'Desconocido' };
    }
  };

  const handleStepSubmit = async () => {
    const stepIndex = registrationSteps.indexOf(currentStep);
    
    if (currentStep === 'version' && !stepFormData.version_id) {
      alert(t('please_select_version'));
      return;
    }

    if (currentStep === 'device_id') {
      if (!stepFormData.device_id.trim()) {
        alert('Por favor ingresa un Device ID');
        return;
      }
      if (!stepFormData.mac_address.trim()) {
        alert('Por favor ingresa un MAC Address');
        return;
      }
    }

    if (stepIndex < registrationSteps.length - 1) {
      setCurrentStep(registrationSteps[stepIndex + 1]);
    } else {
      await handleFinalSubmit();
    }
  };

  const handleStepBack = () => {
    const stepIndex = registrationSteps.indexOf(currentStep);
    if (stepIndex > 0) {
      setCurrentStep(registrationSteps[stepIndex - 1]);
    }
  };

  const handleFinalSubmit = async () => {
    if (!stepFormData.version_id || !stepFormData.device_id || !stepFormData.mac_address) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    setIsRegistering(true);

    try {
      const selectedVersion = versions.find(v => v.id === stepFormData.version_id);
      if (!selectedVersion) {
        throw new Error('Versión no encontrada');
      }

      console.log('📦 Selected version:', selectedVersion);
      console.log('📦 Components required:', selectedVersion.components);

      // Verificar y consumir componentes SIN usar bins
      const componentsUsed = [];
      const componentsToUpdate = [];

      for (const requiredComp of selectedVersion.components || []) {
        const component = components.find(c => c.id === requiredComp.component_id);
        
        if (!component) {
          throw new Error(`Componente no encontrado: ${requiredComp.component_id}`);
        }

        console.log(`📦 Checking component: ${component.name}, Available: ${component.quantity}`);

        // Verificar que hay cantidad disponible
        if (!component.quantity || component.quantity < 1) {
          throw new Error(`⚠️ Stock insuficiente de: ${component.name}\nDisponible: ${component.quantity || 0}`);
        }

        // Preparar actualización del componente (decrementar cantidad)
        const newQuantity = component.quantity - 1;
        
        componentsToUpdate.push({
          id: component.id,
          quantity: newQuantity
        });

        componentsUsed.push({
          component_id: component.id,
          component_name: component.name,
          tracking_type: component.tracking_type,
          batch_number: 'N/A', // Ya no usamos bins
          po_number: 'N/A'
        });

        console.log(`✅ Will consume 1 unit from ${component.name}, new quantity: ${newQuantity}`);
      }

      // Crear el device
      const operator = getCurrentOperator();
      const deviceData = {
        warehouse_id: activeWarehouse.id,
        device_id: stepFormData.device_id,
        mac_address: stepFormData.mac_address,
        version_id: stepFormData.version_id,
        components_used: componentsUsed,
        status: 'ready',
        assembly_date: new Date().toISOString(),
        assembled_by_operator: operator.name || 'Unknown',
        notes: stepFormData.notes || ''
      };

      console.log('📝 Creating device with data:', deviceData);
      const newDevice = await Device.create(deviceData);
      console.log('✅ Device created:', newDevice);

      // Actualizar cantidades de componentes
      for (const compUpdate of componentsToUpdate) {
        console.log(`📦 Updating component ${compUpdate.id}, new quantity: ${compUpdate.quantity}`);
        await Component.update(compUpdate.id, { quantity: compUpdate.quantity });
      }

      console.log('✅ All components updated successfully');

      setLastRegistered({ ...newDevice, components_used: componentsUsed });
      resetStepForm();
      await loadData();

    } catch (error) {
      console.error("❌ Error registering device:", error);
      alert('Error al registrar dispositivo:\n\n' + error.message);
    }

    setIsRegistering(false);
  };

  const handleDeleteDevice = async (device) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar el dispositivo ${device.device_id}?`)) {
      return;
    }

    try {
      await Device.delete(device.id);
      await loadDevices();
    } catch (error) {
      console.error("Error deleting device:", error);
      alert('Error eliminando dispositivo: ' + error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!activeWarehouse) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-6">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
                No hay warehouse activo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">Por favor selecciona un warehouse desde el menú lateral para continuar.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const selectedVersion = versions.find(v => v.id === stepFormData.version_id);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-50 to-indigo-50 overflow-hidden flex flex-col">
      {/* Full Screen Registration Form */}
      {currentStep !== 'list' && (
        <div className="fixed inset-0 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 z-50 overflow-auto">
          <div className="min-h-screen flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-4xl"
            >
              <Card className="shadow-2xl border-0">
                <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-8">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-3xl font-bold mb-2">
                        {t('device_registration_assistant')}
                      </CardTitle>
                      <p className="text-indigo-100">
                        {t('step_x_of_y', { current: registrationSteps.indexOf(currentStep) + 1, total: registrationSteps.length })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCurrentStep('list')}
                      className="text-white hover:bg-white/20"
                    >
                      <X className="w-6 h-6" />
                    </Button>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mt-6 bg-white/20 rounded-full h-2">
                    <div
                      className="bg-white rounded-full h-2 transition-all duration-300"
                      style={{ width: `${((registrationSteps.indexOf(currentStep) + 1) / registrationSteps.length) * 100}%` }}
                    />
                  </div>
                </CardHeader>

                <CardContent className="p-8">
                  <AnimatePresence mode="wait">
                    {/* Step 1: Version Selection */}
                    {currentStep === 'version' && (
                      <motion.div
                        key="version"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                      >
                        <div className="text-center mb-8">
                          <Package className="w-16 h-16 mx-auto text-indigo-600 mb-4" />
                          <h2 className="text-2xl font-bold text-slate-800 mb-2">
                            {t('select_dinosaur_version')}
                          </h2>
                          <p className="text-slate-600">
                            Selecciona la versión del dispositivo que vas a registrar
                          </p>
                        </div>

                        <div>
                          <Label className="text-lg mb-3 block">{t('version')} *</Label>
                          <Select
                            value={stepFormData.version_id}
                            onValueChange={(value) => setStepFormData({ ...stepFormData, version_id: value })}
                          >
                            <SelectTrigger className="h-16 text-lg">
                              <SelectValue placeholder={t('choose_version')} />
                            </SelectTrigger>
                            <SelectContent>
                              {versions.map(v => (
                                <SelectItem key={v.id} value={v.id} className="text-lg py-4">
                                  <div>
                                    <div className="font-semibold">{v.model_name}</div>
                                    <div className="text-sm text-slate-500">
                                      {v.components?.length || 0} componentes requeridos
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {selectedVersion && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-6 bg-indigo-50 rounded-xl border border-indigo-200"
                          >
                            <h3 className="font-semibold text-indigo-900 mb-3">
                              Componentes necesarios:
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                              {selectedVersion.components?.map((comp, idx) => {
                                const component = components.find(c => c.id === comp.component_id);
                                return (
                                  <div key={idx} className="flex items-center gap-2 text-sm bg-white p-3 rounded-lg">
                                    <Package className="w-4 h-4 text-indigo-600" />
                                    <span className="font-medium">{component?.name || 'Unknown'}</span>
                                    <span className="ml-auto text-xs text-slate-500">
                                      Stock: {component?.quantity || 0}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    )}

                    {/* Step 2: Device ID */}
                    {currentStep === 'device_id' && (
                      <motion.div
                        key="device_id"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                      >
                        <div className="text-center mb-8">
                          <Cpu className="w-16 h-16 mx-auto text-indigo-600 mb-4" />
                          <h2 className="text-2xl font-bold text-slate-800 mb-2">
                            {t('scan_device_id')}
                          </h2>
                          <p className="text-slate-600">
                            Escanea o ingresa el ID y MAC Address del dispositivo
                          </p>
                        </div>

                        <div className="space-y-6">
                          <div>
                            <Label className="text-lg mb-3 block">Device ID *</Label>
                            <Input
                              value={stepFormData.device_id}
                              onChange={(e) => setStepFormData({ ...stepFormData, device_id: e.target.value })}
                              placeholder={t('scan_or_enter_device_id')}
                              className="h-16 text-lg font-mono"
                              autoFocus
                            />
                          </div>

                          <div>
                            <Label className="text-lg mb-3 block">MAC Address *</Label>
                            <Input
                              value={stepFormData.mac_address}
                              onChange={(e) => setStepFormData({ ...stepFormData, mac_address: e.target.value })}
                              placeholder="AA:BB:CC:DD:EE:FF"
                              className="h-16 text-lg font-mono"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 3: Notes */}
                    {currentStep === 'notes' && (
                      <motion.div
                        key="notes"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                      >
                        <div className="text-center mb-8">
                          <CheckCircle className="w-16 h-16 mx-auto text-indigo-600 mb-4" />
                          <h2 className="text-2xl font-bold text-slate-800 mb-2">
                            {t('additional_notes_optional_device')}
                          </h2>
                          <p className="text-slate-600">
                            Agrega cualquier observación especial sobre este dispositivo
                          </p>
                        </div>

                        <Textarea
                          value={stepFormData.notes}
                          onChange={(e) => setStepFormData({ ...stepFormData, notes: e.target.value })}
                          placeholder={t('special_observations_placeholder')}
                          rows={6}
                          className="text-lg"
                        />
                      </motion.div>
                    )}

                    {/* Step 4: Confirmation */}
                    {currentStep === 'submit' && (
                      <motion.div
                        key="submit"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                      >
                        <div className="text-center mb-8">
                          <CheckCircle className="w-16 h-16 mx-auto text-green-600 mb-4" />
                          <h2 className="text-2xl font-bold text-slate-800 mb-2">
                            {t('confirm_and_register')}
                          </h2>
                          <p className="text-slate-600">
                            Revisa la información antes de registrar
                          </p>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-6 space-y-4">
                          <div className="flex justify-between items-center py-3 border-b">
                            <span className="text-slate-600">Versión:</span>
                            <span className="font-semibold text-slate-800">
                              {selectedVersion?.model_name}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b">
                            <span className="text-slate-600">Device ID:</span>
                            <span className="font-mono font-semibold text-slate-800">
                              {stepFormData.device_id}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b">
                            <span className="text-slate-600">MAC Address:</span>
                            <span className="font-mono text-sm text-slate-800">
                              {stepFormData.mac_address}
                            </span>
                          </div>
                          {stepFormData.notes && (
                            <div className="py-3">
                              <span className="text-slate-600 block mb-2">Notas:</span>
                              <p className="text-slate-800 bg-white p-3 rounded-lg">
                                {stepFormData.notes}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <p className="text-sm text-blue-800">
                            ℹ️ <strong>Sistema simplificado:</strong> El sistema decrementará automáticamente 1 unidad de cada componente requerido.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Navigation Buttons */}
                  <div className="flex gap-4 mt-8 pt-8 border-t">
                    {currentStep !== 'version' && (
                      <Button
                        onClick={handleStepBack}
                        variant="outline"
                        className="flex-1 h-14 text-lg"
                        disabled={isRegistering}
                      >
                        {t('back')}
                      </Button>
                    )}
                    <Button
                      onClick={handleStepSubmit}
                      className="flex-1 h-14 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                      disabled={isRegistering}
                    >
                      {isRegistering ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          {t('registering')}...
                        </>
                      ) : currentStep === 'submit' ? (
                        <>
                          <CheckCircle className="w-5 h-5 mr-2" />
                          {t('register_device')}
                        </>
                      ) : (
                        t('continue')
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      )}

      {/* List View */}
      {currentStep === 'list' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {t('device_registration_station')}
              </h1>
              <p className="text-slate-600">{t('register_devices_step_by_step')}</p>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="font-semibold text-indigo-600">Warehouse:</span>
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full font-medium">
                  {activeWarehouse.name}
                </span>
              </div>
            </motion.div>

            {/* Success Alert */}
            <AnimatePresence>
              {lastRegistered && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mb-6"
                >
                  <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="w-5 h-5" />
                          {t('device_registered_successfully')}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setLastRegistered(null)}
                          className="text-green-600 hover:text-green-800"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-slate-600 text-sm">Device ID:</span>
                          <span className="font-mono font-bold text-lg text-green-800 ml-2">
                            {lastRegistered.device_id}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-600 text-sm">MAC:</span>
                          <span className="font-mono text-sm text-slate-700 ml-2">
                            {lastRegistered.mac_address}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              onClick={() => setCurrentStep('version')}
              className="mb-6 h-12 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            >
              <Cpu className="w-5 h-5 mr-2" />
              {t('register_device')}
            </Button>

            <DevicesList
              devices={devices}
              versions={versions}
              onDelete={handleDeleteDevice}
              onDeviceUpdated={loadDevices}
            />
          </div>
        </div>
      )}
    </div>
  );
}
