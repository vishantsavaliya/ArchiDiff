# ArchiDiff Backend - File Structure & Libraries

Comprehensive documentation of each file with detailed library explanations.

---

## File Overview

```
backend/
├── convert_all_pdfs.py         # PDF to PNG conversion
├── upscale_realesrgan.py       # Image upscaling
├── remove_text_ocr.py          # Text removal with OCR
├── web_sam_remover.py          # SAM annotation remover (Flask)
├── interactive_overlay.py      # Overlay comparison tool (Flask)
├── line_selector.py            # Line detection & selection (Flask)
├── requirements.txt            # Dependencies
└── README.md                   # Documentation
```

---

## 1. convert_all_pdfs.py

**Purpose:** Convert PDF files to high-quality PNG images for processing.

### Libraries Used

```python
from pdf2image import convert_from_path
from pathlib import Path
import sys
```

#### Library Details:

1. **pdf2image** (External)

   - Purpose: PDF to image conversion
   - Functions: `convert_from_path()`
   - Converts PDF pages to PIL Image objects
   - Uses poppler (system dependency)
   - Installation: `pip install pdf2image`

2. **pathlib** (Standard Library)

   - Purpose: Object-oriented filesystem paths
   - Classes: `Path`
   - Cross-platform path handling
   - Built-in: No installation needed

3. **sys** (Standard Library)
   - Purpose: System-specific parameters
   - Used for: Command-line arguments (`sys.argv`)
   - Exit codes and system functions
   - Built-in: No installation needed

### Key Functions

```python
def convert_pdf_to_images(pdf_path, output_dir, dpi=300)
```

- **Parameters:** PDF file path, output directory, DPI (default 300)
- **Returns:** List of generated PNG filenames
- **Process:** Reads PDF → Converts each page → Saves as PNG

### How It Works

1. Scans current directory for PDF files
2. Creates output directory if needed
3. Converts each PDF page at 300 DPI
4. Saves as PNG with sanitized filenames
5. Reports success/failure for each file

---

## 2. upscale_realesrgan.py

**Purpose:** Upscale images 2x or 4x using bicubic interpolation for better OCR and line detection.

### Libraries Used

```python
import cv2
import numpy as np
import sys
import os
from pathlib import Path
import requests
import torch
from PIL import Image
```

#### Library Details:

1. **cv2 (OpenCV)** (External)

   - Version: 4.10.0+
   - Purpose: Image processing and computer vision
   - Functions used:
     - `cv2.imread()` - Read images
     - `cv2.resize()` - Resize images
     - `cv2.imwrite()` - Save images
     - `cv2.INTER_CUBIC` - Bicubic interpolation
   - Installation: `pip install opencv-python`

2. **numpy** (External)

   - Version: 1.26.4+
   - Purpose: Numerical computing
   - Used for: Array operations, image data manipulation
   - Installation: `pip install numpy`

3. **torch (PyTorch)** (External)

   - Version: 2.7.1+
   - Purpose: Deep learning framework
   - Used for: Loading Real-ESRGAN models (optional)
   - Functions: `torch.jit.load()`, `torch.no_grad()`
   - Installation: `pip install torch`

4. **PIL (Pillow)** (External)

   - Purpose: Image processing library
   - Used for: Image format conversions
   - Installation: `pip install pillow`

5. **requests** (External)

   - Purpose: HTTP library for downloading models
   - Used for: Downloading Real-ESRGAN weights
   - Installation: `pip install requests`

6. **pathlib, sys, os** (Standard Library)
   - File path handling and system operations

### Key Classes & Functions

```python
class RealESRGAN:
    def __init__(self, model_path=None, device='cpu')
    def download_model(self)
    def upscale(self, image)

def upscale_image(input_path, output_path, scale=4)
def upscale_directory(input_dir, output_dir, scale=4)
```

### How It Works

1. **Single Image Mode:**

   - Reads image with OpenCV
   - Applies bicubic interpolation (cv2.INTER_CUBIC)
   - Upscales by specified factor (2x or 4x)
   - Saves high-resolution output

2. **Directory Mode:**

   - Scans directory for image files (.png, .jpg, .jpeg)
   - Batch processes all images
   - Preserves directory structure

