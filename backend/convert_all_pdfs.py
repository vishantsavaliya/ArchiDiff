#!/usr/bin/env python3
"""
Convert PDFs to PNG images at high resolution.
Can process a single PDF file or all PDFs in a directory.

Usage:
  python3 convert_all_pdfs.py <input> <output_dir> [--dpi DPI]
  
  input: PDF file path or directory containing PDFs
  output_dir: Directory to save PNG files
  --dpi: DPI scale factor (default: 4.0 for 400 DPI)
"""

import fitz  # PyMuPDF
import os
import sys
import argparse
from pathlib import Path

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
        print(f"Error: {e}")
        return False, 0, 0

def main():
    parser = argparse.ArgumentParser(description='Convert PDFs to PNG')
    parser.add_argument('input', help='PDF file or directory containing PDFs')
    parser.add_argument('output', help='Output directory for PNG files')
    parser.add_argument('--dpi', type=float, default=4.0, help='DPI scale factor (default: 4.0)')
    
    args = parser.parse_args()
    
    input_path = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(exist_ok=True, parents=True)
    
    # Get list of PDF files
    if input_path.is_file() and input_path.suffix.lower() == '.pdf':
        pdf_files = [input_path]
    elif input_path.is_dir():
        pdf_files = list(input_path.glob("*.pdf"))
    else:
        print(f"Error: {input_path} is not a valid PDF file or directory")
        sys.exit(1)
    
    if not pdf_files:
        print(f"No PDF files found in {input_path}")
        sys.exit(1)
    
    print(f"Found {len(pdf_files)} PDF file(s)")
    print(f"Output directory: {output_dir}")
    print("-" * 60)
    
    converted_count = 0
    total_size = 0
    
    for pdf_file in pdf_files:
        # Output filename
        png_name = pdf_file.stem + ".png"
        output_path = output_dir / png_name
        
        print(f"Converting: {pdf_file.name}...", end=" ")
        
        success, width, height = convert_pdf_to_png(pdf_file, output_path, args.dpi)
        
        if success:
            size_kb = output_path.stat().st_size / 1024
            total_size += size_kb
            converted_count += 1
            print(f"✓ {width}x{height} ({size_kb:.1f} KB)")
        else:
            print("✗ FAILED")
    
    print("-" * 60)
    print(f"Converted: {converted_count}/{len(pdf_files)} files")
    if total_size > 0:
        print(f"Total size: {total_size/1024:.1f} MB")
    print(f"Output directory: {output_dir}")

if __name__ == '__main__':
    main()
