# 🚀 ArchiDiff Quick Reference

## Development Commands

### Backend (FastAPI)

```bash
cd backend
source venv/bin/activate          # Activate virtual env
uvicorn main:app --reload         # Start dev server
deactivate                        # Deactivate virtual env
```

**URL:** http://localhost:8000
**API Docs:** http://localhost:8000/docs

### Frontend (Next.js)

```bash
cd frontend
npm run dev                       # Start dev server
npm run build                     # Production build
npm run start                     # Start production server
npm run lint                      # Run linter
```

**URL:** http://localhost:3000

## API Endpoints

| Endpoint            | Method | Description         |
| ------------------- | ------ | ------------------- |
| `/`                 | GET    | API information     |
| `/api/health`       | GET    | Health check        |
| `/api/details`      | GET    | Get all details     |
| `/api/detail/{id}`  | GET    | Get specific detail |
| `/api/upload`       | POST   | Upload new file     |
| `/files/{filename}` | GET    | Serve static file   |

## File Structure

```
ArchiDiff/
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── compare/page.tsx      # Comparison tool
│   │   └── about/page.tsx        # About page
│   ├── components/
│   │   ├── ComparisonCanvas.tsx  # Canvas with Fabric.js
│   │   └── DetailSelector.tsx    # File picker
│   └── lib/
│       └── api.ts                # API calls
│
└── backend/
    ├── main.py                   # FastAPI server
    └── details/                  # Put your 6 files here
```

## Key Features

### Comparison Canvas

- **Pan:** Hold Alt + drag
- **Zoom:** Mouse wheel (0.1x - 20x)
- **Opacity:** 0-100% sliders
- **Colors:** Customizable hex colors
- **Export:** High-res PNG (2x multiplier)

### Detail Selector

- Shows 6 architectural details
- Displays metadata (name, project, scale, description)
- Prevents selecting same detail twice
- Real-time availability checking

## Environment Variables

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend (No env needed for dev)

Files stored in `backend/details/`

## Adding Detail Files

1. Place files in `backend/details/`
2. Update `DETAILS_METADATA` in `backend/main.py`:

```python
{
    "id": "1",
    "name": "Detail Name",
    "filename": "file.pdf",        # Must match actual file
    "project": "Project Name",
    "scale": "1:20",
    "description": "Brief description"
}
```

## Troubleshooting

### Backend won't start

```bash
# Check Python version
python3 --version  # Need 3.9+

# Reinstall dependencies
pip install -r requirements.txt

# Check port 8000 is free
lsof -i :8000
```

### Frontend won't start

```bash
# Clear cache
rm -rf .next
rm -rf node_modules
npm install

# Check port 3000 is free
lsof -i :3000
```

### Images not loading

1. Check backend is running: `curl http://localhost:8000/api/health`
2. Verify files exist in `backend/details/`
3. Check filenames match metadata
4. Try: `curl http://localhost:8000/files/your_file.pdf`

### CORS errors

- Backend allows `localhost:3000` by default
- Check `CORSMiddleware` in `backend/main.py`
- Ensure both servers running on correct ports

## Testing Checklist

- [ ] Backend health check passes
- [ ] Frontend loads without errors
- [ ] Can select two different details
- [ ] Images overlay on canvas
- [ ] Opacity controls work
- [ ] Pan with Alt+drag works
- [ ] Zoom with mouse wheel works
- [ ] Export PNG downloads file
- [ ] Toast notifications appear

## Git Commands

```bash
git status                        # Check status
git add .                         # Stage all changes
git commit -m "Your message"      # Commit changes
git push origin main              # Push to GitHub
```

## Production Deployment

### Backend (Railway/Render/Heroku)

1. Add `Procfile`: `web: uvicorn main:app --host 0.0.0.0 --port $PORT`
2. Deploy Python app
3. Add files to `details/` directory
4. Set env vars if needed

### Frontend (Vercel)

1. Connect GitHub repo
2. Set `NEXT_PUBLIC_API_URL` to production backend
3. Deploy (auto from git push)

## Useful Links

- **GitHub:** https://github.com/vishantsavaliya/ArchiDiff
- **Next.js Docs:** https://nextjs.org/docs
- **FastAPI Docs:** https://fastapi.tiangolo.com
- **Fabric.js Docs:** http://fabricjs.com/docs
- **shadcn/ui:** https://ui.shadcn.com

## Package Versions

**Frontend:**

- next: 16.1.1
- react: 19.2.3
- fabric: 7.1.0
- sonner: 2.0.7
- lucide-react: 0.562.0

**Backend:**

- fastapi: 0.115.6
- uvicorn: 0.34.0
- pillow: 11.1.0
- ezdxf: 1.3.5

---

_Quick reference for ArchiDiff development_