3. **Upscaling Method:**
   - Uses bicubic interpolation (fast, good for technical drawings)
   - Alternative: Real-ESRGAN AI model (commented out, slower but better for photos)

---

## 3. remove_text_ocr.py

**Purpose:** Remove text annotations from architectural drawings using EasyOCR.

### Libraries Used

```python
import cv2
import numpy as np
from pathlib import Path
import sys
```

#### Library Details:

1. **cv2 (OpenCV)** (External)

   - Functions used:
     - `cv2.imread()` - Load images
     - `cv2.fillPoly()` - Fill text regions with white
     - `cv2.inpaint()` - Inpainting (optional)
     - `cv2.getStructuringElement()` - Morphological operations
     - `cv2.dilate()` - Mask dilation
     - `cv2.imwrite()` - Save cleaned images
   - Installation: `pip install opencv-python`

2. **easyocr** (External - Dynamically Imported)

   - Purpose: Optical Character Recognition
   - Functions:
     - `easyocr.Reader(['en'], gpu=False)` - Initialize OCR
     - `reader.readtext(image)` - Detect text regions
   - Returns: List of (bbox, text, confidence)
   - Installation: `pip install easyocr`
   - Note: Auto-installs on first run if missing

3. **numpy** (External)
   - Used for: Image array manipulation, mask operations
   - Functions: `np.array()`, `np.zeros()`

### Configuration Constants

```python
MASK_DILATION = 3        # Kernel size for mask expansion
USE_WHITE_FILL = True    # White fill vs inpainting
INPAINT_RADIUS = 7       # Inpainting radius (if used)
TWO_PASS = False         # Single-pass mode (optimized for upscaled)
```

### Key Functions

```python
def remove_text_easyocr(image_path, output_path)
def batch_remove_text(input_dir, output_dir)
```

### How It Works

1. **Initialize EasyOCR:**

   - Loads English language model
   - Runs on CPU (gpu=False)
   - Auto-downloads models on first run (~500MB)

2. **Text Detection:**

   - Scans image for text regions
   - Returns bounding boxes with confidence scores
   - Filters by confidence threshold (0.3)

3. **Text Removal:**

   - **Single-pass mode** (TWO_PASS=False):
     - One detection pass (sufficient for upscaled images)
   - Creates binary mask for detected text
   - Dilates mask by 3 pixels (covers text edges)
   - Fills masked regions with white color

4. **Processing Flow:**
   ```
   Input Image → EasyOCR Detection → Create Mask →
   Dilate Mask → Fill White → Save Output
   ```

---

## 4. web_sam_remover.py

**Purpose:** Interactive web-based tool for removing annotations using MobileSAM segmentation.

### Libraries Used

```python
from flask import Flask, render_template_string, request, jsonify, send_file
import cv2
import numpy as np
import torch
from mobile_sam import sam_model_registry, SamPredictor
import base64
import io
from pathlib import Path
import sys
```

#### Library Details:

1. **Flask** (External)

   - Version: 3.0.3+
   - Purpose: Web framework for creating HTTP server
   - Components used:
     - `Flask` - Application instance
     - `render_template_string` - Render HTML templates
     - `request` - Handle HTTP requests
     - `jsonify` - Return JSON responses
     - `send_file` - Send file downloads
   - Installation: `pip install flask`

2. **mobile_sam** (External)

   - Purpose: Segment Anything Model (lightweight version)
   - Components:
     - `sam_model_registry` - Load SAM models
     - `SamPredictor` - Prediction interface
   - Model: vit_t (tiny vision transformer, 40MB)
   - Installation: `pip install git+https://github.com/ChaoningZhang/MobileSAM.git`

3. **torch (PyTorch)** (External)

   - Used for: SAM model inference
   - Functions: `torch.device()`, tensor operations
   - CPU inference supported

4. **cv2 (OpenCV)** (External)

   - Functions used:
     - `cv2.imread()` - Load images
     - `cv2.cvtColor()` - Color conversions (BGR ↔ RGB)
     - `cv2.inpaint()` - Remove segmented regions
     - `cv2.imencode()` - Encode images to bytes
     - `cv2.imwrite()` - Save results

5. **base64** (Standard Library)

   - Purpose: Encode images for web transmission
   - Functions: `base64.b64encode()`
   - Converts binary image data to text for JSON

