# ArchiDiff - Quick Start Guide

## 🚀 Complete Workflow Setup

### Step 1: Start Backend Processing API (Port 5000)

```bash
cd /Users/vishantsavaliya/ArchiDiff/backend
python3 processing_api.py
```

**This server handles:**

- PDF to PNG conversion
- Image upscaling (2x)
- Text removal
- File processing pipeline

### Step 2: Start Interactive Overlay API (Port 5002)

```bash
cd /Users/vishantsavaliya/ArchiDiff/backend
python3 interactive_overlay.py examples/cleaned_Sheet-430_SHUTTLE_GURNEY_ELEVATOR_CAR.png examples/cleaned_Sheet-430_PASSENGER_GURNEY_ELEVATOR_CAR.png
```

**This server handles:**

- Red/green/blue overlay comparison
- Transformation controls (translate, rotate, scale)

### Step 3: Start Frontend (Port 5173)

```bash
cd /Users/vishantsavaliya/ArchiDiff/frontend
npm run dev
```

**Access:** http://localhost:5173

---

## 📖 Using the New Home Page Workflow

### Automatic Processing Pipeline

1. **Go to Home Page**: http://localhost:5173

2. **Upload 2 Files**:

   - Click "Drawing 1" and select a PDF or PNG file
   - Click "Drawing 2" and select a PDF or PNG file
   - Supported formats: PDF, PNG, JPG (up to 50MB each)

3. **Click "Start Processing & Comparison"**

4. **Watch the Progress**:

   - 📄 Converting PDF to PNG (if needed)
   - 🔍 Upscaling images 2x
   - ✏️ Removing text annotations
   - Progress bar shows 0-100%

5. **Automatic Redirect**:

   - When complete, you'll be automatically redirected to the Overlay Comparison tool
   - Both images will be loaded and ready for comparison

6. **Adjust Overlay**:
   - Use sliders to translate, rotate, scale
   - Red = Drawing 1 only
   - Green = Drawing 2 only
   - Blue = Both images match
   - Save the overlay result

---

## 🛠 Individual Tools

### SAM Annotation Remover (Port 5001)

```bash
# Terminal 1
cd /Users/vishantsavaliya/ArchiDiff/backend
python3 web_sam_remover.py examples/cleaned_Sheet-600_FIRE_EXTINGUISHER_CABINET.png
```

Then go to: http://localhost:5173/sam-remover

**Workflow:**

1. Upload image
2. Click on annotations to create mask
3. Apply mask to remove
4. Save result

### Line Selector (Port 5003)

```bash
# Terminal 2
cd /Users/vishantsavaliya/ArchiDiff/backend
python3 line_selector.py examples/cleaned_Sheet-600_FIRE_EXTINGUISHER_CABINET.png
```

Then go to: http://localhost:5173/line-selector

**Workflow:**

1. Upload image
2. System detects lines
3. Click to select/deselect
4. Preview removal
5. Save result

---

## 📊 Complete Setup (All Services)

Run these in **4 separate terminals**:

```bash
# Terminal 1: Processing API (PDF, Upscale, Text Removal)
cd /Users/vishantsavaliya/ArchiDiff/backend
python3 processing_api.py

# Terminal 2: Overlay API
cd /Users/vishantsavaliya/ArchiDiff/backend
lsof -ti:5002 | xargs kill -9 2>/dev/null
python3 interactive_overlay.py examples/cleaned_Sheet-430_SHUTTLE_GURNEY_ELEVATOR_CAR.png examples/cleaned_Sheet-430_PASSENGER_GURNEY_ELEVATOR_CAR.png

# Terminal 3: SAM Remover API (optional)
cd /Users/vishantsavaliya/ArchiDiff/backend
lsof -ti:5001 | xargs kill -9 2>/dev/null
python3 web_sam_remover.py examples/cleaned_Sheet-600_FIRE_EXTINGUISHER_CABINET.png

# Terminal 4: Line Selector API (optional)
cd /Users/vishantsavaliya/ArchiDiff/backend
lsof -ti:5003 | xargs kill -9 2>/dev/null
python3 line_selector.py examples/cleaned_Sheet-600_FIRE_EXTINGUISHER_CABINET.png

# Terminal 5: Frontend
cd /Users/vishantsavaliya/ArchiDiff/frontend
npm run dev
```

