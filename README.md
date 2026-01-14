# ArchiBoost Compare

A professional web tool for visually comparing architectural details by overlaying drawings on a single canvas.

## Problem Statement

Architects and designers often create multiple versions of the same detail across different projects. When searching through a detail library, it's difficult to compare similar details and identify the best version to use.

## Solution

ArchiBoost Compare allows users to:
- Select two architectural details from a library
- Overlay them on a single canvas with distinct colors
- Adjust opacity, alignment, and zoom to spot differences
- Export comparisons as high-quality images

## Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Beautiful, accessible UI components
- **Fabric.js** - Interactive canvas for overlays

### Backend
- **FastAPI** - Modern Python web framework
- **Uvicorn** - ASGI server
- **Python libraries** - Image processing, CAD file parsing

## Project Structure

```
archiboost-compare/
├── frontend/           # Next.js application
│   ├── app/           # App router pages
│   ├── components/    # React components
│   └── lib/           # Utilities
├── backend/           # FastAPI server
│   ├── main.py       # API endpoints
│   ├── details/      # Detail files storage
│   └── processors/   # File processing modules
└── README.md
```

## Getting Started

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Add your detail files to `backend/details/` directory

5. Run the server:
```bash
uvicorn main:app --reload
```

API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run development server:
```bash
npm run dev
```

App will be available at `http://localhost:3000`

## Features

- 🎨 **Visual Overlay** - Compare details with color-coded overlays
- 🎚️ **Opacity Control** - Adjust transparency for each layer
- 🔍 **Pan & Zoom** - Navigate large drawings easily
- 📸 **Export** - Save comparisons as PNG images
- 🎯 **Alignment Tools** - Position details precisely
- 📱 **Responsive** - Works on desktop and tablet
- 🌙 **Dark Mode** - Professional dark interface

## Usage

1. Open the app and click "Start Comparing"
2. Select two details from the library
3. Use opacity sliders to adjust visibility
4. Pan and zoom to inspect differences
5. Export the comparison for documentation

## Development

### Adding New Details

1. Place files in `backend/details/`
2. Update `DETAILS_METADATA` in `backend/main.py`
3. Supported formats: PDF, PNG, JPG, DXF, DWG

### Customization

- Colors: Edit Tailwind theme in `tailwind.config.ts`
- API endpoints: Modify `backend/main.py`
- UI components: Located in `frontend/components/`

## Deployment

### Frontend (Vercel)
```bash
cd frontend
vercel deploy
```

### Backend (Railway/Render)
```bash
cd backend
# Follow platform-specific deployment steps
```

## Future Enhancements

- [ ] AI-powered similarity detection
- [ ] Automatic alignment using computer vision
- [ ] Batch comparison (3+ details)
- [ ] Annotation tools
- [ ] Collaborative features
- [ ] Version history tracking

## Author

Built by [Your Name] as a portfolio project demonstrating full-stack development with modern web technologies.

## License

MIT License - Feel free to use this project for learning and portfolio purposes.
