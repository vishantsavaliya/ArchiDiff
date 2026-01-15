from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, StreamingResponse
from pathlib import Path
import json
from typing import List, Dict
import os
from PIL import Image
import io
import fitz  # PyMuPDF
import cv2
import numpy as np
from skimage.metrics import structural_similarity as ssim
from skimage.feature import ORB, match_descriptors
from skimage.transform import AffineTransform, warp
from skimage.color import rgb2gray
from skimage.morphology import skeletonize, medial_axis
from skimage.filters import threshold_otsu
from controlnet_aux import MLSDdetector

app = FastAPI(title="ArchiBoost Compare API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
DETAILS_DIR = Path(__file__).parent / "details"
DETAILS_DIR.mkdir(exist_ok=True)
app.mount("/files", StaticFiles(directory=str(DETAILS_DIR)), name="files")

# Create heatmap directory
HEATMAP_DIR = Path(__file__).parent / "heatmaps"
HEATMAP_DIR.mkdir(exist_ok=True)

# Mount converted images directory
CONVERTED_DIR = Path(__file__).parent / "converted_images" / "outlines_detailed"

# Helper function to convert PDF filenames to PNG
def get_outline_filename(filename: str) -> str:
    """Convert PDF filename to corresponding outline PNG filename"""
    if filename.endswith('.pdf'):
        return filename.replace('.pdf', '.png')
    return filename

# Actual detail metadata
DETAILS_METADATA = [
    {
        "id": "1",
        "name": "Accessible Water Closet - Multiple Accommodation (CBC 11A)",
        "filename": "Sheet-001_ACCESSIBLE_WATER_CLOSET_MULTIPLE_ACCOMMODATION_ALT_(CBC_11A).pdf",
        "project": "Accessibility Standards",
        "scale": "Various",
        "description": "Accessible water closet detail for multiple accommodation - Alternative design per CBC 11A"
    },
    {
        "id": "2",
        "name": "Accessible Water Closet - Multiple Accommodation (Alt)",
        "filename": "Sheet-ACCESSIBLE_WATER_CLOSET_MULTIPLE_ACCOMMODATION_ALT_(CBC_11A).pdf",
        "project": "Accessibility Standards",
        "scale": "Various",
        "description": "Alternative accessible water closet configuration for multiple accommodation"
    },
    {
        "id": "3",
        "name": "Passenger Gurney Elevator Car",
        "filename": "Sheet-430_PASSENGER_GURNEY_ELEVATOR_CAR.pdf",
        "project": "Elevator Details",
        "scale": "1:20",
        "description": "Passenger gurney elevator car layout and dimensions"
    },
    {
        "id": "4",
        "name": "Shuttle Gurney Elevator Car",
        "filename": "Sheet-430_SHUTTLE_GURNEY_ELEVATOR_CAR.pdf",
        "project": "Elevator Details",
        "scale": "1:20",
        "description": "Shuttle gurney elevator car specifications and layout"
    },
    {
        "id": "5",
        "name": "Fire Extinguisher Cabinet",
        "filename": "Sheet-600_FIRE_EXTINGUISHER_CABINET.pdf",
        "project": "Fire Safety",
        "scale": "1:20",
        "description": "Standard fire extinguisher cabinet mounting detail"
    },
    {
        "id": "6",
        "name": "Fire Extinguisher Cabinet - Version 2",
        "filename": "Sheet-600_FIRE_EXTINGUISHER_CABINET_(2).pdf",
        "project": "Fire Safety",
        "scale": "1:20",
        "description": "Alternative fire extinguisher cabinet configuration"
    }
]


@app.get("/")
async def root():
    return {
        "message": "ArchiBoost Compare API",
        "version": "1.0.0",
        "endpoints": {
            "details": "/api/details",
            "detail": "/api/detail/{detail_id}",
            "files": "/files/{filename}"
        }
    }


@app.get("/api/details")
async def get_details():
    """Get list of all available details"""
    # Check which files actually exist
    available_details = []
    for detail in DETAILS_METADATA:
        file_path = DETAILS_DIR / detail["filename"]
        detail_copy = detail.copy()
        detail_copy["exists"] = file_path.exists()
        detail_copy["url"] = f"/files/{detail['filename']}" if file_path.exists() else None
        available_details.append(detail_copy)
    
    return {"details": available_details}


@app.get("/api/detail/{detail_id}")
async def get_detail(detail_id: str):
    """Get specific detail information"""
    detail = next((d for d in DETAILS_METADATA if d["id"] == detail_id), None)
    
    if not detail:
        raise HTTPException(status_code=404, detail="Detail not found")
    
    file_path = DETAILS_DIR / detail["filename"]
    
    if not file_path.exists():
        raise HTTPException(
            status_code=404, 
            detail=f"File {detail['filename']} not found in details directory"
        )
    
    return {
        "detail": {
            **detail,
            "url": f"/files/{detail['filename']}",
            "file_size": file_path.stat().st_size,
            "exists": True
        }
    }


@app.post("/api/upload")
async def upload_detail(file: UploadFile = File(...)):
    """Upload a new detail file"""
    try:
        file_path = DETAILS_DIR / file.filename
        
        # Save file
        with file_path.open("wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        return {
            "message": "File uploaded successfully",
            "filename": file.filename,
            "url": f"/files/{file.filename}",
            "size": len(content)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "details_count": len(DETAILS_METADATA),
        "files_present": len(list(DETAILS_DIR.glob("*"))),
        "details_dir": str(DETAILS_DIR)
    }


@app.get("/api/pdf-to-image/{filename}")
async def pdf_to_image(filename: str, page: int = 0):
    """Convert PDF to image for canvas display"""
    file_path = DETAILS_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        # Open PDF
        pdf_document = fitz.open(str(file_path))
        
        # Get the specified page (default to first page)
        if page >= len(pdf_document):
            page = 0
            
        pdf_page = pdf_document[page]
        
        # Render page to image at high resolution
        mat = fitz.Matrix(2.0, 2.0)  # 2x zoom for better quality
        pix = pdf_page.get_pixmap(matrix=mat)
        
        # Convert to PIL Image
        img_data = pix.tobytes("png")
        
        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(img_data),
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=3600"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to convert PDF: {str(e)}")


