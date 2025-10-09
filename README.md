# Supabase Basic Test - FASE 1

Proyecto básico para probar conectividad con Supabase.

## 🎯 Objetivo

Este es un proyecto mínimo para:
1. Probar la conexión a Supabase (PostgreSQL)
2. Verificar deployment en Vercel

## 📋 Instrucciones

### 1. Configuración

Las credenciales de Supabase ya están incluidas en `index.html`. No se necesita configuración adicional para esta prueba inicial.

### 2. Probar Localmente

Abre `index.html` en tu navegador y haz clic en "Probar Conexión a Supabase".

### 3. Deploy a Vercel

```bash
# Conectar con tu repo de GitHub
git init
git add .
git commit -m "Initial commit - Firebase basic test"

# Push a GitHub
git remote add origin https://github.com/deivid-commits/dino-tracking.git
git push -u origin main --force

# Vercel se auto-deployará desde GitHub
```

### 4. Variables de Entorno en Vercel

Para producción, las credenciales de Supabase se configurarán como variables de entorno en Vercel para mayor seguridad. Por ahora, están en el HTML para simplificar.

## 🔥 Funcionalidad

- **Probar Conexión**: Intenta hacer una consulta a la tabla `warehouses` en Supabase para verificar la conectividad.

## 📁 Estructura

```
firebase-basic-test/
├── index.html          # Página de prueba
├── README.md          # Este archivo
├── .gitignore         # Archivos a ignorar
└── vercel.json        # Configuración de Vercel
```

## ✅ Siguiente Paso

Una vez que este proyecto básico funcione en Vercel y la conexión a Supabase sea exitosa:
- FASE 2: Crear la tabla `warehouses` y empezar a añadir datos.
- FASE 3: Reconstruir la interfaz de React para gestionar los datos.
- FASE 4: etc...
