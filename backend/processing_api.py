#!/usr/bin/env python3
"""
Processing API - Flask server for ArchiDiff processing pipeline
Handles: PDF conversion, upscaling, text removal
Port: 5000
"""

import os
import sys
import cv2
import uuid
import shutil
import subprocess
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = Path('uploads')
OUTPUT_FOLDER = Path('processed')
UPLOAD_FOLDER.mkdir(exist_ok=True)
OUTPUT_FOLDER.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# Processing status storage
processing_jobs = {}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_script_path(script_name):
    """Get absolute path to backend script"""
    backend_dir = Path(__file__).parent
    return backend_dir / script_name

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'processing_api'})

@app.route('/upload', methods=['POST'])
def upload_files():
    """Upload and start processing 2 files"""
    if 'file1' not in request.files or 'file2' not in request.files:
        return jsonify({'error': 'Both file1 and file2 are required'}), 400
    
    file1 = request.files['file1']
    file2 = request.files['file2']
    
    if file1.filename == '' or file2.filename == '':
        return jsonify({'error': 'No files selected'}), 400
    
    if not (allowed_file(file1.filename) and allowed_file(file2.filename)):
        return jsonify({'error': 'Invalid file type. Only PDF, PNG, JPG allowed'}), 400
    
    # Clean up old uploads to save storage
    cleanup_old_uploads()
    
    # Create job ID
    job_id = str(uuid.uuid4())
    job_folder = UPLOAD_FOLDER / job_id
    job_folder.mkdir(parents=True, exist_ok=True)
    
    # Save uploaded files
    filename1 = secure_filename(file1.filename)
    filename2 = secure_filename(file2.filename)
    filepath1 = job_folder / filename1
    filepath2 = job_folder / filename2
    
    file1.save(str(filepath1))
    file2.save(str(filepath2))
    
    # Initialize job status
    processing_jobs[job_id] = {
        'status': 'queued',
        'progress': 0,
        'current_step': 'Initializing...',
        'file1': filename1,
        'file2': filename2,
        'file1_path': str(filepath1),
        'file2_path': str(filepath2),
        'file1_processed': None,
        'file2_processed': None,
        'error': None
    }
    
    # Start processing in background (simulate async)
    import threading
    thread = threading.Thread(target=process_files, args=(job_id,))
    thread.daemon = True
    thread.start()
    
    return jsonify({
        'job_id': job_id,
        'message': 'Files uploaded successfully. Processing started.',
        'file1': filename1,
        'file2': filename2
    })

def cleanup_old_uploads():
    """Remove old upload and processed folders to save storage"""
    try:
        import time
        current_time = time.time()
        
        # Remove upload folders older than 1 hour
        for folder in UPLOAD_FOLDER.iterdir():
            if folder.is_dir():
                folder_age = current_time - folder.stat().st_mtime
                if folder_age > 3600:  # 1 hour
                    shutil.rmtree(folder, ignore_errors=True)
        
        # Remove processed folders older than 1 hour
        for folder in OUTPUT_FOLDER.iterdir():
            if folder.is_dir():
                folder_age = current_time - folder.stat().st_mtime
                if folder_age > 3600:  # 1 hour
                    shutil.rmtree(folder, ignore_errors=True)
    except Exception as e:
        print(f"Cleanup warning: {e}")

def process_files(job_id):
    """Process both files through the pipeline in parallel where possible"""
    job = processing_jobs[job_id]
    
    try:
        job_output = OUTPUT_FOLDER / job_id
        job_output.mkdir(parents=True, exist_ok=True)
        
        # Step 1: Convert PDFs to PNG if needed (sequential, fast)
        job['current_step'] = 'Converting PDFs to PNG...'
        job['progress'] = 5
        
        file1_path = Path(job['file1_path'])
        file2_path = Path(job['file2_path'])
        
        # Convert file 1 if PDF
        if file1_path.suffix.lower() == '.pdf':
            converted_folder = job_output / 'file1_converted'
            converted_folder.mkdir(exist_ok=True)
            convert_pdf_to_png(file1_path, converted_folder)
            png_files = list(converted_folder.glob('*.png'))
            if png_files:
                file1_path = png_files[0]
        
        # Convert file 2 if PDF
        if file2_path.suffix.lower() == '.pdf':
            converted_folder = job_output / 'file2_converted'
            converted_folder.mkdir(exist_ok=True)
            convert_pdf_to_png(file2_path, converted_folder)
            png_files = list(converted_folder.glob('*.png'))
            if png_files:
                file2_path = png_files[0]
        
        job['progress'] = 15
        
        # Step 2: Upscale both files in parallel
        job['current_step'] = 'Upscaling both images 2x...'
        job['progress'] = 20
        
        upscaled1_path = job_output / 'file1_upscaled.png'
        upscaled2_path = job_output / 'file2_upscaled.png'
        
        # Process both in parallel using threading
        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        with ThreadPoolExecutor(max_workers=2) as executor:
            future1 = executor.submit(upscale_image, file1_path, upscaled1_path)
            future2 = executor.submit(upscale_image, file2_path, upscaled2_path)
            
            # Wait for both to complete
            future1.result()
            future2.result()
        
        job['progress'] = 50
        
        # Step 3: Remove text from both files in parallel (single pass)
        job['current_step'] = 'Removing text from both images...'
        job['progress'] = 55
        
        final1_path = job_output / 'file1_final.png'
        final2_path = job_output / 'file2_final.png'
        
        with ThreadPoolExecutor(max_workers=2) as executor:
            future1 = executor.submit(remove_text, upscaled1_path, final1_path)
            future2 = executor.submit(remove_text, upscaled2_path, final2_path)
            
            # Wait for both to complete
            future1.result()
            future2.result()
        
        job['progress'] = 95
        
        # Store final paths
        job['file1_processed'] = str(final1_path)
        job['file2_processed'] = str(final2_path)
        
        # Complete
        job['status'] = 'completed'
        job['current_step'] = 'Processing complete!'
        job['progress'] = 100
        
    except Exception as e:
        job['status'] = 'failed'
        job['error'] = str(e)
        job['current_step'] = f'Error: {str(e)}'
        print(f"Error processing job {job_id}: {e}")

