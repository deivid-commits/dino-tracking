# 🦖 DinoTrack - Sistema de Gestión de Manufactura

Sistema completo de tracking y gestión de manufactura para productos electrónicos (juguetes tipo "dinosaurios"), migrado completamente a **Supabase**.

## 📋 Tabla de Contenidos

- [Características](#características)
- [Stack Tecnológico](#stack-tecnológico)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Modelo de Datos](#modelo-de-datos)
- [Funcionalidades](#funcionalidades)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [Migración Completada](#migración-completada)

## ✨ Características

- ✅ **Gestión de Componentes/SKUs**: Añadir, editar y trackear inventario de componentes
- ✅ **Gestión de Productos (Toys)**: CRUD completo de productos finales
- ✅ **Control de Calidad**: Sistema de QC logs y testing
- ✅ **Gestión de Operadores**: Login y tracking de acciones
- ✅ **Multi-Warehouse**: Soporte para múltiples almacenes
- ✅ **Ventas y Envíos**: Tracking completo de ventas y shipments
- ✅ **BOM Management**: Versiones de productos y especificaciones
- ✅ **Dashboard en Tiempo Real**: Estadísticas y métricas actualizadas
- ✅ **Internacionalización**: Soporte ES/EN
- ✅ **Catálogo de SKUs (BOM)**: Definición de componentes (toy_bom_items) para construir versiones

## 🛠️ Stack Tecnológico

### Frontend
- **React 18** - Framework UI
- **Vite** - Build tool y dev server
- **React Router DOM v7** - Routing
- **Tailwind CSS** - Styling
- **Radix UI** - Componentes UI primitivos
- **shadcn/ui** - Componentes UI pre-construidos
- **Framer Motion** - Animaciones
- **Lucide React** - Iconos
- **Sonner** - Toast notifications

### Backend
- **Supabase** - Backend as a Service
  - PostgreSQL database
  - Authentication
  - Real-time subscriptions
  - Row Level Security (RLS)

### Deployment
- **Vercel** - Hosting y CI/CD

## 📦 Instalación

### Prerrequisitos
- Node.js 18+ 
- npm o yarn
- Cuenta de Supabase

### Pasos

1. **Clonar el repositorio**
```bash
git clone https://github.com/deivid-commits/dino-tracking.git
cd dino-tracking
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**

Crear archivo `.env` en la raíz:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

4. **Iniciar servidor de desarrollo**
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## ⚙️ Configuración

### Supabase Setup

1. Crear proyecto en [Supabase](https://supabase.com)
2. Ejecutar el schema SQL (ver `supabase-schema.sql`)
3. Configurar Row Level Security (RLS) según necesidades
4. Copiar URL y Anon Key al `.env`

### Tablas Requeridas

El sistema requiere las siguientes tablas en Supabase:

- `toys` - Productos finales
- `purchase_order_items` - Componentes/inventario
- `purchase_orders` - Órdenes de compra
- `bom_versions` - Versiones de BOM
- `toy_bom_items` - Catálogo de SKUs (componentes) para construir versiones (BOM)
- `devices` - Dispositivos electrónicos
- `operators` - Operadores del sistema
- `warehouses` - Almacenes
- `sales` - Ventas
- `shipments` - Envíos
- `quick_qc_logs` - Logs de control de calidad

## 📁 Estructura del Proyecto

```
src/
├── api/                      # Capa de datos
│   ├── base44Client.js      # Cliente Supabase principal
│   ├── entities.js          # Exportación de entidades
│   ├── functions.js         # Funciones auxiliares
│   └── integrations.js      # Integraciones externas
│
├── components/              # Componentes React
│   ├── ui/                 # Componentes UI (shadcn)
│   │   ├── button.jsx
│   │   ├── card.jsx
│   │   ├── input.jsx
│   │   └── ...
│   ├── components/         # Componentes de negocio
│   │   ├── ComponentForm.jsx
│   │   └── ComponentsList.jsx
│   ├── LanguageProvider.jsx  # i18n Provider
│   └── WarehouseProvider.jsx # Warehouse context
│
├── pages/                   # Páginas principales
│   ├── Dashboard.jsx       # Panel principal
│   ├── Components.jsx      # Gestión de componentes
│   ├── Dinosaurs.jsx       # Gestión de productos
│   ├── Sales.jsx           # Ventas
│   ├── QualityControl.jsx  # Control de calidad
│   ├── OperatorLogin.jsx   # Login de operadores
│   └── ...
│
├── App.jsx                 # Componente raíz
├── main.jsx               # Punto de entrada
└── supabaseClient.js      # Configuración Supabase
```

## 🗄️ Modelo de Datos

### Entidades Principales

#### TOYS (Productos)
```javascript
{
  serial_number: string (PK),
  voice_box_id: string,
  sku: string,
  manufacturing_status: string,
  created_at: timestamp,
  updated_at: timestamp
}
```

#### PURCHASE_ORDER_ITEMS (Componentes)
```javascript
{
  po_item_id: uuid (PK),
  po_number: string,
  component_sku: string,
  component_description: string,
  quantity_ordered: number,
  quantity_received: number,
  unit_cost: decimal,
  currency: string,
  lot_number: string,
  created_at: timestamp
}
```

#### DEVICES
```javascript
{
  id: uuid (PK),
  assembly_date: timestamp,
  assembled_by_operator: string,
  status: string,
  components: jsonb
}
```

## 🎯 Funcionalidades

### 1. Gestión de Componentes/SKUs

**Añadir Nuevo Componente:**
```javascript
import { Component } from '@/api/entities';

await Component.create({
  component_sku: 'ESP32-WROOM-32',
  component_description: 'ESP32 WiFi Module'
});
```

**Listar Componentes (Agregados por SKU):**
```javascript
const components = await Component.list('-created_at');
// Retorna componentes agrupados por SKU con cantidades totales
```

**Actualizar Descripción:**
```javascript
await Component.update('ESP32-WROOM-32', { component_description: 'Nuevo detalle' });
```

### 2. Gestión de Productos (Toys)

**Crear Producto:**
```javascript
import { Toy } from '@/api/entities';

await Toy.create({
  serial_number: 'DINO-2024-001',
  voice_box_id: 'VB-001',
  sku: 'DINO-TREX-V1',
  manufacturing_status: 'in_production'
});
```

**Buscar Productos:**
```javascript
const results = await Toy.search('DINO', {
  manufacturing_status: 'completed'
});
```

### 3. Component Usage Tracking

Cuando se crea un device, automáticamente se deducen los componentes del inventario:

```javascript
import { Device } from '@/api/entities';

await Device.create({
  status: 'ready',
  components: [
    { component_sku: 'ESP32-WROOM-32', quantity: 1 },
    { component_sku: 'BATTERY-3.7V', quantity: 1 }
  ]
});
// Nota: No se deduce inventario desde toy_bom_items; este catálogo se usa para definir versiones (BOM)
```

### 4. Dashboard

El dashboard muestra:
- Total de componentes
- Total de productos
- Ventas totales
- Productos disponibles
- Componentes con stock bajo
- Ventas de la semana

### 5. Control de Calidad

```javascript
import { QuickQCLog } from '@/api/entities';

await QuickQCLog.create({
  serial_number: 'DINO-2024-001',
  test_date: new Date().toISOString(),
  test_result: 'passed',
  notes: 'All tests passed'
});
```

## 📚 API Reference

### Component Entity

```javascript
// Listar componentes agregados por SKU
Component.list(orderBy = 'component_sku')

// Obtener componente por SKU
Component.getBySKU(sku)

// Crear nuevo componente
Component.create(componentData)

// Actualizar cantidad
Component.update(sku, updates)

// Obtener SKUs únicos
Component.getUniqueSKUs()
```

### Toy Entity

```javascript
// Listar productos
Toy.list(orderBy = '-created_at')

// Buscar productos
Toy.search(query, filters)

// Crear producto
Toy.create(toyData)

// Actualizar producto
Toy.update(serialNumber, updates)

// Eliminar producto
Toy.delete(serialNumber)
```

### Device Entity

```javascript
// Listar devices
Device.list(orderBy)

// Crear device (con component usage tracking)
Device.create(deviceData)

// Eliminar device
Device.delete(id)
```

## 🚀 Deployment

### Vercel

1. **Conectar repositorio a Vercel**
```bash
vercel
```

2. **Configurar variables de entorno en Vercel:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

3. **Deploy a producción:**
```bash
npm run build
vercel --prod
```

### Scripts Disponibles

```json
{
  "dev": "vite",                    // Desarrollo local
  "build": "vite build",            // Build producción
  "preview": "vite preview",        // Preview build
  "cache-bust": "echo 'Invalidating Vercel cache'"
}
```

### Archivos de Configuración

- `.vercelignore` - Archivos a ignorar en deploy
- `vercel.json` - Configuración de Vercel
- `vite.config.js` - Configuración de Vite

## ✅ Migración Completada

### Estado de la Migración Firebase → Supabase

- ✅ **Entidades migradas**: Todas las entidades principales
- ✅ **CRUD operations**: Funcionando completamente
- ✅ **Autenticación**: Supabase Auth implementado
- ✅ **Component creation**: Sistema de añadir SKUs habilitado
- ✅ **Component usage tracking**: Deducción automática de inventario
- ✅ **Agregación por SKU**: Vista consolidada de inventario
- ✅ **Formularios actualizados**: ComponentForm adaptado al nuevo schema
- ✅ **UI actualizada**: Botón "Añadir Nuevo SKU" en Components page

### Compatibilidad Legacy

Para mantener compatibilidad con código existente:

```javascript
// Legacy names → New implementation
Dinosaur → Toy (mapea a tabla TOYS)
DinosaurVersion → BomVersion (mapea a tabla BOM_VERSIONS)
Component → ComponentInventory (vista agregada de PURCHASE_ORDER_ITEMS)
```

## 🔐 Seguridad

- **Row Level Security (RLS)** en Supabase
- **Autenticación por operador**
- **Variables de entorno** para secrets
- **HTTPS** en producción (Vercel)

## 📝 Notas Importantes

1. **Component Inventory**: Los componentes se manejan como `purchase_order_items` y se agregan por SKU para mostrar inventario consolidado.

2. **PO Numbers**: Al crear componentes manualmente, se genera automáticamente un PO number con formato `MANUAL-{timestamp}`.

3. **Component Usage**: Al crear devices, los componentes se deducen automáticamente del inventario mediante entradas negativas en `purchase_order_items`.

4. **Warehouse Filtering**: El sistema soporta filtrado por warehouse a través del `WarehouseProvider`.

## 🤝 Contribuir

1. Fork el proyecto
2. Crear feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## 📄 Licencia

Este proyecto es privado y propietario.

## 👥 Contacto

- **Repositorio**: https://github.com/deivid-commits/dino-tracking
- **Issues**: https://github.com/deivid-commits/dino-tracking/issues

---

**Versión**: 1.0.0  
**Última actualización**: Octubre 2025  
**Estado**: ✅ Producción - Migración a Supabase Completada