6. **io** (Standard Library)
   - Purpose: In-memory file operations
   - Classes: `BytesIO` - Binary stream

### Key Classes & Functions

```python
class SAMRemoverState:
    def __init__(self)
    def load_image(self, image_path)
    def set_predictor(self, predictor)
    def predict_mask(self, point_coords, point_labels, box=None)
    def remove_with_mask(self, mask)
    def encode_image(self, img)

# Flask Routes
@app.route('/')                          # Serve HTML interface
@app.route('/get_image')                 # Get current image
@app.route('/predict', methods=['POST']) # Generate mask from clicks
@app.route('/apply_mask', methods=['POST']) # Apply inpainting
@app.route('/reset')                     # Reset to original
@app.route('/save')                      # Download result
```

### How It Works

1. **Initialization:**

   - Loads MobileSAM model (vit_t, 40MB)
   - Starts Flask server on port 5001
   - Loads target image for processing

2. **Interactive Workflow:**

   ```
   User Clicks → Generate Mask → Preview Mask →
   Apply Removal → Download Result
   ```

3. **Segmentation Process:**

   - **Input:** User clicks (point prompts) or bounding boxes
   - **SAM Processing:**
     - Encodes image features
     - Generates segmentation masks
     - Returns binary mask (foreground/background)
   - **Mask Application:**
     - Uses cv2.inpaint with INPAINT_TELEA
     - Inpainting radius: 3 pixels
     - Preserves background patterns

4. **Web Interface:**
   - HTML5 Canvas for image display
   - Click detection: Left click = foreground, Right click = background
   - Real-time mask preview (semi-transparent overlay)
   - Base64 image encoding for AJAX updates

---

## 5. interactive_overlay.py

**Purpose:** Red/green overlay comparison tool with full transformation controls.

### Libraries Used

```python
from flask import Flask, render_template_string, request, jsonify, send_file
import cv2
import numpy as np
import base64
import io
from pathlib import Path
import sys
```

#### Library Details:

1. **Flask** (External)

   - Same as web_sam_remover.py
   - Server runs on port 5002

2. **cv2 (OpenCV)** (External)

   - Functions used:
     - `cv2.imread()` - Load two images
     - `cv2.resize()` - Resize images to match
     - `cv2.getRotationMatrix2D()` - Create rotation matrix
     - `cv2.warpAffine()` - Apply transformations (rotation, scale, translation)
     - `cv2.threshold()` - Create binary masks
     - `cv2.bitwise_and()` - Find intersection regions
     - `cv2.addWeighted()` - Blend images with opacity
     - `cv2.dilate()` - Line thickness control
     - `cv2.imencode()` - Encode to bytes

3. **numpy** (External)
   - Used extensively for:
     - Array operations (`np.zeros()`, `np.ones()`)
     - Mask manipulation
     - Conditional operations (`np.where()`)
     - Matrix operations for transformations

### Key Classes & Functions

```python
class OverlayState:
    def __init__(self)
    def load_images(self, lower_path, upper_path)
    def create_overlay(self, dx, dy, rotation, scale_x, scale_y, opacity, thickness)
    def encode_image(self)
    def save_overlay(self, output_path)

# Flask Routes
@app.route('/')                              # Serve HTML interface
@app.route('/get_image')                     # Get current overlay
@app.route('/update_transform', methods=['POST'])  # Update transformation
@app.route('/save')                          # Download overlay
```

### How It Works

1. **Image Loading:**

   - Loads two images (lower and upper)
   - Converts to RGB color space
   - Resizes to match canvas dimensions

2. **Transformation Pipeline:**

   ```python
   # Transformation order:
   Scale → Rotate → Translate (Move)
   ```

   - **Scale:** Separate X and Y scaling (non-uniform)
   - **Rotation:** -180° to 180° around image center
   - **Translation:** dx, dy pixel offsets

3. **Overlay Composition:**

   - **Step 1:** Create binary masks (threshold at 240 for white)
   - **Step 2:** Apply transformations to upper image + mask
   - **Step 3:** Find intersection:
     ```python
     intersection = bitwise_and(lower_mask, upper_mask)
     ```
   - **Step 4:** Color composition:
     ```python
     Red channel   = lower_only  # Red (255, 0, 0)
     Green channel = upper_only  # Green (0, 255, 0)
     Blue channel  = intersection # Blue (0, 0, 255)
     ```

