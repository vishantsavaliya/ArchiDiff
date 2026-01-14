# M-LSD Line Detection Guide

## What is M-LSD?

**M-LSD (Mobile Line Segment Detection)** is a Deep Learning model from ControlNet that detects straight lines in images. It's particularly useful for:

- **Scanned drawings** with noise or artifacts
- **Hand-drawn sketches** with imperfect lines
- **Complex architectural details** where traditional methods struggle
- **Poor quality PDFs** with compression artifacts

## Why Use M-LSD vs Skeletonization?

### Traditional Skeletonization (scikit-image)
✅ **Best for:** Clean, high-quality vector PDFs  
✅ **Advantages:** Fast, accurate for perfect drawings  
❌ **Limitations:** Struggles with noise, scans, or hand-drawn content

### M-LSD Deep Learning
✅ **Best for:** Messy, scanned, or hand-drawn content  
✅ **Advantages:** Robust to noise, detects semantic lines  
❌ **Limitations:** Slower (needs GPU), requires model download

## Installation

Already installed in your backend! The model downloads automatically on first use:

```bash
pip install controlnet-aux==0.0.9
```

Dependencies: PyTorch (CPU version: ~115MB, first use downloads model: ~1.2GB)

## API Endpoints

### 1. `/api/mlsd/{filename}` - Detect Lines

Extract straight lines from a PDF using M-LSD.

**Parameters:**
- `filename`: PDF file name (required)
- `page`: Page number, default 0
- `score_threshold`: Confidence threshold 0-1 (default: 0.1)
  - Lower = detect more lines (0.05)
  - Higher = only confident lines (0.3)
- `distance_threshold`: Minimum line length in pixels (default: 20.0)

**Example:**
```bash
# Default (detect many lines)
curl -o lines.png "http://localhost:8000/api/mlsd/elevator.pdf"

# High confidence only
curl -o lines.png "http://localhost:8000/api/mlsd/elevator.pdf?score_threshold=0.3"

# Longer lines only
curl -o lines.png "http://localhost:8000/api/mlsd/elevator.pdf?distance_threshold=50.0"
```

**Response Headers:**
```
X-Model: M-LSD
X-Score-Threshold: 0.1
X-Distance-Threshold: 20.0
X-DPI: 300
```

### 2. `/api/mlsd-overlay/{file1}/{file2}` - Compare with M-LSD

Create pink/green overlay using M-LSD detected lines.

**Parameters:**
- `file1`: First PDF (required)
- `file2`: Second PDF (required)
- `color1`: Color for file1 (default: green)
- `color2`: Color for file2 (default: pink)
- `score_threshold`: Line confidence (default: 0.1)
- `distance_threshold`: Min line length (default: 20.0)

**Example:**
```bash
# Compare two elevator designs
curl -o overlay.png \
  "http://localhost:8000/api/mlsd-overlay/detail1.pdf/detail2.pdf?color1=green&color2=pink"

# Strict comparison (only main lines)
curl -o overlay.png \
  "http://localhost:8000/api/mlsd-overlay/detail1.pdf/detail2.pdf?score_threshold=0.3&distance_threshold=50"
```

## Performance Comparison

### Processing Times (MacBook Pro M2)

| Method | PDF Size | Processing Time | Output Size |
|--------|----------|----------------|-------------|
| **Skeletonization** | 2376x2374 | ~2s | 56KB |
| **M-LSD** | 1792x1792 | ~5-7s (first run: ~20s) | 64KB |
| **M-LSD Overlay** | 1792x1792 | ~12-15s | 124KB |

**Note:** First M-LSD run downloads the model (~1.2GB), subsequent runs are faster.

## Tuning Parameters

### Score Threshold

```python
# Detect ALL possible lines (may include noise)
score_threshold=0.05

# Balanced (recommended for most drawings)
score_threshold=0.1  # DEFAULT

# Only very confident lines (clean main structures)
score_threshold=0.3
```

### Distance Threshold

```python
# Include tiny details
distance_threshold=10.0

# Balanced (default)
distance_threshold=20.0  # DEFAULT

# Only major structural lines
distance_threshold=50.0
```

## Use Cases

### Case 1: Clean Vector PDF → Use Skeletonization
```bash
# Fast, accurate
curl "http://localhost:8000/api/skeletonize/clean_drawing.pdf"
curl "http://localhost:8000/api/overlay/clean1.pdf/clean2.pdf"
```

### Case 2: Scanned Drawing → Use M-LSD
```bash
# Robust to noise
curl "http://localhost:8000/api/mlsd/scanned_sketch.pdf?score_threshold=0.2"
curl "http://localhost:8000/api/mlsd-overlay/scan1.pdf/scan2.pdf?score_threshold=0.2"
```

### Case 3: Hand-Drawn Sketch → Use M-LSD with Higher Threshold
```bash
# Focus on main lines
curl "http://localhost:8000/api/mlsd/sketch.pdf?score_threshold=0.3&distance_threshold=50"
```

## Technical Details

### Model Architecture
- **Model:** M-LSD from ControlNet (lllyasviel/ControlNet)
- **Input Resolution:** 512x512 (automatic scaling)
- **Output:** RGB image with detected lines
- **Framework:** PyTorch + HuggingFace

### How It Works
1. **PDF Extraction:** Render at 300 DPI (3x zoom)
2. **Model Inference:** Resize to 512x512, detect lines
3. **Output:** Scale back to original resolution
4. **Overlay:** Apply colors and blend with cv2.addWeighted

### Memory Usage
- **Model Size:** ~1.2GB (auto-downloads on first use)
- **RAM Usage:** ~2-3GB during inference
- **GPU Support:** Automatically uses MPS (Apple Silicon) if available

## Comparison Matrix

| Feature | Skeletonization | M-LSD |
|---------|----------------|-------|
| **Speed** | ⚡⚡⚡ Very Fast | ⚡ Slower |
| **Quality (Clean PDFs)** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Quality (Scanned)** | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Quality (Hand-drawn)** | ⭐ | ⭐⭐⭐⭐⭐ |
| **Noise Robustness** | ❌ Low | ✅ High |
| **Setup Complexity** | ✅ Simple | ⚠️ Model Download |
| **Dependencies** | scikit-image | PyTorch + ControlNet |

## Troubleshooting

### Model Download Fails
```bash
# Pre-download the model
python -c "from controlnet_aux import MLSDdetector; MLSDdetector.from_pretrained('lllyasviel/ControlNet')"
```

### Out of Memory
Reduce input resolution or use skeletonization instead.

### Lines Too Noisy
Increase `score_threshold` to 0.2-0.3.

### Missing Details
Decrease `score_threshold` to 0.05 and `distance_threshold` to 10.

## Future Enhancements

### 1. GPU Acceleration
```python
# Detect GPU and use if available
device = "cuda" if torch.cuda.is_available() else "cpu"
detector = MLSDdetector.from_pretrained('lllyasviel/ControlNet').to(device)
```

### 2. Batch Processing
Process multiple PDFs in parallel.

### 3. Hybrid Approach
Combine skeletonization for clean areas + M-LSD for complex regions.

## Summary

**M-LSD is now available in ArchiDiff!** 

- ✅ Two new endpoints: `/api/mlsd/` and `/api/mlsd-overlay/`
- ✅ Perfect for scanned or messy drawings
- ✅ Complements existing skeletonization approach
- ✅ Model auto-downloads on first use

**Recommendation:**
- **Clean vector PDFs** → Use `/api/skeletonize/` and `/api/overlay/`
- **Scanned/messy drawings** → Use `/api/mlsd/` and `/api/mlsd-overlay/`
