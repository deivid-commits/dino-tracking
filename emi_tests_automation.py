#!/usr/bin/env python3
"""
EMI/RF Test Automation para Rigol DSA815
===========================================

Este script automatiza las mediciones de EMI/RF radiation según las
especificaciones del documento "Normal Factory - MT-All-Tests".

Realiza mediciones en el rango 30 MHz - 1 GHz con diferentes configuraciones
de hardware y firmware, similar a las pruebas documentadas.
"""

import time
import os
import json
import numpy as np
from datetime import datetime
from typing import Dict, List, Any, Tuple

from rigol_dsa815_control import RigolDSA815

class EMFCRadiationTester:
    """
    Automatizador de pruebas de radiación EMI/RF según estándares FCC/EN
    """

    def __init__(self):
        self.dsa = RigolDSA815()
        self.connected = False

        # Configuraciones de frecuencia según FCC/EN para 30-1000 MHz
        self.frequency_ranges = [
            (30e6, 88e6, 9, 120),      # VHF Low (30-88 MHz) - Class B 30
            (88e6, 216e6, 9, 90),      # VHF High (88-216 MHz) - Class B 43.5
            (216e6, 960e6, 9, 54),     # UHF (216-960 MHz) - Class B 46
        ]

        # Configuraciones de RBW según CISPR 16-1-1
        # Para medidas de Peak en Pre-scan: RBW >= 120 kHz
        # Para medidas QP: RBW = 120 kHz
        self.rbw_peak = 120e3
        self.vbw_peak = 300e3
        self.rbw_qp = 120e3
        self.vbw_qp = 120e3

        self.reference_level = -20  # dBm

    def connect_device(self) -> bool:
        """Conectar al DSA815"""
        print("🔌 Conectando al Rigol DSA815...")
        self.connected = self.dsa.connect()
        if self.connected:
            print("✅ Dispositivo conectado!")
        return self.connected

    def get_fcc_limit(self, frequency: float) -> float:
        """Obtener límite FCC Class B para una frecuencia dada (en dBμV/m)"""
        if 30e6 <= frequency <= 88e6:
            return 30  # dBμV/m
        elif 88e6 <= frequency <= 216e6:
            return 43.5  # dBμV/m
        elif 216e6 <= frequency <= 960e6:
            return 46 if frequency <= 700e6 else 54  # dBμV/m
        else:
            return 54

    def configure_for_frequency_range(self, start_freq: float, stop_freq: float):
        """Configurar el DSA815 para un rango de frecuencia específico"""
        center_freq = (start_freq + stop_freq) / 2
        span = stop_freq - start_freq

        # Configurar con delays como en debug script
        self.dsa.instrument.write(f"FREQ:CENT {center_freq}")
        time.sleep(0.1)
        self.dsa.instrument.write(f"FREQ:SPAN {span}")
        time.sleep(0.1)

        self.dsa.configure_bandwidth(self.rbw_peak, self.vbw_peak)
        time.sleep(0.1)

        self.dsa.set_reference_level(self.reference_level)
        time.sleep(0.1)

        # Activar trazo 1 como en debug
        self.dsa.instrument.write("TRAC1:MODE WRIT")
        time.sleep(0.1)

        print(".1f")

    def perform_peak_scan(self, test_id: str, description: str) -> Dict[str, Any]:
        """Realizar un escaneo Peak y devolver resultados"""
        results = {
            "test_id": test_id,
            "description": description,
            "timestamp": datetime.now().isoformat(),
            "measurements": []
        }

        print(f"\n🚀 Iniciando {description}")
        print(f"📝 Test ID: {test_id}")

        # Escanear cada rango de frecuencia
        all_frequencies = []
        all_amplitudes = []

        for start_freq, stop_freq, _, _ in self.frequency_ranges:
            print(".1f")

            self.configure_for_frequency_range(start_freq, stop_freq)

            # Realizar medición
            self.dsa.trigger_single_measurement()

            # Obtener datos usando el método del debug (que funciona)
            try:
                freq_data, amp_data = self.get_trace_data_debug_style()
                all_frequencies.extend(freq_data)
                all_amplitudes.extend(amp_data)

                print(".1f")

                # Buscar picos en este rango
                peaks = self.find_peaks_in_range(freq_data, amp_data, start_freq, stop_freq)
                results["measurements"].extend(peaks)

            except Exception as e:
                print(f"❌ Error obteniendo datos: {e}")

        # Analizar resultados globales
        if all_frequencies and all_amplitudes:
            worst_peak = self.find_worst_peak(all_frequencies, all_amplitudes)
            results["worst_peak"] = worst_peak

            print("\n📊 RESULTADOS GLOBALES:")
            print(".2f")
            print(".3f")
            limit = self.get_fcc_limit(worst_peak["frequency"])
            margin = worst_peak["amplitude"] - limit
            print(".2f")
            print(f"   📏 FCC Limit: {worst_peak['fcc_limit']:.1f} dBμV/m")
        return results

    def find_peaks_in_range(self, frequencies: List[float], amplitudes: List[float],
                           start_freq: float, stop_freq: float) -> List[Dict[str, Any]]:
        """Encontrar picos en un rango de frecuencia específico"""
        peaks = []

        # Filtrar datos en el rango
        mask = (frequencies >= start_freq) & (frequencies <= stop_freq)
        freq_range = frequencies[mask]
        amp_range = amplitudes[mask]

        if len(amp_range) == 0:
            return peaks

        # Encontrar picos locales (simplificado)
        # Para un análisis real, se usarían métodos más sofisticados
        for i in range(1, len(amp_range) - 1):
            if (amp_range[i] > amp_range[i-1]) and (amp_range[i] > amp_range[i+1]):
                frequency = freq_range[i] / 1e6  # MHz
                amplitude = amp_range[i]

                # Solo incluir si está por encima de cierto umbral
                if amplitude > -80:  # Solo picos significativos
                    fcc_limit = self.get_fcc_limit(frequency * 1e6)
                    margin = amplitude - fcc_limit

                    peak_info = {
                        "frequency_mhz": round(frequency, 3),
                        "amplitude_dbmv": round(amplitude, 2),
                        "fcc_limit_dbuv_m": round(fcc_limit, 1),
                        "margin_db": round(margin, 2),
                        "frequency_range": ".1f"
                    }
                    peaks.append(peak_info)

        # Ordenar por margin (los más críticos primero)
        peaks.sort(key=lambda x: x["margin_db"], reverse=True)

        return peaks[:10]  # Top 10 picos

    def find_worst_peak(self, frequencies: List[float], amplitudes: List[float]) -> Dict[str, Any]:
        """Encontrar el pico más alto en toda la medición"""
        max_idx = amplitudes.index(max(amplitudes))
        max_freq = frequencies[max_idx] / 1e6  # MHz
        max_amp = amplitudes[max_idx]
        fcc_limit = self.get_fcc_limit(frequencies[max_idx])
        margin = max_amp - fcc_limit

        return {
            "frequency": max_freq,
            "amplitude": max_amp,
            "margin": margin,
            "fcc_limit": fcc_limit
        }

    def get_trace_data_debug_style(self) -> Tuple[np.ndarray, np.ndarray]:
        """Obtener datos del trazo usando exactamente el mismo método que el debug script"""
        if not self.connected:
            raise ConnectionError("No conectado al dispositivo")

        try:
            # Obtener puntos del trazo
            points = int(self.dsa.instrument.query("SENS:SWE:POIN?"))

            # Obtener datos de frecuencia
            freq_start = float(self.dsa.instrument.query("FREQ:STAR?"))
            freq_stop = float(self.dsa.instrument.query("FREQ:STOP?"))
            frequencies = np.linspace(freq_start, freq_stop, points)

            # Obtener datos de amplitud usando TRAC? TRACE1 (como en debug)
            trace_data = self.dsa.instrument.query("TRAC? TRACE1")
            amplitudes = np.array([float(x) for x in trace_data.split(',')])

            return frequencies, amplitudes

        except Exception as e:
            print(f"❌ Error obteniendo datos del trazo (debug style): {e}")
            return np.array([]), np.array([])

    def save_results(self, results: Dict[str, Any], output_dir: str = "./emi_results"):
        """Guardar resultados de medición"""
        os.makedirs(output_dir, exist_ok=True)

        test_id = results["test_id"]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Archivo JSON con todos los resultados
        json_filename = f"{output_dir}/{test_id}_{timestamp}.json"
        with open(json_filename, 'w') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

        # Archivo CSV con picos
        csv_filename = f"{output_dir}/{test_id}_{timestamp}_peaks.csv"
        if results["measurements"]:
            with open(csv_filename, 'w') as f:
                f.write("Frequency_MHz,Amplitude_dBμV/m,FCC_Limit_dBμV/m,Margin_dB,Range\n")
                for peak in results["measurements"]:
                    f.write(f"{peak['frequency_mhz']:.3f},{peak['amplitude_dbmv']:.2f},{peak['fcc_limit_dbuv_m']:.1f},{peak['margin_db']:.2f},{peak['frequency_range']}\n")
        print(f"💾 Resultados guardados:")
        print(f"   📄 JSON: {json_filename}")
        print(f"   📊 CSV: {csv_filename}")

    def run_test_configuration(self, test_id: str, description: str,
                             config_notes: str = "") -> Dict[str, Any]:
        """Ejecutar una configuración de prueba completa"""
        print(f"\n{'='*60}")
        print(f"🧪 CONFIGURACIÓN DE PRUEBA: {test_id}")
        print(f"📋 {description}")
        if config_notes:
            print(f"💡 {config_notes}")
        print(f"{'='*60}")

        if not self.connected:
            if not self.connect_device():
                raise ConnectionError("No se pudo conectar al DSA815")

        # Realizar medición Peak Scan
        results = self.perform_peak_scan(test_id, description)

        # Agregar información de configuración
        results["test_configuration"] = {
            "device_id": test_id.split('-')[0] + '-' + test_id.split('-')[1],
            "firmware_version": extract_version_from_id(test_id),
            "hardware_config": extract_hw_config_from_id(test_id),
            "cable_type": extract_cable_info(description),
            "charger_type": extract_charger_info(description),
            "notes": config_notes
        }

        # Guardar resultados
        self.save_results(results)

        return results