---

## 🎯 Testing the New Workflow

### Test Case 1: Two PNG Files

1. Go to http://localhost:5173
2. Upload `converted/Sheet-600_FIRE_EXTINGUISHER_CABINET.png` as Drawing 1
3. Upload another PNG as Drawing 2
4. Click "Start Processing & Comparison"
5. Wait for completion (~30-60 seconds)
6. Automatic redirect to overlay comparison
7. Adjust transform controls
8. Save overlay

### Test Case 2: PDF Files

1. Place 2 PDF files in `backend/` folder
2. Go to http://localhost:5173
3. Upload both PDFs
4. Processing will:
   - Convert PDFs to PNG (300 DPI)
   - Upscale 2x
   - Remove text
   - Load into overlay
5. Takes longer (~2-3 minutes per file)

---

## 🔧 Troubleshooting

### "Upload failed: Network Error"

- Ensure processing_api.py is running on port 5000
- Check: `curl http://localhost:5000/health`

### "Lost connection to processing server"

- Backend may have crashed during processing
- Check terminal running processing_api.py for errors
- Restart: `python3 processing_api.py`

### "Failed to load processed images"

- Overlay API (port 5002) may not be running
- Start it with 2 dummy images first
- OR use manual file upload in overlay tool

### Ports Already in Use

```bash
# Kill all services
lsof -ti:5000 | xargs kill -9 2>/dev/null
lsof -ti:5001 | xargs kill -9 2>/dev/null
lsof -ti:5002 | xargs kill -9 2>/dev/null
lsof -ti:5003 | xargs kill -9 2>/dev/null

# Restart services
```

---

## 📝 API Endpoints Reference

### Processing API (Port 5000)

- `POST /upload` - Upload 2 files and start processing
- `GET /status/<job_id>` - Get processing status
- `GET /image/<job_id>/<file_num>` - Get processed image
- `DELETE /cleanup/<job_id>` - Clean up job files

### Overlay API (Port 5002)

- `GET /get_image` - Get current overlay
- `POST /update_transform` - Update transformation
- `GET /save` - Download overlay

### SAM API (Port 5001)

- `GET /get_image` - Get current image
- `POST /predict` - Generate mask from clicks
- `POST /apply_mask` - Apply mask
- `GET /reset` - Reset to original

### Line Selector API (Port 5003)

- `GET /get_image` - Get visualization
- `POST /click_line` - Toggle line selection
- `POST /clear_selection` - Clear all
- `POST /remove_selected` - Preview removal
- `POST /save_result` - Save result

---

## 🎉 Features

### Home Page Pipeline

- ✅ Upload PDF or PNG files
- ✅ Automatic PDF conversion (300 DPI)
- ✅ 2x upscaling for better quality
- ✅ Text removal using EasyOCR
- ✅ Real-time progress tracking
- ✅ Auto-redirect to overlay comparison
- ✅ Both images pre-loaded

### Processing Details

- **PDF Conversion**: 300 DPI, preserves layout
- **Upscaling**: Bicubic interpolation, 2x size
- **Text Removal**: EasyOCR English, Telea inpainting
- **Total Time**: ~1-2 minutes per file

### Overlay Features

- **Red/Green/Blue**: Visual difference detection
- **Transform Controls**: Translate, rotate, scale, opacity
- **Keyboard Shortcuts**: Arrow keys for precise movement
- **Save**: Download comparison overlay

---

## 💡 Tips

1. **Use PNG for faster processing** - PDFs take longer to convert
2. **Upscaling improves text detection** - 2x upscaling detects more text regions
3. **Start with overlay API** - It needs 2 images to initialize
4. **Watch the progress** - Terminal output shows detailed processing steps
5. **Check examples folder** - Pre-processed images available for testing

---

## 📚 Documentation

- [Backend README](backend/README.md) - Backend tools guide
- [Backend STRUCTURE](backend/STRUCTURE.md) - Technical deep-dive
- [Frontend README](frontend/README.md) - Frontend documentation
- [PROJECT_GUIDE](PROJECT_GUIDE.md) - Complete project documentation

---

**Built with ❤️ for architects and engineers**
