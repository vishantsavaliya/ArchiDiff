# ArchiDiff - Project Development Summary

## Overview

ArchiDiff is a full-stack web application that enables visual comparison of architectural detail drawings by overlaying them with distinct colors to highlight differences and similarities.

---

## Tech Stack

### Frontend

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (button, card, slider)
- **Canvas Library**: Fabric.js v7 (for image overlay and manipulation)
- **Notifications**: Sonner (toast notifications)

### Backend

- **Framework**: FastAPI (Python)
- **Server**: Uvicorn (ASGI server)
- **PDF Processing**: PyMuPDF (fitz) v1.24.14
- **Image Processing**: OpenCV (cv2), Pillow, NumPy
- **File Format Support**: ezdxf v1.4.3 (for DXF files)

---

## Project Structure

```
ArchiDiff/
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── compare/page.tsx      # Main comparison interface
│   │   ├── about/page.tsx        # About page
│   │   ├── layout.tsx            # Root layout
│   │   └── globals.css           # Global styles
│   ├── components/
│   │   ├── ComparisonCanvas.tsx  # Fabric.js canvas for overlaying
│   │   ├── DetailSelector.tsx    # Grid of detail cards
│   │   └── ui/                   # shadcn/ui components
│   ├── lib/
│   │   ├── api.ts                # API client functions
│   │   └── utils.ts              # Utility functions
│   └── package.json
│
├── backend/
│   ├── main.py                   # FastAPI server with all endpoints
│   ├── requirements.txt          # Python dependencies
│   ├── details/                  # Original PDF files (6 files)
│   ├── converted_images/         # PNG conversions from PDFs
│   │   └── outlines_detailed/    # Edge-detected outlines (final)
│   ├── convert_detailed_outlines.py  # Script for edge detection
│   └── venv/                     # Python virtual environment
│
└── PROJECT_SUMMARY.md            # This file
```

---

## Development Process

### Phase 1: Initial Setup

1. Created Next.js frontend with TypeScript
2. Set up FastAPI backend with CORS
3. Created three pages: landing, compare, about
4. Implemented detail selector component showing metadata cards

### Phase 2: Backend API Development

**6 API Endpoints Created:**

1. `GET /api/details` - Returns list of all architectural details with metadata
2. `GET /files/{filename}` - Serves original files (PDFs, DXFs, images)
3. `GET /api/detail/{detail_id}` - Get specific detail by ID
4. `GET /api/search?query={q}` - Search details by keywords
5. `GET /api/projects` - List all unique projects
6. `GET /api/pdf-to-image/{filename}?page={n}` - Convert PDF to PNG (real-time)

### Phase 3: PDF Processing Challenge

**Problem**: Fabric.js cannot load PDF files directly on HTML canvas

**Solution**:

- Added PyMuPDF (fitz) library
- Created `/api/pdf-to-image` endpoint that:
  - Opens PDF using `fitz.open()`
  - Renders first page at 2x resolution (`Matrix(2.0, 2.0)`)
  - Converts to PNG in memory
  - Streams back as `image/png` response
- Frontend automatically routes `.pdf` files through this endpoint

### Phase 4: Edge Detection for Outlines

**Goal**: Convert solid architectural drawings to clean outlines for better overlay visualization

**Initial Approach (Blurry):**

- Canny edge detection with Gaussian blur (5x5 kernel)
- Thresholds: 50, 150
- Result: Soft edges, loss of detail

**Final Approach (Sharp & Detailed):**

```python
# 1. Adaptive Thresholding - preserves text and fine lines
binary = cv2.adaptiveThreshold(
    gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv2.THRESH_BINARY_INV, 11, 2
)

# 2. Minimal blur (3x3) - retains sharpness
blurred = cv2.GaussianBlur(gray, (3, 3), 0)

# 3. Lower Canny thresholds - captures more detail
edges = cv2.Canny(blurred, threshold1=30, threshold2=100)

# 4. Combine both methods for maximum detail
combined = cv2.bitwise_or(binary, edges)
```

**Result**: Crisp white outlines on black background, ready for color overlay

### Phase 5: UI Design Evolution

**Original**: Dark gradient background with dark text (invisible!)

**Final**:

