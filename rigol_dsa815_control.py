#!/usr/bin/env python3
"""
Rigol DSA815 Spectrum Analyzer Control Library
===========================================

Esta librería permite controlar el analizador de espectros Rigol DSA815
mediante comunicación VISA usando Python y PyVISA.

Características principales:
- Conexión automática al dispositivo
- Configuración de parámetros de medición
- Medición de espectros
- Visualización de datos en tiempo real
- Exportación de datos
"""

import pyvisa
import numpy as np
import matplotlib.pyplot as plt
import time
from typing import Optional, List, Tuple
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class RigolDSA815:
    """
    Clase para controlar el analizador de espectros Rigol DSA815
    """

    def __init__(self, resource_string: str = "USB0::0x1AB1::0x0960::DSA8A204201242::INSTR"):
        """
        Inicializar la conexión con el DSA815

        Args:
            resource_string: String de recurso VISA del dispositivo
        """
        self.resource_string = resource_string
        self.instrument = None
        self.connected = False

        # Configuraciones por defecto
        self.center_freq = 1e9  # 1 GHz
        self.span = 100e6      # 100 MHz
        self.rbw = 100e3       # 100 kHz
        self.vbw = 100e3       # 100 kHz
        self.reference_level = -30  # dBm

    def connect(self) -> bool:
        """
        Conectar al dispositivo DSA815

        Returns:
            bool: True si la conexión es exitosa
        """
        try:
            rm = pyvisa.ResourceManager()
            self.instrument = rm.open_resource(self.resource_string)
            self.instrument.timeout = 5000  # 5 segundos de timeout

            # Identificar el dispositivo
            idn = self.instrument.query("*IDN?")
            logger.info(f"Dispositivo conectado: {idn.strip()}")

            # Reset del instrumento
            self.instrument.write("*RST")
            time.sleep(2)

            # Configurar idioma inglés para comandos consistentes
            self.instrument.write("SYST:LANG ENG")

            self.connected = True
            return True

        except Exception as e:
            logger.error(f"Error al conectar: {e}")
            self.connected = False
            return False

    def disconnect(self):
        """Desconectar del dispositivo"""
        if self.instrument:
            self.instrument.close()
            self.connected = False
            logger.info("Desconectado del DSA815")

    def configure_frequency(self, center_freq: float, span: float):
        """
        Configurar la frecuencia central y el span

        Args:
            center_freq: Frecuencia central en Hz
            span: Ancho de banda en Hz
        """
        if not self.connected:
            raise ConnectionError("No conectado al dispositivo")

        self.center_freq = center_freq
        self.span = span

        self.instrument.write(f"FREQ:CENT {center_freq}")
        self.instrument.write(f"FREQ:SPAN {span}")

        logger.info(f"Frecuencia configurada: Centro={center_freq/1e6:.1f}MHz, Span={span/1e6:.1f}MHz")

    def configure_bandwidth(self, rbw: float, vbw: float):
        """
        Configurar el ancho de banda de resolución (RBW) y video (VBW)

        Args:
            rbw: Resolution Bandwidth en Hz
            vbw: Video Bandwidth en Hz
        """
        if not self.connected:
            raise ConnectionError("No conectado al dispositivo")

        self.rbw = rbw
        self.vbw = vbw

        self.instrument.write(f"BAND:RES {rbw}")
        self.instrument.write(f"BAND:VID {vbw}")

        logger.info(f"Ancho de banda configurado: RBW={rbw/1e3:.1f}kHz, VBW={vbw/1e3:.1f}kHz")

    def set_reference_level(self, level: float):
        """
        Configurar el nivel de referencia (Reference Level)

        Args:
            level: Nivel de referencia en dBm
        """
        if not self.connected:
            raise ConnectionError("No conectado al dispositivo")

        self.reference_level = level
        self.instrument.write(f"DISP:TRAC:Y:RLEV {level}")

        logger.info(f"Nivel de referencia configurado: {level}dBm")

    def start_continuous_measurement(self):
        """Iniciar medición continua"""
        if not self.connected:
            raise ConnectionError("No conectado al dispositivo")

        self.instrument.write("INIT:CONT ON")
        logger.info("Medición continua iniciada")

    def stop_measurement(self):
        """Detener medición"""
        if not self.connected:
            raise ConnectionError("No conectado al dispositivo")

        self.instrument.write("INIT:CONT OFF")
        logger.info("Medición detenida")

    def trigger_single_measurement(self):
        """Realizar una medición única (single sweep)"""
        if not self.connected:
            raise ConnectionError("No conectado al dispositivo")

        self.instrument.write("INIT:CONT OFF")  # Asegurar que esté en modo single
        time.sleep(0.1)  # Pequeño delay
        self.instrument.write("INIT:IMM")  # Trigger inmediato
        time.sleep(0.1)

        # Esperar hasta que la medición esté completa
        # Verificar el estado completando la operación
        try:
            opc_status = self.instrument.query("*OPC?")
            logger.info("Medición única completada")
        except:
            logger.warning("Timeout esperando completación, continuando...")

    def get_trace_data(self, trace: int = 1) -> Tuple[np.ndarray, np.ndarray]:
        """
        Obtener datos del trazo espectral

        Args:
            trace: Número del trazo (1-4)

        Returns:
            Tuple[np.ndarray, np.ndarray]: (frecuencias, amplitudes)
        """
        if not self.connected:
            raise ConnectionError("No conectado al dispositivo")

        try:
            # Obtener puntos del trazo
            points = int(self.instrument.query("SENS:SWE:POIN?"))

            # Obtener datos de frecuencia
            freq_start = float(self.instrument.query("FREQ:STAR?"))
            freq_stop = float(self.instrument.query("FREQ:STOP?"))
            frequencies = np.linspace(freq_start, freq_stop, points)

            # Obtener datos de amplitud
            trace_data = self.instrument.query(f"TRAC? TRACE{trace}")
            amplitudes = np.array([float(x) for x in trace_data.split(',')])

            return frequencies, amplitudes

        except Exception as e:
            logger.error(f"Error obteniendo datos del trazo: {e}")
            return np.array([]), np.array([])

    def add_marker(self, marker_num: int, frequency: Optional[float] = None):
        """
        Agregar un marcador en una frecuencia específica

        Args:
            marker_num: Número del marcador (1-4)
            frequency: Frecuencia en Hz (opcional, si no se especifica usa el máximo)
        """
        if not self.connected:
            raise ConnectionError("No conectado al dispositivo")

        self.instrument.write(f"CALC:MARK{marker_num}:MODE POS")

        if frequency:
            self.instrument.write(f"CALC:MARK{marker_num}:X {frequency}")
        else:
            # Colocar en el máximo
            self.instrument.write(f"CALC:MARK{marker_num}:MAX")

        # Leer valores del marcador
        freq = float(self.instrument.query(f"CALC:MARK{marker_num}:X?"))
        amp = float(self.instrument.query(f"CALC:MARK{marker_num}:Y?"))

        logger.info(f"Marcador {marker_num}: Frecuencia={freq/1e6:.3f}MHz, Amplitud={amp:.2f}dBm")

    def get_marker_value(self, marker_num: int) -> Tuple[float, float]:
        """
        Obtener valores de un marcador

        Args:
            marker_num: Número del marcador

        Returns:
            Tuple[float, float]: (frecuencia, amplitud)
        """
        if not self.connected:
            raise ConnectionError("No conectado al dispositivo")

        freq = float(self.instrument.query(f"CALC:MARK{marker_num}:X?"))
        amp = float(self.instrument.query(f"CALC:MARK{marker_num}:Y?"))

        return freq, amp

    def save_measurement_data(self, filename: str, trace: int = 1):
        """
        Guardar datos de medición en archivo CSV

        Args:
            filename: Nombre del archivo
            trace: Número del trazo
        """
        frequencies, amplitudes = self.get_trace_data(trace)

        if len(frequencies) > 0:
            data = np.column_stack((frequencies/1e6, amplitudes))  # Frecuencia en MHz
            np.savetxt(filename, data, delimiter=',', header='Frequency_MHz,Amplitude_dBm', fmt='%.6f')
            logger.info(f"Datos guardados en {filename}")
        else:
            logger.error("No hay datos para guardar")

    def plot_spectrum(self, trace: int = 1, save_plot: bool = False, filename: str = "spectrum_plot.png"):
        """
        Graficar el espectro actual

        Args:
            trace: Número del trazo
            save_plot: Si guardar la gráfica como imagen
            filename: Nombre del archivo para guardar
        """
        frequencies, amplitudes = self.get_trace_data(trace)

        if len(frequencies) > 0:
            plt.figure(figsize=(12, 8))

            # Convertir frecuencia a MHz para mejor visualización
            freq_mhz = frequencies / 1e6

            plt.plot(freq_mhz, amplitudes, 'b-', linewidth=2)

            # Configuración del gráfico
            plt.title(f'Espectro Analizador RIGOL DSA815', fontsize=16, fontweight='bold')
            plt.xlabel('Frecuencia (MHz)', fontsize=14)
            plt.ylabel('Amplitud (dBm)', fontsize=14)
            plt.grid(True, alpha=0.3)

            # Configurar límites del eje Y
            plt.ylim(self.reference_level - 100, self.reference_level + 10)

            # Formatear eje X
            plt.xticks(np.arange(min(freq_mhz), max(freq_mhz)+1, 50))

            # Agregar información del instrumento
            info_text = f"Centro: {self.center_freq/1e6:.1f} MHz\nSpan: {self.span/1e6:.1f} MHz\nRBW: {self.rbw/1e3:.1f} kHz"
            plt.annotate(info_text, xy=(0.02, 0.98), xycoords='axes fraction',
                        verticalalignment='top', bbox=dict(boxstyle='round', facecolor='wheat'))

            plt.tight_layout()

            if save_plot:
                plt.savefig(filename, dpi=300, bbox_inches='tight')
                logger.info(f"Gráfica guardada como {filename}")

            plt.show()
        else:
            logger.error("No hay datos para graficar")


