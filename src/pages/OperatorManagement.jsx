import React, { useState, useEffect } from "react";
import { Warehouse } from "@/api/entities";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Shield, Loader2, PlusCircle, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { useWarehouse } from "@/components/WarehouseProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import OperatorList from "@/components/operators/OperatorList";
import OperatorForm from "@/components/operators/OperatorForm";

export default function OperatorManagement() {
  const { t } = useLanguage();
  const { activeWarehouse, updateWarehouse } = useWarehouse();
  const [operators, setOperators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const loadOperators = async () => {
    setIsLoading(true);
    try {
      if (activeWarehouse) {
        setOperators(activeWarehouse.operators || []);
      } else {
        setOperators([]);
      }
    } catch (error) {
      console.error("Error fetching operator data:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadOperators();
  }, [activeWarehouse]); // Reload when warehouse changes

  const handleEditOperator = (operator) => {
    setSelectedOperator(operator);
    setIsCreatingNew(false);
    setShowForm(true);
  };

  const handleAddNewOperator = () => {
    setSelectedOperator(null);
    setIsCreatingNew(true);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setSelectedOperator(null);
    setIsCreatingNew(false);
    setShowForm(false);
  };

  const handleSaveOperator = async (operatorData) => {
    try {
      if (!activeWarehouse) {
        alert('Selecciona un warehouse primero');
        return;
      }

      if (isCreatingNew) {
        // Add new operator to warehouse operators JSON
        const updatedOperators = [...(activeWarehouse.operators || []), operatorData];
        await updateWarehouse(activeWarehouse.id, { operators: updatedOperators });
      } else {
        // Update existing operator in warehouse operators JSON
        const updatedOperators = (activeWarehouse.operators || []).map(op =>
          op.code === selectedOperator.code ? operatorData : op
        );
        await updateWarehouse(activeWarehouse.id, { operators: updatedOperators });
      }
      loadOperators();
      handleCloseForm();
    } catch (error) {
      console.error("Failed to save operator:", error);
      alert('Error guardando operario: ' + error.message);
    }
  };

  const handleDeleteOperator = async (operatorCode) => {
      if (window.confirm('¿Estás seguro de que quieres eliminar este operario? Esta acción no se puede deshacer.')) {
          try {
              if (!activeWarehouse) return;

              const updatedOperators = (activeWarehouse.operators || []).filter(op => op.code !== operatorCode);
              await updateWarehouse(activeWarehouse.id, { operators: updatedOperators });
              loadOperators();
          } catch(error) {
              console.error("Failed to delete operator:", error);
              alert('Error eliminando operario: ' + error.message);
          }
      }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-pink-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-pink-50 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Gestión de Operarios
          </h1>
          <p className="text-slate-600">Administra los códigos de acceso y permisos para los operarios del sistema.</p>
        </motion.div>
        
        <div className="flex justify-end mb-6">
            <Button onClick={handleAddNewOperator}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Agregar Operario
            </Button>
        </div>

        <AnimatePresence>
          {showForm && (
            <OperatorForm
              key={selectedOperator?.id || 'new'}
              operator={selectedOperator}
              isCreatingNew={isCreatingNew}
              onSave={handleSaveOperator}
              onCancel={handleCloseForm}
            />
          )}
        </AnimatePresence>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}>
            <OperatorList 
                operators={operators} 
                onEdit={handleEditOperator}
                onDelete={handleDeleteOperator}
            />
        </motion.div>
      </div>
    </div>
  );
}