4. **Line Thickness Control:**

   - Uses morphological dilation
   - Kernel size: 1-10 pixels
   - Applied to both masks before overlay

5. **Web Interface:**
   - Sliders for all transformation parameters
   - Keyboard shortcuts (arrow keys, T/Y for thickness)
   - Drag-to-move functionality
   - Auto-fit to viewport

---

## 6. line_selector.py

**Purpose:** Hough Line Transform-based line detection, selection, and removal.

### Libraries Used

```python
from flask import Flask, render_template_string, request, jsonify
import cv2
import numpy as np
import base64
import io
from pathlib import Path
import sys
```

#### Library Details:

1. **Flask** (External)

   - Same as previous Flask apps
   - Server runs on port 5003

2. **cv2 (OpenCV)** (External)

   - Functions used:
     - `cv2.imread()` - Load images
     - `cv2.cvtColor()` - Grayscale conversion
     - `cv2.Canny()` - Edge detection
     - `cv2.HoughLinesP()` - **Probabilistic Hough Line Transform**
     - `cv2.line()` - Draw lines for visualization
     - `cv2.inpaint()` - Remove selected lines
     - `cv2.imencode()` - Encode to bytes

3. **numpy** (External)
   - Used for:
     - Geometric calculations (point-to-line distance)
     - Array indexing for line storage
     - Mathematical operations

### Hough Line Transform Details

**cv2.HoughLinesP Parameters:**

```python
lines = cv2.HoughLinesP(
    edges,              # Binary edge image
    rho=1,             # Distance resolution (1 pixel)
    theta=np.pi/180,   # Angle resolution (1 degree)
    threshold=50,      # Minimum votes for a line
    minLineLength=20,  # Minimum line length (pixels)
    maxLineGap=5       # Max gap to connect segments (pixels)
)
```

**Returns:** Array of line segments as [(x1, y1, x2, y2), ...]

### Key Classes & Functions

```python
class LineSelectionState:
    def __init__(self)
    def load_image(self, image_path)
    def find_line_near_point(self, x, y, threshold=10)
    def _point_to_segment_distance(self, px, py, x1, y1, x2, y2)
    def toggle_line_selection(self, x, y)
    def remove_selected_lines(self)
    def create_visualization(self)

# Flask Routes
@app.route('/')                              # Serve HTML interface
@app.route('/get_image')                     # Get visualization
@app.route('/click_line', methods=['POST'])  # Toggle line selection
@app.route('/clear_selection')               # Clear all selections
@app.route('/remove_selected', methods=['POST']) # Preview removal
@app.route('/save_result', methods=['POST']) # Save cleaned image
```

### How It Works

1. **Line Detection:**

   ```python
   # Step 1: Convert to grayscale
   gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

   # Step 2: Canny edge detection
   edges = cv2.Canny(gray, 50, 150, apertureSize=3)

   # Step 3: Hough Line Transform
   lines = cv2.HoughLinesP(edges, 1, np.pi/180, 50, 20, 5)
   ```

2. **Click Detection:**

   - User clicks on canvas
   - Calculates distance from click point to each line segment
   - Uses parametric line equation:
     ```python
     # Point P on line segment AB: P = A + t(B - A)
     # where t ∈ [0, 1] for point on segment
     ```
   - Finds nearest line within 15-pixel threshold
   - Toggles selection state

3. **Point-to-Segment Distance:**

   ```python
   def _point_to_segment_distance(self, px, py, x1, y1, x2, y2):
       # Calculate perpendicular distance from point to line segment
       # Handles endpoints (clamping parameter t to [0, 1])
   ```

4. **Visualization:**

   - Unselected lines: Gray (128, 128, 128)
   - Selected lines: Green (0, 255, 0)
   - Line width: 2 pixels for visibility

5. **Removal Process:**
   - Creates combined mask for all selected lines
   - Dilates mask slightly (3 pixels) for complete coverage
   - Applies cv2.inpaint with INPAINT_TELEA
   - Inpainting radius: 5 pixels

---

## Library Summary

### External Dependencies (requirements.txt)

