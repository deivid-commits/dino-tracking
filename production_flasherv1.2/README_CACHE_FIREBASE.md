# DinoCore Firebase Cache System Documentation

## Resumen del Sistema

El sistema de cache inteligente de DinoCore proporciona una integración robusta entre Firebase Firestore y almacenamiento local, permitiendo operar tanto online como offline de manera transparente.

## Arquitectura

### Componentes Principales

1. **FirebaseDB** (`firebase_db.py`)
   - Gestiona la conexión con Firebase Firestore
   - Inicializa el sistema de cache
   - Proporciona interfaz de compatibilidad hacia atrás

2. **CacheManager** (`cache_manager.py`)
   - Sistema de cache inteligente offline-first
   - Sincronización automática en segundo plano
   - Gestión de caché con expiración automática

### Modo de Operación: OFFLINE-FIRST

```
Usuario → Cache Local → Firebase → Respuesta
      └─────────┐         ▲
              └─────────┘
```

- **Lectura**: Intenta cache local primero → Firebase si falla
- **Escritura**: Guarda en ambos (cache + Firebase)
- **Sincronización**: Automática cada 5 minutos en segundo plano

## Colecciones de Firebase

### `qc_results`
Almacena resultados de pruebas de calidad Bluetooth:
```json
{
  "session_id": "qc_abc123",
  "device_info": {
    "name": "DinoCore Dev Board",
    "address": "AA:BB:CC:DD:EE:FF"
  },
  "test_results": [...],
  "total_tests": 3,
  "passed_tests": 3,
  "failed_tests": 0,
  "timestamp": "2025-10-07T14:25:00Z"
}
```

### `flash_logs`
Registra operaciones de flashing:
```json
{
  "session_id": "flash_xyz789",
  "device_info": {
    "name": "DinoCore Prod Unit"
  },
  "flash_result": {...},
  "success": true,
  "mode": "production",
  "hardware_version": "1.9.0",
  "duration": 45.2,
  "error_message": "",
  "timestamp": "2025-10-07T14:30:15Z"
}
```

### `devices` (Próximamente)
Inventario de dispositivos registrados.

## Configuración

### 1. Instalar Dependencias

```bash
pip install firebase-admin>=6.0.0
```

### 2. Configurar Firebase

1. Crear proyecto en Firebase Console
2. Generar credenciales de servicio:
   - Ir a Project Settings → Service Accounts
   - Click "Generate new private key"
   - Descargar JSON y nombrarlo `firebase-credentials.json`

### 3. Archivo `.gitignore`

Asegurarse de que estos archivos estén ignorados:
```
# Firebase Credentials
firebase-credentials.json
firebase-credentials-template.json

# Cache Directory
.dinocore_cache/
```

## Uso Programático

### Inicialización Automática

```python
from firebase_db import store_qc_results, store_flash_log, get_qc_history

# El sistema se inicializa automáticamente al importar
# Firebase se conecta si encuentra credenciales
# Cache está siempre disponible
```

### Almacenar Resultados QC

```python
from firebase_db import store_qc_results

device_info = {
    'name': 'DinoCore Test Device',
    'address': 'AA:BB:CC:DD:EE:FF'
}

test_results = [
    {
        'name': 'Microphone L/R Balance',
        'status': 'pass',
        'details': 'L: 4800 RMS, R: 4750 RMS'
    }
]

success = store_qc_results(device_info, test_results)
# Guarda en cache local inmediatamente
# Sincroniza a Firebase en segundo plano
```

### Consultar Historial

```python
from firebase_db import get_qc_history, get_flash_history

# Últimos 50 resultados QC
qc_history = get_qc_history(limit=50)

# Últimos 20 logs de flash
flash_history = get_flash_history(limit=20)
```

## Comandos CLI para Firebase

```bash
# Configurar proyecto Firebase
python firebase_db.py setup

# Inicializar con credenciales existentes
python firebase_db.py init

# Probar conexión
python firebase_db.py test
```

## Modos de Cache

### OFFLINE_FIRST (Por defecto)
- Lee del cache local primero
- Solo consulta Firebase si no hay datos en cache
- Garantiza funcionamiento offline

### ONLINE_FIRST (Próximamente)
- Consulta Firebase primero
- Caída a cache local como respaldo

### HYBRID (Próximamente)
- Sincronización continua entre cache y nube

## Características Avanzadas

### Sincronización Automática
- Ejecuta cada 5 minutos en hilo separado
- Sube datos del cache local a Firebase
- No interrumpe la operación normal de usuario

### Gestión de Cache
- Archivos JSON organizados por colección
- Expiración automática (por defecto 1 hora)
- Limpieza automática de archivos corruptos

### Recuperación de Errores
- Caída suave si Firebase no está disponible
- Operación continua solo con cache local
- Notificación al usuario de estado de conexión

## Directorio de Cache

```
.dinocore_cache/
├── qc_results_qc_abc123.json
├── flash_logs_flash_xyz789.json
├── metadata.json
└── last_sync.txt
```

## Comandos de Gestión de Cache

```python
from cache_manager import get_cache_manager

cache = get_cache_manager()

# Limpiar cache completo
cache.clear_cache()

# Limpiar solo colección específica
cache.clear_cache('qc_results')

# Limpiar archivos expirados manualmente
cache.cleanup_expired_cache()

# Ver estado del cache
print(cache.get_qc_history())
```

## Estados de Conexión

### Online (Firebase disponible)
```
🔗 SERVER ONLINE
✅ Firebase and cache system initialized successfully
```

### Offline (Solo cache)
```
❌ OFFLINE
⚠️ Firebase initialization failed, using cache-only mode
```

## Depuración

### Logs del Sistema
```
🔥 Initializing Firebase and cache system...
✅ Firebase and cache system initialized successfully
💾 QC results stored in Firebase database
🔄 Shutting down and cleaning up cache...
✅ Cache system shut down cleanly
```

### Debug Cache
```python
# Ver contenido del cache
import os
cache_dir = '.dinocore_cache'
for file in os.listdir(cache_dir):
    if file.endswith('.json'):
        print(f"Cache file: {file}")
```

## Funcionalidades Futuras

- **Análisis de datos**: Paneles de control y métricas
- **Sincronización en tiempo real**: Actualizaciones push desde Firebase
- **Compresión de datos**: Para reducir tamaño del cache
- **Encriptación**: Para datos sensibles
- **API REST**: Acceso remoto al cache

## Soporte y Troubleshooting

### Issues Comunes

1. **"Firebase not available"**
   - Instalar: `pip install firebase-admin`

2. **"Firebase credentials not found"**
   - Ejecutar: `python firebase_db.py setup`
   - Colocar `firebase-credentials.json` en directorio raíz

3. **Cache no se actualiza**
   - Verificar permisos de escritura
   - Borrar directorio `.dinocore_cache` manualmente

4. **Sincronización lenta**
   - Aumentar intervalo de sync en `cache_manager.py`
   - Verificar conexión a internet

### Logs de Debug

Para debug avanzado:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Conclusión

Este sistema proporciona una base sólida para la gestión de datos de DinoCore, asegurando funcionamiento offline, sincronización automática y robustez en ambientes de producción.
