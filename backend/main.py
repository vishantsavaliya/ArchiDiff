from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pathlib import Path
import json
from typing import List, Dict
import os

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

# Sample detail metadata (replace with your actual 6 files)
DETAILS_METADATA = [
    {
        "id": "1",
        "name": "Fire Extinguisher Cabinet - Version A",
        "filename": "detail_1.pdf",
        "project": "Building Alpha",
        "scale": "1:20",
        "description": "Standard wall-mounted fire extinguisher cabinet detail"
    },
    {
        "id": "2",
        "name": "Fire Extinguisher Cabinet - Version B",
        "filename": "detail_2.pdf",
        "project": "Building Beta",
        "scale": "1:20",
        "description": "Enhanced fire extinguisher cabinet with reinforced mounting"
    },
    {
        "id": "3",
        "name": "Window Head Detail - Type 1",
        "filename": "detail_3.pdf",
        "project": "Residential Complex",
        "scale": "1:5",
        "description": "Aluminum window head detail with thermal break"
    },
    {
        "id": "4",
        "name": "Window Head Detail - Type 2",
        "filename": "detail_4.pdf",
        "project": "Office Tower",
        "scale": "1:5",
        "description": "Modified window head detail with improved waterproofing"
    },
    {
        "id": "5",
        "name": "Wall Section - Exterior",
        "filename": "detail_5.pdf",
        "project": "Commercial Building",
        "scale": "1:10",
        "description": "Typical exterior wall section with insulation"
    },
    {
        "id": "6",
        "name": "Wall Section - Exterior (Revised)",
        "filename": "detail_6.pdf",
        "project": "Commercial Building",
        "scale": "1:10",
        "description": "Revised exterior wall section with enhanced R-value"
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
