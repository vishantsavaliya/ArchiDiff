#!/usr/bin/env python3
"""
Interactive Line Selection Tool
- Click on lines to select/deselect them
- Selected lines are highlighted in color
- Remove selected lines or save selection
"""

import sys
import cv2
import numpy as np
from flask import Flask, render_template, request, jsonify
from pathlib import Path
import base64
from io import BytesIO

app = Flask(__name__)

class LineSelectionState:
    def __init__(self):
        self.original_image = None
        self.gray = None
        self.lines = []  # List of line segments [(x1, y1, x2, y2), ...]
        self.selected_lines = set()  # Indices of selected lines
        self.image_path = None
        self.line_thickness = 2  # Thickness for line detection
        
    def load_image(self, image_path):
        """Load image and detect lines"""
        self.image_path = image_path
        self.original_image = cv2.imread(str(image_path))
        if self.original_image is None:
            raise ValueError(f"Could not load image: {image_path}")
        
        # Convert to grayscale
        self.gray = cv2.cvtColor(self.original_image, cv2.COLOR_BGR2GRAY)
        
        # Detect lines using HoughLinesP
        edges = cv2.Canny(self.gray, 50, 150, apertureSize=3)
        lines = cv2.HoughLinesP(
            edges, 
            rho=1, 
            theta=np.pi/180, 
            threshold=50,
            minLineLength=20,
            maxLineGap=5
        )
        
        if lines is not None:
            self.lines = [tuple(line[0]) for line in lines]
        else:
            self.lines = []
        
        print(f"Detected {len(self.lines)} lines")
    
    def find_line_near_point(self, x, y, threshold=10):
        """Find line segment near the clicked point"""
        min_dist = float('inf')
        nearest_idx = None
        
        for idx, (x1, y1, x2, y2) in enumerate(self.lines):
            # Calculate distance from point to line segment
            dist = self._point_to_segment_distance(x, y, x1, y1, x2, y2)
            if dist < min_dist and dist < threshold:
                min_dist = dist
                nearest_idx = idx
        
        return nearest_idx
    
    def _point_to_segment_distance(self, px, py, x1, y1, x2, y2):
        """Calculate distance from point to line segment"""
        # Vector from line start to point
        dx = x2 - x1
        dy = y2 - y1
        
        if dx == 0 and dy == 0:
            # Line segment is a point
            return np.sqrt((px - x1)**2 + (py - y1)**2)
        
        # Parameter t for projection onto line
        t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
        
        # Closest point on segment
        closest_x = x1 + t * dx
        closest_y = y1 + t * dy
        
        # Distance to closest point
        return np.sqrt((px - closest_x)**2 + (py - closest_y)**2)
    
    def toggle_line_selection(self, line_idx):
        """Toggle selection state of a line"""
        if line_idx is None:
            return
        
        if line_idx in self.selected_lines:
            self.selected_lines.remove(line_idx)
        else:
            self.selected_lines.add(line_idx)
    
    def get_visualization(self):
        """Get image with selected lines highlighted"""
        if self.original_image is None:
            return None
        
        # Create a copy for visualization
        vis = self.original_image.copy()
        
        # Draw all lines in light gray
        for idx, (x1, y1, x2, y2) in enumerate(self.lines):
            if idx not in self.selected_lines:
                cv2.line(vis, (x1, y1), (x2, y2), (200, 200, 200), 1)
        
        # Draw selected lines in bright green
        for idx in self.selected_lines:
            if idx < len(self.lines):
                x1, y1, x2, y2 = self.lines[idx]
                cv2.line(vis, (x1, y1), (x2, y2), (0, 255, 0), 3)
        
        return vis
    
    def remove_selected_lines(self):
        """Remove selected lines from the image"""
        if self.original_image is None:
            return None
        
        # Create mask for inpainting
        mask = np.zeros(self.gray.shape, dtype=np.uint8)
        
        # Draw selected lines on mask
        for idx in self.selected_lines:
            if idx < len(self.lines):
                x1, y1, x2, y2 = self.lines[idx]
                cv2.line(mask, (x1, y1), (x2, y2), 255, 5)
        
        # Inpaint to remove lines
        result = cv2.inpaint(self.original_image, mask, 3, cv2.INPAINT_TELEA)
        
        return result
    
    def clear_selection(self):
        """Clear all selected lines"""
        self.selected_lines.clear()

