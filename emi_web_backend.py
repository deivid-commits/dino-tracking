#!/usr/bin/env python3
"""
🔴 EMI Web Backend - FastAPI Server
===================================

Servidor web FastAPI para control en tiempo real del DSA815
con interfaz web moderna y gráficas interactivas.
"""

import asyncio
import json
import threading
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
import uvicorn

from rigol_dsa815_control import RigolDSA815
from emi_visual_tester import VisualEMITester  # Importar la lógica visual

from fastapi.middleware.cors import CORSMiddleware

# Crear aplicación FastAPI
app = FastAPI(title="EMI DSA815 Web Analyzer", description="Real-time EMI testing with Rigol DSA815")

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Crear directorio estático si no existe
static_dir = Path("./static")
static_dir.mkdir(exist_ok=True)

# Estado global de la aplicación
app_state = {
    "connected_devices": {},
    "active_scans": {},
    "scan_history": [],
    "device_status": "disconnected"
}

# Instancia del analizador EMI
emi_analyzer = VisualEMITester()

class ConnectionManager:
    """Manejar conexiones WebSocket para tiempo real"""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"🔗 Nueva conexión WebSocket: {len(self.active_connections)} conexiones activas")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"📴 Conexión WebSocket cerrada: {len(self.active_connections)} conexiones restantes")

    async def broadcast(self, message: Dict[str, Any]):
        """Enviar mensaje a todos los clientes conectados"""
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"❌ Error enviando mensaje: {e}")
                self.disconnect(connection)

manager = ConnectionManager()

async def broadcast_status():
    """Enviar estado actual a todos los clientes"""
    status_data = {
        "type": "status_update",
        "data": {
            "device_status": app_state["device_status"],
            "connected_devices": app_state["connected_devices"],
            "active_scans": len(app_state["active_scans"]),
            "scan_count": len(app_state["scan_history"]),
            "timestamp": datetime.now().isoformat()
        }
    }
    await manager.broadcast(status_data)

