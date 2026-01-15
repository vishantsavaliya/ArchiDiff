#!/usr/bin/env python3
"""
Standalone script to process architectural drawings locally.
Run directly without the FastAPI server.

Usage:
    python process_drawing.py <method> <input.pdf> <output.png>
    
Methods:
    yolo      - YOLO text detection and removal
    vector    - Vector path extraction (filters text/arrows)
    mlsd      - M-LSD line detection
    skeleton  - Skeletonization (1-pixel centerlines)
    
Examples:
    python process_drawing.py yolo Sheet-001.pdf output_yolo.png
    python process_drawing.py vector Sheet-001.pdf output_clean.png
    python process_drawing.py mlsd Sheet-001.pdf output_lines.png
    python process_drawing.py skeleton Sheet-001.pdf output_skeleton.png
"""

import sys
import cv2
import numpy as np
import fitz  # PyMuPDF
from PIL import Image, ImageDraw
from pathlib import Path

# Method 1: YOLO Text Removal
def yolo_clean(pdf_path, output_path, conf_threshold=0.1):
    """Remove text using YOLO object detection"""
    from ultralytics import YOLO
    
    # Load YOLO model
    model = YOLO('yolov8n.pt')
    
    # Extract PDF
    doc = fitz.open(pdf_path)
    page = doc[0]
    mat = fitz.Matrix(4.0, 4.0)  # 400 DPI
    pix = page.get_pixmap(matrix=mat, alpha=False)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
    doc.close()
    
    # Run YOLO detection
    results = model(img, conf=conf_threshold, verbose=False)
    
    # Create mask for text regions
    mask = np.zeros(img.shape[:2], dtype=np.uint8)
    
    if len(results) > 0 and results[0].boxes is not None:
        for box in results[0].boxes:
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
            width = x2 - x1
            height = y2 - y1
            area = width * height
            aspect_ratio = max(width, height) / (min(width, height) + 1e-6)
            
            # Detect text-like regions
            if area < 5000 or aspect_ratio > 5:
                mask[y1:y2, x1:x2] = 255
    
    # Remove text (fill with white)
    clean_img = img.copy()
    clean_img[mask > 0] = 255
    
    # Save
    cv2.imwrite(output_path, clean_img)
    print(f"✓ YOLO cleaned: {output_path}")


# Method 2: Vector Path Extraction
def vector_extract(pdf_path, output_path, filter_arrows=True):
    """Extract vector paths, filter text and arrows"""
    doc = fitz.open(pdf_path)
    page = doc[0]
    
    # Get vector drawings
    drawings = page.get_drawings()
    
    # Render high-res
    mat = fitz.Matrix(4.0, 4.0)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
    doc.close()
    
    # Create blank canvas
    clean_img = np.ones_like(img) * 255
    pil_img = Image.fromarray(clean_img)
    draw = ImageDraw.Draw(pil_img)
    
    # Draw filtered paths
    for drawing in drawings:
        items = drawing.get("items", [])
        
        # Filter arrows (small filled shapes)
        if filter_arrows:
            has_fill = drawing.get("fill") is not None
            if has_fill:
                # Calculate area
                all_points = []
                for item in items:
                    if item[0] == "l":
                        all_points.extend([item[1], item[2]])
                    elif item[0] == "c":
                        all_points.extend(item[1:])
                
                if all_points:
                    xs = [p.x for p in all_points]
                    ys = [p.y for p in all_points]
                    width = max(xs) - min(xs)
                    height = max(ys) - min(ys)
                    area = width * height
                    
                    # Skip small fills (arrows/symbols)
                    if area < 300:
                        continue
        
        # Draw lines
        for item in items:
            if item[0] == "l":
                p1 = (item[1].x * 4, item[1].y * 4)
                p2 = (item[2].x * 4, item[2].y * 4)
                draw.line([p1, p2], fill=(0, 0, 0), width=2)
            elif item[0] == "c":
                points = [(item[i].x * 4, item[i].y * 4) for i in range(1, len(item))]
                if len(points) >= 2:
                    for i in range(len(points) - 1):
                        draw.line([points[i], points[i + 1]], fill=(0, 0, 0), width=2)
    
    clean_img = np.array(pil_img)
    cv2.imwrite(output_path, clean_img)
    print(f"✓ Vector extracted: {output_path}")


# Method 3: M-LSD Line Detection
def mlsd_detect(pdf_path, output_path, score_threshold=0.1):
    """Use M-LSD deep learning to detect lines"""
    from controlnet_aux import MLSDdetector
    
    # Extract PDF
    doc = fitz.open(pdf_path)
    page = doc[0]
    mat = fitz.Matrix(3.0, 3.0)  # 300 DPI for M-LSD
    pix = page.get_pixmap(matrix=mat, alpha=False)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
    doc.close()
    
    # M-LSD detection
    detector = MLSDdetector.from_pretrained('lllyasviel/ControlNet')
    pil_img = Image.fromarray(img)
    
    result = detector(
        pil_img,
        thr_v=score_threshold,
        thr_d=20.0,
        detect_resolution=512,
        image_resolution=max(pil_img.size)
    )
    
    result.save(output_path)
    print(f"✓ M-LSD detected: {output_path}")


# Method 4: Skeletonization
def skeletonize_drawing(pdf_path, output_path):
    """Reduce to 1-pixel centerlines"""
    from skimage.morphology import skeletonize
    from skimage.filters import threshold_otsu
    
    # Extract PDF
    doc = fitz.open(pdf_path)
    page = doc[0]
    mat = fitz.Matrix(4.0, 4.0)  # 400 DPI
    pix = page.get_pixmap(matrix=mat, alpha=False)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
    doc.close()
    
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    
    # Threshold
    thresh = threshold_otsu(gray)
    binary = gray < thresh
    
    # Skeletonize
    skeleton = skeletonize(binary)
    
    # Convert back to image
    result = np.where(skeleton, 0, 255).astype(np.uint8)
    result = cv2.cvtColor(result, cv2.COLOR_GRAY2RGB)
    
    cv2.imwrite(output_path, result)
    print(f"✓ Skeletonized: {output_path}")


# Main CLI
if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)
    
    method = sys.argv[1].lower()
    input_pdf = sys.argv[2]
    output_png = sys.argv[3]
    
    # Validate input
    if not Path(input_pdf).exists():
        print(f"❌ Error: Input file not found: {input_pdf}")
        sys.exit(1)
    
    # Process based on method
    if method == "yolo":
        yolo_clean(input_pdf, output_png)
    elif method == "vector":
        vector_extract(input_pdf, output_png)
    elif method == "mlsd":
        mlsd_detect(input_pdf, output_png)
    elif method == "skeleton":
        skeletonize_drawing(input_pdf, output_png)
    else:
        print(f"❌ Unknown method: {method}")
        print("Available methods: yolo, vector, mlsd, skeleton")
        sys.exit(1)
    
    print(f"✓ Processing complete!")
