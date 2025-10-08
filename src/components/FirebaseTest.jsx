/**
 * Firebase Test Component
 * Componente para probar la conectividad con Firebase
 * y ejecutar inicialización de datos base
 */

import React, { useState, useEffect } from 'react';
import { testFirebaseConnection, initializeBaseData } from '../firebase/initializeData';
import { Button } from './ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card.jsx';
import { Alert, AlertDescription } from './ui/alert.jsx';
import { Loader2, CheckCircle, XCircle, Database } from 'lucide-react';

const FirebaseTest = () => {
  const [isTesting, setIsTesting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [initResult, setInitResult] = useState(null);
  const [error, setError] = useState(null);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const result = await testFirebaseConnection();
      setTestResult({
        success: true,
        message: '¡Conexión a Firebase exitosa! Se creó y leyó un documento de prueba.'
      });
    } catch (err) {
      setError(err.message);
      setTestResult({
        success: false,
        message: `Error en la conexión: ${err.message}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleInitializeData = async () => {
    setIsInitializing(true);
    setError(null);
    setInitResult(null);

    try {
      const result = await initializeBaseData();
      setInitResult({
        success: true,
        message: '¡Datos base inicializados correctamente! Se creó el warehouse BASE.'
      });
    } catch (err) {
      setError(err.message);
      setInitResult({
        success: false,
        message: `Error en inicialización: ${err.message}`
      });
    } finally {
      setIsInitializing(false);
    }
  };

  const isFirebaseConfigured = () => {
    return !!(
      import.meta.env.VITE_FIREBASE_API_KEY &&
      import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      import.meta.env.VITE_FIREBASE_APP_ID
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Configuración Firebase - FASE 1
          </CardTitle>
          <CardDescription>
            Prueba de conectividad con Firebase y inicialización de datos base
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Estado de configuración */}
          <div className="flex items-center gap-3">
            {isFirebaseConfigured() ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <span className={isFirebaseConfigured() ? 'text-green-700' : 'text-red-700'}>
              {isFirebaseConfigured()
                ? 'Firebase configurado correctamente'
                : 'Firebase no configurado - Revisar archivo .env'
              }
            </span>
          </div>

          {!isFirebaseConfigured() && (
            <Alert>
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>No se puede continuar.</strong> Para usar este componente:
                <br />
                1. Crea un archivo `.env` basado en `.env.example`
                <br />
                2. Rellena las credenciales de Firebase
                <br />
                3. Asegúrate de tener Firestore habilitado en tu proyecto
              </AlertDescription>
            </Alert>
          )}

          {/* Botones de prueba */}
          <div className="flex gap-4">
            <Button
              onClick={handleTestConnection}
              disabled={!isFirebaseConfigured() || isTesting || isInitializing}
              className="flex items-center gap-2"
            >
              {isTesting && <Loader2 className="h-4 w-4 animate-spin" />}
              Probar Conexión
              {isTesting ? '...' : ''}
            </Button>

            <Button
              onClick={handleInitializeData}
              disabled={!isFirebaseConfigured() || isTesting || isInitializing}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isInitializing && <Loader2 className="h-4 w-4 animate-spin" />}
              Inicializar Datos Base
              {isInitializing ? '...' : ''}
            </Button>
          </div>

          {/* Resultados */}
          {testResult && (
            <Alert className={testResult.success ? 'border-green-200' : 'border-red-200'}>
              {testResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={testResult.success ? 'text-green-800' : 'text-red-800'}>
                <strong>Resultado del Test:</strong><br />
                {testResult.message}
              </AlertDescription>
            </Alert>
          )}

          {initResult && (
            <Alert className={initResult.success ? 'border-green-200' : 'border-red-200'}>
              {initResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={initResult.success ? 'text-green-800' : 'text-red-800'}>
                <strong>Resultado de Inicialización:</strong><br />
                {initResult.message}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert className="border-red-200">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Error:</strong><br />
                {error}
                <br /><br />
                <em>Solución posible:</em> Verificar que las credenciales en .env sean correctas y que Firestore esté habilitado.
              </AlertDescription>
            </Alert>
          )}

          {/* Información del siguiente paso */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Siguiente Paso</CardTitle>
              <CardDescription>
                Una vez que los tests funcionen correctamente, procederemos a implementar
                el sistema de gestión de warehouses en FASE 2
              </CardDescription>
            </CardHeader>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default FirebaseTest;
