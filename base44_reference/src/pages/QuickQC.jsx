import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Radio, CheckCircle, AlertTriangle, X, Save, Search, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QuickQCLog } from '@/api/entities';
import { useWarehouse } from '@/components/WarehouseProvider';
import { useLanguage } from '@/components/LanguageProvider';

export default function QuickQCPage() {
    const { t } = useLanguage();
    const { activeWarehouse } = useWarehouse();
    const [status, setStatus] = useState("Listo para iniciar");
    const [statusClass, setStatusClass] = useState("disconnected");
    const [logs, setLogs] = useState([]);
    const [currentScreen, setCurrentScreen] = useState("ready");
    const [deviceInfo, setDeviceInfo] = useState(null);
    const [testResults, setTestResults] = useState([]);
    const [progress, setProgress] = useState(0);
    const [currentTestName, setCurrentTestName] = useState("Preparando tests...");
    const [overallResult, setOverallResult] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [testStartTime, setTestStartTime] = useState(null);

    const bluetoothDevice = useRef(null);
    const logCharacteristic = useRef(null);
    const commandCharacteristic = useRef(null);
    const currentTestIndex = useRef(0);
    const testTimeoutRef = useRef(null);

    // ✅ CONSTANTES BLE
    const QA_SERVICE_UUID = 'a07498ca-ad5b-474e-940d-16f1fbe7e8cd';
    const QA_CONTROL_UUID = 'b30ac6b4-1b2d-4c2f-9c10-4b2a7b80f1a1';
    const QA_EVENTS_UUID = 'f29f4a3e-9a53-4d93-9b33-0a1cc4f0c8a2';

    const tests = [
        { name: "Test Audio", command: "qa_audio_play", payload: { file: 'boot.wav' }, timeout: 8000 },
        { name: "Test Mic Básico", command: "qa_mic_sensitivity_test", payload: { record_ms: 3000 }, timeout: 6000 },
        { name: "Test Mic L/R Balance", command: "qa_mic_lr_test", payload: { wait_ms: 2000, tone_ms: 2000, volume_percent: 95, freq_hz: 1000 }, timeout: 10000 },
        { name: "Test Batería", command: "qa_battery_test", payload: {}, timeout: 5000 },
        { name: "Ajuste Volumen", command: "qa_volume_set", payload: { percent: 80 }, timeout: 3000 }
    ];

    const addLog = useCallback((type, message, category = 'info', rawData = null, testName = null) => {
        const timestamp = new Date().toISOString();
        const timeDisplay = new Date().toLocaleTimeString('es-ES', { hour12: false });
        
        setLogs(prev => [...prev, { 
            timestamp,
            time_display: timeDisplay,
            log_type: type, 
            message, 
            category,
            raw_data: rawData,
            test_name: testName
        }]);
    }, []);

    const showScreen = (screen) => setCurrentScreen(screen);

    const disconnect = useCallback(() => {
        if (testTimeoutRef.current) {
            clearTimeout(testTimeoutRef.current);
            testTimeoutRef.current = null;
        }
        
        if (bluetoothDevice.current?.gatt?.connected) {
            addLog('info', '🔌 Desconectando del dispositivo...', 'connection');
            bluetoothDevice.current.gatt.disconnect();
        }
        
        bluetoothDevice.current = null;
        logCharacteristic.current = null;
        commandCharacteristic.current = null;
        
        setStatus("Desconectado");
        setStatusClass("disconnected");
        addLog('info', '✅ Desconexión completada', 'connection');
    }, [addLog]);

    const connectBluetooth = async () => {
        setIsConnecting(true);
        setTestStartTime(Date.now());
        setLogs([]);
        setTestResults([]);
        setProgress(0);
        
        addLog('info', '🔍 Iniciando búsqueda de dispositivo Bluetooth...', 'connection');
        
        try {
            if (!navigator.bluetooth) {
                throw new Error('Bluetooth no está disponible en este navegador');
            }

            addLog('info', '📡 Solicitando dispositivo Bluetooth...', 'connection');
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: [QA_SERVICE_UUID] }],
                optionalServices: [QA_SERVICE_UUID]
            });

            bluetoothDevice.current = device;
            addLog('success', `✅ Dispositivo encontrado: ${device.name || 'Sin nombre'}`, 'connection');
            addLog('bluetooth', `   ID: ${device.id}`, 'connection');
            
            setDeviceInfo({
                name: device.name || 'Sin nombre',
                id: device.id
            });

            setStatus("Conectando...");
            setStatusClass("connecting");
            addLog('info', '🔗 Conectando al servidor GATT...', 'connection');

            const connectionStart = Date.now();
            const server = await device.gatt.connect();
            const connectionTime = Date.now() - connectionStart;
            
            addLog('success', `✅ Conectado al servidor GATT (${connectionTime}ms)`, 'connection');
            setStatus("Conectado");
            setStatusClass("connected");

            addLog('info', `🔍 Buscando servicio: ${QA_SERVICE_UUID}`, 'connection');
            const service = await server.getPrimaryService(QA_SERVICE_UUID);
            addLog('success', `✅ Servicio encontrado`, 'connection');

            addLog('info', `🔍 Obteniendo características...`, 'connection');
            const [logChar, cmdChar] = await Promise.all([
                service.getCharacteristic(QA_EVENTS_UUID),
                service.getCharacteristic(QA_CONTROL_UUID)
            ]);

            logCharacteristic.current = logChar;
            commandCharacteristic.current = cmdChar;
            addLog('success', `✅ Características obtenidas`, 'connection');
            addLog('bluetooth', `   Log UUID: ${QA_EVENTS_UUID}`, 'connection');
            addLog('bluetooth', `   Command UUID: ${QA_CONTROL_UUID}`, 'connection');

            addLog('info', '🔔 Habilitando notificaciones...', 'connection');
            await logCharacteristic.current.startNotifications();
            
            logCharacteristic.current.addEventListener('characteristicvaluechanged', handleNotification);
            addLog('success', '✅ Notificaciones habilitadas', 'connection');

            setStatus("Listo para iniciar tests");
            setStatusClass("ready");
            showScreen("ready_to_test");
            addLog('success', '🎉 Sistema listo para ejecutar tests de QC', 'connection');

        } catch (error) {
            console.error("Error BLE:", error);
            addLog('error', `❌ Error de conexión: ${error.message}`, 'connection');
            setStatus("Error de conexión");
            setStatusClass("error");
            disconnect();
        }
        
        setIsConnecting(false);
    };

    const handleNotification = (event) => {
        const value = new TextDecoder().decode(event.target.value);
        addLog('response', `📥 Notificación recibida: ${value}`, 'bluetooth', value, currentTestName);
        
        const tests = testResults;
        if (tests[currentTestIndex.current]) {
            tests[currentTestIndex.current].status = 'pass';
            tests[currentTestIndex.current].response_received = value;
            tests[currentTestIndex.current].completed_at = new Date().toISOString();
            tests[currentTestIndex.current].duration_ms = Date.now() - tests[currentTestIndex.current].started_at_ms;
            
            setTestResults([...tests]);
            addLog('success', `✅ Test "${tests[currentTestIndex.current].test_name}" completado exitosamente`, 'test_execution', null, tests[currentTestIndex.current].test_name);
            
            if (testTimeoutRef.current) {
                clearTimeout(testTimeoutRef.current);
                testTimeoutRef.current = null;
            }
            
            currentTestIndex.current++;
            setTimeout(() => runNextTest(), 1000);
        }
    };

    const sendCommand = async (command, payload) => {
        const cmd = { command, ...payload };
        const jsonStr = JSON.stringify(cmd);
        
        addLog('command', `📤 Enviando comando: ${jsonStr}`, 'test_execution', jsonStr, currentTestName);
        
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(jsonStr);
            await commandCharacteristic.current.writeValue(data);
            addLog('success', `✅ Comando enviado correctamente`, 'test_execution', null, currentTestName);
        } catch (error) {
            addLog('error', `❌ Error enviando comando: ${error.message}`, 'test_execution', null, currentTestName);
            throw error;
        }
    };

    const runTests = async () => {
        showScreen("running");
        setProgress(0);
        setOverallResult(null);
        
        const initialTests = tests.map(t => ({
            test_name: t.name,
            status: 'running',
            started_at: new Date().toISOString(),
            started_at_ms: Date.now(),
            command_sent: JSON.stringify({ command: t.command, ...t.payload }),
            response_received: null,
            completed_at: null,
            duration_ms: 0,
            details: ''
        }));
        
        setTestResults(initialTests);
        addLog('info', `🚀 Iniciando secuencia de ${tests.length} tests...`, 'test_execution');
        
        currentTestIndex.current = 0;
        runNextTest();
    };

    const runNextTest = async () => {
        if (currentTestIndex.current >= tests.length) {
            addLog('success', '🎉 ¡Todos los tests completados!', 'test_execution');
            completeTests();
            return;
        }

        const test = tests[currentTestIndex.current];
        setCurrentTestName(test.name);
        setProgress(((currentTestIndex.current + 1) / tests.length) * 100);
        
        addLog('info', `▶️  Ejecutando: ${test.name}`, 'test_execution', null, test.name);
        
        try {
            await sendCommand(test.command, test.payload);
            
            testTimeoutRef.current = setTimeout(() => {
                addLog('warning', `⏱️  Timeout: ${test.name} no respondió a tiempo`, 'test_execution', null, test.name);
                
                const tests = testResults;
                if (tests[currentTestIndex.current]) {
                    tests[currentTestIndex.current].status = 'timeout';
                    tests[currentTestIndex.current].completed_at = new Date().toISOString();
                    tests[currentTestIndex.current].duration_ms = Date.now() - tests[currentTestIndex.current].started_at_ms;
                    tests[currentTestIndex.current].details = 'Timeout: No response received';
                    setTestResults([...tests]);
                }
                
                currentTestIndex.current++;
                setTimeout(() => runNextTest(), 500);
            }, test.timeout);
            
        } catch (error) {
            addLog('error', `❌ Error en test ${test.name}: ${error.message}`, 'test_execution', null, test.name);
            
            const tests = testResults;
            if (tests[currentTestIndex.current]) {
                tests[currentTestIndex.current].status = 'fail';
                tests[currentTestIndex.current].details = error.message;
                tests[currentTestIndex.current].completed_at = new Date().toISOString();
                tests[currentTestIndex.current].duration_ms = Date.now() - tests[currentTestIndex.current].started_at_ms;
                setTestResults([...tests]);
            }
            
            currentTestIndex.current++;
            setTimeout(() => runNextTest(), 500);
        }
    };

    const completeTests = () => {
        const passed = testResults.filter(t => t.status === 'pass').length;
        const failed = testResults.filter(t => t.status === 'fail' || t.status === 'timeout').length;
        
        const result = failed === 0 ? 'pass' : 'fail';
        setOverallResult(result);
        
        addLog(result === 'pass' ? 'success' : 'error', 
            `📊 Resultados finales: ${passed} passed, ${failed} failed`,
            'test_execution'
        );
        
        showScreen("results");
        setProgress(100);
    };

    const saveResults = async () => {
        if (!activeWarehouse) {
            alert('⚠️ No hay warehouse activo');
            return;
        }

        setIsSaving(true);
        addLog('info', '💾 Guardando resultados en base de datos...', 'system');

        try {
            const operator = JSON.parse(localStorage.getItem('dinotrack-operator') || '{}');
            const testDuration = Date.now() - testStartTime;

            const qcLogData = {
                test_date: new Date(testStartTime).toISOString(),
                operator: operator.name || 'Unknown',
                warehouse_id: activeWarehouse.id,
                bluetooth_device_info: deviceInfo,
                overall_result: overallResult,
                test_results: testResults,
                detailed_logs: logs,
                connection_info: {
                    service_uuid: QA_SERVICE_UUID,
                    log_characteristic_uuid: QA_EVENTS_UUID,
                    command_characteristic_uuid: QA_CONTROL_UUID,
                    notifications_enabled: true
                },
                test_duration_ms: testDuration,
                tests_passed: testResults.filter(t => t.status === 'pass').length,
                tests_failed: testResults.filter(t => t.status === 'fail' || t.status === 'timeout').length,
                tests_total: testResults.length
            };

            console.log('💾 Saving QuickQC Log:', qcLogData);
            await QuickQCLog.create(qcLogData);
            
            addLog('success', '✅ Resultados guardados exitosamente en la base de datos', 'system');
            alert('✅ Resultados guardados correctamente');
            
        } catch (error) {
            console.error('❌ Error saving QC results:', error);
            addLog('error', `❌ Error guardando resultados: ${error.message}`, 'system');
            alert('Error guardando resultados: ' + error.message);
        }

        setIsSaving(false);
    };

    const resetAndStartNew = () => {
        disconnect();
        setLogs([]);
        setTestResults([]);
        setDeviceInfo(null);
        setOverallResult(null);
        setProgress(0);
        setCurrentTestName("Preparando tests...");
        showScreen("ready");
    };

    const getLogColor = (type) => {
        const colors = {
            info: 'text-blue-600',
            success: 'text-green-600',
            error: 'text-red-600',
            warning: 'text-amber-600',
            command: 'text-purple-600',
            response: 'text-indigo-600',
            bluetooth: 'text-cyan-600'
        };
        return colors[type] || 'text-slate-600';
    };

    const getLogIcon = (type) => {
        const icons = {
            info: 'ℹ️',
            success: '✅',
            error: '❌',
            warning: '⚠️',
            command: '📤',
            response: '📥',
            bluetooth: '📡'
        };
        return icons[type] || '•';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
            <div className="max-w-7xl mx-auto">
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                        {t('quick_qc_station')}
                    </h1>
                    <p className="text-slate-600">{t('quick_qc_subtitle')}</p>
                    {activeWarehouse && (
                        <div className="mt-2 flex items-center gap-2 text-sm">
                            <span className="font-semibold text-blue-600">Warehouse:</span>
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                                {activeWarehouse.name}
                            </span>
                        </div>
                    )}
                </motion.div>

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Left Panel - Controls */}
                    <div>
                        <Card className="shadow-xl border-0">
                            <CardHeader className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
                                <CardTitle className="flex items-center gap-2">
                                    <Radio className="w-6 h-6" />
                                    Control Panel
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                {currentScreen === "ready" && (
                                    <>
                                        <div className="text-center py-8">
                                            <Radio className="w-16 h-16 mx-auto text-blue-600 mb-4" />
                                            <p className="text-slate-600 mb-6">
                                                {t('ensure_device_on_range')}
                                            </p>
                                        </div>
                                        <Button
                                            onClick={connectBluetooth}
                                            disabled={isConnecting}
                                            className="w-full h-14 text-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                                        >
                                            {isConnecting ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                    {t('searching_device')}
                                                </>
                                            ) : (
                                                <>
                                                    <Search className="w-5 h-5 mr-2" />
                                                    Buscar Dispositivo
                                                </>
                                            )}
                                        </Button>
                                    </>
                                )}

                                {currentScreen === "ready_to_test" && (
                                    <>
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                                            <div className="flex items-center gap-2 text-green-700 font-semibold mb-2">
                                                <CheckCircle className="w-5 h-5" />
                                                Dispositivo Conectado
                                            </div>
                                            <div className="text-sm text-slate-600 space-y-1">
                                                <div>Nombre: {deviceInfo?.name}</div>
                                                <div className="font-mono text-xs">ID: {deviceInfo?.id}</div>
                                            </div>
                                        </div>
                                        <Button
                                            onClick={runTests}
                                            className="w-full h-14 text-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                                        >
                                            <CheckCircle className="w-5 h-5 mr-2" />
                                            {t('start_qc_test')}
                                        </Button>
                                    </>
                                )}

                                {currentScreen === "running" && (
                                    <>
                                        <div className="space-y-4">
                                            <div className="text-center">
                                                <Loader2 className="w-12 h-12 mx-auto text-blue-600 animate-spin mb-4" />
                                                <h3 className="text-lg font-semibold text-slate-800">
                                                    {t('running_tests')}
                                                </h3>
                                                <p className="text-slate-600 mt-2">{currentTestName}</p>
                                            </div>

                                            <div>
                                                <div className="flex justify-between text-sm text-slate-600 mb-2">
                                                    <span>{t('test_progress')}</span>
                                                    <span>{Math.round(progress)}%</span>
                                                </div>
                                                <div className="w-full bg-slate-200 rounded-full h-3">
                                                    <div
                                                        className="bg-gradient-to-r from-blue-600 to-cyan-600 h-3 rounded-full transition-all duration-300"
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                {testResults.map((test, idx) => (
                                                    <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                                        {test.status === 'pass' && <CheckCircle className="w-5 h-5 text-green-600" />}
                                                        {test.status === 'fail' && <AlertTriangle className="w-5 h-5 text-red-600" />}
                                                        {test.status === 'timeout' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                                                        {test.status === 'running' && <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />}
                                                        <span className="flex-1 text-sm font-medium">{test.test_name}</span>
                                                        {test.duration_ms > 0 && (
                                                            <span className="text-xs text-slate-500">{test.duration_ms}ms</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {currentScreen === "results" && (
                                    <>
                                        <div className={`text-center py-6 rounded-xl ${overallResult === 'pass' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                            {overallResult === 'pass' ? (
                                                <>
                                                    <CheckCircle className="w-16 h-16 mx-auto text-green-600 mb-4" />
                                                    <h3 className="text-2xl font-bold text-green-700">
                                                        {t('device_approved')}
                                                    </h3>
                                                </>
                                            ) : (
                                                <>
                                                    <AlertTriangle className="w-16 h-16 mx-auto text-red-600 mb-4" />
                                                    <h3 className="text-2xl font-bold text-red-700">
                                                        {t('device_failed')}
                                                    </h3>
                                                </>
                                            )}
                                            <p className="text-slate-600 mt-2">
                                                {t('tests_passed', { 
                                                    passed: testResults.filter(t => t.status === 'pass').length,
                                                    total: testResults.length
                                                })}
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            {testResults.map((test, idx) => (
                                                <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                                                    <div className="flex items-center gap-3">
                                                        {test.status === 'pass' && <CheckCircle className="w-5 h-5 text-green-600" />}
                                                        {test.status === 'fail' && <AlertTriangle className="w-5 h-5 text-red-600" />}
                                                        {test.status === 'timeout' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                                                        <div className="flex-1">
                                                            <div className="font-medium text-sm">{test.test_name}</div>
                                                            {test.details && (
                                                                <div className="text-xs text-slate-500 mt-1">{test.details}</div>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-slate-500">{test.duration_ms}ms</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex gap-3">
                                            <Button
                                                onClick={saveResults}
                                                disabled={isSaving}
                                                className="flex-1 h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                                            >
                                                {isSaving ? (
                                                    <>
                                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                        Guardando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Save className="w-5 h-5 mr-2" />
                                                        Guardar Resultados
                                                    </>
                                                )}
                                            </Button>
                                            <Button
                                                onClick={resetAndStartNew}
                                                variant="outline"
                                                className="h-12"
                                            >
                                                {t('test_another_device')}
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Panel - Detailed Logs */}
                    <div>
                        <Card className="shadow-xl border-0 h-full">
                            <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 text-white">
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="w-6 h-6" />
                                    {t('event_log')} ({logs.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="h-[600px] overflow-y-auto bg-slate-900 text-white font-mono text-xs">
                                    {logs.length === 0 ? (
                                        <div className="flex items-center justify-center h-full text-slate-500">
                                            <div className="text-center">
                                                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                                <p>No hay logs aún</p>
                                                <p className="text-xs mt-2">Los logs aparecerán aquí durante el proceso de QC</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-4 space-y-1">
                                            {logs.map((log, idx) => (
                                                <motion.div
                                                    key={idx}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    className={`${
                                                        log.log_type === 'error' ? 'text-red-400' :
                                                        log.log_type === 'success' ? 'text-green-400' :
                                                        log.log_type === 'warning' ? 'text-amber-400' :
                                                        log.log_type === 'command' ? 'text-purple-400' :
                                                        log.log_type === 'response' ? 'text-cyan-400' :
                                                        log.log_type === 'bluetooth' ? 'text-blue-400' :
                                                        'text-slate-300'
                                                    }`}
                                                >
                                                    <span className="text-slate-500">[{log.time_display}]</span>
                                                    <span className="ml-2">{log.message}</span>
                                                    {log.raw_data && (
                                                        <div className="ml-4 text-slate-400 text-[10px] mt-0.5">
                                                            → {log.raw_data}
                                                        </div>
                                                    )}
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}