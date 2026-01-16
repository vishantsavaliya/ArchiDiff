#!/usr/bin/env python3
"""
Interactive Overlay Comparison Tool
Overlays two images with red/green channels for manual alignment checking.
- Lower image: Red channel
- Upper image: Green channel
- Background: Black
- Upper image is draggable for alignment
"""

import sys
import cv2
import numpy as np
from pathlib import Path
from flask import Flask, render_template, jsonify, request, send_file
import io
import base64

app = Flask(__name__)

class OverlayState:
    def __init__(self):
        self.img1 = None  # Lower image (red)
        self.img2 = None  # Upper image (green)
        self.offset_x = 0
        self.offset_y = 0
        self.opacity = 1.0
        self.scale = 1.0  # Uniform scale factor
        self.scale_x = 1.0  # Width scale
        self.scale_y = 1.0  # Height scale
        self.rotation = 0.0  # Rotation angle in degrees
        self.thickness = 1  # Line thickness (1-10px)
        self.image1_path = None
        self.image2_path = None

state = OverlayState()

def load_images(path1, path2):
    """Load two images and resize them to match dimensions"""
    img1 = cv2.imread(path1)
    img2 = cv2.imread(path2)
    
    if img1 is None:
        raise ValueError(f"Could not load image: {path1}")
    if img2 is None:
        raise ValueError(f"Could not load image: {path2}")
    
    # Get max dimensions
    h1, w1 = img1.shape[:2]
    h2, w2 = img2.shape[:2]
    max_h = max(h1, h2)
    max_w = max(w1, w2)
    
    # Resize if needed
    if img1.shape[:2] != (max_h, max_w):
        img1 = cv2.resize(img1, (max_w, max_h))
    if img2.shape[:2] != (max_h, max_w):
        img2 = cv2.resize(img2, (max_w, max_h))
    
    state.img1 = img1
    state.img2 = img2
    state.image1_path = path1
    state.image2_path = path2
    state.offset_x = 0
    state.offset_y = 0

