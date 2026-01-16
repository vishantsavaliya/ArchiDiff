# ArchiDiff - Complete Project Documentation

## 📋 Project Overview

ArchiDiff is a comprehensive platform for architectural drawing processing and comparison, featuring a Python Flask backend with React TypeScript frontend.

### Architecture

```
ArchiDiff/
├── backend/          # Python Flask services
│   ├── 6 processing tools (PDF, upscaling, text removal, SAM, overlay, lines)
│   └── 3 Flask servers (ports 5001, 5002, 5003)
└── frontend/         # React + TypeScript UI
    ├── 3 interactive tools (SAM Remover, Overlay, Line Selector)
    └── Vite dev server (port 5173)
```

## 🚀 Quick Start

### Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Start Flask servers (3 separate terminals)
python web_sam_remover.py          # Port 5001
python interactive_overlay.py       # Port 5002
python line_selector.py             # Port 5003
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev                        # Port 5173

# Build for production
npm run build
```

### Access the Application

- **Frontend**: http://localhost:5173
- **SAM API**: http://localhost:5001
- **Overlay API**: http://localhost:5002
- **Line Selector API**: http://localhost:5003

## 🛠 Backend Tools

### 1. PDF to PNG Converter (`convert_all_pdfs.py`)

Convert PDF architectural drawings to PNG images.

```bash
python convert_all_pdfs.py input_folder/ output_folder/ --dpi 300
```

**Features:**

- 200-600 DPI support
- Batch processing
- Preserves layout

### 2. Image Upscaler (`upscale_realesrgan.py`)

Upscale images 2x or 4x using bicubic interpolation.

```bash
python upscale_realesrgan.py input.png output.png --scale 2
python upscale_realesrgan.py input_dir/ output_dir/ --scale 4
```

**Results:**

- 2x: 2064×3352 → 4128×6704
- Better text detection (19 regions vs 7)

### 3. Text Remover (`remove_text_ocr.py`)

Remove text annotations using EasyOCR.

```bash
python remove_text_ocr.py input.png output.png
```

**Features:**

- Single-pass processing (TWO_PASS=False)
- EasyOCR English detection
- Telea inpainting algorithm
- ~5s per 2x upscaled image

### 4. SAM Annotation Remover (Web UI - Port 5001)

Interactive tool using MobileSAM for annotation removal.

**Backend:**

```bash
python web_sam_remover.py
```

**API Endpoints:**

- `GET /get_image` - Get current image
- `POST /predict` - Generate mask from clicks
- `POST /apply_mask` - Apply mask and remove
- `GET /reset` - Reset to original
- `GET /save` - Download result

**Model:** MobileSAM vit_t (40MB, ~0.2s inference)

### 5. Interactive Overlay (Web UI - Port 5002)

Compare two drawings with color overlay.

**Backend:**

```bash
python interactive_overlay.py
```

**API Endpoints:**

- `GET /get_image` - Get current overlay
- `POST /update_transform` - Update transformation
- `GET /save` - Download overlay

**Color Coding:**

- 🔴 Red: Lower image only
- 🟢 Green: Upper image only
- 🔵 Blue: Both images match

**Transform Controls:**

- Translation (dx, dy)
- Rotation (-180° to 180°)
- Scale (0.5x to 2.0x)
- Opacity (0 to 1)

### 6. Line Selector (Web UI - Port 5003)

Detect and selectively remove lines using Hough Transform.

**Backend:**

```bash
python line_selector.py
```

**API Endpoints:**

- `GET /get_image` - Get visualization
- `POST /click_line` - Toggle line selection
- `POST /clear_selection` - Clear all
- `POST /remove_selected` - Preview removal
- `POST /save_result` - Save final result

**Algorithm:**

- Canny edge detection
- Hough Transform line detection
- Click-to-select (15px threshold)
- Morphological closing for removal

## 🎨 Frontend Features

### Technology Stack

- **Framework**: React 18+ with TypeScript
- **Build**: Vite 7.3.1
- **Routing**: React Router DOM
- **HTTP**: Axios
- **Styling**: TailwindCSS v3.4

### Pages

#### 1. Home (Dashboard)

- Tool overview cards
- Feature grid
- Navigation to all tools

#### 2. SAM Remover (`/sam-remover`)

**Components:**

- Drag & drop file upload
- Interactive canvas with click handling
- Real-time mask preview
- Mask overlay toggle

**Workflow:**

1. Upload image
2. Click on annotation
3. Preview mask (50% opacity)
4. Apply mask to remove
5. Download result

#### 3. Overlay Comparison (`/overlay`)

**Components:**

- Dual file upload (lower + upper)
- Transform sliders (translate, rotate, scale, opacity)
- Real-time overlay preview

**Workflow:**

1. Upload lower image (red channel)
2. Upload upper image (green channel)
3. Adjust transformation
4. Click "Update Overlay"
5. Analyze differences (red/green) and matches (blue)
6. Download overlay

#### 4. Line Selector (`/line-selector`)

**Components:**

- File upload
- Interactive canvas
- Statistics panel (total/selected/remaining)
- Selection controls

**Workflow:**

1. Upload image
2. System detects lines
3. Click to select/deselect
4. Preview removal
5. Save result

### Reusable Components

#### FileUpload

Drag & drop with validation.

```tsx
<FileUpload
  accept="image/*"
  multiple={false}
  onFileSelect={handleFiles}
  maxSize={50}
  label="Upload Image"
