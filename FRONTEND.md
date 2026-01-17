# Frontend Documentation

Detailed documentation for ArchiDiff React TypeScript frontend application.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Pages](#pages)
4. [Components](#components)
5. [Services](#services)
6. [State Management](#state-management)
7. [Coordinate System](#coordinate-system)

---

## Overview

The frontend is a React 18 + TypeScript + Vite application that provides an interactive canvas editor for comparing and editing architectural drawings.

**Port**: `5177`  
**Framework**: React 18 with TypeScript  
**Build Tool**: Vite  
**Styling**: Tailwind CSS  

---

## Architecture

```
frontend/src/
├── pages/
│   ├── Home.tsx                 # Upload page with progress tracking
│   ├── CanvasEditor.tsx         # Main canvas editor (1200 lines)
│   ├── Dashboard.tsx            # Job management dashboard
│   ├── OverlayComparison.tsx    # Legacy overlay view
│   ├── SAMRemover.tsx           # Legacy SAM removal tool
│   └── LineSelector.tsx         # Legacy line selection tool
├── components/
│   ├── FileUpload.tsx           # File upload component
│   ├── ProgressBar.tsx          # Upload progress bar
│   ├── StatusMessage.tsx        # Status messages
│   └── ImageCanvas.tsx          # Legacy canvas component
├── services/
│   ├── api.ts                   # Backend API client
│   ├── backendService.ts        # Processing API service
│   └── imageEditorService.ts    # Image editor service (legacy)
├── utils/
│   └── webglRenderer.ts         # WebGL rendering (experimental)
├── types/
│   └── index.ts                 # TypeScript type definitions
├── App.tsx                      # Main app with routing
└── main.tsx                     # App entry point
```

---

## Pages

### 1. `Home.tsx` - Upload Page

**Purpose**: File upload interface with real-time processing progress.

**Key Features**:
- Drag-and-drop or click-to-upload interface
- File validation (PDF, PNG, JPG, max 50MB)
- Real-time progress tracking with emoji icons
- Automatic redirect to Canvas Editor on completion

**State**:
```typescript
const [files, setFiles] = useState<File[]>([]);
const [uploading, setUploading] = useState(false);
const [progress, setProgress] = useState(0);
const [currentStep, setCurrentStep] = useState('');
const [jobId, setJobId] = useState<string | null>(null);
```

**Upload Flow**:
```typescript
1. User selects 2 files
2. Validate: size < 50MB, type in [PDF, PNG, JPG]
3. POST /upload → job_id
4. Poll GET /status/{job_id} every 500ms
5. Update progress bar (0-100%)
6. On complete → navigate to /canvas-editor
```

**Progress Icons**:
- ⚙️ Preparing (20-30%)
- 🔍 Upscaling (65-95%)
- ✅ Complete (100%)

**Error Handling**:
- File size validation
- Type validation
- Upload failure retry
- Processing error display

---

### 2. `CanvasEditor.tsx` - Main Canvas Editor

**Purpose**: Interactive canvas for comparing and editing two architectural drawings with advanced transform-aware tools.

**File Size**: ~1200 lines  
**Canvas Size**: Fixed 1600x1200 pixels (landscape)  
**Rendering**: Canvas 2D API with memoized render function

#### Key Features

**Layer System**:
- 2 independent layers (Layer 1, Layer 2)
- Each layer has transform properties:
  - Position (x, y)
  - Scale (zoom level)
  - Rotation (degrees)
  - Opacity (0-1)
  - Visibility (show/hide)

**Tools**:
1. **Overlay Mode**: Drag to move active layer, adjust opacity
2. **Edit Mode**: Box erase tool with transform-aware coordinates
3. **Undo/Redo**: 10-step history for all edits

**State Structure**:
```typescript
interface Layer {
  id: number;
  visible: boolean;
  active: boolean;
  transform: {
    x: number;
    y: number;
    rotation: number;
    opacity: number;
    scale: number;
  };
}

const [layers, setLayers] = useState<Record<number, Layer>>();
const [images, setImages] = useState<Record<number, HTMLImageElement>>();
const [editableImages, setEditableImages] = useState<Record<number, HTMLCanvasElement>>();
const [layerOrder, setLayerOrder] = useState<[number, number]>([1, 2]);
const [currentTool, setCurrentTool] = useState<'overlay' | 'edit'>('overlay');
```

#### Coordinate Transform System

**Problem**: Canvas uses center-origin for transforms, but editable canvas uses top-left origin.

**Solution**: Bidirectional coordinate transformation:

```typescript
// Calculate scale to fit images in 1600x1200 canvas
const scaleToFit = useMemo(() => {
  if (!images[1] || !images[2]) return 1;
  const maxW = Math.max(images[1].width, images[2].width);
  const maxH = Math.max(images[1].height, images[2].height);
  return Math.min(1600 / maxW, 1200 / maxH);
}, [images]);

// Forward Transform (Image Space → Canvas Space)
// Used for rendering box preview
const centerX = (img.width * scaleToFit) / 2;
const centerY = (img.height * scaleToFit) / 2;
const offsetX = centerX + transform.x;
const offsetY = centerY + transform.y;
const totalScale = transform.scale * scaleToFit;

const canvasX = (imageX - img.width / 2) * totalScale + offsetX;
const canvasY = (imageY - img.height / 2) * totalScale + offsetY;

// Inverse Transform (Canvas Space → Image Space)
// Used for mouse click handling
const relX = (canvasX - offsetX) / totalScale;
const relY = (canvasY - offsetY) / totalScale;
const imageX = relX + (img.width / 2);
const imageY = relY + (img.height / 2);
```

**Why This Works**:
1. Canvas renders images centered at origin
2. Editable canvas stores pixels from top-left (0,0)
3. Transform adds centering offset + user transforms
4. Inverse transform reverses both operations

#### Box Erase Tool

**How It Works**:

1. **Mouse Down**: Store box start in image space
```typescript
const imageX = relX + (img.width / 2);
const imageY = relY + (img.height / 2);
setBoxStart({ x: imageX, y: imageY });
```

2. **Mouse Move**: Update box end in image space
```typescript
setBoxEnd({ x: imageX, y: imageY });
renderCanvas(); // Show preview
```

3. **Mouse Up**: Erase box area on editable canvas
```typescript
const x = Math.min(boxStart.x, boxEnd.x);
const y = Math.min(boxStart.y, boxEnd.y);
const width = Math.abs(boxEnd.x - boxStart.x);
const height = Math.abs(boxEnd.y - boxStart.y);

ctx.globalCompositeOperation = 'destination-out';
ctx.fillRect(x, y, width, height);
```

**Box Preview Rendering**:
```typescript
// Convert from image space to canvas space for preview
const relStartX = boxStart.x - (img.width / 2);
const relStartY = boxStart.y - (img.height / 2);
const canvasStartX = relStartX * totalScale + offsetX;
const canvasStartY = relStartY * totalScale + offsetY;

// Draw preview box
ctx.strokeStyle = '#ffffff';
ctx.lineWidth = 5;
ctx.strokeRect(canvasStartX, canvasStartY, width, height);
```

#### Rendering Pipeline

```typescript
const renderCanvas = useCallback(() => {
  // 1. Clear canvas with black background
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, 1600, 1200);
  
  // 2. Calculate scaleToFit
  const maxW = Math.max(images[1].width, images[2].width);
  const maxH = Math.max(images[1].height, images[2].height);
  const scaleToFit = Math.min(1600 / maxW, 1200 / maxH);
  
  // 3. Draw layers in order (bottom to top)
  layerOrder.forEach((layerId) => {
    const layer = layers[layerId];
    const img = editableImages[layerId] || images[layerId];
    
    // Apply transforms
    const totalScale = layer.transform.scale * scaleToFit;
    const centerX = (img.width * scaleToFit) / 2;
    const centerY = (img.height * scaleToFit) / 2;
    
    ctx.save();
    ctx.globalAlpha = layer.transform.opacity;
    ctx.translate(centerX + layer.transform.x, centerY + layer.transform.y);
    ctx.rotate((layer.transform.rotation * Math.PI) / 180);
    ctx.scale(totalScale, totalScale);
    ctx.drawImage(img, -(img.width / 2), -(img.height / 2));
    ctx.restore();
  });
  
  // 4. Draw box preview if active
  // 5. Draw UI overlays
}, [images, layers, layerOrder, editableImages, boxStart, boxEnd]);
```

#### Undo/Redo System

**Implementation**:
```typescript
const saveUndoState = () => {
  const canvas = editableImages[activeLayerId];
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  setUndoHistory(prev => {
    const newHistory = [...prev, { layerId: activeLayerId, imageData }];
    return newHistory.slice(-MAX_UNDO_HISTORY); // Keep last 10
  });
  setRedoHistory([]); // Clear redo on new action
};

const undo = () => {
  const lastState = undoHistory[undoHistory.length - 1];
  const canvas = editableImages[lastState.layerId];
  const ctx = canvas.getContext('2d');
  
  // Save current to redo
  const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
  setRedoHistory(prev => [...prev, { layerId: lastState.layerId, imageData: current }]);
  
  // Restore previous
  ctx.putImageData(lastState.imageData, 0, 0);
  setUndoHistory(prev => prev.slice(0, -1));
  renderCanvas();
};
```

**Memory Management**:
- Limited to 10 undo steps
- ImageData stored in memory (can be large for big images)
- Cleared on layer switch

#### Performance Optimizations

1. **Memoized Values**:
```typescript
const activeLayerId = useMemo(() => layers[1].active ? 1 : 2, [layers]);
const scaleToFit = useMemo(() => {
  // Calculate only when images change
}, [images]);
```

2. **Throttled Mouse Drag**:
```typescript
// Update transform on next animation frame
if (!animationFrameRef.current) {
  animationFrameRef.current = requestAnimationFrame(() => {
    setLayers(/* update */);
    animationFrameRef.current = null;
  });
}
```

3. **Canvas Context Caching**:
```typescript
const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);
if (!canvasCtxRef.current) {
  canvasCtxRef.current = canvas.getContext('2d', { 
    alpha: true, 
    desynchronized: true 
  });
}
```

4. **Image Smoothing Disabled**:
```typescript
ctx.imageSmoothingEnabled = false; // Faster rendering
```

#### UI Components

**Layer Panel**:
- Active layer indicator
- Visibility toggles
- Opacity sliders
- Swap layer order button

**Tool Panel**:
- Overlay mode (drag to move)
- Edit mode (box erase)
- Tool instructions

**Controls**:
- Undo/Redo buttons with keyboard shortcuts
- Download canvas button
- Reset view button
- Zoom controls (scale slider)
- Rotation controls

**Keyboard Shortcuts**:
- `Ctrl/Cmd + Z`: Undo
- `Ctrl/Cmd + Shift + Z`: Redo
- `Space + Drag`: Pan view (overlay mode)

---

### 3. `Dashboard.tsx` - Job Management

**Purpose**: View and manage processed jobs.

**Features**:
- List all completed jobs
- Quick access to canvas editor
- Job cleanup/deletion
- Job metadata display

**API Integration**:
```typescript
const jobs = await api.getJobs();
// Display job list with thumbnails
```

---

## Components

### 1. `FileUpload.tsx`

**Purpose**: Reusable file upload component with drag-and-drop.

**Props**:
```typescript
interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles: number;
  acceptedTypes: string[];
  maxSize: number;
}
```

**Features**:
- Drag-and-drop zone
- Click to browse
- File validation
- Preview thumbnails
- Remove files

---

### 2. `ProgressBar.tsx`

**Purpose**: Animated progress bar with percentage.

**Props**:
```typescript
interface ProgressBarProps {
  progress: number;
  label?: string;
}
```

**Features**:
- Smooth animations
- Color gradients (0% red → 50% yellow → 100% green)
- Percentage display

---

### 3. `StatusMessage.tsx`

**Purpose**: Toast-style status messages.

**Props**:
```typescript
interface StatusMessageProps {
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  onClose?: () => void;
}
```

**Features**:
- Auto-dismiss after 5 seconds
- Color-coded by type
- Slide-in animation
- Close button

---

## Services

### 1. `api.ts` - Backend API Client

**Purpose**: Centralized API communication with type-safe methods.

```typescript
const API_BASE_URL = 'http://localhost:5004';

export const api = {
  // Upload files
  uploadFiles: async (file1: File, file2: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file1', file1);
    formData.append('file2', file2);
    
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  },
  
  // Get processing status
  getStatus: async (jobId: string): Promise<StatusResponse> => {
    const response = await fetch(`${API_BASE_URL}/status/${jobId}`);
    if (!response.ok) throw new Error('Status check failed');
    return response.json();
  },
  
  // Get processed image URL
  getImageUrl: (jobId: string, fileNum: 1 | 2): string => {
    return `${API_BASE_URL}/image/${jobId}/${fileNum}`;
  },
  
  // Cleanup job
  cleanupJob: async (jobId: string): Promise<void> => {
    await fetch(`${API_BASE_URL}/cleanup/${jobId}`, {
      method: 'DELETE',
    });
  },
};
```

---

### 2. `backendService.ts` - Processing Service

**Purpose**: High-level service for upload and processing workflow.

```typescript
export const backendService = {
  // Upload and wait for completion
  uploadAndProcess: async (
    file1: File,
    file2: File,
    onProgress: (progress: number, step: string) => void
  ): Promise<string> => {
    // Upload
    const { job_id } = await api.uploadFiles(file1, file2);
    
    // Poll for completion
    while (true) {
      const status = await api.getStatus(job_id);
      onProgress(status.progress, status.current_step);
      
      if (status.status === 'complete') return job_id;
      if (status.status === 'error') throw new Error(status.error);
      
      await sleep(500);
    }
  },
};
```

---

## State Management

### Local State (useState)

Used for component-specific state:
- Form inputs
- UI state (modals, dropdowns)
- Temporary values

### Ref-based State (useRef)

Used for values that don't trigger re-renders:
- Canvas context cache
- Animation frame IDs
- Previous mouse positions

### LocalStorage

Used for persistence:
- `dashboard_job_id`: Current job ID
- Auto-load on page refresh

### URL Parameters

Used for navigation:
- `/canvas-editor?job=<job_id>`
- Shareable links

---

## Coordinate System

### Canvas Coordinate System

**Canvas Space** (1600x1200 pixels):
- Origin at top-left
- Used for rendering and mouse events
- Fixed size for consistency

**Image Space** (variable size):
- Origin at top-left for editable canvas
- Origin at center for rendering transforms
- Actual image dimensions (e.g., 3000x2000)

**Transform Space**:
- User transforms applied (move, scale, rotate)
- Relative to canvas center

### Coordinate Conversion

```typescript
// Mouse → Canvas
const rect = canvas.getBoundingClientRect();
const scaleX = canvas.width / rect.width;
const scaleY = canvas.height / rect.height;
const canvasX = (e.clientX - rect.left) * scaleX;
const canvasY = (e.clientY - rect.top) * scaleY;

// Canvas → Image (Inverse Transform)
const totalScale = transform.scale * scaleToFit;
const centerX = (img.width * scaleToFit) / 2;
const centerY = (img.height * scaleToFit) / 2;
const offsetX = centerX + transform.x;
const offsetY = centerY + transform.y;

const relX = (canvasX - offsetX) / totalScale;
const relY = (canvasY - offsetY) / totalScale;
const imageX = relX + (img.width / 2);  // Convert to top-left origin
const imageY = relY + (img.height / 2);

// Image → Canvas (Forward Transform)
const relX = imageX - (img.width / 2);  // Convert to center origin
const relY = imageY - (img.height / 2);
const canvasX = relX * totalScale + offsetX;
const canvasY = relY * totalScale + offsetY;
```

---

## TypeScript Types

```typescript
// types/index.ts

export interface Layer {
  id: number;
  visible: boolean;
  active: boolean;
  transform: LayerTransform;
}

export interface LayerTransform {
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  scale: number;
}

export interface UploadResponse {
  job_id: string;
  status: string;
  message: string;
}

export interface StatusResponse {
  job_id: string;
  status: 'queued' | 'processing' | 'complete' | 'error';
  progress: number;
  current_step: string;
  file1: string;
  file2: string;
  file1_processed?: string;
  file2_processed?: string;
  error?: string;
}
```

---

## Styling (Tailwind CSS)

**Theme Configuration** (`tailwind.config.js`):
```javascript
export default {
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
        accent: '#ec4899',
      },
    },
  },
}
```

**Common Patterns**:
```tsx
// Button
<button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">

// Card
<div className="bg-white rounded-lg shadow-md p-6">

// Input
<input className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500">

// Grid Layout
<div className="grid grid-cols-2 gap-4">
```

---

## Development Tips

### Hot Module Replacement

Vite provides instant HMR:
- Save file → changes reflect immediately
- React state preserved across updates
- Fast rebuild times

### Debugging

**Console Logs**:
```typescript
console.log('Box Start:', boxStart);
console.log('Transform:', layers[activeLayerId].transform);
```

**React DevTools**:
- Inspect component state
- Track prop changes
- Performance profiling

**Canvas Debugging**:
```typescript
// Draw debug grid
for (let x = 0; x < 1600; x += 100) {
  ctx.moveTo(x, 0);
  ctx.lineTo(x, 1200);
}
ctx.stroke();
```

---

## Future Enhancements

- [ ] Multi-layer support (>2 layers)
- [ ] Brush eraser tool
- [ ] Layer blending modes
- [ ] Export to PDF
- [ ] Collaborative editing (WebSockets)
- [ ] Mobile responsive design
- [ ] WebGL renderer for better performance

---

**Last Updated**: January 17, 2026
