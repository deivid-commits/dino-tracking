
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Edit, Hash, Calendar, Package, Trash2, Wifi, Fingerprint } from "lucide-react"; // Added Fingerprint icon
import { Device } from "@/api/entities";

// Define status color classes
const statusColors = {
  "available": "bg-green-100 text-green-800 border-green-200",
  "sold": "bg-blue-100 text-blue-800 border-blue-200",
  "maintenance": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "damaged": "bg-red-100 text-red-800 border-red-200",
  "unverified": "bg-gray-100 text-gray-800 border-gray-200"
};

// Define color gradients for card headers based on dinosaur color
const colorGradients = {
  "red": "bg-gradient-to-r from-red-400 via-pink-400 to-rose-400",
  "blue": "bg-gradient-to-r from-blue-400 via-cyan-400 to-sky-400",
  "green": "bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400",
  "yellow": "bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400",
  "purple": "bg-gradient-to-r from-purple-400 via-fuchsia-400 to-violet-400",
  "black": "bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900",
  "white": "bg-gradient-to-r from-gray-100 via-gray-200 to-gray-300",
  "brown": "bg-gradient-to-r from-amber-800 via-yellow-800 to-orange-800",
  "default": "bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400" // Fallback gradient
};

// Define background colors for dinosaur icons based on dinosaur color
const colorBackgrounds = {
  "red": "bg-red-100",
  "blue": "bg-blue-100",
  "green": "bg-green-100",
  "yellow": "bg-yellow-100",
  "purple": "bg-purple-100",
  "black": "bg-gray-200",
  "white": "bg-slate-100",
  "brown": "bg-amber-100",
  "default": "bg-purple-100" // Fallback background
};

// Define icons for different dinosaur statuses
const statusIcons = {
  "available": <Wifi className="w-3 h-3" />,
  "sold": <Package className="w-3 h-3" />,
  "maintenance": <Edit className="w-3 h-3" />,
  "damaged": <Trash2 className="w-3 h-3" />,
  "unverified": <Sparkles className="w-3 h-3" />
};

export default function DinosaursList({ dinosaurs, versions = [], onEdit, onDelete }) {
  const [devicesMap, setDevicesMap] = useState({});

  useEffect(() => {
    loadDevices();
  }, [dinosaurs]);

  const loadDevices = async () => {
    const deviceIds = [...new Set(dinosaurs.map(d => d.device_id).filter(Boolean))];
    if (deviceIds.length === 0) return;

    try {
      const devices = await Device.list();
      const map = {};
      devices.forEach(device => {
        map[device.device_id] = device;
      });
      setDevicesMap(map);
    } catch (error) {
      console.error("Error loading devices:", error);
    }
  };

  if (!dinosaurs || dinosaurs.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
        <CardContent className="p-12 text-center">
          <Sparkles className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-600 mb-2">
            No dinosaurs registered
          </h3>
          <p className="text-slate-500">
            Start by registering your first dinosaur using the form above
          </p>
        </CardContent>
      </Card>
    );
  }

  const versionLookup = (versions || []).reduce((acc, version) => {
    if (version && version.id) {
      acc[version.id] = version;
    }
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {dinosaurs.map((dino, index) => { // Changed dinosaur to dino for iteration
        const version = versionLookup[dino.version_id];
        const device = devicesMap[dino.device_id];
        
        return (
          <motion.div
            key={dino.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }} // Changed transition delay
          >
            <Card className="bg-white/90 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 border-0 overflow-hidden"> {/* Updated background opacity */}
              <div className={`h-2 ${colorGradients[dino.color] || colorGradients.default}`} /> {/* Dynamic header color */}
              
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${colorBackgrounds[dino.color] || colorBackgrounds.default}`}> {/* Dynamic icon background */}
                      <span className="text-2xl">🦖</span> {/* Replaced Sparkles with emoji */}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">
                        {version?.model_name || "Unknown Version"}
                      </h3>
                      <p className="text-sm text-slate-500 capitalize">
                        {dino.color}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {onEdit && ( // Keep condition for onEdit
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent event bubbling if card is clickable
                          onEdit(dino);
                        }}
                        className="hover:bg-emerald-100 h-8 w-8" // Changed hover color
                      >
                        <Edit className="w-4 h-4 text-emerald-600" /> {/* Changed icon color */}
                      </Button>
                    )}
                    {onDelete && ( // Keep condition for onDelete
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent event bubbling if card is clickable
                          onDelete(dino);
                        }}
                        className="hover:bg-red-100 h-8 w-8"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge className={`${statusColors[dino.status]} border flex items-center gap-1`}> {/* Added flex, items-center, gap-1 */}
                    {statusIcons[dino.status]} {/* Added status icon */}
                    {dino.status.charAt(0).toUpperCase() + dino.status.slice(1)} {/* Capitalize status */}
                  </Badge>
                  {dino.sku_final && (
                    <Badge variant="outline" className="font-mono text-xs">
                      {dino.sku_final}
                    </Badge>
                  )}
                </div>

                <div className="space-y-3">
                  {dino.toy_id && (
                    <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50 p-2 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-semibold text-purple-700">Toy ID:</span>
                      </div>
                      <span className="text-sm font-mono font-bold text-purple-800 bg-white px-2 py-1 rounded">
                        {dino.toy_id}
                      </span>
                    </div>
                  )}

                  {/* RFID section with Fingerprint icon and truncation */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Fingerprint className="w-4 h-4 text-slate-400" /> {/* Changed Hash to Fingerprint */}
                      <span className="text-sm text-slate-600">RFID:</span>
                    </div>
                    <span className="text-xs font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded max-w-[180px] truncate">
                      {dino.rfid_code}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-600">Device:</span>
                    </div>
                    <span className="text-sm font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded">
                      {dino.device_id}
                    </span>
                  </div>

                  {device?.mac_address && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">MAC:</span>
                      </div>
                      <span className="text-xs font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded">
                        {device.mac_address}
                      </span>
                    </div>
                  )}

                  {dino.assembly_date && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">Assembled:</span>
                      </div>
                      <span className="text-sm text-slate-700">
                        {new Date(dino.assembly_date).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })}
                      </span>
                    </div>
                  )}

                  {dino.notes && (
                    <div className="pt-2 border-t border-slate-200">
                      <p className="text-xs text-slate-600 italic line-clamp-2">
                        {dino.notes}
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
  );
}