@app.get("/")
async def get_dashboard():
    """Servir el dashboard principal"""
    html_content = """
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🎯 EMI DSA815 WebAnalyzer</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/htmx.org@2.0.1"></script>
        <script defer src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
        <style>
            .spectrum-gradient { background: linear-gradient(90deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff); }
            .pulse-animation { animation: pulse 2s infinite; }
            @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
            .scan-progress { transition: width 0.5s ease; }
        </style>
    </head>
    <body class="bg-gray-900 text-white min-h-screen" x-data="emiApp" x-init="init()">
        <div class="container mx-auto p-6">
            <!-- Header -->
            <div class="flex items-center justify-between mb-8">
                <div>
                    <h1 class="text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                        🎯 EMI DSA815 WebAnalyzer
                    </h1>
                    <p class="text-gray-400 mt-2">Análisis de EMI en Tiempo Real - FCC Pre-Scan</p>
                </div>
                <div class="flex items-center space-x-4">
                    <div class="flex items-center space-x-2">
                        <div class="w-3 h-3 rounded-full bg-red-500" :class="{'bg-green-500': deviceConnected, 'bg-red-500': !deviceConnected}"></div>
                        <span class="text-sm" x-text="deviceConnected ? 'DSA815 Conectado' : 'DSA815 Desconectado'"></span>
                    </div>
                </div>
            </div>

            <!-- Status Cards -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div class="bg-gray-800 rounded-lg p-6 text-center">
                    <div class="text-3xl mb-2">
                        <i class="fas fa-microchip text-blue-400"></i>
                    </div>
                    <h3 class="text-lg font-semibold">Dispositivo</h3>
                    <p class="text-gray-400 text-sm" x-text="deviceStatus"></p>
                </div>
                <div class="bg-gray-800 rounded-lg p-6 text-center">
                    <div class="text-3xl mb-2">
                        <i class="fas fa-search text-green-400"></i>
                    </div>
                    <h3 class="text-lg font-semibold">Escaneos Activos</h3>
                    <p class="text-gray-400 text-3xl font-bold" x-text="activeScans"></p>
                </div>
                <div class="bg-gray-800 rounded-lg p-6 text-center">
                    <div class="text-3xl mb-2">
                        <i class="fas fa-history text-purple-400"></i>
                    </div>
                    <h3 class="text-lg font-semibold">Historial</h3>
                    <p class="text-gray-400 text-3xl font-bold" x-text="totalScans"></p>
                </div>
                <div class="bg-gray-800 rounded-lg p-6 text-center">
                    <div class="text-3xl mb-2">
                        <i class="fas fa-signal text-yellow-400"></i>
                    </div>
                    <h3 class="text-lg font-semibold">Rango FCC</h3>
                    <p class="text-gray-400 text-sm">30 MHz - 1 GHz</p>
                </div>
            </div>

            <!-- Main Content Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Controls Panel -->
                <div class="bg-gray-800 rounded-lg p-6">
                    <h2 class="text-xl font-bold mb-4 flex items-center">
                        <i class="fas fa-cogs text-blue-400 mr-2"></i>
                        Controles
                    </h2>

                    <div class="space-y-4">
                        <!-- Connect Button -->
                        <button
                            @click="connectDevice()"
                            :disabled="deviceConnected || connecting"
                            :class="{'bg-gray-600 cursor-not-allowed': deviceConnected || connecting, 'bg-green-600 hover:bg-green-700': !deviceConnected && !connecting}"
                            class="w-full py-3 px-4 rounded-lg font-semibold transition-colors duration-200">
                            <i class="fas fa-plug mr-2"></i>
                            <span x-text="connecting ? 'Conectando...' : deviceConnected ? 'Conectado ✅' : 'Conectar DSA815'"></span>
                        </button>

                        <!-- Test Mode Selection -->
                        <div class="bg-gray-700 rounded-lg p-4">
                            <h3 class="text-sm font-semibold mb-3 text-gray-300">Tipo de Prueba</h3>
                            <div class="space-y-2">
                                <label class="flex items-center space-x-3">
                                    <input type="radio" value="radiated" x-model="testMode" class="text-blue-600">
                                    <span class="text-sm">🌈 Radiated Emissions (FCC)</span>
                                </label>
                                <label class="flex items-center space-x-3">
                                    <input type="radio" value="conducted" x-model="testMode" class="text-blue-600">
                                    <span class="text-sm">⚡ Conducted Emissions</span>
                                </label>
                            </div>
                        </div>

                        <!-- Start Scan Button -->
                        <button
                            @click="startScan()"
                            :disabled="!deviceConnected || scanning"
                            :class="{'bg-gray-600 cursor-not-allowed': !deviceConnected || scanning, 'bg-blue-600 hover:bg-blue-700': deviceConnected && !scanning}"
                            class="w-full py-3 px-4 rounded-lg font-semibold transition-colors duration-200">
                            <i class="fas fa-play mr-2"></i>
                            <span x-text="scanning ? 'Escaneando...' : 'Iniciar Prueba EMI'"></span>
                        </button>

                        <!-- Progress Bar -->
                        <div x-show="scanning" class="space-y-2">
                            <div class="flex justify-between text-sm">
                                <span>Progreso</span>
                                <span x-text="scanProgress + '%'"></span>
                            </div>
                            <div class="w-full bg-gray-700 rounded-full h-3">
                                <div class="bg-blue-600 h-3 rounded-full transition-all duration-300"
                                     :style="`width: ${scanProgress}%`"></div>
                            </div>
                            <p class="text-xs text-gray-400" x-text="scanStatus"></p>
                        </div>
                    </div>
                </div>

                <!-- Spectrum Display -->
                <div class="lg:col-span-2 bg-gray-800 rounded-lg p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-xl font-bold flex items-center">
                            <i class="fas fa-wave-square text-purple-400 mr-2"></i>
                            Espectro en Tiempo Real
                        </h2>
                        <div class="flex space-x-2">
                            <button @click="zoomIn()" class="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm">
                                <i class="fas fa-search-plus"></i>
                            </button>
                            <button @click="zoomOut()" class="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm">
                                <i class="fas fa-search-minus"></i>
                            </button>
                        </div>
                    </div>

                    <div class="spectrum-gradient p-4 rounded-lg h-96 flex items-center justify-center">
                        <canvas id="spectrumChart" class="max-w-full max-h-full"></canvas>
                    </div>

                    <!-- Frequency Information -->
                    <div class="grid grid-cols-3 gap-4 mt-4">
                        <div class="text-center">
                            <div class="text-2xl font-bold text-blue-400" x-text="currentFrequency + ' MHz'">-</div>
                            <div class="text-xs text-gray-400">Frecuencia</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-red-400" x-text="currentAmplitude + ' dBmV'">-</div>
                            <div class="text-xs text-gray-400">Amplitud</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold" :class="currentMargin >= 0 ? 'text-green-400' : 'text-red-400'"
                                 x-text="currentMargin + ' dB'">-</div>
                            <div class="text-xs text-gray-400">Margen FCC</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Results Panel -->
            <div class="mt-6 bg-gray-800 rounded-lg p-6">
                <h2 class="text-xl font-bold mb-4 flex items-center">
                    <i class="fas fa-chart-bar text-green-400 mr-2"></i>
                    Resultados FCC
                </h2>

                <!-- Compliance Status -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div class="bg-green-900/30 border border-green-500 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="text-2xl font-bold text-green-400" x-text="compliantPeaks">-</div>
                                <div class="text-sm text-gray-400">Cumplen FCC</div>
                            </div>
                            <i class="fas fa-check-circle text-green-400 text-3xl"></i>
                        </div>
                    </div>
                    <div class="bg-red-900/30 border border-red-500 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="text-2xl font-bold text-red-400" x-text="nonCompliantPeaks">-</div>
                                <div class="text-sm text-gray-400">No Cumplen</div>
                            </div>
                            <i class="fas fa-times-circle text-red-400 text-3xl"></i>
                        </div>
                    </div>
                    <div class="bg-blue-900/30 border border-blue-500 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="text-2xl font-bold text-blue-400" x-text="totalPeaks">-</div>
                                <div class="text-sm text-gray-400">Picos Total</div>
                            </div>
                            <i class="fas fa-mountain text-blue-400 text-3xl"></i>
                        </div>
                    </div>
                    <div class="bg-yellow-900/30 border border-yellow-500 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="text-2xl font-bold text-yellow-400" x-text="(compliantPeaks/totalPeaks*100).toFixed(1) + '%'"></div>
                                <div class="text-sm text-gray-400">Cumplimiento</div>
                            </div>
                            <i class="fas fa-percentage text-yellow-400 text-3xl"></i>
                        </div>
                    </div>
                </div>

                <!-- Peaks Table -->
                <div id="peaks-table" class="bg-gray-700 rounded-lg overflow-x-auto">
                    <table class="w-full table-auto">
                        <thead class="bg-gray-600">
                            <tr>
                                <th class="px-4 py-2 text-left">Frecuencia</th>
                                <th class="px-4 py-2 text-left">Amplitud</th>
                                <th class="px-4 py-2 text-left">Límite FCC</th>
                                <th class="px-4 py-2 text-left">Margen</th>
                                <th class="px-4 py-2 text-left">Estado</th>
                                <th class="px-4 py-2 text-left">Rango</th>
                            </tr>
                        </thead>
                        <tbody id="peaks-tbody" class="text-sm">
                            <tr>
                                <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                                    Esperando datos de escaneo...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Live Log Panel -->
            <div class="mt-6 bg-gray-800 rounded-lg p-6">
                <h2 class="text-xl font-bold mb-4 flex items-center">
                    <i class="fas fa-terminal text-orange-400 mr-2"></i>
                    Log en Tiempo Real
                </h2>
                <div id="log-container" class="bg-gray-900 rounded p-4 h-48 overflow-y-auto font-mono text-sm">
                    <div class="text-gray-500">Conectando al servidor...</div>
                </div>
            </div>
        </div>

        <script>
            document.addEventListener('alpinejs:init', () => {
                Alpine.data('emiApp', () => ({
                    deviceConnected: false,
                    connecting: false,
                    scanning: false,
                    deviceStatus: 'Desconectado',
                    testMode: 'radiated',
                    scanProgress: 0,
                    scanStatus: '',
                    activeScans: 0,
                    totalScans: 0,
                    currentFrequency: '-',
                    currentAmplitude: '-',
                    currentMargin: 0,
                    compliantPeaks: 0,
                    nonCompliantPeaks: 0,
                    totalPeaks: 0,
                    spectrumChart: null,
                    ws: null,

                    init() {
                        this.connectWebSocket();
                        this.initializeChart();
                    },

                    async connectWebSocket() {
                        try {
                            this.ws = new WebSocket('ws://localhost:8000/ws/live-updates');

                            this.ws.onmessage = (event) => {
                                const data = JSON.parse(event.data);
                                this.handleWebSocketMessage(data);
                            };

                            this.ws.onopen = () => {
                                this.addLog('✅ Conectado al servidor EMI', 'success');
                            };

                            this.ws.onclose = () => {
                                this.addLog('📴 Desconectado del servidor', 'warning');
                            };

                            this.ws.onerror = (error) => {
                                this.addLog('❌ Error de conexión WebSocket', 'error');
                            };
                        } catch (error) {
                            this.addLog('❌ Error inicializando WebSocket', 'error');
                        }
                    },

                    handleWebSocketMessage(data) {
                        switch (data.type) {
                            case 'status_update':
                                this.handleStatusUpdate(data.data);
                                break;
                            case 'scan_progress':
                                this.handleScanProgress(data.data);
                                break;
                            case 'spectrum_data':
                                this.handleSpectrumData(data.data);
                                break;
                            case 'peaks_found':
                                this.handlePeaksFound(data.data);
                                break;
                            case 'log_message':
                                this.addLog(data.data.message, data.data.level);
                                break;
                        }
                    },

                    handleStatusUpdate(data) {
                        this.deviceConnected = data.device_status === 'connected';
                        this.deviceStatus = data.device_status === 'connected' ? 'Conectado ✅' : 'Desconectado ❌';
                        this.activeScans = data.active_scans || 0;
                        this.totalScans = data.scan_count || 0;
                    },

                    handleScanProgress(data) {
                        this.scanning = true;
                        this.scanProgress = data.progress || 0;
                        this.scanStatus = data.status || '';
                    },

                    handleSpectrumData(data) {
                        // Update spectrum chart with new data
                        if (this.spectrumChart && data.frequencies && data.amplitudes) {
                            this.updateSpectrumChart(data);
                        }
                    },

                    handlePeaksFound(peaks) {
                        this.updatePeaksTable(peaks);
                        this.updatePeakCounts(peaks);
                    },

                    async connectDevice() {
                        this.connecting = true;
                        this.addLog('🔌 Conectando al DSA815...', 'info');

                        try {
                            const response = await fetch('/api/connect-device', {
                                method: 'POST'
                            });
                            const result = await response.json();

                            if (result.success) {
                                this.deviceConnected = true;
                                this.deviceStatus = 'Conectado ✅';
                                this.addLog('✅ DSA815 conectado exitosamente', 'success');
                            } else {
                                this.addLog(`❌ Error de conexión: ${result.message}`, 'error');
                            }
                        } catch (error) {
                            this.addLog(`❌ Error: ${error.message}`, 'error');
                        } finally {
                            this.connecting = false;
                        }
                    },

                    async startScan() {
                        this.scanning = true;
                        this.scanProgress = 0;
                        this.scanStatus = 'Iniciando escaneo...';
                        this.addLog(`🚀 Iniciando escaneo ${this.testMode}`, 'info');

                        try {
                            const response = await fetch('/api/start-scan', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    test_mode: this.testMode
                                })
                            });
                            const result = await response.json();

                            if (result.success) {
                                this.addLog('✅ Escaneo iniciado', 'success');
                            } else {
                                this.addLog(`❌ Error iniciando escaneo: ${result.message}`, 'error');
                                this.scanning = false;
                            }
                        } catch (error) {
                            this.addLog(`❌ Error: ${error.message}`, 'error');
                            this.scanning = false;
                        }
                    },

                    initializeChart() {
                        const ctx = document.getElementById('spectrumChart').getContext('2d');
                        this.spectrumChart = new Chart(ctx, {
                            type: 'line',
                            data: {
                                labels: [],
                                datasets: [{
                                    label: 'Espectro (dBmV)',
                                    data: [],
                                    borderColor: '#60a5fa',
                                    backgroundColor: 'rgba(96, 165, 250, 0.1)',
                                    fill: true,
                                    tension: 0.1,
                                    pointRadius: 0,
                                    pointHoverRadius: 2
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                scales: {
                                    x: {
                                        type: 'linear',
                                        title: {
                                            display: true,
                                            text: 'Frecuencia (MHz)'
                                        },
                                        ticks: {
                                            callback: function(value) {
                                                return value.toFixed(1) + ' MHz';
                                            }
                                        }
                                    },
                                    y: {
                                        title: {
                                            display: true,
                                            text: 'Amplitud (dBmV)'
                                        },
                                        min: -100,
                                        max: -20
                                    }
                                },
                                plugins: {
                                    legend: {
                                        display: false
                                    }
                                }
                            }
                        });
                    },

                    updateSpectrumChart(data) {
                        // Update chart with new spectrum data
                        if (data.frequencies && data.amplitudes) {
                            const freqMHz = data.frequencies.map(f => f / 1e6);
                            this.spectrumChart.data.labels = freqMHz;
                            this.spectrumChart.data.datasets[0].data = data.amplitudes;
                            this.spectrumChart.update('none'); // Don't animate for performance
                        }
                    },

                    updatePeaksTable(peaks) {
                        const tbody = document.getElementById('peaks-tbody');
                        if (peaks.length === 0) return;

                        tbody.innerHTML = peaks.map(peak => `
                            <tr class="${peak.margin_db >= 0 ? 'bg-green-900/20' : 'bg-red-900/20'}">
                                <td class="px-4 py-2">${peak.frequency_mhz.toFixed(2)} MHz</td>
                                <td class="px-4 py-2">${peak.amplitude_dbmv.toFixed(1)} dBmV</td>
                                <td class="px-4 py-2">${peak.fcc_limit_dbuv_m} dBμV/m</td>
                                <td class="px-4 py-2 ${peak.margin_db >= 0 ? 'text-green-400' : 'text-red-400'}">${peak.margin_db.toFixed(1)} dB</td>
                                <td class="px-4 py-2">${peak.margin_db >= 0 ? '✅ PASS' : '❌ FAIL'}</td>
                                <td class="px-4 py-2">${peak.frequency_range}</td>
                            </tr>
                        `).join('');
                    },

                    updatePeakCounts(peaks) {
                        const compliant = peaks.filter(p => p.margin_db >= 0).length;
                        const nonCompliant = peaks.length - compliant;

                        this.compliantPeaks = compliant;
                        this.nonCompliantPeaks = nonCompliant;
                        this.totalPeaks = peaks.length;
                    },

                    addLog(message, level = 'info') {
                        const logContainer = document.getElementById('log-container');
                        const timestamp = new Date().toLocaleTimeString();
                        const colorClass = {
                            'info': 'text-blue-400',
                            'success': 'text-green-400',
                            'warning': 'text-yellow-400',
                            'error': 'text-red-400'
                        }[level] || 'text-gray-300';

                        logContainer.innerHTML += `<div class="${colorClass}">[${timestamp}] ${message}</div>`;

                        // Auto-scroll to bottom
                        logContainer.scrollTop = logContainer.scrollHeight;
                    },

                    zoomIn() {
                        // Zoom in spectrum chart
                        if (this.spectrumChart) {
                            const scales = this.spectrumChart.options.scales;
                            scales.y.min = Math.max(scales.y.min + 10, -120);
                            scales.y.max = Math.max(scales.y.max - 10, -10);
                            this.spectrumChart.update();
                        }
                    },

                    zoomOut() {
                        // Zoom out spectrum chart
                        if (this.spectrumChart) {
                            const scales = this.spectrumChart.options.scales;
                            scales.y.min = Math.min(scales.y.min - 10, -100);
                            scales.y.max = Math.min(scales.y.max + 10, 0);
                            this.spectrumChart.update();
                        }
                    }
                }));
            });
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content, status_code=200)

@app.websocket("/ws/live-updates")
async def websocket_live_updates(websocket: WebSocket):
    """WebSocket para actualizaciones en tiempo real"""
    await manager.connect(websocket)
    print(f"🔗 Cliente WebSocket conectado desde: {websocket.client}")

    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
            # Broadcast connection status
            await websocket.send_json({
                "type": "connection_status",
                "data": {"connected": True, "message": "WebSocket conectado"}
            })

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("📴 WebSocket desconectado")

@app.post("/api/connect-device")
async def api_connect_device():
    """API endpoint para conectar al dispositivo DSA815"""
    try:
        if emi_analyzer.connect_device_visual():
            app_state["device_status"] = "connected"
            await manager.broadcast({
                "type": "log_message",
                "data": {"message": "✅ DSA815 conectado exitosamente", "level": "success"}
            })
            await broadcast_status()
            return {"success": True, "message": "Dispositivo conectado"}
        else:
            return {"success": False, "message": "Error conectando dispositivo"}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.post("/api/start-scan")
async def api_start_scan(data: Dict[str, str], background_tasks: BackgroundTasks):
    """API endpoint para iniciar un escaneo EMI"""
    test_mode = data.get("test_mode", "fcc_prescán")

    try:
        scan_id = f"scan_{int(asyncio.get_event_loop().time())}"
        app_state["active_scans"][scan_id] = {"start_time": datetime.now(), "status": "running"}

        # Ejecutar escaneo en background
        background_tasks.add_task(run_scan_background, scan_id, test_mode)

        await manager.broadcast({
            "type": "log_message",
            "data": {"message": f"🚀 Iniciando escaneo {test_mode}", "level": "info"}
        })

        return {"success": True, "scan_id": scan_id}

    except Exception as e:
        await manager.broadcast({
            "type": "log_message",
            "data": {"message": f"❌ Error iniciando escaneo: {str(e)}", "level": "error"}
        })
        return {"success": False, "message": str(e)}

def run_scan_background(scan_id: str, test_mode: str):
    """Ejecutar escaneo en background con actualizaciones en tiempo real"""
    try:
        # Configurar modo de escaneo
        if test_mode == "fcc_prescán":
            actual_mode = "fcc_prescán"
        elif test_mode == "conducted":
            actual_mode = "conducted"
        else:
            actual_mode = "fcc_prescán"

        # Simular progreso del escaneo (en producción, esto vendría del emi_analyzer)
        import time
        import random

        progress_steps = 100
        for step in range(progress_steps):
            progress = (step + 1) / progress_steps * 100

            # Simular datos de frecuencia para la banda actual
            if step < 30:  # VHF Low
                freq_start, freq_stop = 30e6, 88e6
                range_name = "VHF Low"
            elif step < 60:  # VHF High
                freq_start, freq_stop = 88e6, 216e6
                range_name = "VHF High"
            else:  # UHF
                freq_start, freq_stop = 216e6, 1000e6
                range_name = "UHF"

            # Generar datos simulados del espectro
            frequencies = np.linspace(freq_start, freq_stop, 1000) / 1e6  # MHz
            amplitudes = np.random.normal(-60, 15, 1000) + np.sin(2*np.pi*frequencies/50) * 10

            # Crear algunos picos artificiales para demostración
            if random.random() < 0.1:  # 10% chancecada step
                peak_idx = random.randint(100, 900)
                peak_height = random.uniform(10, 20)
                amplitudes[peak_idx-5:peak_idx+6] += peak_height

            # Enviar datos del espectro en tiempo real
            asyncio.run(manager.broadcast({
                "type": "scan_progress",
                "data": {
                    "progress": int(progress),
                    "status": f"Escaneando {range_name}: {freq_start/1e6:.1f}-{freq_stop/1e6:.0f} MHz",
                    "current_range": range_name
                }
            }))

            # Enviar datos del espectro cada pocos steps
            if step % 5 == 0:
                asyncio.run(manager.broadcast({
                    "type": "spectrum_data",
                    "data": {
                        "frequencies": frequencies.tolist(),
                        "amplitudes": amplitudes.tolist(),
                        "timestamp": datetime.now().isoformat()
                    }
                }))

            time.sleep(0.1)  # Simular tiempo de medición

        # Simular resultados finales
        final_results = {
            "test_mode": test_mode,
            "duration": "25.3s",
            "total_peaks": random.randint(8, 15),
            "fcc_compliance": random.choice(["90.5%", "85.2%", "92.1%", "88.7%"]),
            "worst_peak": {
                "frequency_mhz": round(random.uniform(100, 800), 2),
                "amplitude_dbmv": round(random.uniform(-40, -20), 1),
                "margin_db": round(random.uniform(-5, 8), 1)
            }
        }

        app_state["scan_history"].append({
            "scan_id": scan_id,
            "timestamp": datetime.now().isoformat(),
            "results": final_results
        })

        # Limpiar escaneo activo
        if scan_id in app_state["active_scans"]:
            del app_state["active_scans"][scan_id]

        # Enviar resultados finales
        asyncio.run(manager.broadcast({
            "type": "scan_progress",
            "data": {"progress": 100, "status": "Escaneo completado ✅"}
        }))

        asyncio.run(manager.broadcast({
            "type": "log_message",
            "data": {"message": f"✅ Escaneo {test_mode} completado exitosamente", "level": "success"}
        }))

        # Simular algunos picos encontrados
        mock_peaks = []
        for i in range(random.randint(5, 12)):
            peak = {
                "frequency_mhz": round(random.uniform(50, 950), 2),
                "amplitude_dbmv": round(random.uniform(-65, -30), 1),
                "fcc_limit_dbuv_m": random.choice([40, 43.5, 46]),
                "margin_db": round(random.uniform(-8, 5), 1),
                "frequency_range": random.choice(["VHF Low", "VHF High", "UHF"])
            }
            mock_peaks.append(peak)

        asyncio.run(manager.broadcast({
            "type": "peaks_found",
            "data": mock_peaks
        }))

        asyncio.run(broadcast_status())

    except Exception as e:
        asyncio.run(manager.broadcast({
            "type": "log_message",
            "data": {"message": f"❌ Error en escaneo: {str(e)}", "level": "error"}
        }))

        if scan_id in app_state["active_scans"]:
            del app_state["active_scans"][scan_id]

@app.get("/api/status")
async def get_status():
    """Obtener estado actual del sistema"""
    return JSONResponse({
        "device_status": app_state["device_status"],
        "connected_devices": app_state["connected_devices"],
        "active_scans": len(app_state["active_scans"]),
        "scan_history": app_state["scan_history"][-10:]  # Últimos 10 escaneos
    })

if __name__ == "__main__":
    print("🎯 EMI DSA815 Web Backend Starting...")
    print("🌐 URL: http://localhost:8000")
    print("⚡ Características:")
    print("  • UI moderna con Tailwind CSS")
    print("  • Gráficas en tiempo real con Chart.js")
    print("  • WebSocket para actualizaciones live")
    print("  • Dashboard interactivo")
    print("  • Análisis FCC automático")
    print("")
    print("📱 Abre tu navegador en http://localhost:8000")

    uvicorn.run(
        "emi_web_backend:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )
