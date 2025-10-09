# Firebase Basic Test - FASE 1

Proyecto básico para probar conectividad con Firebase.

## 🎯 Objetivo

Este es un proyecto mínimo para:
1. Probar la conexión a Firebase Firestore
2. Inicializar datos base (warehouse BASE)
3. Verificar deployment en Vercel

## 📋 Instrucciones

### 1. Configurar Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Crea un proyecto o selecciona uno existente
3. Ve a Project Settings → General → Your apps
4. Agrega una Web App y copia las credenciales
5. Edita `index.html` y reemplaza las credenciales en `firebaseConfig`
6. Habilita Firestore Database en tu proyecto Firebase

### 2. Probar Localmente

Abre `index.html` en tu navegador.

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

### 4. Configurar Variables de Entorno en Vercel

En tu proyecto de Vercel, ve a Settings → Environment Variables y agrega:
- (Opcional) Puedes dejar las credenciales directamente en el HTML por ahora para simplificar

## 🔥 Funcionalidad

- **Probar Conexión**: Crea un documento de prueba en Firestore
- **Inicializar Datos Base**: Crea el warehouse BASE en Firestore

## 📁 Estructura

```
firebase-basic-test/
├── index.html          # Página de prueba
├── README.md          # Este archivo
├── .gitignore         # Archivos a ignorar
└── vercel.json        # Configuración de Vercel
```

## ✅ Siguiente Paso

Una vez que este proyecto básico funcione en Vercel:
- FASE 2: Añadir gestión de warehouses
- FASE 3: Añadir componentes
- FASE 4: etc...
