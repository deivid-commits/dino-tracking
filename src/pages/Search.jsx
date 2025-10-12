import React, { useState, useEffect } from "react";
import { Component, Dinosaur, Device, Sale, DinosaurVersion } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Package, Cpu, ShoppingCart, Layers, Loader2, Edit } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";
import { useWarehouse } from "@/components/WarehouseProvider";
import DeviceEditForm from "@/components/devices/DeviceEditForm";

export default function SearchPage() {
  const { t } = useLanguage();
  const { filterByWarehouse } = useWarehouse();
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [versions, setVersions] = useState([]);
  const [editingDevice, setEditingDevice] = useState(null);

  useEffect(() => {
    loadVersions();
  }, []);

  const loadVersions = async () => {
    try {
      const allVersions = await DinosaurVersion.list('-created_date');
      setVersions(allVersions);
    } catch (error) {
      console.error("Error loading versions:", error);
    }
  };

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        performSearch();
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(delaySearch);
  }, [searchTerm]);

  const performSearch = async () => {
    setIsSearching(true);
    const foundResults = [];
    const term = searchTerm.toLowerCase();

    try {
      // Search Components
      const allComponents = await Component.list('name');
      const components = filterByWarehouse(allComponents);
      components.forEach(comp => {
        if (
          comp.name?.toLowerCase().includes(term) ||
          comp.description?.toLowerCase().includes(term) ||
          comp.supplier?.toLowerCase().includes(term) ||
          comp.bins?.some(b => b.bin_number?.toLowerCase().includes(term)) ||
          comp.serial_numbers?.some(s => s.serial_number?.toLowerCase().includes(term))
        ) {
          foundResults.push({ type: 'component', data: comp });
        }
      });

      // Search Dinosaurs
      const allDinosaurs = await Dinosaur.list('-assembly_date');
      const dinosaurs = filterByWarehouse(allDinosaurs);
      dinosaurs.forEach(dino => {
        if (
          dino.rfid_code?.toLowerCase().includes(term) ||
          dino.device_id?.toLowerCase().includes(term) ||
          dino.color?.toLowerCase().includes(term) ||
          dino.notes?.toLowerCase().includes(term)
        ) {
          foundResults.push({ type: 'dinosaur', data: dino });
        }
      });

      // Search Devices
      const allDevices = await Device.list('-assembly_date');
      const devices = filterByWarehouse(allDevices);
      devices.forEach(device => {
        if (
          device.device_id?.toLowerCase().includes(term) ||
          device.mac_address?.toLowerCase().includes(term) ||
          device.notes?.toLowerCase().includes(term) ||
          device.components_used?.some(c => c.component_name?.toLowerCase().includes(term))
        ) {
          foundResults.push({ type: 'device', data: device });
        }
      });

      // Search Sales
      const allSales = await Sale.list('-created_date');
      const sales = filterByWarehouse(allSales);
      sales.forEach(sale => {
        if (
          sale.shopify_order_number?.toLowerCase().includes(term) ||
          sale.dinosaur_rfid?.toLowerCase().includes(term) ||
          sale.notes?.toLowerCase().includes(term)
        ) {
          foundResults.push({ type: 'sale', data: sale });
        }
      });

      // Search Versions
      const allVersions = await DinosaurVersion.list('-created_date');
      allVersions.forEach(version => {
        if (
          version.model_name?.toLowerCase().includes(term) ||
          version.sku_base?.toLowerCase().includes(term) ||
          version.notes?.toLowerCase().includes(term)
        ) {
          foundResults.push({ type: 'version', data: version });
        }
      });

      setResults(foundResults);
    } catch (error) {
      console.error("Error performing search:", error);
    }
    setIsSearching(false);
  };

  const getResultIcon = (type) => {
    switch (type) {
      case 'component': return <Package className="w-5 h-5 text-blue-600" />;
      case 'dinosaur': return <span className="text-xl">🦖</span>;
      case 'device': return <Cpu className="w-5 h-5 text-purple-600" />;
      case 'sale': return <ShoppingCart className="w-5 h-5 text-green-600" />;
      case 'version': return <Layers className="w-5 h-5 text-indigo-600" />;
      default: return null;
    }
  };

  const getResultTitle = (type) => {
    switch (type) {
      case 'component': return t('component_result');
      case 'dinosaur': return t('dinosaur_result');
      case 'device': return t('device_result');
      case 'sale': return t('sale_result');
      case 'version': return t('version_result');
      default: return type;
    }
  };

  const renderResultDetails = (result) => {
    const { type, data } = result;

    switch (type) {
      case 'component':
        return (
          <div className="space-y-2">
            <p className="font-semibold text-lg text-slate-800">{data.name}</p>
            {data.description && <p className="text-sm text-slate-600">{data.description}</p>}
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline">{data.tracking_type === 'lote' ? t('by_batch') : t('by_unit')}</Badge>
              <Badge className={
                data.quantity === 0 ? 'bg-red-100 text-red-800' :
                data.quantity < 10 ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }>
                {data.quantity} {t('units')}
              </Badge>
            </div>
          </div>
        );

      case 'dinosaur':
        const dinoVersion = versions.find(v => v.id === data.version_id);
        return (
          <div className="space-y-2">
            <p className="font-semibold text-lg text-slate-800">{dinoVersion?.model_name || 'Unknown Version'}</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-slate-500">RFID:</span> <span className="font-mono">{data.rfid_code}</span></div>
              <div><span className="text-slate-500">Device:</span> <span className="font-mono">{data.device_id}</span></div>
              <div><span className="text-slate-500">{t('color')}:</span> <span className="capitalize">{data.color}</span></div>
              <div><span className="text-slate-500">{t('status')}:</span> <Badge variant="outline">{t(data.status)}</Badge></div>
            </div>
          </div>
        );

      case 'device':
        const deviceVersion = versions.find(v => v.id === data.version_id);
        return (
          <div className="space-y-2">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-semibold text-lg text-slate-800">{deviceVersion?.model_name || 'Unknown Version'}</p>
                <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                  <div><span className="text-slate-500">Device ID:</span> <span className="font-mono">{data.device_id}</span></div>
                  <div><span className="text-slate-500">MAC:</span> <span className="font-mono text-xs">{data.mac_address}</span></div>
                  <div><span className="text-slate-500">{t('status')}:</span> <Badge variant="outline">{t(data.status)}</Badge></div>
                  <div><span className="text-slate-500">{t('components')}:</span> {data.components_used?.length || 0}</div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingDevice(data);
                }}
                className="hover:bg-purple-100"
              >
                <Edit className="w-4 h-4 text-purple-600" />
              </Button>
            </div>
          </div>
        );

      case 'sale':
        return (
          <div className="space-y-2">
            <p className="font-semibold text-lg text-slate-800">{t('sale')} #{data.shopify_order_number}</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-slate-500">RFID:</span> <span className="font-mono">{data.dinosaur_rfid}</span></div>
              <div><span className="text-slate-500">{t('date')}:</span> {new Date(data.created_date).toLocaleDateString()}</div>
            </div>
            {data.notes && <p className="text-sm text-slate-600 italic">{data.notes}</p>}
          </div>
        );

      case 'version':
        return (
          <div className="space-y-2">
            <p className="font-semibold text-lg text-slate-800">{data.model_name}</p>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline">SKU: {data.sku_base}</Badge>
              <Badge variant="outline">v{data.version_number || '01'}</Badge>
              <Badge className="bg-purple-100 text-purple-800">{data.components?.length || 0} {t('components')}</Badge>
            </div>
            {data.notes && <p className="text-sm text-slate-600 italic line-clamp-2">{data.notes}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  const reloadSearchResults = async () => {
    if (searchTerm.trim().length >= 2) {
      await performSearch();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            {t('global_search')}
          </h1>
          <p className="text-slate-600">{t('search_across_inventory')}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
            <CardContent className="p-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <Input
                  placeholder={t('search_placeholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-14 text-lg bg-white"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-purple-600 w-5 h-5 animate-spin" />
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {results.length > 0 ? (
            <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl text-slate-700">
                  {t('search_results')} ({results.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {results.map((result, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-white"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-slate-50">
                          {getResultIcon(result.type)}
                        </div>
                        <div className="flex-1">
                          <Badge variant="outline" className="mb-2">{getResultTitle(result.type)}</Badge>
                          {renderResultDetails(result)}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : searchTerm.trim().length >= 2 && !isSearching ? (
            <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
              <CardContent className="p-12 text-center">
                <Search className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-600 mb-2">
                  {t('no_results_found')}
                </h3>
                <p className="text-slate-500">
                  {t('try_different_search')}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </motion.div>
      </div>

      {editingDevice && (
        <DeviceEditForm
          device={editingDevice}
          versions={versions}
          onClose={() => setEditingDevice(null)}
          onSaved={() => {
            setEditingDevice(null);
            reloadSearchResults();
          }}
        />
      )}
    </div>
  );
}