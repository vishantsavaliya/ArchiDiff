#!/usr/bin/env python3
"""
Image Editor API - Backend processing for dashboard operations
Handles: crop, transform, recolor, background removal
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import cv2
import numpy as np
from pathlib import Path
import base64
from io import BytesIO
from PIL import Image
import json

app = Flask(__name__)
CORS(app)

WORK_DIR = Path(__file__).parent / 'processed' / 'test-job'
WORK_DIR.mkdir(parents=True, exist_ok=True)

class ImageState:
    """Store current state of images"""
    def __init__(self):
        self.images = {}  # {layer_id: numpy_array}
        self.originals = {}  # Store originals for reset
    
    def load_image(self, layer_id, path):
        """Load image into memory"""
        img = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
        if img is None:
            return False
        self.images[layer_id] = img
        self.originals[layer_id] = img.copy()
        return True
    
    def get_image(self, layer_id):
        """Get current image"""
        return self.images.get(layer_id)
    
    def save_image(self, layer_id, path):
        """Save image to file"""
        if layer_id not in self.images:
            return False
        cv2.imwrite(str(path), self.images[layer_id])
        return True
    
    def reset_image(self, layer_id):
        """Reset to original"""
        if layer_id in self.originals:
            self.images[layer_id] = self.originals[layer_id].copy()
            return True
        return False

state = ImageState()

@app.route('/load', methods=['POST'])
def load_images():
    """Load images into memory for processing"""
    try:
        data = request.json
        layer1_path = WORK_DIR / 'file1_final.png'
        layer2_path = WORK_DIR / 'file2_final.png'
        
        # Check if files exist, if not use test images
        if not layer1_path.exists():
            layer1_path = Path(__file__).parent.parent / 'frontend' / 'public' / 'test' / 'image1.png'
        if not layer2_path.exists():
            layer2_path = Path(__file__).parent.parent / 'frontend' / 'public' / 'test' / 'image2.png'
        
        success1 = state.load_image(1, layer1_path)
        success2 = state.load_image(2, layer2_path)
        
        if not success1 or not success2:
            return jsonify({'error': 'Failed to load images'}), 400
        
        return jsonify({
            'success': True,
            'layer1': str(layer1_path),
            'layer2': str(layer2_path)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/convert-green-transparent', methods=['POST'])
def convert_green_transparent():
    """
    Convert image: Remove white background, convert black to green
    Body: { layer_id: 1 or 2 }
    """
    try:
        data = request.json
        layer_id = data.get('layer_id', 2)
        
        img = state.get_image(layer_id)
        if img is None:
            return jsonify({'error': 'Image not loaded'}), 400
        
        # Convert to BGRA if not already
        if img.shape[2] == 3:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
        
        # Process pixels
        height, width = img.shape[:2]
        for y in range(height):
            for x in range(width):
                b, g, r, a = img[y, x]
                
                # White or near-white -> transparent
                if r > 240 and g > 240 and b > 240:
                    img[y, x] = [0, 0, 0, 0]
                else:
                    # Dark pixels -> green
                    brightness = 255 - int((int(r) + int(g) + int(b)) / 3)
                    img[y, x] = [0, brightness, 0, 255]
        
        # Update state
        state.images[layer_id] = img
        
        # Save to file
        output_path = WORK_DIR / f'{layer_id}_processed.png'
        cv2.imwrite(str(output_path), img)
        
        return jsonify({
            'success': True,
            'layer_id': layer_id,
            'output': str(output_path)
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/crop', methods=['POST'])
def crop_image():
    """
    Crop image
    Body: { layer_id: int, x: int, y: int, width: int, height: int }
    """
    try:
        data = request.json
        layer_id = data.get('layer_id', 1)
        x = int(data.get('x', 0))
        y = int(data.get('y', 0))
        width = int(data.get('width', 100))
        height = int(data.get('height', 100))
        
        img = state.get_image(layer_id)
        if img is None:
            return jsonify({'error': 'Image not loaded'}), 400
        
        # Crop
        cropped = img[y:y+height, x:x+width]
        state.images[layer_id] = cropped
        
        # Save
        output_path = WORK_DIR / f'{layer_id}_cropped.png'
        cv2.imwrite(str(output_path), cropped)
        
        return jsonify({
            'success': True,
            'layer_id': layer_id,
            'dimensions': {'width': width, 'height': height}
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/transform', methods=['POST'])
def transform_image():
    """
    Transform image (rotate, scale, translate)
    Body: { layer_id: int, rotation: float, scale: float, tx: int, ty: int }
    """
    try:
        data = request.json
        layer_id = data.get('layer_id', 1)
        rotation = float(data.get('rotation', 0))
        scale = float(data.get('scale', 1.0))
        tx = int(data.get('tx', 0))
        ty = int(data.get('ty', 0))
        
        img = state.get_image(layer_id)
        if img is None:
            return jsonify({'error': 'Image not loaded'}), 400
        
        height, width = img.shape[:2]
        center = (width // 2, height // 2)
        
        # Rotation matrix
        M_rotate = cv2.getRotationMatrix2D(center, rotation, scale)
        
        # Add translation
        M_rotate[0, 2] += tx
        M_rotate[1, 2] += ty
        
        # Apply transform
        transformed = cv2.warpAffine(img, M_rotate, (width, height), 
                                     flags=cv2.INTER_LINEAR,
                                     borderMode=cv2.BORDER_CONSTANT,
                                     borderValue=(255, 255, 255, 0))
        
        state.images[layer_id] = transformed
        
        # Save
        output_path = WORK_DIR / f'{layer_id}_transformed.png'
        cv2.imwrite(str(output_path), transformed)
        
        return jsonify({
            'success': True,
            'layer_id': layer_id,
            'transform': {
                'rotation': rotation,
                'scale': scale,
                'translation': [tx, ty]
            }
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get-image/<int:layer_id>', methods=['GET'])
def get_image(layer_id):
    """Get current processed image"""
    try:
        img = state.get_image(layer_id)
        if img is None:
            return jsonify({'error': 'Image not found'}), 404
        
        # Convert to PNG bytes
        is_success, buffer = cv2.imencode('.png', img)
        if not is_success:
            return jsonify({'error': 'Failed to encode image'}), 500
        
        io_buf = BytesIO(buffer)
        return send_file(io_buf, mimetype='image/png')
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/reset/<int:layer_id>', methods=['POST'])
def reset_layer(layer_id):
    """Reset layer to original"""
    try:
        if state.reset_image(layer_id):
            return jsonify({'success': True, 'layer_id': layer_id})
        else:
            return jsonify({'error': 'Layer not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/overlay', methods=['POST'])
def create_overlay():
    """
    Create final overlay of both layers
    Body: { output_path: str (optional) }
    """
    try:
        data = request.json or {}
        output_path = data.get('output_path', str(WORK_DIR / 'overlay_result.png'))
        
        img1 = state.get_image(1)
        img2 = state.get_image(2)
        
        if img1 is None or img2 is None:
            return jsonify({'error': 'Both images must be loaded'}), 400
        
        # Ensure same size
        h = max(img1.shape[0], img2.shape[0])
        w = max(img1.shape[1], img2.shape[1])
        
        # Create canvas
        canvas = np.ones((h, w, 4), dtype=np.uint8) * 255
        canvas[:, :, 3] = 255
        
        # Place img1
        if img1.shape[2] == 3:
            img1 = cv2.cvtColor(img1, cv2.COLOR_BGR2BGRA)
        canvas[:img1.shape[0], :img1.shape[1]] = img1
        
        # Overlay img2
        if img2.shape[2] == 3:
            img2 = cv2.cvtColor(img2, cv2.COLOR_BGR2BGRA)
        
        # Alpha blend img2 on top
        for y in range(min(img2.shape[0], h)):
            for x in range(min(img2.shape[1], w)):
                alpha = img2[y, x, 3] / 255.0
                canvas[y, x] = canvas[y, x] * (1 - alpha) + img2[y, x] * alpha
        
        cv2.imwrite(output_path, canvas)
        
        return jsonify({
            'success': True,
            'output_path': output_path
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({'status': 'running', 'service': 'image-editor-api'})

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🎨 Image Editor API")
    print("="*60)
    print("Port: 5005")
    print("Endpoints:")
    print("  POST /load - Load images")
    print("  POST /convert-green-transparent - Remove white bg, make green")
    print("  POST /crop - Crop image")
    print("  POST /transform - Rotate, scale, translate")
    print("  POST /overlay - Create final overlay")
    print("  GET  /get-image/<layer_id> - Get processed image")
    print("  POST /reset/<layer_id> - Reset to original")
    print("="*60 + "\n")
    
    app.run(host='0.0.0.0', port=5005, debug=True)
