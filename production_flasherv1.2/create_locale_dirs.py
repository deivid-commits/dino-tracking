#!/usr/bin/env python3
"""Create locale directories for internationalization"""

import os
from pathlib import Path

def create_locale_dirs():
    """Create locale directory structure"""
    base_locale_dir = Path(__file__).parent / 'locale'

    # Create directories for supported languages
    languages = ['zh_CN', 'zh_TW']

    for lang in languages:
        lang_dir = base_locale_dir / lang / 'LC_MESSAGES'
        lang_dir.mkdir(parents=True, exist_ok=True)
        print(f"Created directory: {lang_dir}")

if __name__ == "__main__":
    create_locale_dirs()
