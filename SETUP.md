# 🚀 Quick Start Guide

## Prerequisites

- **Node.js 18+** and npm
- **Python 3.9+** and pip

## Setup Instructions

### 1️⃣ Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On macOS/Linux
# OR
venv\Scripts\activate     # On Windows

# Install dependencies
pip install -r requirements.txt

# Add your 6 detail files to backend/details/
# Supported formats: PDF, PNG, JPG, DXF

# Update DETAILS_METADATA in main.py to match your files

# Run the server
uvicorn main:app --reload
```

Backend API will be available at: **http://localhost:8000**

### 2️⃣ Frontend Setup

```bash
cd frontend

# Install dependencies (if not already done)
npm install

# Create environment file
cp .env.example .env.local

# Start development server
npm run dev
```

Frontend will be available at: **http://localhost:3000**

## 📁 Adding Detail Files

1. Place your 6 architectural detail files in `backend/details/`
2. Update the `DETAILS_METADATA` dictionary in `backend/main.py`:

```python
DETAILS_METADATA = {
    "1": {
        "id": "1",
        "name": "Your Detail Name",
        "filename": "your_file.pdf",  # Must match actual filename
        "project": "Project Name",
        "scale": "1:20",
        "description": "Brief description"
    },
    # Add entries for all 6 files...
}
```

## 🎨 Using ArchiDiff

1. Navigate to **http://localhost:3000**
2. Click **"Start Comparing"**
3. Select **Detail 1** from the left panel
4. Select **Detail 2** from the bottom panel
5. Adjust **opacity** and **colors** as needed
6. Use **Alt + drag** to pan, **mouse wheel** to zoom
7. Click **"Export PNG"** to save your comparison

## 🛠️ Tech Stack

**Frontend:**

- Next.js 14 + TypeScript
- Tailwind CSS + shadcn/ui
- Fabric.js (canvas overlay)
- Sonner (notifications)

**Backend:**

- FastAPI + Uvicorn
- ezdxf (CAD file parsing)
- Pillow (image processing)

## 📝 Project Structure

```
ArchiDiff/
├── frontend/              # Next.js application
│   ├── app/
│   │   ├── page.tsx      # Landing page
│   │   ├── compare/      # Comparison page
│   │   └── about/        # About page
│   ├── components/
│   │   ├── ComparisonCanvas.tsx
│   │   └── DetailSelector.tsx
│   └── lib/
│       └── api.ts        # API integration
│
├── backend/              # FastAPI server
│   ├── main.py          # API endpoints
│   ├── details/         # Store your 6 files here
│   └── requirements.txt
│
└── README.md
```

## 🐛 Troubleshooting

### Backend not starting?

- Check if port 8000 is available
- Ensure virtual environment is activated
- Verify all dependencies are installed: `pip list`

### Frontend shows "Failed to load details"?

- Ensure backend is running on port 8000
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Verify CORS is enabled in `backend/main.py`

### Images not loading?

- Confirm files exist in `backend/details/`
- Check filenames match `DETAILS_METADATA`
- Try accessing: http://localhost:8000/files/your_file.pdf

## 🚀 Deployment

### Backend (Python)

- Deploy to Heroku, Railway, or Render
- Set environment variables for production
- Use Gunicorn for production server

### Frontend (Next.js)

- Deploy to Vercel (recommended)
- Update `NEXT_PUBLIC_API_URL` to production backend URL
- Build command: `npm run build`

## 📧 Contact

**Vishant Savaliya**

- GitHub: [@vishantsavaliya](https://github.com/vishantsavaliya)
- Repository: [ArchiDiff](https://github.com/vishantsavaliya/ArchiDiff)

---

Built with ❤️ for architects and designers
