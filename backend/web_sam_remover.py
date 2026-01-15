#!/usr/bin/env python3
"""
Web-based SAM Annotation Remover
Better UI with undo, zoom, and easy controls
"""

from flask import Flask, render_template, request, jsonify, send_file
import cv2
import numpy as np
import base64
import io
from pathlib import Path
import os
import urllib.request
from mobile_sam import sam_model_registry, SamPredictor

app = Flask(__name__)

# Global state
class AppState:
    def __init__(self):
        self.original_img = None
        self.current_img = None
        self.selected_masks = []
        self.history = []  # For undo
        self.predictor = None
        self.image_path = None
        self.prototype_contour = None  # For prototype matching
        self.prototype_solidity = None
        self.prototype_hu = None
        
state = AppState()

MODEL_TYPE = "vit_t"  # MobileSAM uses vit_t (tiny)
MODEL_PATH = Path(__file__).parent / "mobile_sam.pt"
MODEL_URL = "https://github.com/ChaoningZhang/MobileSAM/raw/master/weights/mobile_sam.pt"
MAX_LINE_AREA = 20000  # Much stricter - only small annotations
BACKGROUND_COLOR = (255, 255, 255)

def download_model():
    """Download MobileSAM model if not present"""
    if MODEL_PATH.exists():
        return
    
    print(f"Downloading MobileSAM model (~40MB)...")
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    def progress(block_num, block_size, total_size):
        downloaded = block_num * block_size
        percent = min(100, (downloaded / total_size) * 100)
        mb_downloaded = downloaded / (1024 * 1024)
        mb_total = total_size / (1024 * 1024)
        print(f"\rDownloading: {mb_downloaded:.1f}/{mb_total:.1f} MB ({percent:.1f}%)", end="")
    
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH, progress)
    print("\n✓ Model downloaded")

def load_image(image_path):
    """Load image and initialize MobileSAM"""
    state.image_path = image_path
    state.original_img = cv2.imread(str(image_path))
    state.current_img = state.original_img.copy()
    state.selected_masks = []
    state.history = []
    
    # Initialize MobileSAM
    if state.predictor is None:
        download_model()
        print("Loading MobileSAM model...")
        sam = sam_model_registry[MODEL_TYPE](checkpoint=str(MODEL_PATH))
        state.predictor = SamPredictor(sam)
    
    # Set image in SAM
    image_rgb = cv2.cvtColor(state.current_img, cv2.COLOR_BGR2RGB)
    state.predictor.set_image(image_rgb)
    print("✓ Ready!")

def img_to_base64(img):
    """Convert OpenCV image to base64 for web display"""
    _, buffer = cv2.imencode('.png', img)
    img_base64 = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/png;base64,{img_base64}"

def get_display_image():
    """Get current image with mask overlays"""
    display = state.current_img.copy()
    
    # Overlay selected masks in semi-transparent green
    overlay = np.zeros_like(display)
    for mask in state.selected_masks:
        overlay[mask > 0] = (0, 255, 0)
    
    display = cv2.addWeighted(display, 1.0, overlay, 0.4, 0)
    return display

@app.route('/')
def index():
    """Serve the web UI"""
    return render_template('sam_remover.html')