- White background (#ffffff)
- Black headings, gray-700 body text
- Blue accent color for selections
- White cards with gray borders
- High contrast for accessibility

---

## Key Features Implemented

### Comparison Canvas (ComparisonCanvas.tsx)

- **Image Loading**: Fabric.js FabricImage with URL loading
- **Color Tinting**: `fabric.filters.BlendColor()` filter
- **Opacity Control**: Individual sliders for each overlay (0-100%)
- **Pan**: Alt/Option + drag to move around
- **Zoom**: Mouse wheel to zoom in/out
- **Export**: Download overlayed result as PNG
- **Reset**: Clear canvas and start over

### Detail Selector (DetailSelector.tsx)

- Grid layout with responsive cards
- Shows: Name, project, scale, description, filename
- Visual selection indicator (blue border)
- "exists" check for file availability
- Callback on selection

### API Integration (lib/api.ts)

- `fetchDetails()` - Get all details
- `getDetailFileUrl()` - Smart routing (PDF → conversion, others → direct)
- Base URL configuration for API endpoint

---

## Testing & Validation

### Backend Testing (without frontend)

```bash
# Test details endpoint
curl http://127.0.0.1:8000/api/details

# Test PDF to PNG conversion
curl -o test.png "http://127.0.0.1:8000/api/pdf-to-image/Sheet-001.pdf?page=0"

# Verify output is valid PNG
file test.png  # Should show: PNG image data
```

### Batch Processing

```bash
# Convert all PDFs to PNGs
for pdf in details/*.pdf; do
  curl -o "converted_images/$(basename "$pdf" .pdf).png" \
    "http://127.0.0.1:8000/api/pdf-to-image/$(basename "$pdf")?page=0"
done

# Generate edge-detected outlines
python convert_detailed_outlines.py
```

---

## File Inventory

### Original PDF Files (6)

Located in `backend/details/`:

1. `Sheet-001_ACCESSIBLE_WATER_CLOSET_MULTIPLE_ACCOMMODATION_ALT_(CBC_11A).pdf`
2. `Sheet-ACCESSIBLE_WATER_CLOSET_MULTIPLE_ACCOMMODATION_ALT_(CBC_11A).pdf`
3. `Sheet-430_PASSENGER_GURNEY_ELEVATOR_CAR.pdf`
4. `Sheet-430_SHUTTLE_GURNEY_ELEVATOR_CAR.pdf`
5. `Sheet-600_FIRE_EXTINGUISHER_CABINET.pdf`
6. `Sheet-600_FIRE_EXTINGUISHER_CABINET_(2).pdf`

### Generated PNG Files

**Original PDFs as PNG** (`backend/converted_images/`):

- Full-resolution PNG versions of all PDFs
- 2x zoom factor for quality (1160x600 to 1188x1187 pixels)

**Edge-Detected Outlines** (`backend/converted_images/outlines_detailed/`):

- White outlines on black background
- Preserves fine details, text, dimensions
- Ready for color overlay visualization

---

## Important Code Patterns

### Frontend: Loading Images Through API

```typescript
export function getDetailFileUrl(filename: string): string {
  const baseUrl = "http://127.0.0.1:8000";

  // Route PDFs through conversion endpoint
  if (filename.endsWith(".pdf")) {
    const encoded = encodeURIComponent(filename);
    return `${baseUrl}/api/pdf-to-image/${encoded}?page=0`;
  }

  // Direct file access for images
  return `${baseUrl}/files/${filename}`;
}
```

### Backend: PDF to Image Conversion

```python
@app.get("/api/pdf-to-image/{filename}")
async def pdf_to_image(filename: str, page: int = 0):
    file_path = DETAILS_DIR / filename

    # Open PDF
    doc = fitz.open(file_path)
    pdf_page = doc[page]

    # Render at 2x resolution for quality
    pix = pdf_page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0))

    # Convert to PNG
    img_data = pix.pil_tobytes("PNG")

    return StreamingResponse(
        io.BytesIO(img_data),
        media_type="image/png"
    )
```

### Canvas: Applying Color Overlay

```typescript
const colorFilter = new fabric.filters.BlendColor({
  color: color,
  mode: "tint",
  alpha: 1,
});

fabricImage.filters = [colorFilter];
fabricImage.applyFilters();
canvas.add(fabricImage);
```

---

## Dependencies & Installation

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
uvicorn main:app --reload
```

**Key Dependencies:**

- `fastapi` - Web framework
- `uvicorn[standard]` - ASGI server
- `pymupdf==1.24.14` - PDF processing
- `opencv-python` - Image processing
- `Pillow==11.1.0` - Image manipulation
- `ezdxf==1.4.3` - DXF file support
- `pypdf2` - PDF utilities
- `numpy` - Numerical operations

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

**Key Dependencies:**

- `next` - React framework
- `fabric` - Canvas library (v7)
- `react`, `react-dom` - React core
- `tailwindcss` - CSS framework
- `sonner` - Toast notifications

---

## Common Issues & Solutions

### Issue 1: ezdxf Version Error

**Error**: `ERROR: Could not find a version that satisfies the requirement ezdxf==1.3.8`

**Solution**: Changed to `ezdxf==1.4.3` in requirements.txt

### Issue 2: Port 8000 Already in Use

**Error**: `Address already in use`

**Solution**:

```bash
lsof -ti:8000 | xargs kill -9
```

### Issue 3: Blurry Outlines

**Problem**: Initial edge detection was too soft/blurry

**Solution**:

- Reduced Gaussian blur kernel (5x5 → 3x3)
- Lowered Canny thresholds (50,150 → 30,100)
- Added adaptive thresholding for fine details
- Combined multiple detection methods

### Issue 4: Dark UI Invisible

**Problem**: Dark text on dark background

**Solution**: Complete UI redesign to white/black high-contrast theme

---

## How to Use the Application

1. **Start Backend**: `cd backend && source venv/bin/activate && uvicorn main:app --reload`
2. **Start Frontend**: `cd frontend && npm run dev`
3. **Open Browser**: Navigate to `http://localhost:3000`
4. **Select Details**: Click on two different architectural details
5. **Choose Colors**: Pick colors for each overlay (e.g., green and red)
6. **Adjust Opacity**: Use sliders to see through each layer
7. **Pan/Zoom**: Alt+drag to pan, scroll to zoom
8. **Export**: Download the comparison as PNG

---

## Image Processing Pipeline

```
PDF Files (backend/details/)
    ↓
[PyMuPDF Conversion @ 2x Resolution]
    ↓
PNG Files (backend/converted_images/)
    ↓
[OpenCV Edge Detection Pipeline:
 1. Grayscale conversion
 2. Adaptive thresholding
 3. Minimal Gaussian blur (3x3)
 4. Canny edge detection (30, 100)
 5. Combine methods with bitwise OR]
    ↓
Outline PNGs (backend/converted_images/outlines_detailed/)
    ↓
[Frontend loads via API]
    ↓
[Fabric.js applies color filters]
    ↓
Color Overlay Visualization on Canvas
```

---

## Future Enhancements (Ideas)

1. **Alignment Tools**: Auto-align similar features between drawings
2. **Multi-page PDFs**: Support for PDFs with multiple sheets
3. **Difference Highlighting**: Automatically highlight differing regions
4. **Measurement Tools**: Add rulers and dimension comparison
5. **Annotation**: Allow users to mark up comparisons
6. **Save/Share**: Export comparison settings and share via URL
7. **Batch Compare**: Compare 3+ drawings simultaneously
8. **DXF Support**: Fully implement DXF file comparison
9. **Dark Mode**: Toggle between light/dark themes
10. **Cloud Storage**: Upload and store custom detail files

---

## Interview Talking Points

### Technical Decisions

1. **Why PyMuPDF over other PDF libraries?**

   - Fast rendering, high-quality output
   - Built-in 2x resolution scaling
   - Efficient memory handling with streaming responses

2. **Why Fabric.js over native Canvas API?**

   - Built-in object manipulation (pan, zoom, select)
   - Filter system for color tinting
   - Easy export functionality
   - Better developer experience

3. **Why OpenCV for edge detection?**

   - Industry-standard for computer vision
   - Multiple detection algorithms available
   - Excellent for architectural drawings (lines, text)

4. **Why Next.js over React alone?**
   - File-based routing
   - Built-in API support (could use for proxying)
   - Server-side rendering capabilities
   - Better SEO for landing/about pages

### Problem-Solving Examples

1. **PDF Rendering Issue**: Identified Fabric.js limitation, implemented server-side conversion
2. **Image Quality**: Increased resolution 2x to maintain clarity on canvas
3. **Detail Preservation**: Switched from pure edge detection to hybrid approach with adaptive thresholding
4. **API Design**: Smart routing in frontend to handle different file types transparently

### Architecture Highlights

- **Separation of Concerns**: Frontend handles UI/visualization, backend handles file processing
- **Real-time Conversion**: PDFs converted on-demand rather than pre-processing all files
- **Type Safety**: TypeScript throughout frontend for better maintainability
- **RESTful API**: Standard HTTP endpoints with proper status codes
- **CORS Configuration**: Secure cross-origin setup for local development

---

## Running Commands Reference

```bash
# Backend
cd /Users/vishantsavaliya/ArchiDiff/backend
source venv/bin/activate
uvicorn main:app --reload

# Frontend
cd /Users/vishantsavaliya/ArchiDiff/frontend
npm run dev

# Edge Detection Script
cd /Users/vishantsavaliya/ArchiDiff/backend
source venv/bin/activate
python convert_detailed_outlines.py

# API Testing
curl http://127.0.0.1:8000/api/details
curl -o test.png "http://127.0.0.1:8000/api/pdf-to-image/[filename].pdf?page=0"
```

---

**Created**: January 14, 2026  
**Purpose**: Full-stack architectural detail comparison tool  
**Status**: Core functionality complete, ready for testing and enhancement