def extract_version_from_id(test_id: str) -> str:
    """Extraer versión de firmware del ID"""
    parts = test_id.split('-')
    if len(parts) >= 3:
        return '.'.join([str(int(x)) for x in parts[2]])
    return "unknown"

def extract_hw_config_from_id(test_id: str) -> str:
    """Extraer configuración hardware del ID"""
    parts = test_id.split('-')
    if len(parts) >= 3:
        return parts[2]
    return "unknown"

def extract_cable_info(description: str) -> str:
    """Extraer información del cable"""
    if "White cable" in description:
        return "White"
    elif "Black cable" in description:
        return "Black"
    return "Not specified"

def extract_charger_info(description: str) -> str:
    """Extraer información del cargador"""
    if "White charger" in description:
        return "White"
    elif "Black charger" in description:
        return "Black"
    elif "battery only" in description:
        return "Battery only"
    return "Not specified"

def run_factory_emi_tests():
    """Ejecutar todas las pruebas EMI según el documento Normal Factory"""
    tester = EMFCRadiationTester()

    try:
        # Configuración inicial
        if not tester.connect_device():
            print("❌ No se pudo conectar al DSA815. Verificar conexión USB.")
            return

        print("🎯 INICIANDO SECUENCIA DE PRUEBAS EMI NORMAL FACTORY")
        print("=" * 80)

        test_results = []

        # Ejecutar las configuraciones del documento
        configurations = [
            # Baseline
            ("20250808-01040-2NA00-D", "FLT-000-01", "Baseline DUT (switch v2.9.0, default charger cable unspecified)", "Peak-scan only. Baseline DUT (cable/charger unspecified). Use as reference vs. later cable/charger effects; no QP captured."),

            # Versiones 1.8.0 con diferentes cables/cargadores
            ("20250825-01080-0C010-C", "HB_-200-01", "v1.8.0 — Black cable + Black charger", "Peak-scan shows narrow VHF spikes; mid-band plateau risen."),
            ("20250825-01080-0C010-C", "HW_-200-01", "v1.8.0 — Black cable + White charger", "Slightly higher broad-band floor than black charger; peaks cluster in VHF."),
            ("20250825-01080-0C020-C", "HW_-200-01", "v1.8.0 — White cable + White charger", "Few, narrow spikes and lower overall floor; best of the four 1.8.0 configs."),
            ("20250825-01080-0C020-C", "HB_-200-01", "v1.8.0 — White cable + Black charger", "Similar to black-cable/black-charger but slightly lower crest."),

            # Versiones 1.8.2 con diferentes cables/cargadores
            ("20250825-01080-2C020-C", "HB_-4T0-01", "v1.8.2 — White cable + Black charger (R5)", "Peak-scan ~+10.61 dB worst-case; mid-band floor elevated vs. 1.8.0 (trace antenna influence)."),
            ("20250825-01080-2C020-C", "HW_-4T0-01", "v1.8.2 — White cable + White charger (R6)", "Peak-scan ~+9.99 dB worst-case; white charger not materially better in this rev."),
            ("20250825-01080-2C010-C", "HW_-4T0-01", "v1.8.2 — Black cable + White charger (R7)", "+14.58 dB over limit (worst overall); distinct narrow VHF spikes and higher broad-band floor."),
            ("20250825-01080-2C010-C", "HB_-4T0-01", "v1.8.2 — Black cable + Black charger (R8)", "Treat +60.70 dB spike as ambient; real worst spikes <15 dB over."),

            # Versión 1.9.1 - Default
            ("20251001-01090-1NA00-D", "FLT-20E-01", "v1.9.1 — Default, switch v2.10.0 (cable not specified)", "Default 1.9.1 + internal shielded interconnect (not charger). Baseline before external cable sweeps."),

            # Versión 1.9.1 con configuraciones modificadas
            ("20251003-01090-1BAT0-D", "FLT-20E-01", "v1.9.1 — Default, battery only", "Cleanest run; broad-band floor low, residual narrow peaks likely from clocks/MCU."),
            ("20251003-01090-1SCB0-D", "FLT-20E-01", "v1.9.1 — Default, shielded charging cable", "Peaks reappear at Aug 25 harmonics; shielded charger reduces but doesn't remove cable-borne spikes."),
        ]

        for test_id, hw_config, description, summary in configurations:
            try:
                result = tester.run_test_configuration(test_id, description, summary)
                test_results.append(result)

                # Pequeña pausa entre pruebas
                print("⏳ Esperando 5 segundos para siguiente prueba...")
                time.sleep(5)

            except Exception as e:
                print(f"❌ Error en prueba {test_id}: {e}")
                continue

        # Generar reporte final
        print("\n📋 REPORTE FINAL DE PRUEBAS EMI")
        print("=" * 80)

        for result in test_results:
            print(f"\n🔹 {result['test_id']}: {result['description']}")
            if "worst_peak" in result:
                wp = result["worst_peak"]
                print(".2f")

        tester.dsa.disconnect()
        print("\n✅Todas las pruebas completadas!")

    except KeyboardInterrupt:
        print("\n🚫 Pruebas interrumpidas por usuario")
    except Exception as e:
        print(f"❌ Error crítico: {e}")
    finally:
        if tester.connected:
            tester.dsa.disconnect()

if __name__ == "__main__":
    print("EMI/RF Automated Testing for Rigol DSA815")
    print("============================================")
    print("Basado en protocolo Normal Factory - MT-All-Tests")
    print()

    run_factory_emi_tests()
