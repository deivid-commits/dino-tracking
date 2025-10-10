#!/usr/bin/env python3
"""
Prueba rápida EMI para Rigol DSA815
====================================

Script simplificado para probar mediciones EMI de una configuración específica
"""

from emi_tests_automation import EMFCRadiationTester

def run_single_emi_test():
    """Ejecutar una prueba EMI sencilla"""
    tester = EMFCRadiationTester()

    try:
        print("🚀 PRUEBA RÁPIDA EMI con Rigol DSA815")
        print("=" * 50)

        # Configuración de prueba basada en tu documento
        test_id = "20250825-01080-0C010-C"  # Versión 1.8.2, Black cable + White charger
        description = "Test Rápido: Black cable + White charger (v1.8.2)"
        notes = "Prueba rápida para verificar funcionamiento del sistema"

        # Ejecutar prueba
        if tester.connect_device():
            result = tester.perform_peak_scan(test_id, description)
            tester.save_results(result)
        else:
            result = None

        print("\n🎯 RESULTADO DE LA PRUEBA:")
        print("=" * 50)

        if result and "worst_peak" in result:
            wp = result["worst_peak"]
            print(".2f")
            print(".3f")
            print(".2f")
            print(f"\n📍 FCC Limit: {wp['fcc_limit']:.1f} dBμV/m")
        else:
            print("❌ No se encontraron datos de medición")

    except KeyboardInterrupt:
        print("🔴 Prueba interrumpida por usuario")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        tester.dsa.disconnect()

if __name__ == "__main__":
    run_single_emi_test()
