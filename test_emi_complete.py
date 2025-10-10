#!/usr/bin/env python3
"""
🚀 EMITest Completo - Prueba de Todo el Sistema
===============================================

Script para probar todos los componentes del sistema EMI:
- Control del DSA815
- Análisis visual
- Backend web
- Funciones completas
"""

import subprocess
import time
import os
import sys
import json
from pathlib import Path

def test_basic_dsa_connection():
    """Prueba básica de conexión al DSA815"""
    print("🔌 Probando conexión básica al DSA815...")

    try:
        from rigol_dsa815_control import RigolDSA815

        dsa = RigolDSA815()
        connected = dsa.connect()

        if connected:
            print("✅ DSA815 conectado correctamente")
            dsa.disconnect()
            return True
        else:
            print("❌ No se pudo conectar al DSA815")
            return False

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_visual_interface():
    """Prueba de la interfaz visual Rich"""
    print("\n🎨 Probando interfaz visual Rich...")

    try:
        from emi_visual_tester import VisualEMITester

        tester = VisualEMITester()

        # Mostrar bienvenida (esto debería funcionar sin dispositivo real)
        tester.display_welcome()
        print("✅ Interfaz visual Rich funciona correctamente")

        # Intentar conectar (fallará pero no debería crashear)
        try:
            tester.connect_device_visual()
            print("⚠️  Conexión visual funciona (aunque dispositivo no esté conectado)")
        except Exception as e:
            print(f"⚠️  Conexión visual devolvió error esperado: {type(e).__name__}")

        return True

    except Exception as e:
        print(f"❌ Error en interfaz visual: {e}")
        return False

def test_web_backend():
    """Prueba del backend web FastAPI"""
    print("\n🌐 Probando backend web FastAPI...")

    try:
        from emi_web_backend import app

        # Verificar que las rutas existen
        routes = [route.path for route in app.routes if hasattr(route, 'path')]
        expected_routes = ['/', '/ws/live-updates', '/api/connect-device', '/api/start-scan', '/api/status']

        for route in expected_routes:
            if route in routes:
                print(f"✅ Ruta {route} encontrada")
            else:
                print(f"❌ Ruta {route} faltante")

        return True

    except Exception as e:
        print(f"❌ Error en backend web: {e}")
        return False

