#!/usr/bin/env python3
"""
Convert image: Remove white background (make transparent) and convert black lines to green
"""

import cv2
import numpy as np
from pathlib import Path
import sys

def convert_to_green_transparent(input_path, output_path):
    """
    Convert image:
    - White background -> transparent
    - Black lines -> green
    """
    # Read image
    img = cv2.imread(str(input_path))
    if img is None:
        print(f"Error: Could not read image from {input_path}")
        return False
    
    # Convert BGR to BGRA (add alpha channel)
    img_rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    
    # Get dimensions
    height, width = img.shape[:2]
    
    # Process each pixel
    for y in range(height):
        for x in range(width):
            b, g, r, a = img_rgba[y, x]
            
            # If pixel is white or near-white (> 240), make it transparent
            if r > 240 and g > 240 and b > 240:
                img_rgba[y, x] = [0, 0, 0, 0]  # Transparent
            else:
                # Convert dark pixels to green
                # Keep the intensity but make it green
                brightness = 255 - int((r + g + b) / 3)
                img_rgba[y, x] = [0, brightness, 0, 255]  # Green with original intensity
    
    # Save as PNG with transparency
    cv2.imwrite(str(output_path), img_rgba)
    print(f"✓ Converted: {output_path}")
    return True

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python3 convert_to_green_transparent.py <input_image> <output_image>")
        print("\nExample:")
        print("  python3 convert_to_green_transparent.py input.png output.png")
        sys.exit(1)
    
    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)
    
    # Create output directory if needed
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    success = convert_to_green_transparent(input_path, output_path)
    sys.exit(0 if success else 1)