# Global state
state = LineSelectionState()

@app.route('/')
def index():
    """Serve the main page"""
    return render_template('line_selector.html')

@app.route('/get_image', methods=['GET'])
def get_image():
    """Get current visualization"""
    vis = state.get_visualization()
    if vis is None:
        return jsonify({'error': 'No image loaded'}), 400
    
    # Convert to JPEG for transmission
    _, buffer = cv2.imencode('.jpg', vis, [cv2.IMWRITE_JPEG_QUALITY, 95])
    img_base64 = base64.b64encode(buffer).decode('utf-8')
    
    return jsonify({
        'image': f'data:image/jpeg;base64,{img_base64}',
        'total_lines': len(state.lines),
        'selected_lines': len(state.selected_lines)
    })

@app.route('/click_line', methods=['POST'])
def click_line():
    """Handle line click"""
    data = request.json
    x = int(data.get('x', 0))
    y = int(data.get('y', 0))
    
    # Find nearest line
    line_idx = state.find_line_near_point(x, y, threshold=15)
    
    if line_idx is not None:
        state.toggle_line_selection(line_idx)
        return jsonify({'success': True, 'line_idx': line_idx})
    else:
        return jsonify({'success': False, 'message': 'No line found near click'})

@app.route('/clear_selection', methods=['POST'])
def clear_selection():
    """Clear all selected lines"""
    state.clear_selection()
    return jsonify({'success': True})

@app.route('/remove_selected', methods=['POST'])
def remove_selected():
    """Remove selected lines and return result"""
    if len(state.selected_lines) == 0:
        return jsonify({'error': 'No lines selected'}), 400
    
    result = state.remove_selected_lines()
    if result is None:
        return jsonify({'error': 'Failed to remove lines'}), 500
    
    # Convert to JPEG for transmission
    _, buffer = cv2.imencode('.jpg', result, [cv2.IMWRITE_JPEG_QUALITY, 95])
    img_base64 = base64.b64encode(buffer).decode('utf-8')
    
    return jsonify({
        'image': f'data:image/jpeg;base64,{img_base64}',
        'removed_count': len(state.selected_lines)
    })

@app.route('/save_result', methods=['POST'])
def save_result():
    """Save the result with selected lines removed"""
    if len(state.selected_lines) == 0:
        return jsonify({'error': 'No lines selected'}), 400
    
    result = state.remove_selected_lines()
    if result is None:
        return jsonify({'error': 'Failed to remove lines'}), 500
    
    # Generate output filename
    input_path = Path(state.image_path)
    output_path = input_path.parent / f"{input_path.stem}_lines_removed{input_path.suffix}"
    
    cv2.imwrite(str(output_path), result)
    
    return jsonify({
        'success': True,
        'output_path': str(output_path),
        'removed_count': len(state.selected_lines)
    })

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 line_selector.py <image_path>")
        print("\nInteractive line selection tool:")
        print("  - Click on lines to select/deselect them")
        print("  - Selected lines are highlighted in green")
        print("  - Remove selected lines or save result")
        sys.exit(1)
    
    image_path = Path(sys.argv[1])
    if not image_path.exists():
        print(f"Error: Image not found: {image_path}")
        sys.exit(1)
    
    # Load image and detect lines
    print(f"\n📐 Loading image: {image_path.name}")
    state.load_image(image_path)
    
    print(f"✓ Detected {len(state.lines)} lines")
    print(f"\n🌐 Starting server at http://localhost:5003")
    print("\nControls:")
    print("  - Click on lines to select/deselect")
    print("  - Selected lines are highlighted in green")
    print("  - Use 'Remove Selected' to preview removal")
    print("  - Use 'Save Result' to save the image")
    print("\nPress Ctrl+C to stop server\n")
    
    app.run(host='0.0.0.0', port=5003, debug=False)

if __name__ == '__main__':
    main()
