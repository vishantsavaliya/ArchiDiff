# ArchiDiff Backend

Backend processing tools for architectural drawing comparison and cleaning.

## Overview

This backend provides a suite of image processing tools designed specifically for architectural floor plan drawings. The pipeline includes PDF conversion, image upscaling, text removal, annotation removal, overlay comparison, and line selection.

## Tools

### 1. PDF to PNG Conversion

**File:** `convert_all_pdfs.py`

Converts PDF files to high-quality PNG images.

```bash
# Convert all PDFs in a directory
python3 convert_all_pdfs.py
```

- Automatically finds all PDF files in the current directory
- Outputs PNG images for processing
- Maintains image quality for architectural details

---

### 2. Image Upscaling

**File:** `upscale_realesrgan.py`

Upscales images 2x or 4x using bicubic interpolation for better OCR and line detection.

```bash
# Upscale single image (default 4x)
python3 upscale_realesrgan.py input.png output.png

# Upscale with custom scale
python3 upscale_realesrgan.py input.png output.png 2

# Upscale entire directory
python3 upscale_realesrgan.py input_dir/ output_dir/ 2
```

**Benefits:**

- Better text detection (improves OCR accuracy)
- Clearer line detection (more lines found in Hough transform)
- Original: 356 lines detected → 2x upscaled: 794 lines detected
- Recommended: 2x scale for architectural drawings

---

### 3. Text Removal

**File:** `remove_text_ocr.py`

Removes text annotations from architectural drawings using EasyOCR.

```bash
# Process single image
python3 remove_text_ocr.py input.png output.png

# Process entire directory
python3 remove_text_ocr.py input_dir/ output_dir/
```

**Features:**

- **Single-pass detection** (optimized for upscaled images)
- EasyOCR with confidence threshold 0.3
- White fill method (preserves grid lines)
- Mask dilation for complete text removal
- Detects 19+ text regions on upscaled images

**Configuration:**

- `TWO_PASS = False` - Single pass sufficient for 2x upscaled images
- `MASK_DILATION = 3` - Pixel expansion around detected text
- `USE_WHITE_FILL = True` - White fill vs inpainting

---

### 4. Annotation Removal (MobileSAM)

**File:** `web_sam_remover.py`

Interactive web tool for removing arrows, symbols, and annotations using MobileSAM segmentation.

```bash
# Start server
python3 web_sam_remover.py image.png

# Open browser
http://localhost:5001
```

**Features:**

- Click-based selection
- Point prompts and bounding boxes
- Real-time mask preview
- Inpainting removal (preserves background patterns)
- Download cleaned images

**Model:**

- MobileSAM (vit_t) - 40MB model
- ~500MB RAM usage
- Fast inference on CPU

---

### 5. Interactive Overlay Comparison

**File:** `interactive_overlay.py`

Red/green overlay tool for comparing two architectural drawings with full transformation controls.

```bash
# Start server
python3 interactive_overlay.py image1.png image2.png

# Open browser
http://localhost:5002
```

**Features:**

- **Red:** Lower image only
- **Green:** Upper image only
- **Blue:** Intersection (where both overlap)
- Full transformations: move, rotate, scale (independent x/y)
- Opacity control
- Auto-fit to viewport
- Drag to move
- Keyboard shortcuts
- Save overlay as PNG

**Controls:**

- Arrow keys: Move image
- T/Y: Increase/decrease line thickness (1-10px)
- Sliders: Scale, rotation, opacity
- Mouse drag: Move upper image

---

### 6. Line Selection Tool

**File:** `line_selector.py`

Hough Line Transform-based line selection and removal tool.

```bash
# Start server
python3 line_selector.py image.png

# Open browser
http://localhost:5003
```

**Features:**

- Automatic line detection using Hough Transform
- Click to select/deselect lines
- Visual feedback (green = selected)
- Preview removal with inpainting
- Save cleaned image
- Stats: total lines / selected lines

**Detection Parameters:**

- Canny edge detection (50, 150)
- Hough parameters: rho=1, theta=π/180, threshold=50
- Min line length: 20px, Max gap: 5px
- Detects 350-800 lines depending on image complexity

---

## Complete Workflow

### Standard Pipeline