@app.get("/api/compare-ssim/{file1}/{file2}")
async def compare_ssim(file1: str, file2: str):
    """
    Calculate Structural Similarity Index (SSIM) between two architectural drawings.
    Returns similarity score (0-1, where 1 is identical) and region analysis.
    """
    try:
        # Convert PDF filenames to PNG if needed
        png_file1 = get_outline_filename(file1)
        png_file2 = get_outline_filename(file2)
        
        # Load outline images
        img1_path = CONVERTED_DIR / png_file1
        img2_path = CONVERTED_DIR / png_file2
        
        if not img1_path.exists() or not img2_path.exists():
            raise HTTPException(status_code=404, detail=f"Outline images not found: {png_file1}, {png_file2}")
        
        # Read images
        img1 = cv2.imread(str(img1_path))
        img2 = cv2.imread(str(img2_path))
        
        # Convert to grayscale
        gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
        
        # Resize to same dimensions (use smaller as reference)
        h = min(gray1.shape[0], gray2.shape[0])
        w = min(gray1.shape[1], gray2.shape[1])
        gray1_resized = cv2.resize(gray1, (w, h))
        gray2_resized = cv2.resize(gray2, (w, h))
        
        # Calculate SSIM
        score, diff_image = ssim(gray1_resized, gray2_resized, full=True)
        
        # Convert difference image to percentage
        diff_percent = (1.0 - diff_image) * 100
        
        # Find regions with significant differences (>20% difference)
        significant_diff = np.where(diff_percent > 20)
        num_different_pixels = len(significant_diff[0])
        total_pixels = w * h
        diff_area_percent = (num_different_pixels / total_pixels) * 100
        
        return {
            "similarity_score": float(score),
            "similarity_percent": round(score * 100, 2),
            "difference_area_percent": round(diff_area_percent, 2),
            "is_similar": bool(score > 0.90),
            "status": "identical" if score > 0.98 else "very_similar" if score > 0.90 else "similar" if score > 0.70 else "different",
            "dimensions": {
                "width": int(w),
                "height": int(h)
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SSIM comparison failed: {str(e)}")


@app.get("/api/heatmap/{file1}/{file2}")
async def generate_heatmap(file1: str, file2: str):
    """
    Generate a visual heatmap showing WHERE the differences are between two drawings.
    Red = high difference, Blue = identical, Green/Yellow = moderate difference.
    """
    try:
        # Convert PDF filenames to PNG if needed
        png_file1 = get_outline_filename(file1)
        png_file2 = get_outline_filename(file2)
        
        # Load outline images
        img1_path = CONVERTED_DIR / png_file1
        img2_path = CONVERTED_DIR / png_file2
        
        if not img1_path.exists() or not img2_path.exists():
            raise HTTPException(status_code=404, detail=f"Outline images not found: {png_file1}, {png_file2}")
        
        # Read images
        img1 = cv2.imread(str(img1_path))
        img2 = cv2.imread(str(img2_path))
        
        # Convert to grayscale
        gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
        
        # Resize to same dimensions
        h = min(gray1.shape[0], gray2.shape[0])
        w = min(gray1.shape[1], gray2.shape[1])
        gray1_resized = cv2.resize(gray1, (w, h))
        gray2_resized = cv2.resize(gray2, (w, h))
        
        # Calculate SSIM with full difference map
        score, diff_image = ssim(gray1_resized, gray2_resized, full=True)
        
        # Convert to difference percentage (0-100)
        diff_image = ((1.0 - diff_image) * 255).astype("uint8")
        
        # Apply colormap (COLORMAP_JET: blue=similar, red=different)
        heatmap = cv2.applyColorMap(diff_image, cv2.COLORMAP_JET)
        
        # Blend with original image for context
        alpha = 0.6
        img1_resized = cv2.resize(img1, (w, h))
        blended = cv2.addWeighted(img1_resized, 1-alpha, heatmap, alpha, 0)
        
        # Save heatmap
        output_filename = f"heatmap_{file1.replace('.png', '')}_{file2.replace('.png', '')}.png"
        output_path = HEATMAP_DIR / output_filename
        cv2.imwrite(str(output_path), blended)
        
        # Convert to PNG bytes for streaming
        is_success, buffer = cv2.imencode(".png", blended)
        if not is_success:
            raise Exception("Failed to encode heatmap")
        
        return StreamingResponse(
            io.BytesIO(buffer.tobytes()),
            media_type="image/png",
            headers={
                "Cache-Control": "public, max-age=3600",
                "X-Similarity-Score": str(round(score * 100, 2))
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Heatmap generation failed: {str(e)}")


@app.get("/api/align/{file1}/{file2}")
async def auto_align(file1: str, file2: str):
    """
    Automatically align two drawings using ORB feature matching.
    Returns the aligned version of file2 to match file1's orientation/scale.
    """
    try:
        # Convert PDF filenames to PNG if needed
        png_file1 = get_outline_filename(file1)
        png_file2 = get_outline_filename(file2)
        
        # Load outline images
        img1_path = CONVERTED_DIR / png_file1
        img2_path = CONVERTED_DIR / png_file2
        
        if not img1_path.exists() or not img2_path.exists():
            raise HTTPException(status_code=404, detail=f"Outline images not found: {png_file1}, {png_file2}")
        
        # Read images
        img1 = cv2.imread(str(img1_path))
        img2 = cv2.imread(str(img2_path))
        
        # Convert to grayscale
        gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
        
        # Detect ORB features
        orb = cv2.ORB_create(nfeatures=1000)
        kp1, des1 = orb.detectAndCompute(gray1, None)
        kp2, des2 = orb.detectAndCompute(gray2, None)
        
        if des1 is None or des2 is None:
            raise HTTPException(status_code=400, detail="Not enough features detected for alignment")
        
        # Match features using BFMatcher
        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        matches = bf.match(des1, des2)
        
        # Sort matches by distance (best matches first)
        matches = sorted(matches, key=lambda x: x.distance)
        
        # Use top 50 matches
        good_matches = matches[:min(50, len(matches))]
        
        if len(good_matches) < 10:
            raise HTTPException(status_code=400, detail="Not enough good matches found for alignment")
        
        # Extract matched keypoints
        src_pts = np.float32([kp2[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)
        dst_pts = np.float32([kp1[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
        
        # Find homography matrix
        M, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)
        
        # Warp img2 to align with img1
        h, w = gray1.shape
        aligned = cv2.warpPerspective(img2, M, (w, h))
        
        # Convert to PNG bytes
        is_success, buffer = cv2.imencode(".png", aligned)
        if not is_success:
            raise Exception("Failed to encode aligned image")
        
        return StreamingResponse(
            io.BytesIO(buffer.tobytes()),
            media_type="image/png",
            headers={
                "X-Matches-Found": str(len(good_matches)),
                "X-Alignment-Success": "true"
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Alignment failed: {str(e)}")


@app.get("/api/skeletonize/{filename}")
async def skeletonize_drawing(filename: str, page: int = 0):
    """
    Extract PDF at high resolution and create a clean 1-pixel skeleton.
    This is the "founding engineer" approach for architectural drawings.
    
    Steps:
    1. Extract PDF at 400 DPI for maximum detail
    2. Convert to binary using Otsu thresholding
    3. Apply morphological skeletonization for single-pixel centerlines
    4. Return clean skeleton as PNG
    """
    file_path = DETAILS_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        # Step A: Extract High-Resolution Paths
        pdf_document = fitz.open(str(file_path))
        
        if page >= len(pdf_document):
            page = 0
            
        pdf_page = pdf_document[page]
        
        # Render at 400 DPI (4x zoom) for maximum detail
        mat = fitz.Matrix(4.0, 4.0)
        pix = pdf_page.get_pixmap(matrix=mat, alpha=False)
        
        # Convert to numpy array
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
        
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        
        # Step B: Skeletonization - The Key to Clean Lines
        # Invert so that lines are white on black background
        inverted = cv2.bitwise_not(gray)
        
        # Apply Otsu's thresholding for automatic binary conversion
        thresh_value = threshold_otsu(inverted)
        binary = inverted > thresh_value
        
        # Skeletonize - reduces all structures to 1-pixel centerlines
        skeleton = skeletonize(binary)
        
        # Convert boolean skeleton to uint8 image
        skeleton_img = (skeleton * 255).astype(np.uint8)
        
        # Invert back so skeleton is black on white
        skeleton_img = cv2.bitwise_not(skeleton_img)
        
        # Encode as PNG
        is_success, buffer = cv2.imencode(".png", skeleton_img)
        if not is_success:
            raise Exception("Failed to encode skeleton image")
        
        return StreamingResponse(
            io.BytesIO(buffer.tobytes()),
            media_type="image/png",
            headers={
                "X-DPI": "400",
                "X-Processing": "skeletonized",
                "Cache-Control": "public, max-age=3600"
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Skeletonization failed: {str(e)}")


@app.get("/api/overlay/{file1}/{file2}")
async def create_overlay(file1: str, file2: str, color1: str = "green", color2: str = "pink"):
    """
    Step C: Create professional pink/green overlay of two skeletonized drawings.
    
    This uses the founding engineer workflow:
    - Extract skeletons for both PDFs
    - Color Detail 1 as green (0, 255, 0)
    - Color Detail 2 as red/pink (255, 100, 150)
    - Overlay with addWeighted so overlaps blend and differences pop
    
    Args:
        file1: First PDF filename
        file2: Second PDF filename  
        color1: Color for first detail (green/red/blue)
        color2: Color for second detail (green/red/blue/pink)
    """
    try:
        # Define color mappings
        colors = {
            "green": (0, 255, 0),
            "red": (255, 0, 0),
            "blue": (0, 0, 255),
            "pink": (255, 100, 150),
            "cyan": (0, 255, 255),
            "yellow": (255, 255, 0)
        }
        
        c1 = colors.get(color1.lower(), (0, 255, 0))
        c2 = colors.get(color2.lower(), (255, 100, 150))
        
        # Load both PDFs
        file1_path = DETAILS_DIR / file1
        file2_path = DETAILS_DIR / file2
        
        if not file1_path.exists() or not file2_path.exists():
            raise HTTPException(status_code=404, detail="One or both files not found")
        
        # Extract and skeletonize both drawings
        def extract_skeleton(file_path):
            pdf_doc = fitz.open(str(file_path))
            page = pdf_doc[0]
            
            # High resolution extraction
            mat = fitz.Matrix(4.0, 4.0)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
            gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
            
            # Skeletonize
            inverted = cv2.bitwise_not(gray)
            thresh_value = threshold_otsu(inverted)
            binary = inverted > thresh_value
            skeleton = skeletonize(binary)
            skeleton_img = (skeleton * 255).astype(np.uint8)
            
            pdf_doc.close()
            return skeleton_img
        
        skeleton1 = extract_skeleton(file1_path)
        skeleton2 = extract_skeleton(file2_path)
        
        # Ensure same dimensions (resize if needed)
        if skeleton1.shape != skeleton2.shape:
            height = max(skeleton1.shape[0], skeleton2.shape[0])
            width = max(skeleton1.shape[1], skeleton2.shape[1])
            
            if skeleton1.shape != (height, width):
                skeleton1 = cv2.resize(skeleton1, (width, height))
            if skeleton2.shape != (height, width):
                skeleton2 = cv2.resize(skeleton2, (width, height))
        
        # Create colored versions
        # Black pixels in skeleton are the structure (value 0)
        # White background is value 255
        
        # Create color images
        color_img1 = np.ones((skeleton1.shape[0], skeleton1.shape[1], 3), dtype=np.uint8) * 255
        color_img2 = np.ones((skeleton2.shape[0], skeleton2.shape[1], 3), dtype=np.uint8) * 255
        
        # Apply colors to structure (where skeleton is black/dark)
        mask1 = skeleton1 < 128
        mask2 = skeleton2 < 128
        
        color_img1[mask1] = c1
        color_img2[mask2] = c2
        
        # Overlay using addWeighted - where they overlap, colors blend
        overlay = cv2.addWeighted(color_img1, 0.5, color_img2, 0.5, 0)
        
        # Encode as PNG
        is_success, buffer = cv2.imencode(".png", overlay)
        if not is_success:
            raise Exception("Failed to encode overlay")
        
        return StreamingResponse(
            io.BytesIO(buffer.tobytes()),
            media_type="image/png",
            headers={
                "X-Color1": color1,
                "X-Color2": color2,
                "X-Processing": "skeletonized-overlay"
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Overlay creation failed: {str(e)}")


# Initialize M-LSD detector (lazy loading to save memory)
mlsd_detector = None

def get_mlsd_detector():
    """Lazy load M-LSD detector"""
    global mlsd_detector
    if mlsd_detector is None:
        mlsd_detector = MLSDdetector.from_pretrained('lllyasviel/ControlNet')
    return mlsd_detector


@app.get("/api/mlsd/{filename}")
async def detect_lines_mlsd(filename: str, page: int = 0, score_threshold: float = 0.1, distance_threshold: float = 20.0):
    """
    Use M-LSD (Mobile Line Segment Detection) to detect straight lines in architectural drawings.
    This is a Deep Learning model that's superior to traditional methods for messy/scanned drawings.
    
    Args:
        filename: PDF filename
        page: PDF page number (default: 0)
        score_threshold: Line confidence threshold 0-1 (default: 0.1 = detect more lines)
        distance_threshold: Minimum line length in pixels (default: 20.0)
    
    Returns:
        Image with detected line segments drawn
    """
    file_path = DETAILS_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        # Extract PDF at high resolution
        pdf_document = fitz.open(str(file_path))
        
        if page >= len(pdf_document):
            page = 0
            
        pdf_page = pdf_document[page]
        
        # Render at 300 DPI for M-LSD
        mat = fitz.Matrix(3.0, 3.0)
        pix = pdf_page.get_pixmap(matrix=mat, alpha=False)
        
        # Convert to PIL Image
        img_data = pix.tobytes("png")
        pil_image = Image.open(io.BytesIO(img_data))
        
        # Load M-LSD detector
        detector = get_mlsd_detector()
        
        # Detect lines (returns image with lines drawn)
        # detect_resolution: input resolution for model (512 is standard)
        # image_resolution: output resolution (keep original)
        result = detector(
            pil_image,
            thr_v=score_threshold,
            thr_d=distance_threshold,
            detect_resolution=512,
            image_resolution=max(pil_image.size)
        )
        
        # Convert PIL image to bytes
        buffer = io.BytesIO()
        result.save(buffer, format='PNG')
        buffer.seek(0)
        
        pdf_document.close()
        
        return StreamingResponse(
            buffer,
            media_type="image/png",
            headers={
                "X-Model": "M-LSD",
                "X-Score-Threshold": str(score_threshold),
                "X-Distance-Threshold": str(distance_threshold),
                "X-DPI": "300"
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"M-LSD detection failed: {str(e)}")


@app.get("/api/mlsd-overlay/{file1}/{file2}")
async def mlsd_overlay(
    file1: str, 
    file2: str, 
    color1: str = "green", 
    color2: str = "pink",
    score_threshold: float = 0.1,
    distance_threshold: float = 20.0
):
    """
    Create overlay using M-LSD detected lines instead of skeletonization.
    Best for scanned or messy drawings where traditional methods struggle.
    
    Args:
        file1: First PDF filename
        file2: Second PDF filename
        color1: Color for first detail (default: green)
        color2: Color for second detail (default: pink)
        score_threshold: Line confidence threshold (default: 0.1)
        distance_threshold: Minimum line length (default: 20.0)
    """
    try:
        colors = {
            "green": (0, 255, 0),
            "red": (255, 0, 0),
            "blue": (0, 0, 255),
            "pink": (255, 100, 150),
            "cyan": (0, 255, 255),
            "yellow": (255, 255, 0)
        }
        
        c1 = colors.get(color1.lower(), (0, 255, 0))
        c2 = colors.get(color2.lower(), (255, 100, 150))
        
        file1_path = DETAILS_DIR / file1
        file2_path = DETAILS_DIR / file2
        
        if not file1_path.exists() or not file2_path.exists():
            raise HTTPException(status_code=404, detail="One or both files not found")
        
        # Load M-LSD detector
        detector = get_mlsd_detector()
        
        def extract_mlsd_lines(file_path):
            """Extract lines using M-LSD"""
            pdf_doc = fitz.open(str(file_path))
            page = pdf_doc[0]
            
            # Extract at 300 DPI
            mat = fitz.Matrix(3.0, 3.0)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            
            img_data = pix.tobytes("png")
            pil_image = Image.open(io.BytesIO(img_data))
            
            # Detect lines
            result = detector(
                pil_image,
                thr_v=score_threshold,
                thr_d=distance_threshold,
                detect_resolution=512,
                image_resolution=max(pil_image.size)
            )
            
            # Convert to numpy array (grayscale)
            lines_img = np.array(result.convert('L'))
            
            pdf_doc.close()
            return lines_img
        
        lines1 = extract_mlsd_lines(file1_path)
        lines2 = extract_mlsd_lines(file2_path)
        
        # Ensure same dimensions
        if lines1.shape != lines2.shape:
            height = max(lines1.shape[0], lines2.shape[0])
            width = max(lines1.shape[1], lines2.shape[1])
            
            if lines1.shape != (height, width):
                lines1 = cv2.resize(lines1, (width, height))
            if lines2.shape != (height, width):
                lines2 = cv2.resize(lines2, (width, height))
        
        # Create colored versions
        color_img1 = np.ones((lines1.shape[0], lines1.shape[1], 3), dtype=np.uint8) * 255
        color_img2 = np.ones((lines2.shape[0], lines2.shape[1], 3), dtype=np.uint8) * 255
        
        # Apply colors where lines exist (dark pixels)
        mask1 = lines1 < 128
        mask2 = lines2 < 128
        
        color_img1[mask1] = c1
        color_img2[mask2] = c2
        
        # Overlay
        overlay = cv2.addWeighted(color_img1, 0.5, color_img2, 0.5, 0)
        
        # Encode
        is_success, buffer = cv2.imencode(".png", overlay)
        if not is_success:
            raise Exception("Failed to encode overlay")
        
        return StreamingResponse(
            io.BytesIO(buffer.tobytes()),
            media_type="image/png",
            headers={
                "X-Model": "M-LSD",
                "X-Color1": color1,
                "X-Color2": color2,
                "X-Processing": "mlsd-overlay"
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"M-LSD overlay failed: {str(e)}")


@app.get("/api/extract-sketch/{filename}")
async def extract_sketch_only(filename: str, page: int = 0, remove_text: bool = True):
    """
    Extract only the drawing/sketch from PDF, removing all text, dimensions, and annotations.
    Uses M-LSD to detect only structural lines and filters out text elements.
    
    Args:
        filename: PDF filename
        page: PDF page number (default: 0)
        remove_text: Whether to remove text (default: True)
    
    Returns:
        Clean sketch with only line work, no text or annotations
    """
    file_path = DETAILS_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        # Extract PDF at very high resolution to capture fine details
        pdf_document = fitz.open(str(file_path))
        
        if page >= len(pdf_document):
            page = 0
            
        pdf_page = pdf_document[page]
        
        # Method 1: Extract vector drawings directly (removes text automatically)
        # This gets the raw drawing paths without text
        drawings = pdf_page.get_drawings()
        
        # Render at high resolution for rasterization
        mat = fitz.Matrix(4.0, 4.0)  # 400 DPI
        pix = pdf_page.get_pixmap(matrix=mat, alpha=False)
        
        # Convert to numpy array
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
        
        if remove_text and len(drawings) > 0:
            # Create blank canvas
            clean_img = np.ones_like(img) * 255
            
            # Draw only the vector paths (not text)
            # Convert to PIL for drawing
            from PIL import ImageDraw
            pil_img = Image.fromarray(clean_img)
            draw = ImageDraw.Draw(pil_img)
            
            # Draw each path
            for drawing in drawings:
                items = drawing.get("items", [])
                for item in items:
                    if item[0] == "l":  # Line
                        # Scale coordinates by matrix
                        p1 = (item[1].x * 4, item[1].y * 4)
                        p2 = (item[2].x * 4, item[2].y * 4)
                        draw.line([p1, p2], fill=(0, 0, 0), width=2)
                    elif item[0] == "c":  # Curve
                        # For curves, approximate with line segments
                        points = [(item[i].x * 4, item[i].y * 4) for i in range(1, len(item))]
                        if len(points) >= 2:
                            for i in range(len(points) - 1):
                                draw.line([points[i], points[i + 1]], fill=(0, 0, 0), width=2)
            
            clean_img = np.array(pil_img)
        else:
            # Fallback: Use M-LSD to detect only lines (ignores text)
            pil_image = Image.fromarray(img)
            detector = get_mlsd_detector()
            
            # Detect structural lines only (text won't be detected as lines)
            result = detector(
                pil_image,
                thr_v=0.15,  # Moderate threshold
                thr_d=30.0,  # Longer lines only (filters out small text artifacts)
                detect_resolution=512,
                image_resolution=max(pil_image.size)
            )
            
            # Convert to numpy and invert (black lines on white)
            clean_img = np.array(result)
        
        pdf_document.close()
        
        # Encode as PNG
        is_success, buffer = cv2.imencode(".png", clean_img)
        if not is_success:
            raise Exception("Failed to encode sketch")
        
        return StreamingResponse(
            io.BytesIO(buffer.tobytes()),
            media_type="image/png",
            headers={
                "X-Processing": "sketch-only",
                "X-Text-Removed": str(remove_text),
                "X-Method": "vector-extraction" if len(drawings) > 0 else "mlsd-detection",
                "X-DPI": "400"
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sketch extraction failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
