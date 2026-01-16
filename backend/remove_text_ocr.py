#!/usr/bin/env python3
"""
Text Removal using EasyOCR + Inpainting
Simpler and more stable than PaddleOCR
"""

import cv2
import numpy as np
from pathlib import Path
import sys

# Configuration
MASK_DILATION = 3
USE_WHITE_FILL = True  # True = white fill, False = inpaint (blur)
INPAINT_RADIUS = 7  # Only used if USE_WHITE_FILL = False
TWO_PASS = False  # Single pass is sufficient for upscaled images

def remove_text_easyocr(image_path, output_path):
    """Remove text using EasyOCR detection + cv2.inpaint"""
    try:
        import easyocr
    except ImportError:
        print("Installing EasyOCR...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "easyocr"])
        import easyocr
    
    print(f"Loading image: {image_path}")
    image = cv2.imread(str(image_path))
    if image is None:
        raise ValueError(f"Could not load image: {image_path}")
    
    h, w = image.shape[:2]
    print(f"Image size: {w}x{h}")
    
    # Initialize EasyOCR
    print("Initializing EasyOCR (first run downloads models)...")
    reader = easyocr.Reader(['en'], gpu=False, verbose=False)
    current_image = image.copy()
    total_removed = 0
    
    # Two-pass approach
    max_passes = 2 if TWO_PASS else 1
    
    for pass_num in range(1, max_passes + 1):
        if max_passes > 1:
            print(f"\n--- Pass {pass_num}/{max_passes} ---")
        
        # Detect text
        print("Detecting text...")
        results = reader.readtext(current_image, paragraph=False)
        
        if not results:
            print("No text detected")
            if pass_num == 1 and max_passes == 1:
                cv2.imwrite(str(output_path), current_image)
                return
            break
        
        print(f"Found {len(results)} text regions")
        
        # Create mask
        mask = np.zeros(current_image.shape[:2], dtype=np.uint8)
        
        for (bbox, text, prob) in results:
            # bbox is [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
            pts = np.array(bbox, dtype=np.int32)
            cv2.fillPoly(mask, [pts], 255)
            print(f"  - '{text}' (confidence: {prob:.2f})")
        
        # Dilate mask to cover more area
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (MASK_DILATION, MASK_DILATION))
        mask = cv2.dilate(mask, kernel, iterations=1)
        
        # Remove text - fill with white or inpaint
        if USE_WHITE_FILL:
            print("Filling with white...")
            # Simple white fill - no blur, clean result
            current_image[mask == 255] = 255
        else:
            print("Inpainting (may cause blur)...")
            current_image = cv2.inpaint(current_image, mask, INPAINT_RADIUS, cv2.INPAINT_TELEA)
        
        total_removed += len(results)
    
    # Save
    cv2.imwrite(str(output_path), current_image)
    print(f"\n✓ Total text regions removed: {total_removed}")
    print(f"✓ Saved cleaned image to: {output_path}")


def process_directory(input_dir, output_dir):
    """Process all images in a directory"""
    input_dir = Path(input_dir)
    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True)
    
    valid_ext = {'.png', '.jpg', '.jpeg', '.bmp'}
    image_files = [f for f in input_dir.iterdir() 
                   if f.suffix.lower() in valid_ext]
    
    if not image_files:
        print(f"No images found in {input_dir}")
        return
    
    print("=" * 70)
    print(f"Processing {len(image_files)} images")
    print("=" * 70)
    
    for idx, img_file in enumerate(image_files, 1):
        print(f"\n[{idx}/{len(image_files)}] {img_file.name}")
        print("-" * 70)
        
        output_file = output_dir / f"cleaned_{img_file.name}"
        
        try:
            remove_text_easyocr(img_file, output_file)
        except Exception as e:
            print(f"✗ Error: {e}")
            continue
    
    print("\n" + "=" * 70)
    print(f"Done! Cleaned images saved to: {output_dir}")
    print("=" * 70)


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  Single file: python3 remove_text_ocr.py <input_image> [output_image]")
        print("  Directory:   python3 remove_text_ocr.py <input_dir> <output_dir>")
        print("\nExamples:")
        print("  python3 remove_text_ocr.py plan.png")
        print("  python3 remove_text_ocr.py converted/ examples/")
        sys.exit(1)
    
    input_path = Path(sys.argv[1])
    
    if input_path.is_file():
        # Single file mode
        if len(sys.argv) >= 3:
            output_path = sys.argv[2]
        else:
            output_path = input_path.parent / f"{input_path.stem}_cleaned{input_path.suffix}"
        
        remove_text_easyocr(input_path, output_path)
    
    elif input_path.is_dir():
        # Directory mode
        if len(sys.argv) >= 3:
            output_dir = sys.argv[2]
        else:
            output_dir = input_path / "cleaned"
        
        process_directory(input_path, output_dir)
    
    else:
        print(f"Error: '{input_path}' not found")
        sys.exit(1)


if __name__ == "__main__":
    main()
