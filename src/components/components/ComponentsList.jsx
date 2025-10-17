import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Edit, Trash2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Catálogo simple de componentes (toy_bom_items)
// Muestra solo: component_sku y component_description
export default function ComponentsList({ components, onEdit, onDelete, viewMode = "grid" }) {
  const { t } = useLanguage();

  if (!components || components.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
        <CardContent className="p-12 text-center">
          <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-600 mb-2">
            {t('no_components_registered') || 'No hay SKUs en el catálogo'}
          </h3>
          <p className="text-slate-500">
            {t('start_adding_first_component') || 'Añade tu primer SKU para construir versiones (BOM).'}
          </p>
        </CardContent>
      </Card>
    );
  }

  // List View
  if (viewMode === "list") {
    return (
      <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold">SKU</TableHead>
                  <TableHead className="font-semibold">Descripción</TableHead>
                  <TableHead className="font-semibold text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {components.map((component, index) => (
                  <motion.tr
                    key={`${component.component_sku}-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <TableCell className="font-mono text-slate-800">
                      {component.component_sku}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {component.component_description || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit?.(component)}
                          className="hover:bg-blue-100 h-8 w-8"
                        >
                          <Edit className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete?.(component)}
                          className="hover:bg-red-100 h-8 w-8"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Grid View
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {components.map((component, index) => (
        <motion.div
          key={`${component.component_sku}-${index}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 border-0 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-400 to-blue-600" />
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg font-mono">
                      {component.component_sku}
                    </h3>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit?.(component)}
                    className="hover:bg-blue-100 h-8 w-8"
                  >
                    <Edit className="w-4 h-4 text-blue-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete?.(component)}
                    className="hover:bg-red-100 h-8 w-8"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>

              {component.component_description && (
                <p className="text-slate-600 text-sm mb-2">
                  {component.component_description}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
