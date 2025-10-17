import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/components/LanguageProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { X, Save } from 'lucide-react';
import { Component } from "@/api/entities";
import { toast } from 'sonner';

// 🎯 Formulario simple para catálogo de componentes (toy_bom_items)
// Solo guarda: component_sku y component_description
export default function ComponentForm({ component, onClose, onSave }) {
  const { t } = useLanguage();
  const isEditing = !!component;

  const [formData, setFormData] = useState({
    component_sku: component?.component_sku || '',
    component_description: component?.component_description || '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.component_sku?.trim()) {
      toast.error('SKU es requerido');
      return;
    }

    setIsSubmitting(true);

    // Normalized payload we intend to save (omit description if empty)
    const payload = (() => {
      const sku = formData.component_sku.trim();
      const desc = formData.component_description?.trim();
      return desc ? { component_sku: sku, component_description: desc } : { component_sku: sku };
    })();

    try {
      if (isEditing) {
        await Component.update(payload.component_sku, {
          component_description: payload.component_description
        });
        toast.success('✅ Componente actualizado');
      } else {
        const created = await Component.create(payload);
        console.info('✅ Component created:', created);
        toast.success('✅ Componente creado');
      }

      onSave?.();
      onClose();
    } catch (error) {
      // Surface rich error info to help diagnose schema/RLS issues
      console.error('Error saving component:', error);
      console.error('Create payload used:', payload);
      const msg = typeof error?.message === 'string' ? error.message : JSON.stringify(error);
      toast.error(`Error guardando componente: ${msg}`);
    } finally {
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
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <Card className="bg-white">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-t-lg">
            <div className="flex justify-between items-center">
              <CardTitle>{isEditing ? t('edit') : 'Añadir SKU al Catálogo'}</CardTitle>
              <Button 
                type="button"
                variant="ghost" 
                size="icon" 
                onClick={onClose} 
                className="text-white hover:bg-white/20" 
                disabled={isSubmitting}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="component_sku">SKU del Componente *</Label>
                <Input
                  id="component_sku"
                  value={formData.component_sku}
                  onChange={e => handleChange('component_sku', e.target.value)}
                  placeholder="e.g., ESP32-WROOM-32"
                  required
                  disabled={isSubmitting || isEditing} 
                />
                {isEditing && (
                  <p className="text-xs text-slate-500">
                    El SKU no se puede editar. Cree un nuevo elemento si necesita cambiarlo.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="component_description">Descripción (opcional)</Label>
                <Textarea
                  id="component_description"
                  value={formData.component_description}
                  onChange={e => handleChange('component_description', e.target.value)}
                  placeholder="Descripción del componente para usar en versiones (BOM)"
                  className="h-24"
                  disabled={isSubmitting}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>ℹ️ Nota:</strong> Este formulario agrega elementos al catálogo de componentes (toy_components).
                  Luego estos SKUs podrán usarse para crear versiones de BOM.
                </p>
              </div>
            </CardContent>
            
            <CardFooter className="flex justify-end gap-3 bg-slate-50">
              <Button 
                type="button"
                variant="outline" 
                onClick={onClose} 
                disabled={isSubmitting}
              >
                {t('cancel')}
              </Button>
              <Button 
                type="submit"
                className="bg-blue-600 hover:bg-blue-700" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {t('save_changes')}
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </motion.div>
  );
}
