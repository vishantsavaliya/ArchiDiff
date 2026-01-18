# ArchiDiff

ArchiDiff is a web-based architectural drawing comparison and editing tool designed to compare two architectural plans side-by-side with advanced overlay and editing capabilities.

## 🎯 Features

- **Upload & Process**: Upload two architectural drawings (PDF, PNG, JPG)
- **Text Removal Toggle**: Optional text annotation removal during preprocessing
- **Automatic Upscaling**: 1.5X upscaling using bicubic interpolation for better quality
- **AI Analysis**: Automatic comparison analysis using Gemini 2.5 Flash
- **Canvas Editor**: Interactive canvas with layer-based editing
- **Box Erase Tool**: Precise erasing with transform-aware coordinate system
- **Overlay Comparison**: Compare two drawings with adjustable opacity
- **Layer Management**: Move, scale, rotate, and adjust opacity of each layer independently
- **Undo/Redo**: 10-step history for all edits
- **Summary Panel**: Collapsible AI-generated analysis with close button
- **Download Results**: Export edited images as PNG
- **Performance Optimized**: Caching, smart polling, debounced operations

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Node.js 18+
- npm or yarn

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd ArchiDiff
```

2. **Backend Setup**

```bash
cd backend
pip install -r requirements.txt
```

3. **Configure Environment**

Create `backend/.env` file:
```bash
GEMINI_API_KEY=your_api_key_here
```

4. **Frontend Setup**

```bash
cd frontend
npm install
```

### Running the Application

1. **Start Backend Server** (Terminal 1)

```bash
cd backend
python3 processing_api.py
```

Backend will run on `http://localhost:5004`

2. **Start Frontend Server** (Terminal 2)

```bash
cd frontend
npm run dev
```

Frontend will run on `http://localhost:5177`

3. **Access the Application**
   Open `http://localhost:5177` in your browser

## 📖 How to Use

1. **Upload Files**: Click "Choose Files" and select two architectural drawings
2. **Text Removal Option**: Check/uncheck "Remove text annotations" before processing
3. **Processing**: Files are automatically upscaled 1.5X for better quality
4. **AI Analysis**: Automatic comparison analysis runs in background
5. **Canvas Editor**: Opens automatically after processing
6. **Edit Tools**:
   - **Overlay Mode**: Drag to move the active layer, adjust opacity with slider
   - **Edit Mode**: Draw box selections to erase areas
   - **Layer Controls**: Switch between layers, toggle visibility, swap order
7. **Summary Button**: Click to view/hide AI-generated analysis in right panel
8. **Download**: Click "Download Canvas" to save your edited image

## 🏗️ Architecture

```
ArchiDiff/
├── backend/          # Flask API server
│   ├── processing_api.py      # Main API server
│   ├── gemini_analyzer.py     # AI analysis module
│   ├── upscale_realesrgan.py  # Image upscaling
│   ├── remove_text_ocr.py     # Text removal (optional)
│   ├── .env                   # API keys (not in git)
│   └── requirements.txt       # Python dependencies
├── frontend/         # React TypeScript app
│   ├── src/
│   │   ├── pages/            # Main pages
│   │   ├── components/       # UI components
│   │   ├── services/         # API integration
│   │   └── utils/            # Helper utilities
│   └── package.json          # Node dependencies
└── README.md         # This file
```

## 🔧 Configuration

### Backend Port

Edit `processing_api.py`:

```python
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5004, debug=True)
```

### Frontend API URL

Edit `frontend/src/services/api.ts`:

```typescript
const API_BASE_URL = "http://localhost:5004";
```

### Canvas Size

Edit `frontend/src/pages/CanvasEditor.tsx`:

```typescript
const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 1200;
```

## 📚 Documentation

- **[FRONTEND.md](./FRONTEND.md)**: Detailed frontend architecture and component documentation
- **[BACKEND.md](./BACKEND.md)**: Detailed backend API and processing pipeline documentation

## 🛠️ Technologies

**Backend:**

- Flask - Web framework
- OpenCV - Image processing
- EasyOCR - Text detection (optional)
- Real-ESRGAN - Image upscaling

**Frontend:**

- React 18 - UI framework
- TypeScript - Type safety
- Vite - Build tool
- Canvas API - Image rendering and editing
- Tailwind CSS - Styling

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues and questions, please open an issue on GitHub.