```bash
# 1. Convert PDFs to PNG
cd /path/to/pdfs
python3 convert_all_pdfs.py

# 2. Upscale for better detection (2x recommended)
python3 upscale_realesrgan.py converted/ upscaled/ 2

# 3. Remove text annotations
python3 remove_text_ocr.py upscaled/ cleaned/

# 4. Interactive annotation removal (if needed)
python3 web_sam_remover.py cleaned/drawing.png

# 5. Compare two versions
python3 interactive_overlay.py cleaned/version1.png cleaned/version2.png

# 6. Select and remove specific lines (if needed)
python3 line_selector.py cleaned/drawing.png
```

### Quick Comparison (No Text Removal)

```bash
# Direct comparison of two PDFs
python3 convert_all_pdfs.py
python3 interactive_overlay.py converted/drawing1.png converted/drawing2.png
```

---

## Models

### MobileSAM Model

- **File:** `mobile_sam.pt` (40MB)
- **Type:** vit_t (tiny vision transformer)
- **RAM:** ~500MB during inference
- **Speed:** Fast on CPU

### SAM Model (Optional)

- **File:** `sam_vit_b_01ec64.pth` (375MB)
- **Type:** vit_b (base vision transformer)
- **Note:** Can be removed if only using MobileSAM

---

## Dependencies

See `requirements.txt`:

```
opencv-python
numpy
easyocr
flask
pillow
torch
torchvision
mobile_sam
```

Install:

```bash
pip3 install -r requirements.txt
pip3 install git+https://github.com/ChaoningZhang/MobileSAM.git
```

---

## Directory Structure

```
backend/
├── README.md                    # This file
├── requirements.txt             # Python dependencies
│
├── convert_all_pdfs.py         # PDF → PNG conversion
├── upscale_realesrgan.py       # Image upscaling (2x/4x)
├── remove_text_ocr.py          # Text removal (EasyOCR)
├── web_sam_remover.py          # Annotation removal (MobileSAM)
├── interactive_overlay.py      # Overlay comparison tool
├── line_selector.py            # Line selection tool
│
├── mobile_sam.pt               # MobileSAM model (40MB)
├── sam_vit_b_01ec64.pth       # SAM model (375MB, optional)
│
└── details/                    # Additional resources
```

---

## Performance Notes

### Upscaling Impact

- **Original (2064×3352):** 356 lines detected, basic text detection
- **2x Upscaled (4128×6704):** 794 lines detected, 19 text regions found
- **Recommendation:** Always upscale 2x before text removal and line detection

### Text Removal

- Single-pass mode: ~5-10 seconds per upscaled image
- Two-pass mode: ~10-20 seconds (not needed for upscaled images)
- Best results with 2x upscaled images

### Interactive Tools

- Web-based (Flask servers)
- Run on localhost (ports 5001, 5002, 5003)
- CPU-based (no GPU required)
- Can run multiple tools simultaneously

---

## Troubleshooting

### Port Already in Use

```bash
# Kill existing process
lsof -ti:5001 | xargs kill -9 2>/dev/null
lsof -ti:5002 | xargs kill -9 2>/dev/null
lsof -ti:5003 | xargs kill -9 2>/dev/null
```

### Model Not Found

```bash
# Install MobileSAM
pip3 install git+https://github.com/ChaoningZhang/MobileSAM.git
```

### Low Memory

- Use MobileSAM instead of full SAM model
- Process smaller batches
- Close unused browser tabs
- Reduce upscaling factor (2x instead of 4x)

---

## Best Practices

1. **Always upscale before processing**

   - 2x scale provides best balance of quality and file size
   - Significantly improves text and line detection

2. **Use single-pass text removal for upscaled images**

   - Set `TWO_PASS = False` in remove_text_ocr.py
   - Faster and works great with 2x upscaled images

3. **Interactive tools for fine-tuning**

   - Use SAM remover for complex annotations
   - Use line selector for removing specific elements
   - Use overlay tool for detailed comparison

4. **Keep original files**
   - Always work on copies
   - Maintain original PDFs and PNGs
   - Use separate directories for each processing step

---

## Future Enhancements

- [ ] Real-ESRGAN AI upscaling integration
- [ ] Batch processing scripts
- [ ] REST API for programmatic access
- [ ] Docker containerization
- [ ] Cloud deployment support

---

## License

MIT License - See main repository for details

---

## Contact

For issues or questions, please visit the main repository: https://github.com/vishantsavaliya/ArchiDiff
