# Backend Documentation

Detailed documentation for ArchiDiff backend processing pipeline and API server.

## 📋 Table of Contents

1. [Overview](#overview)
2. [File Structure](#file-structure)
3. [Core Files](#core-files)
4. [API Endpoints](#api-endpoints)
5. [Processing Pipeline](#processing-pipeline)
6. [Utility Scripts](#utility-scripts)

---

## Overview

The backend is a Flask-based REST API server that handles:

- File uploads (PDF, PNG, JPG)
- PDF to PNG conversion
- Image upscaling (1.5X using bicubic interpolation)
- Optional text removal (using EasyOCR) with user toggle
- AI-powered comparison analysis (using Gemini 2.5 Flash)
- Async background processing with caching
- Processed image serving

**Port**: `5004`  
**Base URL**: `http://localhost:5004`

---

## File Structure

```
backend/
├── processing_api.py          # Main Flask API server
├── gemini_analyzer.py         # AI analysis module (Gemini)
├── upscale_realesrgan.py      # Image upscaling module
├── remove_text_ocr.py         # Text removal using EasyOCR
├── convert_all_pdfs.py        # Batch PDF converter
├── cleanup_all.py             # Storage cleanup utility
├── .env                       # Environment variables (API keys)
├── requirements.txt           # Python dependencies
├── uploads/                   # Temporary upload storage
├── processed/                 # Processed image output
│   ├── {job_id}/
│   │   ├── file1_final.png     # Processed image 1
│   │   ├── file2_final.png     # Processed image 2
│   │   └── analysis.txt        # Cached AI analysis
│   └── test-job/              # Test images for development
└── converted/                 # PDF conversion output
```

---

## Core Files

### 1. `processing_api.py` - Main API Server

**Purpose**: Flask REST API that orchestrates the entire processing pipeline.

**Key Features**:

- Multi-file upload handling (2 files at a time)
- Background job processing with progress tracking
- File validation and security checks
- Automatic cleanup of old uploads
- CORS enabled for frontend communication

**Configuration**:

```python
UPLOAD_FOLDER = Path('uploads')        # Temporary uploads
OUTPUT_FOLDER = Path('processed')      # Final output
MAX_FILE_SIZE = 50 * 1024 * 1024      # 50MB limit
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf'}
```

**Main Functions**:

- `upload_files()`: Handle file uploads and initiate processing
- `process_files(job_id)`: Background worker that processes uploaded files
- `cleanup_old_uploads()`: Remove old job folders (preserves test-job)
- `allowed_file(filename)`: Validate file extensions

**Processing Steps**:

1. Validate and save uploaded files
2. Convert PDFs to PNG (if needed) using Poppler
3. Upscale images 1.5X using bicubic interpolation
4. (Optional) Remove text using EasyOCR
5. Save final images to `processed/{job_id}/`

**Error Handling**:

- Invalid file types rejected
- File size limits enforced
- Graceful fallbacks for processing errors
- Detailed error messages in job status

---

### 2. `gemini_analyzer.py` - AI Analysis Module

**Purpose**: Lightweight async AI analysis using Gemini 2.5 Flash to compare architectural drawings.

**Key Features**:

- Async background processing (non-blocking)
- Image resizing to 1024px before API call (reduces payload)
- Caching: skips analysis if `analysis.txt` already exists
- Focused architectural analysis prompt
- Saves results to file for reuse

**Configuration**:

```python
GEMINI_API_KEY=your_api_key_here  # Required in .env
model = 'gemini-2.5-flash'        # Fast, cost-effective
max_dimension = 1024               # Resize images for API
```

**Main Class**:

```python
class GeminiAnalyzer:
    def __init__(self):
        # Load API key and configure model

    def resize_for_api(self, image_path, max_dimension=1024):
        # Resize image to reduce payload size

    def analyze_images(self, image1_path, image2_path):
        # Send to Gemini and get comparison analysis

    def analyze_from_job(self, job_folder):
        # Analyze from job folder paths
```

**Async Function**:

```python
def analyze_job_async(job_id, output_folder):
    # Background thread function
    # 1. Check if analysis.txt exists (caching)
    # 2. Wait for images to be processed
    # 3. Perform analysis
    # 4. Save to analysis.txt
```

**Analysis Prompt**:

- Focus on physical build differences
- Identify wall layers, framing, materials
- Ignore text/labels unless they affect build
- Brief 1-2 paragraph summary

**Caching Strategy**:

```python
if analysis_file.exists():
    return analysis_file.read_text()  # Skip API call
```

**Performance**:

- Image resize: ~100ms
- Gemini API call: 2-5 seconds
- Total: ~3-6 seconds per job
- Cached retrieval: <1ms

---

### 3. `upscale_realesrgan.py` - Image Upscaling

**Purpose**: Upscale architectural drawings for better quality and detail.

**How It Works**:

Uses **bicubic interpolation** (not Real-ESRGAN model) for 1.5X upscaling:

```python
def upscale_bicubic(input_path, output_path, scale_factor=1.5):
    """
    Upscale image using bicubic interpolation

    Algorithm:
    1. Load image with OpenCV
    2. Calculate new dimensions (width*1.5, height*1.5)
    3. Apply cv2.INTER_CUBIC interpolation
    4. Save high-quality result

    Why Bicubic?
    - Fast processing (~0.5-2 seconds per image)
    - Good quality for architectural drawings
    - No GPU required
    - Low memory footprint
    """
    image = cv2.imread(str(input_path))
    h, w = image.shape[:2]
    new_h, new_w = int(h * scale_factor), int(w * scale_factor)

    upscaled = cv2.resize(
        image,
        (new_w, new_h),
        interpolation=cv2.INTER_CUBIC
    )

    cv2.imwrite(str(output_path), upscaled)
```

**Performance**:

- 1000x1000 image → 1500x1500 in ~0.5 seconds
- 4000x4000 image → 6000x6000 in ~2 seconds

**Memory Usage**:

- Minimal (< 100MB for 4000x4000 images)
- Scales linearly with image size

**Command Line Usage**:

```bash
# Single file
python3 upscale_realesrgan.py input.png output.png

# Directory batch processing
python3 upscale_realesrgan.py input_folder/ output_folder/
```

---

### 3. `remove_text_ocr.py` - Text Removal

**Purpose**: Remove text labels and annotations from architectural drawings.

**How It Works**:

Uses **EasyOCR** library to detect and remove text:

```python
def remove_text_easyocr(image_path, output_path):
    """
    Text removal pipeline using EasyOCR + OpenCV inpainting

    Step 1: Text Detection with EasyOCR
    - Initialize EasyOCR Reader (downloads models on first run)
    - Detect text regions with bounding boxes
    - Get confidence scores for each detection

    Step 2: Mask Creation
    - Create binary mask (white = text, black = background)
    - Draw filled polygons for each detected text box
    - Dilate mask by 3 pixels to cover edges

    Step 3: Text Removal
    - Method A: White fill (fast, clean result)
      image[mask == 255] = 255

    - Method B: Inpainting (slower, natural result)
      cv2.inpaint(image, mask, radius=7, cv2.INPAINT_TELEA)

    Result: Clean architectural drawing without text
    """
```

**EasyOCR Details**:

- **Model**: English language model (quantized for efficiency)
- **Detection**: Finds text in any orientation
- **Accuracy**: ~90% confidence threshold
- **Memory**: Reuses reader instance (saves 200-500MB per call)
- **GPU**: Disabled (CPU-only for stability)

**Processing Flow**:

1. Load image with OpenCV
2. Initialize EasyOCR reader (cached globally)
3. Detect text regions: `reader.readtext(image)`
4. Create mask from detected bounding boxes
5. Dilate mask to cover text edges
6. Fill masked areas with white or use inpainting
7. Save cleaned image

**Configuration**:

```python
MASK_DILATION = 3           # Expand mask by 3 pixels
USE_WHITE_FILL = True       # True = white, False = inpaint
INPAINT_RADIUS = 7          # Blur radius for inpainting
TWO_PASS = False            # Single pass sufficient
```

**Performance**:

- First run: ~10 seconds (model initialization)
- Subsequent runs: ~2-5 seconds per image
- Memory: ~500MB (model) + image size

**Error Handling**:

- Large images (>5000x5000) downscaled automatically
- Missing model auto-downloads from EasyOCR servers
- Falls back to original image if OCR fails

**Command Line Usage**:

```bash
# Single file
python3 remove_text_ocr.py input.png output_cleaned.png

# Directory batch processing
python3 remove_text_ocr.py input_folder/ output_folder/
```

**When to Use**:

- ✅ Remove dimension labels
- ✅ Remove room names
- ✅ Remove annotations
- ❌ Not recommended for preserving fine details
- ❌ Disabled by default in current pipeline

---

## API Endpoints

### 1. Health Check

**Endpoint**: `GET /health`

**Response**:

```json
{
  "status": "ok",
  "service": "processing_api"
}
```

---

### 2. Upload Files

**Endpoint**: `POST /upload`

**Request**: `multipart/form-data`

- `file1`: First architectural drawing (PDF/PNG/JPG)
- `file2`: Second architectural drawing (PDF/PNG/JPG)
- `remove_text`: Optional boolean (`"true"` or `"false"`, default: `"true"`)

**Response**:

```json
{
  "job_id": "3f4210fb-aa0c-4457-95cd-19df1d5fb05d",
  "status": "queued",
  "message": "Files uploaded successfully. Processing started."
}
```

**Error Response**:

```json
{
  "error": "Both file1 and file2 are required"
}
```

**Status Codes**:

- `200`: Success
- `400`: Invalid request (missing files, wrong format)
- `413`: File too large (>50MB)
- `500`: Server error

---

### 3. Check Processing Status

**Endpoint**: `GET /status/<job_id>`

**Response** (Processing):

```json
{
  "job_id": "3f4210fb-aa0c-4457-95cd-19df1d5fb05d",
  "status": "processing",
  "progress": 75,
  "current_step": "Upscaling file 2",
  "file1": "floor_plan_1.pdf",
  "file2": "floor_plan_2.pdf"
}
```

**Response** (Complete):

```json
{
  "job_id": "3f4210fb-aa0c-4457-95cd-19df1d5fb05d",
  "status": "complete",
  "progress": 100,
  "current_step": "Complete",
  "file1": "floor_plan_1.pdf",
  "file2": "floor_plan_2.pdf",
  "file1_processed": "/image/3f4210fb.../1",
  "file2_processed": "/image/3f4210fb.../2"
}
```

**Progress Steps**:

- 0-20%: Uploading and validation
- 20-30%: Preparing files
- 30-60%: Text removal (if enabled)
- 65-95%: Upscaling (1.5X bicubic)
- 100%: Complete

---

### 4. Get Processed Image

**Endpoint**: `GET /image/<job_id>/<file_num>`

**Parameters**:

- `job_id`: Job identifier from upload
- `file_num`: `1` or `2` for first/second file

**Response**: PNG image file

**Example**:

```
GET /image/3f4210fb-aa0c-4457-95cd-19df1d5fb05d/1
```

---

### 5. Get AI Analysis

**Endpoint**: `GET /get-analysis/<job_id>`

**Response** (Ready):

```json
{
  "status": "ready",
  "summary": "The main difference between these drawings...",
  "job_id": "3f4210fb-aa0c-4457-95cd-19df1d5fb05d"
}
```

**Response** (Processing):

```json
{
  "status": "processing",
  "message": "AI analysis in progress...",
  "job_id": "3f4210fb-aa0c-4457-95cd-19df1d5fb05d"
}
```

**Features**:

- Lightweight GET request (reads cached `analysis.txt`)
- No image data transferred
- Returns instantly if analysis exists
- Non-blocking: frontend polls until ready

---

### 6. Cleanup Job Files

**Endpoint**: `DELETE /cleanup/<job_id>`

**Response**:

```json
{
  "message": "Cleanup successful"
}
```

---

### 7. Cleanup All Old Files

**Endpoint**: `POST /cleanup-all`

**Response**:

```json
{
  "message": "All old files cleaned successfully",
  "preserved": ["test-job"]
}
```

**Note**: Preserves `test-job` folder for development.

---

## Processing Pipeline

### Complete Flow Diagram

```
┌─────────────────┐
│  Upload Files   │ (file1, file2, remove_text option)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Validate Files  │ (size, format, security)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Save Files    │ (uploads/{job_id}/)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PDF → PNG      │ (if PDF, use Poppler)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Text Removal   │ (if enabled, use EasyOCR)
│   (Optional)    │ (else copy original)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Upscale 1.5X    │ (bicubic interpolation)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Save Output    │ (processed/{job_id}/)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI Analysis    │ (async background)
│   (Gemini)      │ (saves to analysis.txt)
└─────────────────┘
```

### Parallel Processing

Files are processed sequentially but certain steps run in parallel:

**Text Removal** (if enabled):

```python
with ThreadPoolExecutor(max_workers=2) as executor:
    futures = [
        executor.submit(remove_text, file1_path, output1_path),
        executor.submit(remove_text, file2_path, output2_path)
    ]
    for future in futures:
        future.result(timeout=120)  # 2 minute timeout
```

**AI Analysis** (async background):

```python
analysis_thread = threading.Thread(
    target=analyze_job_async,
    args=(job_id, str(OUTPUT_FOLDER))
)
analysis_thread.daemon = True
analysis_thread.start()  # Non-blocking
```

### Performance Optimizations

**Caching**:

- Analysis results cached to `analysis.txt`
- Skip analysis if file already exists
- Instant retrieval on subsequent requests

**Debouncing**:

- Slider operations use `onInput` instead of `onChange`
- Reduces render calls during dragging

**Smart Polling**:

- Frontend polls every 5 seconds
- Stops automatically when analysis ready
- Prevents unnecessary API calls

---

## Utility Scripts

### 1. `convert_all_pdfs.py`

Convert all PDFs in a folder to PNG.

**Usage**:

```bash
python3 convert_all_pdfs.py input_folder/ output_folder/
```

**Features**:

- Batch PDF conversion using Poppler
- 300 DPI output for high quality
- Preserves original filenames

---

### 2. `cleanup_all.py`

Remove all processed and upload folders.

**Usage**:

```bash
python3 cleanup_all.py
```

**Warning**: Deletes ALL job data except test-job folder.

---

## Dependencies

### Core Libraries

```
Flask==3.0.0              # Web framework
flask-cors==4.0.0         # CORS support
opencv-python==4.8.1      # Image processing
numpy==1.24.3             # Numerical operations
Pillow==10.1.0           # Image handling
easyocr==1.7.0           # Text detection (optional)
torch==2.1.0             # EasyOCR dependency
pdf2image==1.16.3        # PDF conversion
```

### System Requirements

**Poppler**: Required for PDF conversion

```bash
# macOS
brew install poppler

# Ubuntu/Debian
sudo apt-get install poppler-utils

# Windows
Download from: https://github.com/oschwartz10612/poppler-windows/releases
```

---

## Environment Configuration

### Storage Paths

```python
UPLOAD_FOLDER = Path('uploads')      # Temporary storage
OUTPUT_FOLDER = Path('processed')    # Final output
```

### File Constraints

```python
MAX_FILE_SIZE = 50 * 1024 * 1024    # 50MB per file
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf'}
```

### Processing Options

```python
UPSCALE_FACTOR = 1.5                 # 1.5X upscaling
TEXT_REMOVAL_ENABLED = False         # Disabled by default
```

---

## Error Handling & Logging

### Job Status States

- `queued`: Job created, waiting to process
- `processing`: Currently processing files
- `complete`: Successfully finished
- `error`: Processing failed

### Error Messages

```python
# Invalid file type
{"error": "Invalid file type. Only PDF, PNG, JPG allowed"}

# File too large
{"error": "File size exceeds 50MB limit"}

# Processing error
{"error": "Failed to process files", "details": "..."}

# Job not found
{"error": "Job not found"}
```

### Logging

All processing steps logged to console:

```
============================================================
🚀 ArchiDiff Processing API
============================================================
📁 Upload folder: /path/to/uploads
📁 Output folder: /path/to/processed
🌐 Server: http://localhost:5004
============================================================

🧹 Running startup cleanup...
✓ Startup cleanup complete

Processing job: 3f4210fb-aa0c-4457-95cd-19df1d5fb05d
  ✓ File 1 converted: floor_plan_1.pdf → floor_plan_1.png
  ✓ File 1 upscaled: 1.5x
  ✓ File 2 upscaled: 1.5x
✓ Processing complete
```

---

## Performance Optimization

### Memory Management

- EasyOCR reader cached globally (saves 200-500MB)
- Large images auto-downscaled before OCR
- Cleanup old jobs automatically on startup

### Processing Speed

| Operation    | 1000x1000 | 4000x4000 |
| ------------ | --------- | --------- |
| PDF → PNG    | ~2s       | ~5s       |
| Upscale 1.5X | ~0.5s     | ~2s       |
| Text Removal | ~3s       | ~8s       |

### Parallel Processing

Text removal runs in parallel using ThreadPoolExecutor:

- 2 workers for 2 files
- 120s timeout per file
- Automatic fallback on failure

---

## Security Considerations

1. **File Validation**: Only allowed extensions accepted
2. **Filename Sanitization**: `secure_filename()` prevents path traversal
3. **Size Limits**: 50MB max per file
4. **Storage Isolation**: Each job gets unique folder
5. **Auto Cleanup**: Old uploads removed on startup

---

## Development Tips

### Test Mode

Use `test-job` folder for development:

```
processed/test-job/
  ├── file1_final.png
  └── file2_final.png
```

Access directly: `http://localhost:5004/image/test-job/1`

### Debugging

Enable Flask debug mode in `processing_api.py`:

```python
app.run(host='0.0.0.0', port=5004, debug=True)
```

### Hot Reload

Flask auto-reloads on file changes in debug mode.

---

## Troubleshooting

### "Poppler not found"

Install Poppler for PDF conversion:

```bash
brew install poppler  # macOS
```

### "EasyOCR model download failed"

Check internet connection or manually download:

```bash
python3 -c "import easyocr; easyocr.Reader(['en'])"
```

### "Out of memory"

- Reduce image sizes before upload
- Disable text removal
- Increase system swap space

### "Port 5004 already in use"

Kill existing process:

```bash
lsof -ti :5004 | xargs kill -9
```

---

## Future Enhancements

- [ ] WebSocket for real-time progress updates
- [ ] Batch processing (>2 files at once)
- [ ] GPU acceleration for upscaling
- [ ] Redis for job queue management
- [ ] Docker containerization
- [ ] Cloud storage integration (S3)

---

**Last Updated**: January 17, 2026
