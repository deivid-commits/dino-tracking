#!/usr/bin/env python3
"""
Script de debug para Rigol DSA815
==============================

Este script prueba diferentes comandos para obtener datos del DSA815
"""

import pyvisa
import time

def debug_dsa815():
    try:
        rm = pyvisa.ResourceManager()
        instr = rm.open_resource("USB0::0x1AB1::0x0960::DSA8A204201242::INSTR")
        instr.timeout = 10000  # 10 segundos

        print("Dispositivo conectado!")

        # Reset
        instr.write("*RST")
        time.sleep(3)
        print("*RST enviado")

        # Idiomas
        instr.write("SYST:LANG ENG")
        print("Idioma configurado a ING")

        # Configurar frecuencia
        instr.write("FREQ:CENT 100e6")
        print("Centro de frecuencia: 100MHz")

        instr.write("FREQ:SPAN 200e6")
        print("Span: 200MHz")

        # Configurar RBW/VBW
        instr.write("BAND:RES 100e3")
        print("RBW: 100kHz")

        instr.write("BAND:VID 100e3")
        print("VBW: 100kHz")

        # Configuración de referencia
        instr.write("DISP:TRAC:Y:RLEV -30")
        print("Reference Level: -30dBm")

        # Activar trazo 1
        instr.write("TRAC1:MODE WRIT")
        print("Trazo 1 activado")

        # Iniciar medición única
        instr.write("INIT:CONT OFF")
        time.sleep(0.2)
        print("Modo single-shot")

        instr.write("INIT:IMM")
        time.sleep(0.5)
        print("Medición iniciada")

        # Verificar operaciones completadas
        try:
            opc = instr.query("*OPC?")
            print(f"*OPC?: {opc.strip()}")
        except:
            print("*OPC? timeout")

        # Obtener información del sistema
        try:
            version = instr.query("SYSTem:VERSion?")
            print(f"Versión: {version.strip()}")
        except Exception as e:
            print(f"Error versión: {e}")

        # Obtener número de puntos
        try:
            points = instr.query("SENS:SWE:POIN?")
            print(f"Puntos: {points.strip()}")
        except Exception as e:
            print(f"Error puntos: {e}")

        # Verificar frecuencia
        try:
            start_freq = instr.query("FREQ:STAR?")
            stop_freq = instr.query("FREQ:STOP?")
            print(f"Frecuencia: inicio={start_freq.strip()}Hz, fin={stop_freq.strip()}Hz")
        except Exception as e:
            print(f"Error frecuencia: {e}")

        # Intentar obtener datos - diferentes comandos
        print("\nIntentando obtener datos del trazo...")

        # Comando 1: TRAC? TRACE1
        try:
            print("Probando TRAC? TRACE1...")
            trace_data = instr.query("TRAC? TRACE1")
            print(f"✅ TRAC? TRACE1 exitoso: longitud={len(trace_data)}")
            print(f"Primeros 100 caracteres: {trace_data[:100]}")
        except Exception as e:
            print(f"❌ TRAC? TRACE1 falló: {e}")

        # Comando 2: TRAC1:DATA?
        try:
            print("Probando TRAC1:DATA?...")
            trace_data = instr.query("TRAC1:DATA?")
            print(f"✅ TRAC1:DATA? exitoso: longitud={len(trace_data)}")
            print(f"Primeros 100 caracteres: {trace_data[:100]}")
        except Exception as e:
            print(f"❌ TRAC1:DATA? falló: {e}")

        # Comando 3: READ:SPECtrum:TRACE1?
        try:
            print("Probando READ:SPECtrum:TRACE1?...")
            trace_data = instr.query("READ:SPECtrum:TRACE1?")
            print(f"✅ READ:SPECtrum:TRACE1? exitoso: longitud={len(trace_data)}")
            print(f"Primeros 100 caracteres: {trace_data[:100]}")
        except Exception as e:
            print(f"❌ READ:SPECtrum:TRACE1? falló: {e}")

        # Comando 4: FETCH:SPECtrum:TRACE1?
        try:
            print("Probando FETCH:SPECtrum:TRACE1?...")
            trace_data = instr.query("FETCH:SPECtrum:TRACE1?")
            print(f"✅ FETCH:SPECtrum:TRACE1? exitoso: longitud={len(trace_data)}")
            print(f"Primeros 100 caracteres: {trace_data[:100]}")
        except Exception as e:
            print(f"❌ FETCH:SPECtrum:TRACE1? falló: {e}")

        instr.close()
        print("\nDesconectado")

    except Exception as e:
        print(f"Error fatal: {e}")

if __name__ == "__main__":
    debug_dsa815()
