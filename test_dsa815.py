#!/usr/bin/env python3
"""
Script simple para probar la librería Rigol DSA815
===============================================

Este script conecta al analizador de espectros y muestra la gráfica del espectro.
"""

import sys
from rigol_dsa815_control import RigolDSA815

def main():
    print("Prueba de Rigol DSA815 - Análisis de Espectros")
    print("=" * 50)

    # Crear instancia del control
    dsa = RigolDSA815()

    try:
        print("Conectando al dispositivo...")
        if dsa.connect():
            print("✅ Conexión exitosa!")

            print("\nConfigurando parámetros básicos...")
            dsa.configure_frequency(100e6, 200e6)  # Centro: 100 MHz, Span: 200 MHz
            dsa.configure_bandwidth(100e3, 100e3)   # RBW/VBW: 100 kHz
            dsa.set_reference_level(-30)             # Reference: -30 dBm

            print("Realizando medición...")
            dsa.trigger_single_measurement()

            print("Obteniendo datos del espectro...")
            frequencies, amplitudes = dsa.get_trace_data()

            if len(frequencies) > 0:
                print(".1f")
                print(f"Puntos de medición: {len(amplitudes)}")
                print(".1f")
                print(".2f")

                print("\nGenerando gráfica...")
                dsa.plot_spectrum(save_plot=True, filename="mi_espectro.png")

                print("\nGuardando datos en CSV...")
                dsa.save_measurement_data("datos_espectro.csv")

                print("✅ ¡Medición completada exitosamente!")
                print("📁 Gráfica guardada como: mi_espectro.png")
                print("📊 Datos guardados como: datos_espectro.csv")

            else:
                print("❌ No se pudieron obtener datos del dispositivo")

        else:
            print("❌ No se pudo conectar al dispositivo DSA815")
            print("Verifica que el dispositivo esté conectado y encendido")

    except KeyboardInterrupt:
        print("\nInterrupción del usuario")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        print("\nDesconectando...")
        dsa.disconnect()

if __name__ == "__main__":
    main()
