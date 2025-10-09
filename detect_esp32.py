import serial.tools.list_ports
import time

def find_esp32_ports():
    """
    Escanea los puertos serie en busca de dispositivos ESP32 y devuelve una lista de puertos candidatos.
    """
    print("--- Escaneando puertos serie en busca de ESP32 ---")
    
    ports = serial.tools.list_ports.comports()
    esp32_ports = []

    if not ports:
        print("🔌 No se encontraron puertos serie conectados.")
        return []

    print(f"🔎 Se encontraron {len(ports)} puertos serie. Analizando cada uno...")
    
    for port in ports:
        print(f"\nDispositivo: {port.device}")
        print(f"  - Descripción: {port.description}")
        print(f"  - Fabricante: {port.manufacturer}")
        print(f"  - ID de Hardware: {port.hwid}")
        print(f"  - ID de Vendedor (VID): {port.vid}")
        print(f"  - ID de Producto (PID): {port.pid}")

        # --- Lógica de Detección ---
        # Los ESP32 suelen usar chips de Espressif (VID=303A), Silicon Labs (VID=10C4) o WCH (VID=1A86).
        # Agregamos cualquier puerto que coincida con estos fabricantes.
        is_esp32 = False
        if port.vid == 0x303A or (port.manufacturer and "Espressif" in port.manufacturer):
            print("  ✅ Posible ESP32 (chip nativo de Espressif)")
            is_esp32 = True
        elif port.vid == 0x10C4 or (port.manufacturer and "Silicon Labs" in port.manufacturer):
            print("  ✅ Posible ESP32 (chip Silicon Labs CP210x)")
            is_esp32 = True
        elif port.vid == 0x1A86 or (port.manufacturer and "wch.cn" in port.manufacturer):
            print("  ✅ Posible ESP32 (chip WCH CH340)")
            is_esp32 = True
        elif port.description and "USB-SERIAL CH340" in port.description:
            print("  ✅ Posible ESP32 (chip WCH CH340 por descripción)")
            is_esp32 = True
        
        if is_esp32:
            esp32_ports.append(port)

    if not esp32_ports:
        print("\n❌ No se pudo identificar ningún ESP32 automáticamente.")
    else:
        print(f"\n✅ Se identificaron {len(esp32_ports)} posibles ESP32.")

    return esp32_ports

if __name__ == "__main__":
    try:
        while True:
            esp32_devices = find_esp32_ports()
            
            if not esp32_devices:
                print("\n⚠️ Por favor, conecta un dispositivo ESP32.")
            else:
                print("\n--- Dispositivos ESP32 Detectados ---")
                for device in esp32_devices:
                    print(f"  - Puerto: {device.device} ({device.description})")
            
            print("\n----------------------------------------")
            print("Volviendo a escanear en 5 segundos... (Presiona Ctrl+C para salir)")
            time.sleep(5)
            
    except KeyboardInterrupt:
        print("\n👋 Saliendo del programa.")
