from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from pathlib import Path
import io
import fitz  # PyMuPDF
import cv2
import numpy as np
from PIL import Image, ImageDraw
from skimage.morphology import skeletonize
from skimage.filters import threshold_otsu
from controlnet_aux import MLSDdetector
from ultralytics import YOLO

app = FastAPI(title="ArchiDiff API", version="2.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
DETAILS_DIR = Path(__file__).parent / "details"
DETAILS_DIR.mkdir(exist_ok=True)
app.mount("/files", StaticFiles(directory=str(DETAILS_DIR)), name="files")

# Lazy load models
mlsd_detector = None
yolo_model = None

def get_mlsd_detector():
    global mlsd_detector
    if mlsd_detector is None:
        mlsd_detector = MLSDdetector.from_pretrained('lllyasviel/ControlNet')
    return mlsd_detector

def get_yolo_model():
    global yolo_model
    if yolo_model is None:
        yolo_model = YOLO('yolov8n.pt')
    return yolo_model


@app.get("/")
async def root():
    return {
        "message": "ArchiDiff API - Clean Architectural Drawing Processor",
        "version": "2.0.0",
        "methods": {
            "yolo": "/api/yolo-clean/{filename}",
            "vector": "/api/extract-sketch/{filename}",
            "mlsd": "/api/mlsd/{filename}",
            "skeleton": "/api/skeletonize/{filename}"
        }
    }


@app.get("/api/yolo-clean/{filename}")
async def yolo_clean_drawing(filename: str, page: int = 0, conf: float = 0.1):
    """YOLO: Detect and remove text regions"""
    file_path = DETAILS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        doc = fitz.open(str(file_path))
        page_obj = doc[page] if page < len(doc) else doc[0]
        pix = page_obj.get_pixmap(matrix=fitz.Matrix(4.0, 4.0))
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
        doc.close()
        
        # Detect with YOLO
        model = get_yolo_model()
        results = model(img, conf=conf, verbose=False)
        
        # Mask text regions
        mask = np.zeros(img.shape[:2], dtype=np.uint8)
        if results[0].boxes is not None:
            for box in results[0].boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                w, h = x2 - x1, y2 - y1
                # Filter text-like: small area or high aspect ratio
                if w * h < 5000 or max(w, h) / (min(w, h) + 1e-6) > 5:
                    mask[y1:y2, x1:x2] = 255
        
        clean = img.copy()
        clean[mask > 0] = 255
        
        _, buffer = cv2.imencode(".png", clean)
        return StreamingResponse(io.BytesIO(buffer.tobytes()), media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/extract-sketch/{filename}")
async def extract_sketch(filename: str, page: int = 0, filter_arrows: bool = True):
    """Vector: Extract vector paths, filter text/arrows"""
    file_path = DETAILS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        doc = fitz.open(str(file_path))
        page_obj = doc[page] if page < len(doc) else doc[0]
        drawings = page_obj.get_drawings()
        pix = page_obj.get_pixmap(matrix=fitz.Matrix(4.0, 4.0))
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
        doc.close()
        
        if len(drawings) > 0:
            clean = np.ones_like(img) * 255
            pil_img = Image.fromarray(clean)
            draw = ImageDraw.Draw(pil_img)
            
            for drawing in drawings:
                items = drawing.get("items", [])
                
                # Filter small filled shapes (arrows)
                if filter_arrows and drawing.get("fill"):
                    pts = []
                    for item in items:
                        if item[0] == "l":
                            pts.extend([item[1], item[2]])
                        elif item[0] == "c":
                            pts.extend(item[1:])
                    if pts:
                        xs, ys = [p.x for p in pts], [p.y for p in pts]
                        if (max(xs) - min(xs)) * (max(ys) - min(ys)) < 300:
                            continue
                
                # Draw
                for item in items:
                    if item[0] == "l":
                        draw.line([(item[1].x * 4, item[1].y * 4), (item[2].x * 4, item[2].y * 4)], fill=(0, 0, 0), width=2)
                    elif item[0] == "c":
                        pts = [(item[i].x * 4, item[i].y * 4) for i in range(1, len(item))]
                        for i in range(len(pts) - 1):
                            draw.line([pts[i], pts[i + 1]], fill=(0, 0, 0), width=2)
            
            clean = np.array(pil_img)
        else:
            # Fallback: M-LSD
            detector = get_mlsd_detector()
            result = detector(Image.fromarray(img), thr_v=0.15, thr_d=30.0, detect_resolution=512)
            clean = np.array(result)
        
        _, buffer = cv2.imencode(".png", clean)
        return StreamingResponse(io.BytesIO(buffer.tobytes()), media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/mlsd/{filename}")
async def mlsd_lines(filename: str, page: int = 0, threshold: float = 0.1):
    """M-LSD: Deep learning line detection"""
    file_path = DETAILS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        doc = fitz.open(str(file_path))
        page_obj = doc[page] if page < len(doc) else doc[0]
        pix = page_obj.get_pixmap(matrix=fitz.Matrix(3.0, 3.0))
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
        doc.close()
        
        detector = get_mlsd_detector()
        result = detector(Image.fromarray(img), thr_v=threshold, thr_d=20.0, detect_resolution=512)
        
        output = io.BytesIO()
        result.save(output, format="PNG")
        output.seek(0)
        return StreamingResponse(output, media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/skeletonize/{filename}")
async def skeleton(filename: str, page: int = 0):
    """Skeleton: 1-pixel centerlines"""
    file_path = DETAILS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        doc = fitz.open(str(file_path))
        page_obj = doc[page] if page < len(doc) else doc[0]
        pix = page_obj.get_pixmap(matrix=fitz.Matrix(4.0, 4.0))
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
        doc.close()
        
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        binary = gray < threshold_otsu(gray)
        sk = skeletonize(binary)
        result = cv2.cvtColor(np.where(sk, 0, 255).astype(np.uint8), cv2.COLOR_GRAY2RGB)
        
        _, buffer = cv2.imencode(".png", result)
        return StreamingResponse(io.BytesIO(buffer.tobytes()), media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