@app.route('/get_image', methods=['GET'])
def get_image():
    """Get current image"""
    try:
        if state.current_img is None:
            return jsonify({'error': 'No image loaded'}), 404
        
        display = get_display_image()
        return jsonify({
            'success': True,
            'image': img_to_base64(display),
            'width': state.current_img.shape[1],
            'height': state.current_img.shape[0],
            'selected_count': len(state.selected_masks),
            'can_undo': len(state.history) > 0
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/load_image', methods=['POST'])
def load_image_route():
    """Load image from path"""
    try:
        image_path = request.json.get('image_path')
        if not Path(image_path).exists():
            return jsonify({'error': 'Image not found'}), 404
        
        load_image(image_path)
        display = get_display_image()
        
        return jsonify({
            'success': True,
            'image': img_to_base64(display),
            'width': state.current_img.shape[1],
            'height': state.current_img.shape[0]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/set_prototype', methods=['POST'])
def set_prototype():
    """Set clicked object as prototype for similarity matching"""
    try:
        x = int(request.json.get('x'))
        y = int(request.json.get('y'))
        
        # ENHANCED IMAGE PREPROCESSING - Vector-like feature extraction
        gray = cv2.cvtColor(state.current_img, cv2.COLOR_BGR2GRAY)
        
        # Step 1: Bilateral filter - edge-preserving noise reduction
        bilateral = cv2.bilateralFilter(gray, 9, 75, 75)
        
        # Step 2: Adaptive threshold with larger block for cleaner separation
        binary = cv2.adaptiveThreshold(
            bilateral, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY_INV, blockSize=15, C=3
        )
        
        # Step 3: Morphological cleanup - fill small gaps, remove noise
        kernel_small = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        kernel_large = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        
        # Close small gaps
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel_large, iterations=3)
        # Remove small noise
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel_small, iterations=2)
        
        # Find contours with simple approximation for cleaner vector-like shapes
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_TC89_L1)
        
        # Find contour at click point
        for cnt in contours:
            if cv2.pointPolygonTest(cnt, (float(x), float(y)), False) >= 0:
                # Calculate prototype "DNA"
                hull = cv2.convexHull(cnt)
                hull_area = cv2.contourArea(hull)
                area = cv2.contourArea(cnt)
                
                state.prototype_contour = cnt
                state.prototype_solidity = float(area) / hull_area if hull_area > 0 else 0
                state.prototype_hu = cv2.HuMoments(cv2.moments(cnt)).flatten()
                
                return jsonify({
                    'success': True,
                    'area': int(area),
                    'solidity': float(state.prototype_solidity)
                })
        
        return jsonify({'error': 'No object found at click location'}), 404
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/find_similar', methods=['POST'])
def find_similar():
    """Find all objects similar to prototype using Hu Moments - OpenCV only, no SAM"""
    try:
        if state.prototype_contour is None:
            return jsonify({'error': 'No prototype set - click an object first'}), 400
        
        # ENHANCED IMAGE PREPROCESSING - Vector-like feature extraction
        gray = cv2.cvtColor(state.current_img, cv2.COLOR_BGR2GRAY)
        
        # Step 1: Bilateral filter - edge-preserving noise reduction
        bilateral = cv2.bilateralFilter(gray, 9, 75, 75)
        
        # Step 2: Adaptive threshold with larger block for cleaner separation
        binary = cv2.adaptiveThreshold(
            bilateral, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, blockSize=15, C=3
        )
        
        # Step 3: Morphological cleanup - fill small gaps, remove noise
        kernel_small = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        kernel_large = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        
        # Close small gaps
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel_large, iterations=3)
        # Remove small noise
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel_small, iterations=2)
        
        # Find all contours with simple approximation for cleaner vector-like shapes
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_TC89_L1)
        
        similar_contours = []
        proto_area = cv2.contourArea(state.prototype_contour)
        
        for cnt in contours:
            area = cv2.contourArea(cnt)
            
            # Size filter: similar size (50-200% of prototype)
            if area < proto_area * 0.5 or area > proto_area * 2.0:
                continue
            
            # Solidity check: similar density
            hull = cv2.convexHull(cnt)
            hull_area = cv2.contourArea(hull)
            solidity = float(area) / hull_area if hull_area > 0 else 0
            
            # Must have similar solidity (±30%)
            if abs(solidity - state.prototype_solidity) > 0.3:
                continue
            
            # Hu Moments: ROTATION-INVARIANT shape matching
            similarity_score = cv2.matchShapes(
                state.prototype_contour, 
                cnt, 
                cv2.CONTOURS_MATCH_I1, 
                0
            )
            
            # Lower score = more similar (threshold: 0.15)
            if similarity_score < 0.15:
                similar_contours.append((cnt, similarity_score, area))
        
        if not similar_contours:
            return jsonify({'error': 'No similar objects found'}), 404
        
        # Sort by similarity (lower = better) and limit
        similar_contours = sorted(similar_contours, key=lambda x: x[1])[:40]
        
        # Use OpenCV contours directly - no SAM needed!
        detected_count = 0
        for cnt, _, area in similar_contours:
            # Create mask from contour
            mask = np.zeros(state.current_img.shape[:2], dtype=np.uint8)
            cv2.drawContours(mask, [cnt], -1, 255, -1)
            
            # Validate size
            if 10 < area < MAX_LINE_AREA:
                state.selected_masks.append(mask)
                detected_count += 1
        
        display = get_display_image()
        return jsonify({
            'success': True,
            'image': img_to_base64(display),
            'count': len(state.selected_masks),
            'detected': detected_count,
            'candidates': len(similar_contours)
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/segment_point', methods=['POST'])
def segment_point():
    """Segment object at clicked point"""
    try:
        x = int(request.json.get('x'))
        y = int(request.json.get('y'))
        
        # Segment with SAM
        input_point = np.array([[x, y]])
        input_label = np.array([1])
        
        masks, scores, _ = state.predictor.predict(
            point_coords=input_point,
            point_labels=input_label,
            multimask_output=True
        )
        
        # Find the SMALLEST valid mask near the click point
        img_area = state.current_img.shape[0] * state.current_img.shape[1]
        best_mask = None
        best_area = float('inf')
        
        for i, mask_i in enumerate(masks):
            mask_uint8 = (mask_i * 255).astype(np.uint8)
            area = cv2.countNonZero(mask_uint8)
            
            # Skip if too small or too large
            if area < 10 or area > MAX_LINE_AREA:
                continue
            
            # Skip if larger than 2% of image (strict limit)
            if area > img_area * 0.02:
                continue
            
            # Get bounding box for distance check
            contours, _ = cv2.findContours(mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if len(contours) > 0:
                x_c, y_c, w, h = cv2.boundingRect(contours[0])
                
                # Calculate distance from click to bbox center
                center_x = x_c + w // 2
                center_y = y_c + h // 2
                dist = ((center_x - x) ** 2 + (center_y - y) ** 2) ** 0.5
                
                # Prefer masks closer to click point AND smaller
                # Reject if center is very far from click (not the target)
                if dist > 500:  # Center must be within 500 pixels
                    continue
                
                # Pick the smallest mask that's reasonably close
                if area < best_area:
                    best_area = area
                    best_mask = mask_uint8
        
        if best_mask is None:
            return jsonify({'error': 'No small annotation found - try clicking directly on arrow/symbol'}), 400
        
        # Add to selected masks
        state.selected_masks.append(best_mask)
        
        display = get_display_image()
        return jsonify({
            'success': True,
            'image': img_to_base64(display),
            'count': len(state.selected_masks),
            'area': int(best_area)
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/undo', methods=['POST'])
def undo():
    """Remove last selected mask"""
    try:
        if state.selected_masks:
            state.selected_masks.pop()
        
        display = get_display_image()
        return jsonify({
            'success': True,
            'image': img_to_base64(display),
            'count': len(state.selected_masks)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/clear', methods=['POST'])
def clear():
    """Clear all selections"""
    try:
        state.selected_masks = []
        display = get_display_image()
        return jsonify({
            'success': True,
            'image': img_to_base64(display)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/remove', methods=['POST'])
def remove():
    """Remove selected annotations"""
    try:
        if not state.selected_masks:
            return jsonify({'error': 'No selections'}), 400
        
        # Save current state for undo
        state.history.append(state.current_img.copy())
        
        # Combine masks
        combined_mask = np.zeros(state.current_img.shape[:2], np.uint8)
        for mask in state.selected_masks:
            combined_mask = cv2.bitwise_or(combined_mask, mask)
        
        # Dilate slightly
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        combined_mask = cv2.dilate(combined_mask, kernel, iterations=1)
        
        # Inpaint to preserve background lines/grid
        state.current_img = cv2.inpaint(state.current_img, combined_mask, 3, cv2.INPAINT_TELEA)
        
        # Update SAM
        image_rgb = cv2.cvtColor(state.current_img, cv2.COLOR_BGR2RGB)
        state.predictor.set_image(image_rgb)
        
        # Clear selections
        count = len(state.selected_masks)
        state.selected_masks = []
        
        display = get_display_image()
        return jsonify({
            'success': True,
            'image': img_to_base64(display),
            'removed': count
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/undo_remove', methods=['POST'])
def undo_remove():
    """Undo last removal"""
    try:
        if not state.history:
            return jsonify({'error': 'Nothing to undo'}), 400
        
        state.current_img = state.history.pop()
        image_rgb = cv2.cvtColor(state.current_img, cv2.COLOR_BGR2RGB)
        state.predictor.set_image(image_rgb)
        
        display = get_display_image()
        return jsonify({
            'success': True,
            'image': img_to_base64(display)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/save', methods=['POST'])
def save():
    """Save cleaned image"""
    try:
        output_path = Path(state.image_path).parent / f"{Path(state.image_path).stem}_cleaned.png"
        cv2.imwrite(str(output_path), state.current_img)
        
        return jsonify({
            'success': True,
            'path': str(output_path)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/reset', methods=['POST'])
def reset():
    """Reset to original image"""
    try:
        state.current_img = state.original_img.copy()
        state.selected_masks = []
        state.history = []
        
        image_rgb = cv2.cvtColor(state.current_img, cv2.COLOR_BGR2RGB)
        state.predictor.set_image(image_rgb)
        
        display = get_display_image()
        return jsonify({
            'success': True,
            'image': img_to_base64(display)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print("Usage: python3 web_sam_remover.py <image_path>")
        print("\nExample:")
        print("  python3 web_sam_remover.py examples/cleaned_Sheet-600_FIRE_EXTINGUISHER_CABINET.png")
        print("\nThen open: http://localhost:5000")
        sys.exit(1)
    
    image_path = sys.argv[1]
    if not Path(image_path).exists():
        print(f"Error: Image not found: {image_path}")
        sys.exit(1)
    
    # Pre-load image
    load_image(image_path)
    
    print("\n" + "="*60)
    print("SAM Remover Web Interface")
    print("="*60)
    print(f"Image loaded: {image_path}")
    print("\nOpen your browser to: http://localhost:5001")
    print("Press Ctrl+C to stop")
    print("="*60 + "\n")
    
    app.run(debug=True, port=5001)