```txt
opencv-python==4.10.0+        # Computer vision
numpy==1.26.4+                # Numerical computing
easyocr                       # OCR text detection
flask==3.0.3+                 # Web framework
pillow                        # Image processing
torch==2.7.1+                 # Deep learning
torchvision                   # Vision models
pdf2image                     # PDF conversion
requests                      # HTTP client
mobile_sam                    # Segmentation model
```

### Standard Library (Built-in)

```python
import sys                    # System operations
import os                     # OS interface
from pathlib import Path      # Path handling
import base64                 # Base64 encoding
import io                     # I/O streams
```

---

## Key Algorithms

### 1. Bicubic Interpolation (Upscaling)

- Method: `cv2.INTER_CUBIC`
- 4x4 pixel neighborhood
- Smooth interpolation for technical drawings

### 2. Canny Edge Detection

- Parameters: (50, 150) thresholds
- Sobel kernel: 3x3
- Finds edges for Hough transform

### 3. Hough Line Transform

- Voting in parameter space (ρ, θ)
- Finds collinear edge points
- Probabilistic version for speed

### 4. Morphological Dilation

- Expands binary masks
- Kernel: Rectangular structuring element
- Used for text masks and line thickness

### 5. Inpainting Algorithms

- **INPAINT_TELEA:** Fast Marching Method
- **INPAINT_NS:** Navier-Stokes based
- Fills masked regions from surrounding pixels

### 6. Affine Transformations

- Rotation matrix: 2x3
- Scale, rotation, translation combined
- Preserves parallel lines

---

## Data Flow

### Complete Pipeline:

```
PDF Files
   ↓ [convert_all_pdfs.py]
PNG Images (Original Resolution)
   ↓ [upscale_realesrgan.py 2x]
PNG Images (High Resolution)
   ↓ [remove_text_ocr.py]
PNG Images (Text Removed)
   ↓ [web_sam_remover.py] (optional)
PNG Images (Annotations Removed)
   ↓ [interactive_overlay.py]
Comparison Overlay (Red/Green/Blue)
   ↓ [line_selector.py] (optional)
Final Cleaned Image
```

---

## Performance Characteristics

| Tool           | Speed      | RAM    | CPU/GPU |
| -------------- | ---------- | ------ | ------- |
| PDF Conversion | ~2s/page   | Low    | CPU     |
| Upscaling (2x) | ~1s/image  | Medium | CPU     |
| Text Removal   | ~5s/image  | Medium | CPU     |
| SAM Removal    | ~2s/click  | 500MB  | CPU     |
| Overlay Tool   | Real-time  | Low    | CPU     |
| Line Selector  | ~1s detect | Low    | CPU     |

---

## Model Files

### mobile_sam.pt (40MB)

- Architecture: vit_t (Vision Transformer - Tiny)
- Parameters: ~5M
- Input: RGB images, any resolution
- Output: Binary segmentation masks
- Device: CPU or GPU

### sam_vit_b_01ec64.pth (375MB) - Optional

- Architecture: vit_b (Vision Transformer - Base)
- Parameters: ~90M
- Better quality but slower
- Can be removed to save space

---

## System Requirements

### Minimum:

- Python 3.8+
- 4GB RAM
- 2GB disk space (with models)
- Modern web browser

### Recommended:

- Python 3.13+
- 8GB+ RAM
- 5GB disk space
- Chrome/Firefox/Safari

### OS Support:

- macOS (tested)
- Linux
- Windows

---

## Security Notes

### Flask Development Server

- **Warning:** Not for production use
- Runs on localhost only (127.0.0.1)
- No authentication
- Single-threaded

### File Operations

- Validates file extensions
- Uses pathlib for safe path handling
- Creates directories with proper permissions

### Model Loading

- Models loaded from local files only
- No remote model loading during runtime
- Checksum validation recommended (not implemented)

---

## Future Improvements

### Code Enhancements:

1. Add type hints to all functions
2. Unit tests for each module
3. Better error handling and logging
4. Configuration file support
5. REST API standardization

### Feature Additions:

1. Batch processing UI
2. Multi-image comparison
3. Automatic difference detection
4. Export to PDF reports
5. Real-ESRGAN AI upscaling integration

---

This document provides complete technical details of every file, library, and algorithm used in the ArchiDiff backend.