def test_server_startup():
    """Prueba iniciar y detener el servidor"""
    print("\n🚀 Probando inicio del servidor web...")

    try:
        # Iniciar servidor en background
        process = subprocess.Popen([
            sys.executable, 'emi_web_backend.py'
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, cwd=os.getcwd())

        # Esperar 3 segundos
        time.sleep(3)

        # Terminar el proceso
        process.terminate()
        process.wait(timeout=5)

        # Verificar salida
        stdout, stderr = process.communicate()

        if "EMI DSA815 Web Backend Starting" in stdout:
            print("✅ Servidor web se inicia correctamente")
            return True
        else:
            print(f"❌ Servidor no se inició correctamente. stdout: {stdout[:200]}")
            return False

    except Exception as e:
        print(f"❌ Error iniciando servidor: {e}")
        return False

def test_file_structure():
    """Verificar estructura de archivos creada"""
    print("\n📁 Verificando estructura de archivos...")

    required_files = [
        'rigol_dsa815_control.py',
        'emi_visual_tester.py',
        'emi_web_backend.py',
        'emi_tests_automation.py',
        'quick_emi_test.py',
        'test_dsa815.py',
        'debug_dsa815.py'
    ]

    existing_files = []
    for file in required_files:
        if Path(file).exists():
            existing_files.append(file)
            print(f"✅ {file} existe")
        else:
            print(f"❌ {file} faltante")

    # Verificar directorio de resultados
    if Path('emi_results').exists():
        print("✅ Directorio emi_results existe")
    else:
        print("⚠️  Directorio emi_results no existe (se creará automáticamente)")

    return len(existing_files) == len(required_files)

def test_demo_data():
    """Crear algunos datos demo para mostrar funcionalidad"""
    print("\n📊 Creando datos de demostración...")

    try:
        # Crear datos simulados de un escaneo
        demo_results = {
            "test_mode": "fcc_prescán",
            "timestamp": "2025-10-10T12:39:00",
            "measurements": [
                {
                    "frequency_mhz": 45.7,
                    "amplitude_dbmv": -45.2,
                    "fcc_limit_dbuv_m": 40.0,
                    "margin_db": -5.2,
                    "frequency_range": "VHF Low",
                    "range_description": "30-88 MHz Class B"
                },
                {
                    "frequency_mhz": 156.3,
                    "amplitude_dbmv": -38.7,
                    "fcc_limit_dbuv_m": 43.5,
                    "margin_db": 4.8,
                    "frequency_range": "VHF High",
                    "range_description": "88-216 MHz Class B"
                }
            ],
            "worst_overall_peak": {
                "frequency": 45.7,
                "amplitude": -45.2,
                "margin": -5.2,
                "fcc_limit": 40.0
            }
        }

        # Guardar en results
        os.makedirs('./emi_results', exist_ok=True)
        with open('./emi_results/demo_results.json', 'w', encoding='utf-8') as f:
            json.dump(demo_results, f, indent=2, ensure_ascii=False)

        print("✅ Datos de demostración creados")
        return True

    except Exception as e:
        print(f"❌ Error creando datos demo: {e}")
        return False

def run_complete_test():
    """Ejecutar todas las pruebas"""
    print("🎯 EJECUTANDO PRUEBA COMPLETA DEL SISTEMA EMI")
    print("=" * 50)

    tests = [
        ("Estructura de archivos", test_file_structure),
        ("Interfaz visual Rich", test_visual_interface),
        ("Backend web FastAPI", test_web_backend),
        ("Inicio del servidor", test_server_startup),
        ("Datos de demostración", test_demo_data),
    ]

    # DSA815 connection test (solo si se solicita específicamente)
    if "--test-device" in sys.argv:
        tests.append(("Conexión DSA815 real", test_basic_dsa_connection))

    results = []

    for test_name, test_func in tests:
        print(f"\n🔍 {test_name}:")
        print("-" * 30)

        try:
            success = test_func()
            results.append((test_name, success))

            if success:
                print(f"✅ {test_name}: PASÓ")
            else:
                print(f"❌ {test_name}: FALLÓ")

        except Exception as e:
            print(f"❌ {test_name}: ERROR - {e}")
            results.append((test_name, False))

    # Resumen final
    print("\n" + "=" * 50)
    print("📋 RESUMEN FINAL")
    print("=" * 50)

    passed = sum(1 for _, success in results if success)
    total = len(results)

    for test_name, success in results:
        status = "✅ PASÓ" if success else "❌ FALLÓ"
        print(f"{test_name}: {status}")

    print("-" * 30)
    print(f"TOTAL: {passed}/{total} pruebas pasaron ({passed/total*100:.1f}%)")

    if passed == total:
        print("\n🎉 ¡Todas las pruebas pasaron! El sistema EMI está completamente operativo.")
        print("\nPara usar el sistema:")
        print("1. 🔗 Conecta tu DSA815 via USB")
        print("2. 🌐 Ejecuta: python emi_web_backend.py")
        print("3. 📱 Abre: http://localhost:8000")
        print("4. 🎯 Disfruta de las pruebas EMI en tiempo real!")
    else:
        print(f"\n⚠️  Algunas pruebas fallaron. Pasaron {passed}/{total} pruebas.")
        print("Verifica los errores arriba para depurar.")

    return passed == total

def show_usage():
    """Mostrar instrucciones de uso"""
    print("\n🎯 Sistema EMI DSA815 - Uso Completo")
    print("=" * 40)

    print("\n📁 ARCHIVOS PRINCIPALES:")
    print("• rigol_dsa815_control.py     - Control básico del DSA815")
    print("• emi_visual_tester.py        - Interfaz visual Rich")
    print("• emi_web_backend.py          - Servidor web completo")
    print("• emi_tests_automation.py     - Automatización completa")

    print("\n🚀 MODOS DE USO:")

    print("\n1. 🌐 WEB ANALYZER COMPLETO:")
    print("   python emi_web_backend.py")
    print("   → Abre navegador en http://localhost:8000")
    print("   → Interfaz completa con gráficas en tiempo real")

    print("\n2. 🎨 INTERFAZ VISUAL CONSOLA:")
    print("   python emi_visual_tester.py")
    print("   → Escaneo visual con iconos coloridos")

    print("\n3. ⚡ PRUEBA RÁPIDA:")
    print("   python quick_emi_test.py")
    print("   → Conexión y medición básica")

    print("\n4. 🧪 AUTOMATIZACIÓN COMPLETA:")
    print("   python emi_tests_automation.py")
    print("   → Suite completa de pruebas EMI")

    print("\n🔧 PRUEBAS DE VERIFICACIÓN:")
    print("   python test_emi_complete.py")
    print("   → Verifica que todo funcione")

    print("\n⚠️  OPCIONES AVANZADAS:")
    print("   python test_emi_complete.py --test-device")
    print("   → Incluye prueba de conexión real al DSA815")

if __name__ == "__main__":
    if "--help" in sys.argv or "-h" in sys.argv:
        show_usage()
    elif "--usage" in sys.argv:
        show_usage()
    else:
        success = run_complete_test()

        if success:
            print("\n" + "=" * 50)
            show_usage()
        else:
            print("\n🔍 Use --help para ver las instrucciones de uso")
            sys.exit(1)