def create_overlay():
    """Create red/green overlay with adjustable offset"""
    if state.img1 is None or state.img2 is None:
        return None
    
    h, w = state.img1.shape[:2]
    
    # Create black background
    result = np.zeros((h, w, 3), dtype=np.uint8)
    
    # Convert images to grayscale
    gray1 = cv2.cvtColor(state.img1, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(state.img2, cv2.COLOR_BGR2GRAY)
    
    # Invert grayscale: white background (255) becomes black (0), dark lines become bright
    gray1_inv = 255 - gray1
    gray2_inv = 255 - gray2
    
    # Apply thickness/dilation to make lines thicker if needed
    if state.thickness > 1:
        kernel = np.ones((state.thickness, state.thickness), np.uint8)
        gray1_inv = cv2.dilate(gray1_inv, kernel, iterations=1)
        gray2_inv = cv2.dilate(gray2_inv, kernel, iterations=1)
    
    # Upper image -> Green channel (with rotation, scale, and offset)
    # Apply transformations: scale (width/height) and rotate
    transformed = gray2_inv.copy()
    
    # Apply non-uniform scaling first
    new_w = int(w * state.scale_x)
    new_h = int(h * state.scale_y)
    transformed = cv2.resize(transformed, (new_w, new_h))
    
    # Create canvas for rotation
    canvas = np.zeros((h, w), dtype=np.uint8)
    
    # Center the scaled image on canvas
    y_offset = (h - new_h) // 2
    x_offset = (w - new_w) // 2
    
    if new_h > 0 and new_w > 0:
        # Place scaled image in center
        y1 = max(0, y_offset)
        y2 = min(h, y_offset + new_h)
        x1 = max(0, x_offset)
        x2 = min(w, x_offset + new_w)
        
        src_y1 = max(0, -y_offset)
        src_y2 = src_y1 + (y2 - y1)
        src_x1 = max(0, -x_offset)
        src_x2 = src_x1 + (x2 - x1)
        
        canvas[y1:y2, x1:x2] = transformed[src_y1:src_y2, src_x1:src_x2]
    
    # Get center for rotation
    center_y, center_x = h // 2, w // 2
    
    # Build rotation matrix
    M = cv2.getRotationMatrix2D((center_x, center_y), state.rotation, 1.0)
    
    # Apply rotation
    transformed = cv2.warpAffine(canvas, M, (w, h), borderValue=0)
    
    # Create offset version of transformed image
    offset_img2 = np.zeros((h, w), dtype=np.uint8)
    scaled_h, scaled_w = h, w
    
    # Apply offset by shifting the entire transformed image
    M_translate = np.float32([[1, 0, state.offset_x], [0, 1, state.offset_y]])
    offset_img2 = cv2.warpAffine(transformed, M_translate, (w, h), borderValue=0)
    
    # Detect intersection (where both images have content)
    # Threshold to determine if pixel has content (brightness > 30)
    mask1 = gray1_inv > 30
    mask2 = offset_img2 > 30
    intersection = mask1 & mask2
    
    # Apply opacity to upper image
    offset_img2_opacity = (offset_img2 * state.opacity).astype(np.uint8)
    
    # Composite with blue for intersections:
    # - Red: lower image only (not in intersection)
    # - Green: upper image only (not in intersection)
    # - Blue: intersection areas
    result[:, :, 2] = np.where(intersection, 0, gray1_inv)  # Red channel
    result[:, :, 1] = np.where(intersection, 0, offset_img2_opacity)  # Green channel
    result[:, :, 0] = np.where(intersection, 255, 0)  # Blue channel

    return result

@app.route('/')
def index():
    return render_template('interactive_overlay.html')

@app.route('/get_image')
def get_image():
    """Get current overlay image"""
    overlay = create_overlay()
    if overlay is None:
        return jsonify({'error': 'No images loaded'}), 400
    
    # Encode image
    _, buffer = cv2.imencode('.png', overlay)
    img_base64 = base64.b64encode(buffer).decode('utf-8')
    
    return jsonify({
        'image': img_base64,
        'offset_x': state.offset_x,
        'offset_y': state.offset_y,
        'opacity': state.opacity,
        'scale': state.scale,
        'scale_x': state.scale_x,
        'scale_y': state.scale_y,
        'rotation': state.rotation,
        'thickness': state.thickness,
        'width': state.img1.shape[1],
        'height': state.img1.shape[0]
    })

@app.route('/set_offset', methods=['POST'])
def set_offset():
    """Update offset"""
    data = request.json
    state.offset_x = int(data.get('offset_x', 0))
    state.offset_y = int(data.get('offset_y', 0))
    return jsonify({'success': True})

@app.route('/set_opacity', methods=['POST'])
def set_opacity():
    """Update opacity of upper layer"""
    data = request.json
    state.opacity = float(data.get('opacity', 1.0))
    return jsonify({'success': True})

@app.route('/set_scale', methods=['POST'])
def set_scale():
    """Update uniform scale of upper layer"""
    data = request.json
    scale = float(data.get('scale', 1.0))
    state.scale = scale
    state.scale_x = scale
    state.scale_y = scale
    return jsonify({'success': True})

@app.route('/set_scale_x', methods=['POST'])
def set_scale_x():
    """Update width scale of upper layer"""
    data = request.json
    state.scale_x = float(data.get('scale_x', 1.0))
    return jsonify({'success': True})

@app.route('/set_scale_y', methods=['POST'])
def set_scale_y():
    """Update height scale of upper layer"""
    data = request.json
    state.scale_y = float(data.get('scale_y', 1.0))
    return jsonify({'success': True})

@app.route('/set_rotation', methods=['POST'])
def set_rotation():
    """Update rotation of upper layer"""
    data = request.json
    state.rotation = float(data.get('rotation', 0.0))
    return jsonify({'success': True})

@app.route('/set_thickness', methods=['POST'])
def set_thickness():
    """Update line thickness"""
    data = request.json
    thickness = int(data.get('thickness', 1))
    state.thickness = max(1, min(10, thickness))
    return jsonify({'success': True})

@app.route('/reset', methods=['POST'])
def reset():
    """Reset offset to 0,0"""
    state.offset_x = 0
    state.offset_y = 0
    state.opacity = 1.0
    state.scale = 1.0
    state.scale_x = 1.0
    state.scale_y = 1.0
    state.rotation = 0.0
    state.thickness = 1
    return jsonify({'success': True})

@app.route('/save', methods=['POST'])
def save():
    """Save current overlay"""
    overlay = create_overlay()
    if overlay is None:
        return jsonify({'error': 'No images loaded'}), 400
    
    # Save to file
    output_path = Path(state.image1_path).parent / 'overlay_comparison.png'
    cv2.imwrite(str(output_path), overlay)
    
    return jsonify({
        'success': True,
        'path': str(output_path)
    })

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 interactive_overlay.py <image1> <image2>")
        print("\nExample:")
        print("  python3 interactive_overlay.py converted/Sheet-600.png converted/Sheet-600_(2).png")
        print("\nControls:")
        print("  - Drag the canvas to move the upper (green) layer")
        print("  - Arrow keys for fine adjustment")
        print("  - Slider to adjust green layer opacity")
        print("  - Reset button to return to 0,0")
        print("  - Save button to export comparison")
        sys.exit(1)
    
    img1_path = sys.argv[1]
    img2_path = sys.argv[2]
    
    try:
        load_images(img1_path, img2_path)
        print(f"\n✓ Loaded images:")
        print(f"  Lower (RED):   {img1_path}")
        print(f"  Upper (GREEN): {img2_path}")
        print(f"\n🌐 Starting server at http://localhost:5002")
        print("\nControls:")
        print("  - Drag canvas to move green layer")
        print("  - Arrow keys for 1px adjustment")
        print("  - Shift+Arrow for 10px adjustment")
        print("  - Slider for green opacity")
        print("  - 'R' to reset, 'S' to save")
        print("\nAlignment tips:")
        print("  - Yellow/white = perfect alignment")
        print("  - Red only = only in lower image")
        print("  - Green only = only in upper image")
        print("\nPress Ctrl+C to stop server\n")
        
        app.run(debug=False, port=5002, host='0.0.0.0')
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
