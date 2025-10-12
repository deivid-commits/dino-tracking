import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, CheckCircle, AlertTriangle, Loader2, Save, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QuickQCLog } from '@/api/entities';
import { useWarehouse } from '@/components/WarehouseProvider';

export default function DeviceQCModal({ onClose }) {
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
    const [connectionStartTime, setConnectionStartTime] = useState(null);
    const [connectionTime, setConnectionTime] = useState(null);

    const bluetoothDevice = useRef(null);
    const logCharacteristic = useRef(null);
    const commandCharacteristic = useRef(null);
    const currentTestIndex = useRef(0);
    const testTimeoutRef = useRef(null);
    const testStartTimeRef = useRef(null);

    // Constantes BLE
    const QA_SERVICE_UUID = 'a07498ca-ad5b-474e-940d-16f1fbe7e8cd';
    const QA_CONTROL_UUID = 'b30ac6b4-1b2d-4c2f-9c10-4b2a7b80f1a1';
    const QA_EVENTS_UUID = 'f29f4a3e-9a53-4d93-9b33-0a1cc4f0c8a2';

    const LOG_CHARACTERISTIC_UUID = QA_EVENTS_UUID;
    const COMMAND_CHARACTERISTIC_UUID = QA_CONTROL_UUID;

    const tests = [
        { name: "Test Audio", command: "qa_audio_play", payload: { file: 'boot.wav' }, timeout: 8000 },
        { name: "Test Mic Básico", command: "qa_mic_sensitivity_test", payload: { record_ms: 3000 }, timeout: 6000 },
        { name: "Test Mic L/R Balance", command: "qa_mic_lr_test", payload: { wait_ms: 2000, tone_ms: 2000, volume_percent: 95, freq_hz: 1000 }, timeout: 10000 },
        { name: "Test Batería", command: "qa_battery_test", payload: {}, timeout: 5000 },
        { name: "Ajuste Volumen", command: "qa_volume_set", payload: { percent: 80 }, timeout: 3000 }
    ];

    const addLog = useCallback((type, message, category = 'general', rawData = null, testName = null) => {
        const now = new Date();
        const logEntry = {
            timestamp: now.toISOString(),
            time_display: now.toLocaleTimeString(),
            log_type: type,
            category: category,
            message: message,
            raw_data: rawData,
            test_name: testName
        };
        
        console.log(`[${logEntry.time_display}] [${type.toUpperCase()}] [${category}] ${message}`);
        if (rawData) {
            console.log('  └─ Raw Data:', rawData);
        }
        
        setLogs(prev => [...prev, logEntry]);
    }, []);

    const showScreen = (screen) => setCurrentScreen(screen);

    const disconnect = useCallback(() => {
        if (testTimeoutRef.current) {
            clearTimeout(testTimeoutRef.current);
        }
        if (bluetoothDevice.current && bluetoothDevice.current.gatt.connected) {
            addLog('info', 'Desconectando del dispositivo ESP32...', 'connection');
            bluetoothDevice.current.gatt.disconnect();
            addLog('success', 'Dispositivo desconectado correctamente', 'connection');
        }
        bluetoothDevice.current = null;
        logCharacteristic.current = null;
        commandCharacteristic.current = null;
        setDeviceInfo(null);
        setStatus("Desconectado");
        setStatusClass("disconnected");
    }, [addLog]);

    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    const sendCommand = async (command, testName) => {
        if (!commandCharacteristic.current) {
            addLog('error', 'Característica de comando no disponible', 'command', null, testName);
            return false;
        }
        try {
            const encoder = new TextEncoder();
            const commandStr = typeof command === 'string' ? command : JSON.stringify(command);
            
            addLog('command', `Enviando comando para test: ${testName}`, 'command', commandStr, testName);
            addLog('info', `Payload del comando: ${commandStr}`, 'command', commandStr, testName);
            
            await commandCharacteristic.current.writeValue(encoder.encode(commandStr));
            
            addLog('success', `Comando enviado exitosamente al ESP32`, 'command', commandStr, testName);
            return true;
        } catch (error) {
            addLog('error', `Error al enviar comando: ${error.message}`, 'command', error.stack, testName);
            return false;
        }
    };

    const handleTestResult = (testName, status, details, responseData = null) => {
        if (testTimeoutRef.current) {
            clearTimeout(testTimeoutRef.current);
        }

        const testEndTime = Date.now();
        const duration = testStartTimeRef.current ? testEndTime - testStartTimeRef.current : 0;

        addLog(
            status === 'pass' ? 'success' : 'error', 
            `Test ${testName} completado: ${status.toUpperCase()} (${duration}ms)`,
            'test_result',
            responseData || details,
            testName
        );
        
        if (details) {
            addLog('info', `Detalles: ${details}`, 'test_result', details, testName);
        }
        
        setTestResults(prev => {
            const newResults = [...prev];
            const index = newResults.findIndex(r => r.test_name === testName);
            const resultData = {
                test_name: testName,
                status: status,
                started_at: testStartTimeRef.current ? new Date(testStartTimeRef.current).toISOString() : null,
                completed_at: new Date(testEndTime).toISOString(),
                duration_ms: duration,
                details: details,
                response_received: responseData
            };
            
            if (index !== -1) {
                newResults[index] = { ...newResults[index], ...resultData };
            } else {
                newResults.push(resultData);
            }
            return newResults;
        });

        const completedTests = currentTestIndex.current + 1;
        setProgress((completedTests / tests.length) * 100);

        setTimeout(() => {
            currentTestIndex.current++;
            runNextTest();
        }, 1000);
    };

    const handleNotifications = useCallback((event) => {
        const value = event.target.value;
        const decoder = new TextDecoder('utf-8');
        const message = decoder.decode(value);
        
        const currentTest = tests[currentTestIndex.current];
        const testName = currentTest?.name;
        
        addLog('response', `Notificación Bluetooth recibida`, 'bluetooth', message, testName);
        addLog('info', `Contenido de la respuesta: ${message}`, 'bluetooth', message, testName);

        try {
            const data = JSON.parse(message);
            addLog('success', `Respuesta parseada como JSON`, 'bluetooth', JSON.stringify(data, null, 2), testName);
            
            if (data.type === 'test_result') {
                addLog('info', `Resultado del test detectado: ${data.test} - ${data.status}`, 'test_result', JSON.stringify(data, null, 2), testName);
                handleTestResult(data.test, data.status, data.details, JSON.stringify(data, null, 2));
            } else {
                addLog('info', `Tipo de mensaje: ${data.type}`, 'bluetooth', JSON.stringify(data, null, 2), testName);
            }
        } catch (e) {
            addLog('warning', `La respuesta no es JSON válido, procesando como texto`, 'bluetooth', message, testName);
            
            if (message.includes('PASS') || message.includes('FAIL')) {
                if (testName) {
                    const status = message.includes('PASS') ? 'pass' : 'fail';
                    addLog('info', `Palabra clave detectada en respuesta: ${status.toUpperCase()}`, 'test_result', message, testName);
                    handleTestResult(testName, status, message, message);
                }
            } else {
                addLog('info', `Mensaje informativo recibido: ${message}`, 'bluetooth', message, testName);
            }
        }
    }, [addLog, tests]);

    const handleTestTimeout = () => {
        const testName = tests[currentTestIndex.current]?.name;
        const testEndTime = Date.now();
        const duration = testStartTimeRef.current ? testEndTime - testStartTimeRef.current : 0;
        
        addLog('error', `TIMEOUT: Test ${testName} excedió el tiempo máximo (${duration}ms)`, 'test_result', null, testName);
        addLog('error', `No se recibió respuesta del dispositivo ESP32`, 'test_result', null, testName);
        handleTestResult(testName, 'timeout', `Timeout - No se recibió respuesta después de ${duration}ms`, null);
    };

    const startNotifications = async () => {
        if (!logCharacteristic.current) {
            addLog('error', 'Característica de log no disponible para notificaciones', 'bluetooth');
            return;
        }
        try {
            addLog('info', 'Iniciando suscripción a notificaciones Bluetooth...', 'bluetooth', `UUID: ${LOG_CHARACTERISTIC_UUID}`);
            
            await logCharacteristic.current.startNotifications();
            logCharacteristic.current.addEventListener('characteristicvaluechanged', handleNotifications);
            
            addLog('success', 'Notificaciones Bluetooth activadas correctamente', 'bluetooth');
            addLog('info', 'Escuchando respuestas del dispositivo ESP32...', 'bluetooth');
        } catch (error) {
            addLog('error', `Error al iniciar notificaciones: ${error.message}`, 'bluetooth', error.stack);
        }
    };

    const connect = async () => {
        if (!navigator.bluetooth) {
            addLog('error', 'Web Bluetooth API no está disponible en este navegador', 'connection');
            addLog('error', 'Requiere Chrome/Edge y conexión HTTPS o localhost', 'connection');
            return false;
        }

        const connStart = Date.now();
        setConnectionStartTime(connStart);
        setIsConnecting(true);
        setStatus("Buscando dispositivos ESP32 QA...");
        setStatusClass("scanning");

        try {
            addLog('info', '═══════════════════════════════════════', 'connection');
            addLog('info', 'INICIANDO PROCESO DE CONEXIÓN BLUETOOTH', 'connection');
            addLog('info', '═══════════════════════════════════════', 'connection');
            addLog('info', `Servicio QA UUID: ${QA_SERVICE_UUID}`, 'connection', QA_SERVICE_UUID);
            addLog('info', 'Buscando dispositivos ESP32 con firmware QA...', 'connection');

            const device = await navigator.bluetooth.requestDevice({
                filters: [{
                    services: [QA_SERVICE_UUID]
                }],
                optionalServices: [QA_SERVICE_UUID]
            });

            bluetoothDevice.current = device;
            const devInfo = { 
                name: device.name || 'ESP32-QA', 
                id: device.id,
                service_uuid: QA_SERVICE_UUID
            };
            setDeviceInfo(devInfo);
            
            addLog('success', `✓ Dispositivo QA encontrado`, 'connection');
            addLog('info', `  • Nombre: ${devInfo.name}`, 'connection', device.name);
            addLog('info', `  • ID: ${devInfo.id}`, 'connection', device.id);
            addLog('info', `  • Servicio: ${QA_SERVICE_UUID}`, 'connection', QA_SERVICE_UUID);
            
            setStatus("Conectando al dispositivo QA...");

            device.addEventListener('gattserverdisconnected', () => {
                addLog('warning', 'Dispositivo desconectado inesperadamente', 'connection');
                disconnect();
            });

            addLog('info', 'Conectando al servidor GATT del ESP32...', 'connection');
            const server = await device.gatt.connect();
            addLog('success', '✓ Conexión GATT establecida', 'connection');

            addLog('info', `Obteniendo servicio primario QA...`, 'connection', QA_SERVICE_UUID);
            const qaService = await server.getPrimaryService(QA_SERVICE_UUID);
            addLog('success', '✓ Servicio QA obtenido', 'connection');

            addLog('info', 'Obteniendo características de comunicación...', 'connection');
            addLog('info', `  • Log Characteristic: ${LOG_CHARACTERISTIC_UUID}`, 'connection', LOG_CHARACTERISTIC_UUID);
            addLog('info', `  • Command Characteristic: ${COMMAND_CHARACTERISTIC_UUID}`, 'connection', COMMAND_CHARACTERISTIC_UUID);
            
            logCharacteristic.current = await qaService.getCharacteristic(LOG_CHARACTERISTIC_UUID);
            addLog('success', '✓ Característica de Log configurada', 'connection');
            
            commandCharacteristic.current = await qaService.getCharacteristic(COMMAND_CHARACTERISTIC_UUID);
            addLog('success', '✓ Característica de Comando configurada', 'connection');

            const connEnd = Date.now();
            const connDuration = connEnd - connStart;
            setConnectionTime(connDuration);

            setStatus("Conectado al dispositivo QA");
            setStatusClass("connected");
            
            addLog('success', '═══════════════════════════════════════', 'connection');
            addLog('success', `CONEXIÓN EXITOSA (${connDuration}ms)`, 'connection', `${connDuration}ms`);
            addLog('success', '═══════════════════════════════════════', 'connection');

            await startNotifications();
            return true;

        } catch (error) {
            let errorMessage = `Error de conexión: ${error.message}`;

            if (error.message.includes('User cancelled')) {
                errorMessage = 'Búsqueda cancelada por el usuario';
                addLog('warning', errorMessage, 'connection');
            } else if (error.message.includes('No device selected')) {
                errorMessage = 'No se seleccionó ningún dispositivo';
                addLog('warning', errorMessage, 'connection');
            } else if (error.message.includes('Bluetooth adapter not available')) {
                errorMessage = 'Adaptador Bluetooth no disponible';
                addLog('error', errorMessage, 'connection');
                addLog('error', 'Verifica que Bluetooth esté habilitado en tu sistema', 'connection');
            } else if (error.message.includes('Permission denied')) {
                errorMessage = 'Permisos de Bluetooth denegados';
                addLog('error', errorMessage, 'connection');
            } else if (error.message.includes('Service not found') || error.message.includes('Failed to read a characteristic')) {
                errorMessage = 'No se encontraron dispositivos con firmware QA válido';
                addLog('error', errorMessage, 'connection');
                addLog('error', 'Asegúrate de que el dispositivo esté encendido y dentro del rango', 'connection');
            } else {
                addLog('error', errorMessage, 'connection', error.stack);
            }

            disconnect();
            return false;
        } finally {
            setIsConnecting(false);
        }
    };

    const runNextTest = async () => {
        if (currentTestIndex.current >= tests.length) {
            finalizeTests();
            return;
        }

        const test = tests[currentTestIndex.current];
        testStartTimeRef.current = Date.now();
        
        setCurrentTestName(`Ejecutando: ${test.name}`);
        
        addLog('info', '───────────────────────────────────────', 'test_execution');
        addLog('info', `INICIANDO TEST: ${test.name}`, 'test_execution', null, test.name);
        addLog('info', `Comando: ${test.command}`, 'test_execution', test.command, test.name);
        addLog('info', `Payload: ${JSON.stringify(test.payload)}`, 'test_execution', JSON.stringify(test.payload, null, 2), test.name);
        addLog('info', `Timeout configurado: ${test.timeout}ms`, 'test_execution', `${test.timeout}ms`, test.name);

        setTestResults(prev => {
            const newResults = [...prev];
            const existingIndex = newResults.findIndex(r => r.test_name === test.name);
            const newTest = {
                test_name: test.name,
                status: 'running',
                started_at: new Date(testStartTimeRef.current).toISOString(),
                command_sent: JSON.stringify({ id: Date.now().toString(), type: test.command, payload: test.payload })
            };
            
            if (existingIndex === -1) {
                newResults.push(newTest);
            } else {
                newResults[existingIndex] = { ...newResults[existingIndex], ...newTest };
            }
            return newResults;
        });

        const commandData = {
            id: Date.now().toString(),
            type: test.command,
            payload: test.payload
        };

        const sent = await sendCommand(commandData, test.name);
        
        if (sent) {
            addLog('info', `Esperando respuesta del ESP32 (timeout: ${test.timeout}ms)...`, 'test_execution', null, test.name);
            testTimeoutRef.current = setTimeout(handleTestTimeout, test.timeout);
        } else {
            addLog('error', `Fallo al enviar comando para ${test.name}`, 'test_execution', null, test.name);
            handleTestResult(test.name, 'fail', 'Failed to send command', null);
        }
    };

    const finalizeTests = () => {
        const testEndTime = Date.now();
        const totalDuration = testStartTime ? testEndTime - testStartTime : 0;
        
        setCurrentTestName("Tests completados");
        
        const passedTests = testResults.filter(r => r.status === 'pass').length;
        const failedTests = testResults.filter(r => r.status === 'fail' || r.status === 'timeout').length;
        const totalTests = tests.length;
        const allPassed = passedTests === totalTests;
        
        setOverallResult(allPassed ? 'pass' : 'fail');
        
        addLog('info', '═══════════════════════════════════════', 'test_result');
        addLog(allPassed ? 'success' : 'error', 'TESTS FINALIZADOS', 'test_result');
        addLog('info', `Duración total: ${totalDuration}ms (${(totalDuration/1000).toFixed(2)}s)`, 'test_result', `${totalDuration}ms`);
        addLog('info', `Tests ejecutados: ${totalTests}`, 'test_result');
        addLog('success', `Tests aprobados: ${passedTests}`, 'test_result');
        if (failedTests > 0) {
            addLog('error', `Tests fallidos: ${failedTests}`, 'test_result');
        }
        addLog('info', `Resultado final: ${allPassed ? 'APROBADO ✓' : 'FALLIDO ✗'}`, 'test_result');
        addLog('info', '═══════════════════════════════════════', 'test_result');
        
        showScreen('results');
    };

    const saveResultsToDatabase = async () => {
        if (!activeWarehouse) {
            alert('⚠️ No hay warehouse activo. Por favor selecciona un warehouse.');
            return;
        }

        setIsSaving(true);
        try {
            const operator = JSON.parse(localStorage.getItem('dinotrack-operator') || '{}');
            const testEndTime = Date.now();
            const totalDuration = testStartTime ? testEndTime - testStartTime : 0;
            
            const passedTests = testResults.filter(r => r.status === 'pass').length;
            const failedTests = testResults.filter(r => r.status === 'fail' || r.status === 'timeout').length;
            
            addLog('info', '═══════════════════════════════════════', 'database');
            addLog('info', 'GUARDANDO RESULTADOS EN BASE DE DATOS', 'database');
            addLog('info', '═══════════════════════════════════════', 'database');

            const qcLogData = {
                test_date: new Date(testStartTime).toISOString(),
                operator: operator.name || 'Desconocido',
                warehouse_id: activeWarehouse.id,
                bluetooth_device_info: deviceInfo,
                overall_result: overallResult,
                test_results: testResults.map(r => ({
                    test_name: r.test_name,
                    status: r.status,
                    started_at: r.started_at,
                    completed_at: r.completed_at,
                    duration_ms: r.duration_ms,
                    details: r.details || '',
                    command_sent: r.command_sent || '',
                    response_received: r.response_received || ''
                })),
                detailed_logs: logs,
                connection_info: {
                    connection_time_ms: connectionTime,
                    service_uuid: QA_SERVICE_UUID,
                    log_characteristic_uuid: LOG_CHARACTERISTIC_UUID,
                    command_characteristic_uuid: COMMAND_CHARACTERISTIC_UUID,
                    notifications_enabled: true
                },
                test_duration_ms: totalDuration,
                tests_passed: passedTests,
                tests_failed: failedTests,
                tests_total: tests.length
            };

            addLog('info', `Total de logs a guardar: ${logs.length}`, 'database');
            addLog('info', `Tests: ${passedTests} aprobados, ${failedTests} fallidos`, 'database');
            addLog('info', `Warehouse: ${activeWarehouse.name}`, 'database');

            const savedLog = await QuickQCLog.create(qcLogData);

            addLog('success', `✓ Log guardado con ID: ${savedLog.id}`, 'database');
            addLog('success', '✓ Todos los logs detallados fueron guardados', 'database');
            addLog('success', '═══════════════════════════════════════', 'database');
            
            alert(`✅ Resultados guardados correctamente\n\nID del Log: ${savedLog.id}\nLogs guardados: ${logs.length}\nWarehouse: ${activeWarehouse.name}`);

        } catch (error) {
            console.error('Error guardando resultados:', error);
            addLog('error', `❌ Error guardando en base de datos: ${error.message}`, 'database', error.stack);
            alert(`❌ Error al guardar: ${error.message}`);
        }
        setIsSaving(false);
    };

    const startQA = async () => {
        resetState();
        setTestStartTime(Date.now());
        showScreen('progress');
        
        const connected = await connect();
        if (connected) {
            addLog('info', 'Iniciando secuencia de tests en 1 segundo...', 'test_execution');
            setTimeout(() => {
                currentTestIndex.current = 0;
                runNextTest();
            }, 1000);
        } else {
            showScreen('ready');
        }
    };

    const resetState = () => {
        setLogs([]);
        setTestResults([]);
        setProgress(0);
        setCurrentTestName("Preparando tests...");
        setOverallResult(null);
        setTestStartTime(null);
        setConnectionStartTime(null);
        setConnectionTime(null);
        currentTestIndex.current = 0;
        testStartTimeRef.current = null;
        if (testTimeoutRef.current) {
            clearTimeout(testTimeoutRef.current);
        }
    };

    const handleReset = () => {
        resetState();
        showScreen('ready');
        disconnect();
    };

    const renderScreen = () => {
        switch (currentScreen) {
            case 'ready':
                return (
                    <div className="section">
                        <div className="flex items-center gap-3 mb-4">
                            <Radio className="w-8 h-8 text-blue-600" />
                            <h2 className="text-2xl font-bold text-slate-800">Quick QC - Test Rápido ESP32</h2>
                        </div>
                        
                        <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
                            <p className="text-sm text-blue-900 font-medium mb-2">
                                ℹ️ Información del Test
                            </p>
                            <ul className="text-sm text-blue-800 space-y-1 ml-4">
                                <li>• Este test se ejecuta de forma independiente</li>
                                <li>• No requiere vincular a un Device ID específico</li>
                                <li>• Todos los logs se guardan automáticamente en la base de datos</li>
                                <li>• Solo se detectarán dispositivos ESP32 con firmware QA válido</li>
                            </ul>
                        </div>

                        <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg">
                            <p className="text-sm text-amber-900 font-medium mb-2">
                                ⚡ Preparación
                            </p>
                            <ul className="text-sm text-amber-800 space-y-1 ml-4">
                                <li>• Asegúrate de que el ESP32 esté encendido</li>
                                <li>• El dispositivo debe estar dentro del rango de Bluetooth</li>
                                <li>• El firmware QA debe estar cargado en el dispositivo</li>
                            </ul>
                        </div>

                        <Button 
                            onClick={startQA} 
                            disabled={isConnecting} 
                            className="success w-full h-14 text-lg font-semibold"
                        >
                           {isConnecting ? <Loader2 className="animate-spin mr-2 w-5 h-5"/> : '🔍'}
                           {isConnecting ? 'Buscando dispositivos ESP32...' : 'Iniciar Quick QC Test'}
                        </Button>

                        <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-600 text-center">
                                Los tests se ejecutarán automáticamente una vez conectado al dispositivo
                            </p>
                        </div>
                    </div>
                );
            case 'progress':
                return (
                    <div className="section">
                        <h2>⚙️ Ejecutando Tests Automáticos</h2>
                        {deviceInfo && (
                            <div className="device-info mb-4">
                                <p><strong>📱 Dispositivo:</strong> {deviceInfo.name}</p>
                                <p><strong>🆔 ID:</strong> {deviceInfo.id}</p>
                            </div>
                        )}
                        <div id="currentTest" className="text-lg font-semibold text-blue-600 mb-3">{currentTestName}</div>
                        <div className="progress-bar">
                            <div id="progressFill" className="progress-fill" style={{ width: `${progress}%` }}></div>
                        </div>
                        <div className="text-sm text-slate-600 mt-2">
                            Test {Math.min(currentTestIndex.current + 1, tests.length)} de {tests.length} • {Math.round(progress)}% completado
                        </div>
                    </div>
                );
            case 'results':
                return (
                    <div className="section">
                        <h2>📊 Resultados Finales de Quick QC</h2>
                        {deviceInfo && (
                            <div className="device-info mb-4">
                                <p><strong>📱 Dispositivo:</strong> {deviceInfo.name}</p>
                                <p><strong>🆔 ID:</strong> {deviceInfo.id}</p>
                            </div>
                        )}
                        {testResults.map((result, i) => (
                            <div key={i} className={`test-result ${result.status}`}>
                                <h4>
                                    {result.status === 'pass' ? (
                                        <CheckCircle className="text-green-500" />
                                    ) : result.status === 'fail' || result.status === 'timeout' ? (
                                        <AlertTriangle className="text-red-500" />
                                    ) : (
                                        <Loader2 className="animate-spin text-blue-500" />
                                    )}
                                    {result.test_name}
                                </h4>
                                {result.duration_ms && (
                                    <div className="text-xs text-slate-500 mt-1">
                                        Duración: {result.duration_ms}ms
                                    </div>
                                )}
                                {result.details && <div className="details">{result.details}</div>}
                            </div>
                        ))}
                        <div className="summary">
                            <h3>Resumen General</h3>
                            <p>
                                Tests completados: {testResults.filter(r => r.status !== 'running').length} de {tests.length}
                            </p>
                            <p>
                                Tests aprobados: {testResults.filter(r => r.status === 'pass').length}
                            </p>
                            <p>
                                Tests fallidos: {testResults.filter(r => r.status === 'fail' || r.status === 'timeout').length}
                            </p>
                            <p className="mt-3">
                                Estado Final: <span id="overallStatus" className={overallResult}>
                                    {overallResult === 'pass' ? '✓ APROBADO' : '✗ FALLIDO'}
                                </span>
                            </p>
                            <p className="text-sm text-slate-600 mt-2">
                                Total de logs capturados: {logs.length}
                            </p>
                            <div className="flex gap-3 mt-4">
                                <Button 
                                    onClick={saveResultsToDatabase} 
                                    disabled={isSaving}
                                    className="flex-1 bg-green-600 hover:bg-green-700 h-12 text-base font-semibold"
                                >
                                    {isSaving ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2"/>}
                                    {isSaving ? 'Guardando...' : 'Guardar en Base de Datos'}
                                </Button>
                                <Button onClick={handleReset} variant="outline" className="flex-1 h-12 text-base font-semibold">
                                    🔄 Probar Otro Dispositivo
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl bg-white p-0 max-h-[90vh] overflow-hidden flex flex-col">
                <style>{`
                    .container { background: white; border-radius: 10px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .status { text-align: center; font-size: 16px; font-weight: bold; padding: 10px; border-radius: 8px; margin: 10px 0; }
                    .status.disconnected { background: #ffebee; color: #c62828; }
                    .status.connected { background: #e8f5e9; color: #2e7d32; }
                    .status.scanning { background: #fff3e0; color: #ef6c00; }
                    button.success { background: #4CAF50; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; cursor: pointer; }
                    button.success:hover { background: #388E3C; }
                    button.success:disabled { background: #a5d6a7; cursor: not-allowed; }
                    .section { margin: 20px 0; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background: white; }
                    .section h2 { margin-top: 0; color: #555; border-bottom: 2px solid #2196F3; padding-bottom: 10px; }
                    #log { border: 1px solid #ddd; border-radius: 5px; height: 350px; overflow-y: auto; padding: 12px; background: #fafafa; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.6; }
                    .log-entry { margin: 6px 0; padding: 8px; border-radius: 4px; word-break: break-all; border-left: 3px solid transparent; }
                    .log-entry.error { background: #ffebee; color: #c62828; border-left-color: #c62828; }
                    .log-entry.success { background: #e8f5e9; color: #2e7d32; border-left-color: #2e7d32; }
                    .log-entry.info { background: #e3f2fd; color: #1565c0; border-left-color: #1565c0; }
                    .log-entry.warning { background: #fff3e0; color: #ef6c00; border-left-color: #ef6c00; }
                    .log-entry.command { background: #f3e5f5; color: #7b1fa2; border-left-color: #7b1fa2; font-weight: 600; }
                    .log-entry.response { background: #e0f2f1; color: #00695c; border-left-color: #00695c; }
                    .log-entry .log-time { font-weight: bold; margin-right: 8px; }
                    .log-entry .log-category { display: inline-block; background: rgba(0,0,0,0.1); padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-right: 6px; text-transform: uppercase; }
                    .device-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #2196F3; }
                    .progress-bar { width: 100%; height: 24px; background: #e0e0e0; border-radius: 12px; overflow: hidden; margin: 15px 0; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1); }
                    .progress-fill { height: 100%; background: linear-gradient(90deg, #4CAF50, #2196F3); width: 0%; transition: width 0.3s ease; }
                    .test-result { border: 2px solid #ddd; border-radius: 10px; padding: 16px; margin: 12px 0; }
                    .test-result.pass { border-color: #4CAF50; background: #e8f5e9; }
                    .test-result.fail, .test-result.timeout { border-color: #f44336; background: #ffebee; }
                    .test-result.running { border-color: #2196F3; background: #e3f2fd; }
                    .test-result h4 { margin: 0 0 10px 0; display: flex; align-items: center; gap: 10px; font-size: 16px; }
                    .test-result .details { font-size: 13px; color: #666; margin-top: 10px; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 4px; }
                    .summary { background: #f8f9fa; padding: 24px; border-radius: 10px; margin-top: 20px; border: 3px solid #2196F3; }
                    .summary h3 { margin-top: 0; color: #2196F3; font-size: 20px; }
                    .summary p { margin: 8px 0; font-size: 15px; }
                    #overallStatus.pass { color: #4CAF50; font-weight: bold; font-size: 18px; }
                    #overallStatus.fail { color: #f44336; font-weight: bold; font-size: 18px; }
                `}</style>
                <DialogHeader className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0 border-b">
                    <DialogTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Radio className="w-6 h-6 text-blue-600" />
                        Quick QC - Test Rápido ESP32
                    </DialogTitle>
                    <DialogDescription className="text-slate-600">
                        Sistema de control de calidad automático para dispositivos ESP32 con firmware QA
                    </DialogDescription>
                    <DialogClose asChild>
                        <Button variant="ghost" size="icon" className="absolute top-4 right-4 rounded-full h-8 w-8">
                            <X className="h-4 w-4" />
                        </Button>
                    </DialogClose>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6">
                    <div id="status" className={`status ${statusClass}`}>
                        <span className="font-semibold">Estado:</span> {status}
                    </div>

                    <AnimatePresence mode="wait">
                       <motion.div
                         key={currentScreen}
                         initial={{ opacity: 0, y: 20 }}
                         animate={{ opacity: 1, y: 0 }}
                         exit={{ opacity: 0, y: -20 }}
                         transition={{ duration: 0.2 }}
                       >
                         {renderScreen()}
                       </motion.div>
                    </AnimatePresence>

                    <div className="section">
                        <h2>📜 Log Detallado de Eventos ({logs.length} entradas)</h2>
                        <div id="log">
                            {logs.map((log, i) => (
                                <div key={i} className={`log-entry ${log.log_type}`}>
                                    <span className="log-time">[{log.time_display}]</span>
                                    <span className="log-category">{log.category}</span>
                                    {log.message}
                                    {log.raw_data && (
                                        <div className="mt-2 text-xs opacity-75 pl-4 border-l-2 border-current">
                                            <pre className="whitespace-pre-wrap">{log.raw_data}</pre>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {logs.length === 0 && (
                                <div className="text-center text-slate-400 py-12">
                                    <Radio className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p className="font-medium">No hay logs todavía</p>
                                    <p className="text-sm mt-1">Inicia un test para ver los logs aquí</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}