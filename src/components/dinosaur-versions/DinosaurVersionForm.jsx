
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, X, Layers, Plus, Trash2, Loader2, CheckCircle, Search, Tag } from "lucide-react";
import { Component } from "@/api/entities";
import { DinosaurVersion } from "@/api/entities";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/components/LanguageProvider";

export default function DinosaurVersionForm({ version, components = [], onCancel }) {
  const { t } = useLanguage();
  
  const [formData, setFormData] = useState(version || {
    model_name: "",
    sku_base: "",
    version_number: "01",
    components: [],
    notes: "",
    available_colors: []
  });
  
  const [availableComponents, setAvailableComponents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState("");
  const [hasUserMadeChanges, setHasUserMadeChanges] = useState(false);
  
  // Color input states
  const [newColorName, setNewColorName] = useState("");
  const [newColorCode, setNewColorCode] = useState("");

  // State for manual component selection
  const [selectedComponentId, setSelectedComponentId] = useState("");
  const [requiredQty, setRequiredQty] = useState(1);

  const saveTimeoutRef = useRef(null);
  const initialDataRef = useRef(JSON.stringify(version || {}));

  useEffect(() => {
    // Components are now passed as a prop, so we just set them
    setAvailableComponents(components);
  }, [components]); // Depend on components prop to update if it changes

  // Rehydrate bom_recipe when editing an existing version
  useEffect(() => {
    if (version && version.bom_recipe) {
      try {
        const bomRecipe = typeof version.bom_recipe === 'string' ? JSON.parse(version.bom_recipe) : version.bom_recipe;
        console.log('🔄 Rehydrating version:', version.version_name, 'bom_recipe:', bomRecipe);

        // Extract components from bom_recipe
        const rehydratedComponents = (bomRecipe.components || []).map((item) => ({
          component_id: item.component_sku || item.component_id,
          tracking_type: item.tracking_type || 'lote',
          required_quantity: Number(item.quantity || 1)
        }));

        // Extract colors from generated_skus or available_colors (legacy)
        const availableColors = [];
        if (bomRecipe.generated_skus && Array.isArray(bomRecipe.generated_skus)) {
          bomRecipe.generated_skus.forEach(sku => {
            if (sku.color_code) {
              availableColors.push({
                name: sku.color_name || sku.color_code,
                code: sku.color_code
              });
            }
          });
        }

        // Update form data
        setFormData(prev => ({
          ...prev,
          model_name: bomRecipe.metadata?.model_name || prev.model_name,
          sku_base: bomRecipe.metadata?.sku_base || prev.sku_base,
          version_number: bomRecipe.metadata?.version_number || prev.version_number,
          components: rehydratedComponents,
          notes: bomRecipe.notes || prev.notes,
          available_colors: availableColors
        }));

        console.log('✅ Rehydrated data:', { components: rehydratedComponents, colors: availableColors });
      } catch (error) {
        console.warn('Could not parse bom_recipe for editing:', error);
      }
    }
  }, [version]);

  const handleManualSave = useCallback(async () => {
    setIsLoading(true);
    try {
      // ✅ GENERAR VARIOS SKUS POR COLOR: Una versión genera múltiples SKUs finales
      const availableColors = formData.available_colors || [];
      const generatedSKUs = [];

      if (availableColors.length > 0) {
        // Si hay colores definitivos: generar SKUs únicos por color
        availableColors.forEach(color => {
          const sku = generateFullSKU(color.code);
          if (sku) generatedSKUs.push({
            sku,
            color_name: color.name,
            color_code: color.code
          });
        });
      } else if (newColorCode && newColorCode.trim()) {
        // Si hay un color temporal: usar esa para el primer SKU
        const sku = generateFullSKU(newColorCode.trim());
        if (sku) generatedSKUs.push({
          sku,
          color_name: newColorName || 'Temporal',
          color_code: newColorCode.trim()
        });
      }

      // ✅ VERSION BASE: Guardar como una sola entidad "versión" que contiene múltiples SKUs
      const baseVersion = {
        version_name: `${formData.sku_base}-BASE-${formData.version_number || "01"}`, // Nombre base para la versión
        bom_recipe: JSON.stringify({
          // 🎨 METADATA de la versión (no colores - ya están en los SKUs)
          metadata: {
            model_name: formData.model_name,
            sku_base: formData.sku_base,
            version_number: formData.version_number,
            created_at: new Date().toISOString()
          },
          // ⚙️ COMPONENTES universales de la versión (iguales para todos los colores)
          components: (formData.components || []).map((c) => ({
            component_sku: String(c.component_id),
            quantity: Number(c.required_quantity || 1),
            tracking_type: c.tracking_type || 'lote'
          })),
          // 📝 NOTAS de la versión
          notes: formData.notes || '',
          // 🎨 SKUS GENERADOS: Array de SKUs finales disponibles para esta versión
          generated_skus: generatedSKUs,
          // 📊 RESUMEN
          summary: {
            total_skus: generatedSKUs.length,
            total_components: (formData.components || []).length,
            last_updated: new Date().toISOString()
          }
        }),
        bom_count: (formData.components || []).length,
        is_active: true
      };

      console.log('🛠️ Saving version with generated SKUs:', generatedSKUs);
      console.log('📦 Final payload:', baseVersion);

      if (formData.id) {
        await DinosaurVersion.update(formData.id, baseVersion);
      } else {
        const createdVersion = await DinosaurVersion.create(baseVersion);
        if (createdVersion && createdVersion.id) {
          setFormData(prev => ({ ...prev, id: createdVersion.id }));
          initialDataRef.current = JSON.stringify({ ...formData, id: createdVersion.id });
        }
      }

      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus(""), 2000);
      initialDataRef.current = JSON.stringify(formData);
      setHasUserMadeChanges(false);

    } catch (error) {
      console.error("Manual save failed:", error);
      setAutoSaveStatus("error");
      setTimeout(() => setAutoSaveStatus(""), 2000);
      alert('Error al guardar: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [formData, newColorCode, newColorName]);

  const handleAutoSave = useCallback(async () => {
    if (!hasUserMadeChanges) return;

    try {
      // ✅ DISABLE AUTO-SAVE to prevent flooding the backend
      console.log('Auto-save disabled - use manual save instead');
      return;

    } catch (error) {
      console.error("Auto-save failed:", error);
      setAutoSaveStatus("error");
      setTimeout(() => setAutoSaveStatus(""), 2000);
    }
  }, [formData, hasUserMadeChanges, newColorCode]);

  useEffect(() => {
    const currentDataString = JSON.stringify(formData);
    const hasChanged = currentDataString !== initialDataRef.current;
    
    if (!hasChanged) {
      setHasUserMadeChanges(false);
      return;
    }
    
    setHasUserMadeChanges(true);

    if (!formData.model_name || !formData.model_name.trim() || !formData.sku_base || !formData.sku_base.trim()) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      return;
    }

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    setAutoSaveStatus("saving");
    
    saveTimeoutRef.current = setTimeout(() => {
      handleAutoSave();
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [formData, handleAutoSave]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addComponentToVersion = (componentData) => {
    const isDuplicate = formData.components?.some(c => 
      c.component_id === componentData.component_id
    );

    if (isDuplicate) {
      const comp = availableComponents.find(c => c.id === componentData.component_id);
      setError(t('component_already_added', { name: comp?.name || componentData.component_id }));
    } else {
      setFormData(prev => ({
        ...prev,
        components: [...(prev.components || []), {
          component_id: componentData.component_id,
          tracking_type: componentData.tracking_type,
          required_quantity: Number(componentData.required_quantity || 1)
        }]
      }));
      setError(null);
    }
  };
  
  const handleAddComponentManually = () => {
    const component = availableComponents.find(c => c.id === selectedComponentId);
    if (!component) return;

    addComponentToVersion({
      component_id: component.id,
      tracking_type: component.tracking_type,
      required_quantity: Number(requiredQty || 1)
    });
    
    setSelectedComponentId("");
    setRequiredQty(1);
  };

  const removeComponent = (index) => {
    setFormData(prev => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index)
    }));
  };
  
  const handleAddColor = () => {
    const trimmedName = (newColorName || '').trim();
    const trimmedCode = (newColorCode || '').trim().toUpperCase();
    
    if (!trimmedName || !trimmedCode) {
      return;
    }
    
    // Check if color already exists - with safe checks
    const exists = formData.available_colors?.some(c => {
      const colorName = (c?.name || '').toLowerCase();
      const colorCode = (c?.code || '').toUpperCase();
      return colorName === trimmedName.toLowerCase() || colorCode === trimmedCode;
    });
    
    if (exists) {
      alert(t('color_already_exists'));
      return;
    }
    
    const newColor = {
      name: trimmedName,
      code: trimmedCode
    };
    
    handleChange('available_colors', [...(formData.available_colors || []), newColor]);
    setNewColorName("");
    setNewColorCode("");
  };

  const handleRemoveColor = (index) => {
    const updatedColors = (formData.available_colors || []).filter((_, i) => i !== index);
    handleChange('available_colors', updatedColors);
  };

  const handleColorNameChange = (value) => {
    setNewColorName(value);
    // Auto-fill color code with first 2 letters in uppercase
    if (value && value.length >= 2) {
      const autoCode = value.substring(0, 2).toUpperCase();
      setNewColorCode(autoCode);
    } else if (value && value.length === 1) {
      setNewColorCode(value.toUpperCase());
    } else {
      setNewColorCode("");
    }
  };

  const generateFullSKU = (colorCode) => {
    if (!formData.sku_base || !colorCode) return "";
    const versionNum = formData.version_number || "01";
    return `${formData.sku_base}-${colorCode}-${versionNum}`;
  };

  // Helper function to get component name by ID
  const getComponentName = (componentId) => {
    const component = availableComponents.find(c => c.id === componentId);
    return component?.name || String(componentId);
  };

  // Helper function to get tracking type label
  const getTrackingTypeLabel = (trackingType) => {
    return trackingType === 'lote' ? t('batch') : 
           trackingType === 'unidad' ? t('individual') : 
           t('no_tracking');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mb-8"
    >
      <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0">
        <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-t-lg">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5" />
              {version ? t('edit_version') : t('create_new_version')}
            </div>
            <div className="flex items-center gap-2 text-sm">
              {autoSaveStatus === "saving" && <span>{t('saving')}</span>}
              {autoSaveStatus === "saved" && (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>{t('saved')}</span>
                </>
              )}
              {autoSaveStatus === "error" && <span className="text-red-200">{t('save_error')}</span>}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Model Name and SKU Base */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="model_name">{t('model_name')}*</Label>
                <Input
                  id="model_name"
                  placeholder="e.g.: Bondu Dino V2"
                  value={formData.model_name || ""}
                  onChange={(e) => handleChange('model_name', e.target.value)}
                  required
                  className="bg-white/70"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="sku_base">{t('sku_base')}*</Label>
                <Input
                  id="sku_base"
                  placeholder="e.g.: EXFAC-BON-DIN"
                  value={formData.sku_base || ""}
                  onChange={(e) => handleChange('sku_base', e.target.value.toUpperCase())}
                  required
                  className="bg-white/70 font-mono"
                />
              </div>
            </div>

            {/* Version Number */}
            <div className="space-y-2">
              <Label htmlFor="version_number">{t('version_number')}</Label>
              <Input
                id="version_number"
                placeholder="01"
                value={formData.version_number || "01"}
                onChange={(e) => handleChange('version_number', e.target.value)}
                maxLength={2}
                className="bg-white/70 font-mono w-24"
              />
            </div>

            {/* Available Colors with SKU Preview */}
            <div className="space-y-4">
              <Label>{t('available_colors')}</Label>
              <div className="bg-slate-50 p-4 rounded-lg border space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    placeholder={t('color_name_placeholder')}
                    value={newColorName || ""}
                    onChange={(e) => handleColorNameChange(e.target.value)}
                    className="bg-white/70"
                  />
                  <Input
                    placeholder={t('color_code_placeholder')}
                    value={newColorCode || ""}
                    onChange={(e) => setNewColorCode((e.target.value || '').toUpperCase().slice(0, 2))}
                    maxLength={2}
                    className="bg-white/70 font-mono"
                  />
                  <Button type="button" onClick={handleAddColor} className="bg-purple-600 hover:bg-purple-700 h-10">
                    <Plus className="w-5 h-5 mr-2"/>
                    {t('add')}
                  </Button>
                </div>
                
                {/* SKU Preview for new color */}
                {newColorCode && formData.sku_base && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Tag className="w-4 h-4 text-blue-600" />
                      <span className="text-blue-700 font-medium">{t('sku_preview')}:</span>
                      <code className="bg-white px-2 py-1 rounded font-mono text-blue-900 font-bold">
                        {generateFullSKU(newColorCode)}
                      </code>
                    </div>
                  </div>
                )}
                
                {formData.available_colors && formData.available_colors.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    {formData.available_colors.map((color, index) => (
                      <div key={index} className="bg-white rounded-lg p-3 shadow-sm border flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <Badge variant="outline" className="capitalize bg-purple-100 text-purple-800 border-purple-200">
                            {color?.name || ''}
                          </Badge>
                          <Badge variant="outline" className="font-mono bg-slate-100 text-slate-800">
                            {color?.code || ''}
                          </Badge>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Tag className="w-3 h-3" />
                            <code className="bg-slate-100 px-2 py-0.5 rounded font-mono font-bold text-slate-700">
                              {generateFullSKU(color?.code || '')}
                            </code>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveColor(index)}
                          className="text-red-500 hover:bg-red-100 h-8 w-8 flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Components Configuration */}
            <div className="space-y-4">
              <Label>{t('components_configuration')}</Label>
              
              <div className="bg-slate-50 p-4 rounded-lg border space-y-4">
                <div>
                  <p className="text-sm text-slate-600 mb-2">{t('select_components_for_version')}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Select value={selectedComponentId} onValueChange={setSelectedComponentId}>
                      <SelectTrigger className="bg-white/70">
                        <SelectValue placeholder={t('select_component')} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableComponents.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.tracking_type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      value={requiredQty}
                      onChange={(e) => setRequiredQty(Math.max(1, parseInt(e.target.value || '1', 10)))}
                      className="bg-white/70"
                      placeholder={t('quantity_po')}
                    />
                    <Button 
                      type="button"
                      onClick={handleAddComponentManually}
                      disabled={!selectedComponentId}
                      className="bg-indigo-600 hover:bg-indigo-700 h-10"
                    >
                      <Plus className="w-5 h-5 mr-2"/> {t('add')}
                    </Button>
                  </div>
                </div>
              </div>
              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>

            {/* Added Components List */}
            {formData.components && formData.components.length > 0 && (
              <div className="space-y-2">
                <Label>{t('added_components', { count: formData.components.length })}</Label>
                <div className="space-y-2 rounded-lg bg-slate-50 border max-h-60 overflow-y-auto p-4">
                  {formData.components.map((component, index) => (
                    <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm">
                      <div className="flex items-center gap-3 flex-1">
                        <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">
                          {getComponentName(component.component_id)}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {getTrackingTypeLabel(component.tracking_type)}
                        </Badge>
                        <Badge variant="outline" className="text-xs font-mono">
                          x{Number(component.required_quantity || 1)}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeComponent(index)}
                        className="text-red-500 hover:bg-red-100 h-8 w-8 flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">{t('version_notes')}</Label>
              <Textarea
                id="notes"
                placeholder={t('version_notes_placeholder')}
                value={formData.notes || ""}
                onChange={(e) => handleChange('notes', e.target.value)}
                className="bg-white/70 h-24"
              />
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="bg-white/70 hover:bg-white"
              >
                <X className="w-4 h-4 mr-2" />
                {t('cancel')}
              </Button>
              <Button
                type="button"
                onClick={handleManualSave}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('saving')}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {t('save')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
