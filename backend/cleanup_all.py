#!/usr/bin/env python3
"""
Emergency cleanup script - removes ALL processed and uploaded files
Use this if your system is running out of memory/storage
"""

import shutil
from pathlib import Path

# Folders to clean
UPLOAD_FOLDER = Path('uploads')
OUTPUT_FOLDER = Path('processed')

def cleanup_all_files():
    """Remove all upload and processed folders"""
    total_removed = 0
    total_size = 0
    
    print("=" * 70)
    print("🧹 EMERGENCY CLEANUP - Removing ALL processed files")
    print("=" * 70)
    
    # Clean upload folders
    if UPLOAD_FOLDER.exists():
        print(f"\n📁 Cleaning {UPLOAD_FOLDER}...")
        for folder in UPLOAD_FOLDER.iterdir():
            if folder.is_dir():
                try:
                    # Calculate folder size
                    folder_size = sum(f.stat().st_size for f in folder.rglob('*') if f.is_file())
                    total_size += folder_size
                    
                    shutil.rmtree(folder)
                    total_removed += 1
                    print(f"  ✓ Removed {folder.name} ({folder_size / (1024*1024):.1f} MB)")
                except Exception as e:
                    print(f"  ✗ Failed to remove {folder.name}: {e}")
    
    # Clean processed folders
    if OUTPUT_FOLDER.exists():
        print(f"\n📁 Cleaning {OUTPUT_FOLDER}...")
        for folder in OUTPUT_FOLDER.iterdir():
            if folder.is_dir():
                try:
                    # Calculate folder size
                    folder_size = sum(f.stat().st_size for f in folder.rglob('*') if f.is_file())
                    total_size += folder_size
                    
                    shutil.rmtree(folder)
                    total_removed += 1
                    print(f"  ✓ Removed {folder.name} ({folder_size / (1024*1024):.1f} MB)")
                except Exception as e:
                    print(f"  ✗ Failed to remove {folder.name}: {e}")
    
    print("\n" + "=" * 70)
    print(f"✅ Cleanup Complete!")
    print(f"   Folders removed: {total_removed}")
    print(f"   Space freed: {total_size / (1024*1024):.1f} MB")
    print("=" * 70)
    print("\n💡 Tip: Restart your backend server to clear memory:")
    print("   python3 processing_api.py")
    print("=" * 70)

if __name__ == "__main__":
    import sys
    
    # Safety confirmation
    print("\n⚠️  WARNING: This will delete ALL processed files!")
    print("    - All upload folders will be removed")
    print("    - All processed folders will be removed")
    print("    - Active jobs will be lost")
    print()
    
    if '--force' in sys.argv:
        cleanup_all_files()
    else:
        response = input("Are you sure you want to continue? (yes/no): ")
        if response.lower() in ['yes', 'y']:
            cleanup_all_files()
        else:
            print("\n❌ Cleanup cancelled")
