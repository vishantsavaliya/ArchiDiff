# 🧪 Testing Guide for ArchiDiff

## Testing the Application

### Prerequisites

- Both backend and frontend servers must be running
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000`

## Step-by-Step Testing

### 1. Test Backend API

Open a browser or use curl to test these endpoints:

```bash
# Health check
curl http://localhost:8000/api/health

# Get all details
curl http://localhost:8000/api/details

# Get specific detail
curl http://localhost:8000/api/detail/1

# Check if files are accessible
curl http://localhost:8000/files/detail_1.pdf
```

Expected responses:

- `/api/health` → `{"status":"healthy","message":"ArchiDiff API is running"}`
- `/api/details` → JSON array with 6 detail objects
- `/api/detail/1` → JSON object with detail info
- `/files/detail_1.pdf` → File content (or 404 if file doesn't exist yet)

### 2. Test Frontend Pages

#### Landing Page (`/`)

- [ ] Page loads without errors
- [ ] Title shows "ArchiDiff" with gradient
- [ ] "Start Comparing" button is visible
- [ ] "Learn More" button is visible
- [ ] Features section shows 3 cards
- [ ] "How It Works" section shows 3 steps
- [ ] Footer shows project info

#### About Page (`/about`)

- [ ] Click "Learn More" from landing page
- [ ] Page shows project description
- [ ] Tech stack section displays frontend and backend tools
- [ ] Future enhancements are listed
- [ ] "View on GitHub" link works
- [ ] "Try It Now" navigates to compare page

#### Compare Page (`/compare`)

- [ ] Click "Start Comparing" from landing page
- [ ] Two detail selector panels appear
- [ ] Canvas area shows "Select two details to compare"
- [ ] Back button navigates to home

### 3. Test Detail Selection (With Files)

**Note:** You need to add 6 detail files first!

#### Add Test Files:

```bash
cd backend/details
# Add 6 test images or PDFs (can be sample architectural drawings)
# Update DETAILS_METADATA in backend/main.py
```

Then test:

- [ ] Detail cards appear in selectors
- [ ] Each card shows: name, project, scale, description, filename
- [ ] Clicking a card highlights it with blue border
- [ ] Selected card shows ring effect
- [ ] Can't select same detail twice (excluded from second selector)
- [ ] Toast notification if backend is not running

### 4. Test Comparison Canvas

Once two details are selected:

- [ ] Loading spinner appears
- [ ] Both images load on canvas
- [ ] Images are centered and scaled to fit
- [ ] Success toast: "Details loaded successfully"

### 5. Test Opacity Controls

- [ ] Two opacity sliders appear (one for each detail)
- [ ] Moving slider updates opacity in real-time
- [ ] Opacity value displays as percentage (0-100%)
- [ ] Both layers can be adjusted independently

### 6. Test Color Controls

- [ ] Color picker appears for each detail
- [ ] Default colors: Detail 1 (red), Detail 2 (blue)
- [ ] Clicking color picker opens color selector
- [ ] Can type hex color code manually
- [ ] Color changes apply to canvas immediately
- [ ] Color tint overlays on images

### 7. Test Canvas Interactions

#### Pan (Alt + Drag):

- [ ] Hold Alt key and drag mouse
- [ ] Canvas viewport moves smoothly
- [ ] Works in all directions

#### Zoom (Mouse Wheel):

- [ ] Scroll up to zoom in
- [ ] Scroll down to zoom out
- [ ] Zoom centers on mouse position
- [ ] Min zoom: 0.1x (10%)
- [ ] Max zoom: 20x (2000%)

#### Zoom Buttons:

- [ ] "Zoom In" button increases zoom
- [ ] "Zoom Out" button decreases zoom
- [ ] Buttons work smoothly

#### Reset View:

- [ ] "Reset View" button centers and resets zoom
- [ ] Returns to default 1:1 scale
- [ ] Centers both images

### 8. Test Export Feature

- [ ] "Export PNG" button is visible
- [ ] Click button exports canvas as PNG
- [ ] Exported image has 2x resolution
- [ ] Filename format: `archidiff-comparison-{timestamp}.png`
- [ ] Success toast: "Comparison exported as PNG"
- [ ] Downloaded file opens correctly
- [ ] Image quality is high

### 9. Test Error Handling

#### Backend Not Running:

- [ ] Frontend shows: "Failed to load details. Please check if backend is running."
- [ ] Error toast appears
- [ ] No crash, graceful error message

#### Invalid Files:

- [ ] If file doesn't exist: "Failed to load detail files"
- [ ] Console shows error details
- [ ] App remains functional

#### CORS Issues:

- [ ] Check browser console for CORS errors
- [ ] Ensure backend has CORS middleware enabled

### 10. Test Responsive Design

#### Desktop (1920x1080):

- [ ] Full layout displays correctly
- [ ] Canvas is 800x600px
- [ ] All controls visible

#### Tablet (768px):

- [ ] Layout adjusts to single column
- [ ] Canvas remains centered
- [ ] Controls stack vertically

#### Mobile (375px):

- [ ] Mobile-friendly layout
- [ ] Text remains readable
- [ ] Buttons are tap-friendly

## Performance Testing

### Load Time:

- [ ] Landing page loads < 2 seconds
- [ ] Compare page loads < 2 seconds
- [ ] Images load < 3 seconds each

### Canvas Performance:

- [ ] Smooth pan (60fps)
- [ ] Smooth zoom (60fps)
- [ ] No lag when adjusting opacity
- [ ] No lag when changing colors

## Browser Compatibility

Test in multiple browsers:

- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge

## Common Issues & Solutions

### Issue: "Failed to load details"

**Solution:**

1. Check if backend is running: `curl http://localhost:8000/api/health`
2. Check CORS settings in `backend/main.py`
3. Verify frontend env: `NEXT_PUBLIC_API_URL=http://localhost:8000`

### Issue: Images not loading

**Solution:**

1. Check if files exist in `backend/details/`
2. Verify filenames match `DETAILS_METADATA`
3. Check browser console for network errors
4. Try accessing directly: `http://localhost:8000/files/your_file.pdf`

### Issue: Canvas not rendering

**Solution:**

1. Check browser console for JavaScript errors
2. Ensure Fabric.js is installed: `npm list fabric`
3. Try refreshing the page
4. Check if images are valid format (PDF, PNG, JPG)

### Issue: TypeScript errors

**Solution:**

1. Install types: `npm install --save-dev @types/fabric @types/node`
2. Restart TypeScript server in VS Code
3. Errors shouldn't prevent app from running

## Test Checklist Summary

Before marking the project complete:

- [ ] All 6 detail files added
- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Can select two different details
- [ ] Images overlay on canvas
- [ ] Opacity controls work
- [ ] Color controls work
- [ ] Pan and zoom work
- [ ] Export PNG works
- [ ] All pages navigate correctly
- [ ] Error messages display gracefully
- [ ] Responsive on mobile
- [ ] Tested in 2+ browsers

## Next Steps

Once all tests pass:

1. ✅ Add real architectural detail files
2. ✅ Update metadata with accurate project info
3. ✅ Test with actual use cases
4. ✅ Take screenshots for portfolio
5. ✅ Deploy to production
6. ✅ Add to portfolio website

---

**Happy Testing! 🎉**
