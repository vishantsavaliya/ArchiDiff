# 🧪 TEST MODE - Quick Development Testing

## Overview

TEST MODE allows you to test the dashboard without uploading files or running the processing pipeline. Images are loaded directly from the `/temp` folder.

## How to Use

### Method 1: Direct Test Page

1. Open http://localhost:5173/test.html
2. Dashboard loads automatically in TEST MODE
3. Images are loaded from `/temp/image1.png` and `/temp/image2.png`

### Method 2: Clear LocalStorage

1. Open browser console on dashboard
2. Run: `localStorage.clear()`
3. Refresh page - TEST MODE activates automatically

## Setup Test Images

```bash
# Copy any processed images to temp folder
cp backend/processed/[job-id]/file1_final.png frontend-lite/temp/image1.png
cp backend/processed/[job-id]/file2_final.png frontend-lite/temp/image2.png

# Or use your own images (must be named image1.png and image2.png)
cp /path/to/drawing1.png frontend-lite/temp/image1.png
cp /path/to/drawing2.png frontend-lite/temp/image2.png
```

## Features in TEST MODE

✅ **All Tools Work**

- Overlay Comparison (with transforms)
- SAM Remover (click to select points)
- Line Selector (click to select lines)
- Canvas interactions
- Download functionality

❌ **Disabled Features**

- Auto-cleanup (files not deleted)
- Backend API calls for processing (SAM/Lines still need their servers)
- "Start Over" redirects to upload page

## Benefits

1. **Fast Iteration** - No upload/processing wait time (was 30-60 seconds)
2. **No Memory Issues** - Bypass heavy EasyOCR processing
3. **Quick UI Testing** - Test canvas interactions immediately
4. **Predictable State** - Same images every time

## How It Works

```javascript
// Dashboard checks if jobId exists in localStorage
const TEST_MODE = !localStorage.getItem("dashboard_job_id");

if (TEST_MODE) {
  // Load images from /temp folder instead of backend API
  image1.src = "/temp/image1.png";
  image2.src = "/temp/image2.png";
} else {
  // Normal mode: load from backend
  image1.src = `${API_URL}/image/${jobId}/1`;
  image2.src = `${API_URL}/image/${jobId}/2`;
}
```

## Testing Checklist

- [ ] Images visible in main view
- [ ] Overlay tool loads both images
- [ ] Overlay sliders update canvas in real-time
- [ ] SAM canvas shows image and accepts clicks
- [ ] Line Selector canvas shows image and accepts clicks
- [ ] Download buttons work for all tools
- [ ] Reset buttons clear selections
- [ ] Sidebar navigation switches between tools

## Switching Back to Normal Mode

1. Upload files through http://localhost:5173/index.html
2. After processing, dashboard loads in normal mode
3. Or manually set localStorage:

```javascript
localStorage.setItem("dashboard_job_id", "your-job-id");
localStorage.setItem("dashboard_file1", "file1.pdf");
localStorage.setItem("dashboard_file2", "file2.pdf");
```

## Tips

- Keep test images reasonably sized (< 5MB each) for fast loading
- Use actual architectural drawings for realistic testing
- SAM and Line Selector still need their backend servers (ports 5001, 5003)
- Overlay tool works 100% client-side, no backend needed

## Visual Indicator

Look for this in browser console:

```
🧪 TEST MODE: Loading images from /temp folder
```

---

**Status**: ✅ Fully Functional
**Speed**: Instant load (vs 30-60s upload+processing)
**Use Case**: Development, UI testing, canvas interaction testing