/>
```

#### ImageCanvas

Interactive canvas with click handling.

```tsx
<ImageCanvas
  imageUrl={imageUrl}
  maskUrl={maskUrl}
  showMask={true}
  onClick={(x, y) => handleClick(x, y)}
/>
```

#### ProgressBar

Progress indicator.

```tsx
<ProgressBar progress={75} label="Processing..." color="primary" />
```

#### StatusMessage

Alerts and notifications.

```tsx
<StatusMessage
  type="success"
  message="Image processed successfully"
  onDismiss={() => setMessage(null)}
/>
```

### API Services

All backend communication is handled through typed services:

```typescript
// SAM Service
samService.predictMask({ points, box });
samService.applyMask();
samService.reset();
samService.save();

// Overlay Service
overlayService.updateTransform(transform);
overlayService.save();

// Line Selector Service
lineSelectorService.clickLine({ x, y });
lineSelectorService.removeSelected();
lineSelectorService.saveResult();
```

### Type Safety

Complete TypeScript coverage with interfaces for:

- API requests/responses
- Component props
- State management
- Backend contracts

See `frontend/src/types/index.ts` for 200+ lines of type definitions.

## 📦 Dependencies

### Backend (Python 3.13)

```
Flask==3.0.3
opencv-python==4.10.0.84
numpy==1.26.4
easyocr==1.7.2
torch==2.7.1
Pillow==11.1.0
pdf2image==1.17.0
segment-anything (MobileSAM)
flask-cors==5.0.0
```

### Frontend (Node.js)

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.1.3",
    "axios": "^1.7.9"
  },
  "devDependencies": {
    "typescript": "^5.7.3",
    "vite": "^7.3.1",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

## 🏗 Project Structure

### Backend

```
backend/
├── convert_all_pdfs.py        # PDF → PNG conversion
├── upscale_realesrgan.py      # 2x/4x upscaling
├── remove_text_ocr.py         # Text removal
├── web_sam_remover.py         # SAM Flask server (5001)
├── interactive_overlay.py     # Overlay Flask server (5002)
├── line_selector.py           # Line selector Flask server (5003)
├── requirements.txt           # Python dependencies
├── README.md                  # User guide
├── STRUCTURE.md               # Technical documentation
├── yolov8n.pt                 # YOLOv8 model (unused)
├── converted/                 # PDF conversion output
└── details/                   # Processing metadata
```

### Frontend

```
frontend/
├── src/
│   ├── components/            # Reusable UI
│   │   ├── FileUpload.tsx
│   │   ├── ImageCanvas.tsx
│   │   ├── ProgressBar.tsx
│   │   └── StatusMessage.tsx
│   ├── pages/                 # Route pages
│   │   ├── SAMRemover.tsx
│   │   ├── OverlayComparison.tsx
│   │   └── LineSelector.tsx
│   ├── services/              # API layer
│   │   ├── api.ts             # Axios instances
│   │   └── backendService.ts  # Service functions
│   ├── types/                 # TypeScript types
│   │   └── index.ts
│   ├── App.tsx                # Main app + routing
│   ├── main.tsx               # Entry point
│   └── index.css              # Global styles
├── tailwind.config.js         # TailwindCSS config
├── postcss.config.js          # PostCSS config
├── tsconfig.json              # TypeScript config
├── vite.config.ts             # Vite config
├── package.json               # Dependencies
└── README.md                  # Frontend docs
```

## 🔧 Development Workflow

### Backend Development

1. Install Python 3.13+
2. Create virtual environment
3. Install dependencies: `pip install -r requirements.txt`
4. Start Flask servers (3 terminals)
5. Test endpoints with curl or Postman

### Frontend Development

1. Install Node.js 18+
2. Install dependencies: `npm install`
3. Start dev server: `npm run dev`
4. Access http://localhost:5173
5. Hot module replacement enabled

### Testing Workflow

1. Start all 3 Flask backends
2. Start frontend dev server
3. Test each tool:
   - SAM Remover: Upload → Click → Apply → Save
   - Overlay: Upload 2 images → Transform → Update → Save
   - Line Selector: Upload → Select lines → Remove → Save

## 📊 Performance

### Backend

- **PDF Conversion**: ~2s per page (300 DPI)
- **Upscaling**: ~1-2s per image (bicubic)
- **Text Removal**: ~5s per 4000×6000 image
- **SAM Inference**: ~0.2s per prediction
- **Overlay**: ~0.1s per transform update
- **Line Detection**: ~0.5s for 800 lines

### Frontend

- **Build**: ~1s (production)
- **Dev Server**: ~600ms startup
- **Bundle Size**: 287 KB (gzipped: 93 KB)
- **CSS**: 17 KB (gzipped: 3.7 KB)

## 🐛 Troubleshooting

### Backend Issues

**"ModuleNotFoundError: No module named 'cv2'"**

```bash
pip install opencv-python==4.10.0.84
```

**"Port 5001 already in use"**

```bash
lsof -ti:5001 | xargs kill -9
```

**"MobileSAM model not found"**

```bash
# Will auto-download on first run (40MB)
python web_sam_remover.py
```

### Frontend Issues

**"Cannot find module 'react-router-dom'"**

```bash
npm install react-router-dom axios
```

**"Tailwind classes not working"**

```bash
npm install -D tailwindcss@^3.4.0 postcss autoprefixer
```

**"CORS errors"**

- Ensure Flask servers have flask-cors installed
- Check API_ENDPOINTS in `frontend/src/services/api.ts`

### Connection Issues

**Frontend can't reach backend**

1. Check all 3 Flask servers are running
2. Verify ports: 5001, 5002, 5003
3. Check firewall settings
4. Test endpoints: `curl http://localhost:5001/get_image`

