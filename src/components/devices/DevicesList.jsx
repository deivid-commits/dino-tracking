import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cpu, Edit, Hash, Calendar, CheckCircle, Clock, AlertTriangle, Trash2, ClipboardList, User } from "lucide-react";
import { Device } from "@/api/entities";
import { useLanguage } from "@/components/LanguageProvider";
import DeviceEditForm from "./DeviceEditForm";
import DeviceDetails from "./DeviceDetails";

const statusColors = {
  "ready": "bg-green-100 text-green-800 border-green-200",
  "used": "bg-blue-100 text-blue-800 border-blue-200",
  "defective": "bg-red-100 text-red-800 border-red-200"
};

const statusIcons = {
  "ready": <CheckCircle className="w-4 h-4 text-green-600" />,
  "used": <Clock className="w-4 h-4 text-blue-600" />,
  "defective": <AlertTriangle className="w-4 h-4 text-red-600" />
};

export default function DevicesList({ devices, versions = [], onDeviceUpdated }) {
  const { t } = useLanguage();
  const [editingDevice, setEditingDevice] = useState(null);
  const [viewingDevice, setViewingDevice] = useState(null);

  const handleDelete = async (device) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar el dispositivo ${device.device_id}?`)) {
      return;
    }

    try {
      await Device.delete(device.id);
      if (onDeviceUpdated) {
        onDeviceUpdated();
      }
    } catch (error) {
      console.error('Error deleting device:', error);
      alert('Error eliminando dispositivo: ' + error.message);
    }
  };

  if (!devices || devices.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
        <CardContent className="p-12 text-center">
          <Cpu className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-600 mb-2">
            {t('no_devices_found')}
          </h3>
          <p className="text-slate-500">
            {t('devices_will_appear')}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Create a lookup map for versions with safety check
  const versionLookup = (versions || []).reduce((acc, version) => {
    if (version && version.id) {
      acc[version.id] = version;
    }
    return acc;
  }, {});

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.map((device, index) => {
          const version = versionLookup[device.version_id];
          
          return (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className="bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 border-0 overflow-hidden cursor-pointer"
                onClick={() => setViewingDevice(device)}
              >
                <div className="h-1 bg-gradient-to-r from-purple-400 to-indigo-600" />
                
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-100">
                        <Cpu className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-lg">
                          {version?.model_name || "Unknown Version"}
                        </h3>
                        <p className="text-sm text-slate-500">
                          Device: {device.device_id}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setEditingDevice(device); 
                        }}
                        className="hover:bg-purple-100 h-8 w-8"
                      >
                        <Edit className="w-4 h-4 text-purple-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          handleDelete(device); 
                        }}
                        className="hover:bg-red-100 h-8 w-8"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge className={`${statusColors[device.status]} border flex items-center gap-1`}>
                      {statusIcons[device.status]}
                      {t(device.status)}
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <ClipboardList className="w-3 h-3" />
                      {device.components_used?.length || 0} {t('components')}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">Device ID:</span>
                      </div>
                      <span className="text-sm font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded">
                        {device.device_id}
                      </span>
                    </div>

                    {device.assembly_date && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-600">{t('assembled')}:</span>
                        </div>
                        <span className="text-sm text-slate-700">
                          {new Date(device.assembly_date).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })}
                        </span>
                      </div>
                    )}

                    {device.assembled_by_operator && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-600">By:</span>
                        </div>
                        <span className="text-sm text-slate-700 font-medium">
                          {device.assembled_by_operator}
                        </span>
                      </div>
                    )}

                    {device.notes && (
                      <div className="pt-2 border-t border-slate-200">
                        <p className="text-xs text-slate-600 italic line-clamp-2">
                          {device.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {editingDevice && (
        <DeviceEditForm
          device={editingDevice}
          versions={versions}
          onClose={() => setEditingDevice(null)}
          onSaved={() => {
            if (onDeviceUpdated) {
              onDeviceUpdated();
            }
            setEditingDevice(null);
          }}
        />
      )}

      {viewingDevice && (
        <DeviceDetails
          device={viewingDevice}
          versions={versions}
          onClose={() => setViewingDevice(null)}
          onEdit={(device) => {
            setViewingDevice(null);
            setEditingDevice(device);
          }}
        />
      )}
    </>
  );
}