def convert_pdf_to_png(pdf_path, output_folder):
    """Convert PDF to PNG"""
    convert_script = get_script_path('convert_all_pdfs.py')
    result = subprocess.run([
        sys.executable, str(convert_script),
        str(pdf_path),
        str(output_folder),
        '--dpi', '4.0'
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        raise Exception(f"PDF conversion failed: {result.stderr}")

def upscale_image(input_path, output_path):
    """Upscale image 2x"""
    upscale_script = get_script_path('upscale_realesrgan.py')
    result = subprocess.run([
        sys.executable, str(upscale_script),
        str(input_path),
        str(output_path),
        '--scale', '2'
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        raise Exception(f"Upscaling failed: {result.stderr}")

def remove_text(input_path, output_path):
    """Remove text annotations (single pass)"""
    text_removal_script = get_script_path('remove_text_ocr.py')
    result = subprocess.run([
        sys.executable, str(text_removal_script),
        str(input_path),
        str(output_path)
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        raise Exception(f"Text removal failed: {result.stderr}")

def process_single_file(input_path, job_id, file_label):
    """DEPRECATED: Use process_files instead for parallel processing"""
    pass

@app.route('/status/<job_id>', methods=['GET'])
def get_status(job_id):
    """Get processing status for a job"""
    if job_id not in processing_jobs:
        return jsonify({'error': 'Job not found'}), 404
    
    job = processing_jobs[job_id]
    return jsonify({
        'job_id': job_id,
        'status': job['status'],
        'progress': job['progress'],
        'current_step': job['current_step'],
        'file1': job['file1'],
        'file2': job['file2'],
        'file1_processed': job['file1_processed'],
        'file2_processed': job['file2_processed'],
        'error': job['error']
    })

@app.route('/image/<job_id>/<file_num>', methods=['GET'])
def get_processed_image(job_id, file_num):
    """Get processed image"""
    if job_id not in processing_jobs:
        return jsonify({'error': 'Job not found'}), 404
    
    job = processing_jobs[job_id]
    
    if file_num == '1':
        image_path = job['file1_processed']
    elif file_num == '2':
        image_path = job['file2_processed']
    else:
        return jsonify({'error': 'Invalid file number'}), 400
    
    if not image_path or not os.path.exists(image_path):
        return jsonify({'error': 'Image not ready'}), 404
    
    return send_file(image_path, mimetype='image/png')

@app.route('/cleanup/<job_id>', methods=['DELETE'])
def cleanup_job(job_id):
    """Clean up job files"""
    if job_id in processing_jobs:
        job_folder = UPLOAD_FOLDER / job_id
        job_output = OUTPUT_FOLDER / job_id
        
        if job_folder.exists():
            shutil.rmtree(job_folder)
        if job_output.exists():
            shutil.rmtree(job_output)
        
        del processing_jobs[job_id]
        return jsonify({'message': 'Job cleaned up successfully'})
    
    return jsonify({'error': 'Job not found'}), 404

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 ArchiDiff Processing API")
    print("=" * 60)
    print(f"📁 Upload folder: {UPLOAD_FOLDER.absolute()}")
    print(f"📁 Output folder: {OUTPUT_FOLDER.absolute()}")
    print(f"🌐 Server: http://localhost:5004")
    print("=" * 60)
    print("\nEndpoints:")
    print("  POST   /upload          - Upload and process 2 files")
    print("  GET    /status/<job_id> - Get processing status")
    print("  GET    /image/<job_id>/<file_num> - Get processed image")
    print("  DELETE /cleanup/<job_id> - Clean up job files")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5004, debug=True, threaded=True)