## 🚀 Deployment

### Backend (Production)

```bash
# Use gunicorn for production
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5001 web_sam_remover:app
gunicorn -w 4 -b 0.0.0.0:5002 interactive_overlay:app
gunicorn -w 4 -b 0.0.0.0:5003 line_selector:app
```

### Frontend (Production)

```bash
# Build
npm run build

# Preview
npm run preview

# Serve with nginx or Apache
# Output: dist/
```

### Docker (Optional)

```dockerfile
# Backend Dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "web_sam_remover.py"]

# Frontend Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "run", "preview"]
```

## 📝 API Documentation

### SAM Remover API (Port 5001)

**GET /get_image**
Returns current image as base64.

**POST /predict**

```json
{
  "points": [{ "x": 100, "y": 200, "label": 1 }],
  "box": { "x1": 50, "y1": 50, "x2": 300, "y2": 300 }
}
```

Response: `{ "mask_image": "data:image/png;base64,..." }`

**POST /apply_mask**
No body required.
Response: `{ "image": "data:image/png;base64,..." }`

### Overlay API (Port 5002)

**POST /update_transform**

```json
{
  "dx": 10,
  "dy": 20,
  "rotation": 5,
  "scale_x": 1.1,
  "scale_y": 1.1,
  "opacity": 1.0,
  "thickness": 2
}
```

Response: `{ "image": "data:image/png;base64,..." }`

### Line Selector API (Port 5003)

**POST /click_line**

```json
{
  "x": 150,
  "y": 200
}
```

Response: `{ "success": true }`

**GET /get_image**
Response:

```json
{
  "image": "data:image/png;base64,...",
  "total_lines": 794,
  "selected_lines": 5
}
```

## 🎯 Use Cases

### 1. Remove Annotations from Scanned Drawings

- Upscale 2x for better detail
- Use SAM Remover to click and remove stamps/notes
- Save clean drawing

### 2. Compare Two Versions of Drawing

- Upload original and revised drawings
- Use Overlay Comparison
- Red/green shows changes, blue shows matches
- Adjust transform to align perfectly

### 3. Remove Specific Lines

- Upload drawing
- Use Line Selector to detect all lines
- Click to select unwanted lines
- Preview and save cleaned drawing

### 4. Batch Process PDFs

- Convert multi-page PDF to PNGs
- Upscale all images 2x
- Remove text from all images
- Process hundreds of pages automatically

## 📚 Learning Resources

### Backend

- [OpenCV Documentation](https://docs.opencv.org/)
- [EasyOCR Documentation](https://github.com/JaidedAI/EasyOCR)
- [MobileSAM Repository](https://github.com/ChaoningZhang/MobileSAM)
- [Flask Documentation](https://flask.palletsprojects.com/)

### Frontend

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [React Router Documentation](https://reactrouter.com/)

## 🤝 Contributing

### Code Style

- **Backend**: PEP 8, type hints, docstrings
- **Frontend**: TypeScript strict mode, functional components, Prettier

### Testing

- Backend: pytest for unit tests
- Frontend: Vitest for component tests

### Pull Request Process

1. Fork repository
2. Create feature branch
3. Make changes with tests
4. Submit PR with description

## 📄 License

See LICENSE file for details.

## 🔗 Related Documentation

- [Backend README](backend/README.md) - User guide for backend tools
- [Backend STRUCTURE](backend/STRUCTURE.md) - Technical deep-dive
- [Frontend README](frontend/README.md) - Frontend documentation

## 📧 Support

For issues or questions:

1. Check troubleshooting section
2. Review documentation
3. Open GitHub issue with:
   - Description
   - Steps to reproduce
   - Error messages
   - Environment info

---

**Built with ❤️ for architects and engineers**
