import cv2
import numpy as np
import os

input_dir = 'converted_images'
output_dir = 'converted_images/outlines_detailed'
os.makedirs(output_dir, exist_ok=True)

png_files = [f for f in os.listdir(input_dir) 
             if f.endswith('.png') and 'outline' not in f]

for filename in png_files:
    print(f"Processing {filename}...")
    
    # Load image
    img = cv2.imread(os.path.join(input_dir, filename))
    
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Apply adaptive thresholding for better detail preservation
    # This works well for architectural drawings with text and lines
    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY_INV, 11, 2
    )
    
    # Optional: Slight blur only to reduce noise (minimal)
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    
    # Canny with lower thresholds for more detail
    edges = cv2.Canny(blurred, threshold1=30, threshold2=100)
    
    # Combine both methods for best results
    combined = cv2.bitwise_or(binary, edges)
    
    # Very light morphological closing to connect nearby edges
    kernel = np.ones((1,1), np.uint8)
    result = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel)
    
    # Save
    output_path = os.path.join(output_dir, filename)
    cv2.imwrite(output_path, result)
    print(f"  ✓ Saved to {output_path}")

print(f"\nAll {len(png_files)} images converted to detailed outlines!")
