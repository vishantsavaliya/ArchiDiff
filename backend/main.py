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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
