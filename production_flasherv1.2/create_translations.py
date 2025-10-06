#!/usr/bin/env python3
"""Create translation files (.po and .mo) for DinoCore Production Flasher"""

import os
import msgfmt
from pathlib import Path

def create_po_file(language_code, translations):
    """Create a .po file for the given language"""

    # PO file header
    po_content = f'''# DinoCore Production Flasher Translation
# Language: {language_code}
# Generated automatically

msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Language: {language_code}\\n"
"Plural-Forms: nplurals=1; plural=0;\\n"

'''

    # Add translations
    for msgid, msgstr in translations.items():
        po_content += f'msgid "{msgid}"\n'
        po_content += f'msgstr "{msgstr}"\n\n'

    return po_content

def compile_mo_file(po_content, mo_path):
    """Compile .po content to .mo file"""
    # Write temporary .po file
    temp_po = mo_path.with_suffix('.po')
    with open(temp_po, 'w', encoding='utf-8') as f:
        f.write(po_content)

    # Compile to .mo
    msgfmt.make(temp_po, mo_path)

    # Remove temporary .po
    temp_po.unlink()

def create_chinese_translations():
    """Create translations for Chinese languages"""

    # Chinese Simplified (zh_CN) translations
    zh_cn_translations = {
        # Window titles and headers
        "🦕 DinoCore Production Flasher v1.2.0": "🦕 DinoCore 生产闪存器 v1.2.0",
        " ⚙️ Configuration ": " ⚙️ 配置 ",
        " 🎮 Control Panel ": " 🎮 控制面板 ",
        " 📋 Activity Log ": " 📋 活动日志 ",

        # Labels and buttons
        "🎯 Target HW Version:": "🎯 目标硬件版本:",
        "💾 Save Version": "💾 保存版本",
        "▶️  SELECT A MODE": "▶️  选择模式",
        "🏭 PRODUCTION MODE": "🏭 生产模式",
        "🧪 TESTING MODE": "🧪 测试模式",
        "⏹️  STOP & CHANGE MODE": "⏹️  停止并更改模式",

        # Status messages
        "ACTIVE MODE: PRODUCTION": "激活模式：生产",
        "ACTIVE MODE: TESTING": "激活模式：测试",
        "--- SCANNING STOPPED ---": "--- 扫描停止 ---",
        "Please select a new mode.": "请选择新模式。",

        # Connection status
        "🔗 SERVER ONLINE": "🔗 服务器在线",
        "⚠️ SERVER ISSUES": "⚠️ 服务器问题",
        "❌ OFFLINE": "❌ 离线",

        # Log messages
        "Using Target HW Version:": "使用目标硬件版本：",
        "Ignoring existing ports:": "忽略现有端口：",
        "Waiting for new devices...": "等待新设备...",
        "Ports disconnected:": "端口已断开：",

        # Firmware operations
        "Downloading {mode} firmware for HW {hardware_version}...": "正在下载 {mode} 固件（硬件版本 {hardware_version}）...",
        "[X] No compatible {mode} firmware found for HW {hardware_version}.": "[X] 未找到与硬件版本 {hardware_version} 兼容的 {mode} 固件。",
        "Found compatible build: {name}": "找到兼容版本：{name}",
        "Downloading {filename}...": "正在下载 {filename}...",
        "[OK] {mode} firmware for {hardware_version} downloaded successfully.": "[OK] {mode} 固件（硬件版本 {hardware_version}）下载成功。",
        "[X] Network error while downloading: {error}": "[X] 下载时网络错误：{error}",

        # eFuse operations
        "Attempting to burn eFuse with version {version}...": "正在尝试使用版本 {version} 烧录 eFuse...",
        "Attempting to reset device into download mode...": "正在尝试将设备重置为下载模式...",
        "Device reset successful, proceeding with eFuse burning...": "设备重置成功，正在进行 eFuse 烧录...",
        "Device reset failed, but continuing with eFuse burning...": "设备重置失败，但继续进行 eFuse 烧录...",
        "[X] Invalid version format: {version}": "[X] 无效的版本格式：{version}",
        "[OK] eFuse burned successfully.": "[OK] eFuse 烧录成功。",
        "[OK] Verification successful. Version {version} is burned.": "[OK] 验证成功。版本 {version} 已烧录。",
        "[X] VERIFICATION FAILED. Burned version ({burned}) does not match target ({target}). Stopping.": "[X] 验证失败。烧录版本（{burned}）与目标版本（{target}）不匹配。停止。",
        "Could not burn eFuse. It might be already written.": "无法烧录 eFuse。可能已被写入。",
        "eFuse burn error: {error}": "eFuse 烧录错误：{error}",

        # Reading eFuse
        "Attempting to read eFuse from {port}...": "正在尝试从 {port} 读取 eFuse...",
        "[X] Failed to read eFuse. Maybe locked?": "[X] 读取 eFuse 失败。可能已锁定？",
        "[OK] Found raw eFuse version: {version}": "[OK] 找到原始 eFuse 版本：{version}",
        "[!] eFuse block is empty (version 0.0.0). Treating as no version found.": "[!] eFuse 块为空（版本 0.0.0）。视为未找到版本。",
        "[!] No version found on eFuse.": "[!] 未在 eFuse 上找到版本。",
    }

    # Chinese Traditional (zh_TW) translations
    zh_tw_translations = {
        # Window titles and headers (Traditional Chinese)
        "🦕 DinoCore Production Flasher v1.2.0": "🦕 DinoCore 生產燒錄器 v1.2.0",
        " ⚙️ Configuration ": " ⚙️ 設定 ",
        " 🎮 Control Panel ": " 🎮 控制面板 ",
        " 📋 Activity Log ": " 📋 活動日誌 ",

        # Labels and buttons
        "🎯 Target HW Version:": "🎯 目標硬體版本:",
        "💾 Save Version": "💾 儲存版本",
        "▶️  SELECT A MODE": "▶️  選擇模式",
        "🏭 PRODUCTION MODE": "🏭 生產模式",
        "🧪 TESTING MODE": "🧪 測試模式",
        "⏹️  STOP & CHANGE MODE": "⏹️  停止並更改模式",

        # Status messages
        "ACTIVE MODE: PRODUCTION": "啟動模式：生產",
        "ACTIVE MODE: TESTING": "啟動模式：測試",
        "--- SCANNING STOPPED ---": "--- 掃描停止 ---",
        "Please select a new mode.": "請選擇新模式。",

        # Connection status
        "🔗 SERVER ONLINE": "🔗 伺服器線上",
        "⚠️ SERVER ISSUES": "⚠️ 伺服器問題",
        "❌ OFFLINE": "❌ 離線",

        # Log messages
        "Using Target HW Version:": "使用目標硬體版本：",
        "Ignoring existing ports:": "忽略現有連接埠：",
        "Waiting for new devices...": "等待新設備...",
        "Ports disconnected:": "連接埠已斷開：",

        # Firmware operations
        "Downloading {mode} firmware for HW {hardware_version}...": "正在下載 {mode} 固件（硬體版本 {hardware_version}）...",
        "[X] No compatible {mode} firmware found for HW {hardware_version}.": "[X] 未找到與硬體版本 {hardware_version} 相容的 {mode} 固件。",
        "Found compatible build: {name}": "找到相容版本：{name}",
        "Downloading {filename}...": "正在下載 {filename}...",
        "[OK] {mode} firmware for {hardware_version} downloaded successfully.": "[OK] {mode} 固件（硬體版本 {hardware_version}）下載成功。",
        "[X] Network error while downloading: {error}": "[X] 下載時網路錯誤：{error}",

        # eFuse operations
        "Attempting to burn eFuse with version {version}...": "正在嘗試使用版本 {version} 燒錄 eFuse...",
        "Attempting to reset device into download mode...": "正在嘗試將設備重設為下載模式...",
        "Device reset successful, proceeding with eFuse burning...": "設備重設成功，正在進行 eFuse 燒錄...",
        "Device reset failed, but continuing with eFuse burning...": "設備重設失敗，但繼續進行 eFuse 燒錄...",
        "[X] Invalid version format: {version}": "[X] 無效的版本格式：{version}",
        "[OK] eFuse burned successfully.": "[OK] eFuse 燒錄成功。",
        "[OK] Verification successful. Version {version} is burned.": "[OK] 驗證成功。版本 {version} 已燒錄。",
        "[X] VERIFICATION FAILED. Burned version ({burned}) does not match target ({target}). Stopping.": "[X] 驗證失敗。燒錄版本（{burned}）與目標版本（{target}）不相符。停止。",
        "Could not burn eFuse. It might be already written.": "無法燒錄 eFuse。可能已被寫入。",
        "eFuse burn error: {error}": "eFuse 燒錄錯誤：{error}",

        # Reading eFuse
        "Attempting to read eFuse from {port}...": "正在嘗試從 {port} 讀取 eFuse...",
        "[X] Failed to read eFuse. Maybe locked?": "[X] 讀取 eFuse 失敗。可能已鎖定？",
        "[OK] Found raw eFuse version: {version}": "[OK] 找到原始 eFuse 版本：{version}",
        "[!] eFuse block is empty (version 0.0.0). Treating as no version found.": "[!] eFuse 區塊為空（版本 0.0.0）。視為未找到版本。",
        "[!] No version found on eFuse.": "[!] 未在 eFuse 上找到版本。",
    }

    # Add common translations (same for both simplified and traditional)
    common_translations = {
        # Flashing operations
        "\n📦 Update available: {version}": "\n📦 可用更新：{version}",
        "\n📋 Changelog:": "\n📋 更新日誌：",
        "✅ You're up to date! (version {version})": "✅ 您已是最新版本！（版本 {version}）",
        "❌ Update cancelled by user": "❌ 用戶取消更新",
        "❌ No download URL found for update": "❌ 未找到更新下載網址",
        "\n🔄 Starting update to version {version}...": "\n🔄 開始更新到版本 {version}...",
        "✅ Backup created in: {backup_dir}": "✅ 備份已建立於：{backup_dir}",
        "❌ Failed to create backup: {error}": "❌ 建立備份失敗：{error}",
        "📥 Downloading update...": "📥 正在下載更新...",
        "✅ Update downloaded to: {zip_path}": "✅ 更新已下載到：{zip_path}",
        "❌ Failed to download update: {error}": "❌ 下載更新失敗：{error}",
        "📂 Extracting update...": "📂 正在解壓縮更新...",
        "🔄 Installing update files...": "🔄 正在安裝更新檔案...",
        "   📄 Updated: {file}": "   📄 已更新：{file}",
        "\n✅ Successfully updated to version {version}!": "\n✅ 成功更新到版本 {version}！",
        "🔄 It's recommended to restart the application": "🔄 建議重新啟動應用程式",

        # Main flashing process
        "-- Starting {mode} flash for HW {hardware_version} on {port} --": "-- 開始為 {port} 上的硬體版本 {hardware_version} 進行 {mode} 燒錄 --",
        "[X] Download for {hardware_version} failed. Aborting flash.": "[X] {hardware_version} 下載失敗。中止燒錄。",
        "\n[OK] Flash successful!\n": "\n[OK] 燒錄成功！\n",
        "\n[X] Flash failed with exit code {code}.\n": "\n[X] 燒錄失敗，退出程式碼 {code}。\n",
        "\n[X] An unexpected error occurred during flash: {error}\n": "\n[X] 燒錄期間發生意外錯誤：{error}\n",

        # Dialogs
        "Success": "成功",
        "Hardware version saved: {version}": "硬體版本已儲存：{version}",
        "Error": "錯誤",
        "Invalid version format. Please use format X.Y.Z (e.g., 1.9.1)": "無效的版本格式。請使用格式 X.Y.Z（例如：1.9.1）",

        # Warnings
        "Warning": "警告",
        "Production mode will NOT burn eFuses and requires devices to be tested first. Continue?": "生產模式不會燒錄 eFuses，需要先測試設備。繼續？",
        "Notice": "注意",
        "Testing mode will attempt to burn HW version {version} to eFuses. This is irreversible. Continue?": "測試模式將嘗試將硬體版本 {version} 燒錄到 eFuses。這是不可逆轉的。繼續？"
    }

    # Add common translations to both languages
    zh_cn_translations.update(common_translations)
    zh_tw_translations.update(common_translations)

    return zh_cn_translations, zh_tw_translations

def main():
    """Main function to create translation files"""

    # Create translations directory if needed
    base_dir = Path(__file__).parent

    # Get translations
    zh_cn_translations, zh_tw_translations = create_chinese_translations()

    # Create .po content and compile to .mo for zh_CN
    zh_cn_po_content = create_po_file('zh_CN', zh_cn_translations)
    zh_cn_mo_path = base_dir / 'locale' / 'zh_CN' / 'LC_MESSAGES' / 'dino_flasher.mo'
    compile_mo_file(zh_cn_po_content, zh_cn_mo_path)
    print(f"Created Chinese Simplified translations: {zh_cn_mo_path}")

    # Create .po content and compile to .mo for zh_TW
    zh_tw_po_content = create_po_file('zh_TW', zh_tw_translations)
    zh_tw_mo_path = base_dir / 'locale' / 'zh_TW' / 'LC_MESSAGES' / 'dino_flasher.mo'
    compile_mo_file(zh_tw_po_content, zh_tw_mo_path)
    print(f"Created Chinese Traditional translations: {zh_tw_mo_path}")

    print("Translation files created successfully!")

if __name__ == "__main__":
    main()
