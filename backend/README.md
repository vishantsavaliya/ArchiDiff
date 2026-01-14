# ArchiBoost Compare - Backend

FastAPI backend for processing and serving architectural detail files.

## Setup

1. Create virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Add your detail files:
- Place your 6 architectural detail files in the `details/` directory
- Supported formats: PDF, DXF, DWG, PNG, JPG

4. Run the server:
```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

## API Endpoints

- `GET /` - API information
- `GET /api/details` - List all available details
- `GET /api/detail/{id}` - Get specific detail info
- `GET /files/{filename}` - Serve detail files
- `POST /api/upload` - Upload new detail file
- `GET /api/health` - Health check

## Configuration

Edit the `DETAILS_METADATA` list in `main.py` to match your actual files.
