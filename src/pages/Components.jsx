
import React, { useState, useEffect } from "react";
import { Component } from "@/api/entities"; // 🔥 COMPONENT INVENTORY VIEW - Aggregated by SKU
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Search, Grid3x3, List, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { useLanguage as useL } from "@/components/LanguageProvider";

import ComponentsList from "../components/components/ComponentsList";
import ComponentForm from "../components/components/ComponentForm";

// 🔥 COMPONENT SKU MANAGEMENT - Working with Purchase Order Items Inventory
export default function Components() {
  const { t } = useL(); // Use the imported useL hook
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadComponents();
  }, []); // Remove activeWarehouse dependency since we removed useWarehouse

  const loadComponents = async () => {
    try {
      setLoading(true);
      const data = await Component.list('component_sku');
      setComponents(data || []);
    } catch (error) {
      console.error('Error loading purchase order items:', error);
      setComponents([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredComponents = components.filter(component => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return (
      searchTerm === "" ||
      (component.component_sku && component.component_sku.toLowerCase().includes(lowerSearchTerm)) ||
      (component.component_description && component.component_description.toLowerCase().includes(lowerSearchTerm))
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
              {t('component_management')}
            </h1>
            <p className="text-slate-600">{t('manage_parts_components_inventory')}</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Button 
              onClick={() => setShowForm(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              Añadir Nuevo SKU
            </Button>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8"
        >
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder={t('search_components_placeholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/50"
                />
              </div>
            </div>
            {/* View Mode Toggle */}
            <div className="flex gap-1 bg-white/50 rounded-lg p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded ${viewMode === "grid" ? "bg-blue-600 text-white" : "text-slate-400"}`}
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded ${viewMode === "list" ? "bg-blue-600 text-white" : "text-slate-400"}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-slate-600 mt-4">Cargando componentes...</p>
            </div>
          ) : components.length === 0 ? (
            <Card className="p-12 text-center">
              <Package className="w-16 h-16 mx-auto mb-4 text-slate-400" />
              <CardTitle className="mb-2">No hay SKUs en el catálogo</CardTitle>
              <p className="text-slate-600 mb-6">
                Agrega SKUs al catálogo (toy_components) para construir versiones (BOM).
              </p>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowForm(true)}>
                Añadir SKU
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-slate-600">
                Mostrando {filteredComponents.length} SKUs en catálogo
              </div>
              <ComponentsList
                components={filteredComponents}
                onEdit={() => {}}
                onDelete={() => {}}
                viewMode={viewMode}
              />
            </div>
          )}
        </motion.div>

        {/* Component Form Modal */}
        {showForm && (
          <ComponentForm
            onClose={() => setShowForm(false)}
            onSave={() => {
              loadComponents();
              setShowForm(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