# Función de ejemplo de uso
def example_usage():
    """Ejemplo básico de uso de la librería"""

    # Crear instancia del control DSA815
    dsa = RigolDSA815()

    try:
        # Conectar
        if dsa.connect():
            logger.info("Conexión exitosa")

            # Configurar parámetros básicos
            dsa.configure_frequency(100e6, 200e6)  # 100 MHz centro, 200 MHz span
            dsa.configure_bandwidth(100e3, 100e3)   # RBW y VBW de 100 kHz
            dsa.set_reference_level(-30)             # Nivel de referencia -30 dBm

            # Realizar medición única
            dsa.trigger_single_measurement()

            # Agregar marcador
            dsa.add_marker(1)

            # Mostrar gráfica
            dsa.plot_spectrum(save_plot=True, filename="spectrum_example.png")

            # Guardar datos
            dsa.save_measurement_data("measurement_data.csv")

        else:
            logger.error("No se pudo conectar al dispositivo")

    except Exception as e:
        logger.error(f"Error en el ejemplo: {e}")

    finally:
        dsa.disconnect()


if __name__ == "__main__":
    print("Librería de Control Rigol DSA815")
    print("================================")
    print("Ejecutando ejemplo de uso...")

    example_usage()

    print("\nPara usar con tu propio código:")
    print("from rigol_dsa815_control import RigolDSA815")
    print("dsa = RigolDSA815()")
    print("dsa.connect()")
    print("# ... configuración y mediciones")
    print("dsa.plot_spectrum()")
