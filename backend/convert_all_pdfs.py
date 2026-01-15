#!/usr/bin/env python3
"""
Convert all PDFs to PNG images at high resolution.
Creates a 'converted/' directory with all PNG outputs.
"""

import fitz  # PyMuPDF
import os
from pathlib import Path

# Directories
DETAILS_DIR = Path(__file__).parent / "details"
OUTPUT_DIR = Path(__file__).parent / "converted"
OUTPUT_DIR.mkdir(exist_ok=True)

def convert_pdf_to_png(pdf_path, output_path, dpi=4.0):
    """Convert PDF to PNG at specified DPI (default 400 DPI)"""
    try:
        doc = fitz.open(pdf_path)
        page = doc[0]  # First page only
        
        # Render at high resolution
        mat = fitz.Matrix(dpi, dpi)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        
        # Save
        pix.save(output_path)
        doc.close()
        
        return True, pix.width, pix.height
    except Exception as e:
        return False, 0, 0

# Get all PDFs
pdf_files = list(DETAILS_DIR.glob("*.pdf"))

print(f"Found {len(pdf_files)} PDF files")
print(f"Output directory: {OUTPUT_DIR}")
print("-" * 60)

converted_count = 0
total_size = 0

for pdf_file in pdf_files:
    # Output filename
    png_name = pdf_file.stem + ".png"
    output_path = OUTPUT_DIR / png_name
    
    print(f"Converting: {pdf_file.name}...", end=" ")
    
    success, width, height = convert_pdf_to_png(pdf_file, output_path)
    
    if success:
        size_kb = output_path.stat().st_size / 1024
        total_size += size_kb
        converted_count += 1
        print(f"✓ {width}x{height} ({size_kb:.1f} KB)")
    else:
        print("✗ FAILED")

print("-" * 60)
print(f"Converted: {converted_count}/{len(pdf_files)} files")
print(f"Total size: {total_size/1024:.1f} MB")
print(f"Output directory: {OUTPUT_DIR}")
