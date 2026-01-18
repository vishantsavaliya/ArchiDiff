#!/usr/bin/env python3
"""
Processing API - Flask server for ArchiDiff processing pipeline
Handles: PDF conversion, upscaling, text removal, AI analysis
Port: 5004
"""

import os
import sys
import cv2
import uuid
import shutil
import subprocess
import threading
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv
from gemini_analyzer import analyze_job_async

# Load environment variables
load_dotenv()

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
    
    # Get processing options
    remove_text = request.form.get('remove_text', 'true').lower() == 'true'
    
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
        'remove_text': remove_text,
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
    """Remove ALL upload and processed folders on startup to avoid confusion"""
    try:
        # Remove ALL upload folders (they're temporary)
        for folder in UPLOAD_FOLDER.iterdir():
            if folder.is_dir():
                print(f"Cleaning up upload folder: {folder.name}")
                shutil.rmtree(folder, ignore_errors=True)
        
        # Remove ALL processed folders on startup (fresh start each time)
        for folder in OUTPUT_FOLDER.iterdir():
            if folder.is_dir():
                print(f"Cleaning up processed folder: {folder.name}")
                shutil.rmtree(folder, ignore_errors=True)
        
        # Limit processing_jobs dictionary to prevent memory buildup
        if len(processing_jobs) > 50:
            # Remove oldest completed/failed jobs
            completed_jobs = [(k, v) for k, v in processing_jobs.items() 
                            if v['status'] in ['completed', 'failed']]
            if len(completed_jobs) > 30:
                # Sort by age and remove oldest
                for job_id, _ in completed_jobs[:len(completed_jobs) - 30]:
                    print(f"Removing old job from memory: {job_id}")
                    del processing_jobs[job_id]
    except Exception as e:
        print(f"Cleanup warning: {e}")

def process_files(job_id):
    """Process both files through the pipeline in parallel where possible"""
    job = processing_jobs[job_id]
    
    try:
        job_output = OUTPUT_FOLDER / job_id
        job_output.mkdir(parents=True, exist_ok=True)
        
        # Check if already processed (prevent reprocessing)
        final1_path = job_output / 'file1_final.png'
        final2_path = job_output / 'file2_final.png'
        
        if final1_path.exists() and final2_path.exists():
            print(f"Job {job_id} already processed, skipping...")
            job['file1_processed'] = str(final1_path)
            job['file2_processed'] = str(final2_path)
            
            # Clean up uploads if they still exist
            upload_folder = UPLOAD_FOLDER / job_id
            if upload_folder.exists():
                shutil.rmtree(upload_folder, ignore_errors=True)
                print(f"  ✓ Cleaned up leftover uploads")
            
            job['status'] = 'completed'
            job['current_step'] = 'Already processed (loaded from cache)'
            job['progress'] = 100
            return
        
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
        
        # Step 2: Remove text from images (if enabled)
        job['current_step'] = 'Preparing images...'
        job['progress'] = 20
        
        cleaned1_path = job_output / 'file1_cleaned.png'
        cleaned2_path = job_output / 'file2_cleaned.png'
        
        # Check if text removal is enabled
        if job.get('remove_text', True):
            job['current_step'] = 'Removing text from images...'
            job['progress'] = 30
            
            text_removal_tasks = []
            if not cleaned1_path.exists():
                text_removal_tasks.append(('file1', file1_path, cleaned1_path))
            else:
                print(f"Skipping text removal for file1 (already exists)")
            
            if not cleaned2_path.exists():
                text_removal_tasks.append(('file2', file2_path, cleaned2_path))
            else:
                print(f"Skipping text removal for file2 (already exists)")
            
            if text_removal_tasks:
                # Process in parallel for faster results
                with ThreadPoolExecutor(max_workers=2) as executor:
                    futures = [executor.submit(remove_text, task[1], task[2]) for task in text_removal_tasks]
                    for i, future in enumerate(futures):
                        try:
                            future.result()
                            job['progress'] = 30 + (i + 1) * 15  # 30-60%
                            print(f"Text removal completed for {text_removal_tasks[i][0]}")
                        except Exception as e:
                            print(f"Text removal failed for {text_removal_tasks[i][0]}: {e}")
                            # Fallback: copy original file if text removal fails
                            shutil.copy2(text_removal_tasks[i][1], text_removal_tasks[i][2])
                            print(f"Using original file for {text_removal_tasks[i][0]}")
        else:
            # Skip text removal - copy original files directly
            print(f"Text removal disabled, using original images")
            if not cleaned1_path.exists():
                shutil.copy2(file1_path, cleaned1_path)
            if not cleaned2_path.exists():
                shutil.copy2(file2_path, cleaned2_path)
        
        job['progress'] = 60
        
        # Step 3: Upscale cleaned images (skip if already done)
        job['current_step'] = 'Upscaling images 1.5x...'
        job['progress'] = 65
        
        # Only upscale if not already done
        tasks = []
        if not final1_path.exists():
            tasks.append(('file1', cleaned1_path, final1_path))
        else:
            print(f"Skipping upscale for file1 (already exists)")
        
        if not final2_path.exists():
            tasks.append(('file2', cleaned2_path, final2_path))
        else:
            print(f"Skipping upscale for file2 (already exists)")
        
        if tasks:
            # Use 1 worker to reduce memory pressure (process sequentially)
            with ThreadPoolExecutor(max_workers=1) as executor:
                futures = [executor.submit(upscale_image, task[1], task[2]) for task in tasks]
                for future in futures:
                    future.result()
        
        job['progress'] = 95
        
        # Store final paths
        job['file1_processed'] = str(final1_path)
        job['file2_processed'] = str(final2_path)
        
        # Clean up to save storage
        print(f"\n🧹 Cleaning up temporary files for job {job_id}...")
        
        # Delete uploads folder (raw files no longer needed)
        upload_folder = UPLOAD_FOLDER / job_id
        if upload_folder.exists():
            shutil.rmtree(upload_folder, ignore_errors=True)
            print(f"  ✓ Deleted uploads folder")
        
        # Delete intermediate files (keep only final processed images)
        try:
            # Delete converted PDF folders
            for folder_name in ['file1_converted', 'file2_converted']:
                folder = job_output / folder_name
                if folder.exists():
                    shutil.rmtree(folder, ignore_errors=True)
                    print(f"  ✓ Deleted {folder_name}")
            
            # Delete cleaned intermediates (keep only final upscaled)
            cleaned1_path = job_output / 'file1_cleaned.png'
            cleaned2_path = job_output / 'file2_cleaned.png'
            for cleaned_file in [cleaned1_path, cleaned2_path]:
                if cleaned_file.exists():
                    cleaned_file.unlink()
                    print(f"  ✓ Deleted {cleaned_file.name}")
        except Exception as e:
            print(f"  ⚠️ Cleanup warning: {e}")
        
        print(f"✅ Job {job_id} completed - only final images kept\n")
        
        # Complete
        job['status'] = 'completed'
        job['current_step'] = 'Processing complete!'
        job['progress'] = 100
        
        # Start async AI analysis in background (non-blocking)
        print(f"🤖 Starting background AI analysis...")
        analysis_thread = threading.Thread(
            target=analyze_job_async, 
            args=(job_id, str(OUTPUT_FOLDER))
        )
        analysis_thread.daemon = True
        analysis_thread.start()
        
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
    """Upscale image 2x (with timeout)"""
    upscale_script = get_script_path('upscale_realesrgan.py')
    try:
        result = subprocess.run([
            sys.executable, str(upscale_script),
            str(input_path),
            str(output_path),
            '--scale', '2'
        ], capture_output=True, text=True, timeout=180)  # 3 minute timeout
        
        if result.returncode != 0:
            raise Exception(f"Upscaling failed: {result.stderr}")
    except subprocess.TimeoutExpired:
        raise Exception(f"Upscaling timed out after 180 seconds (file may be too large)")

def remove_text(input_path, output_path):
    """Remove text annotations (single pass with timeout)"""
    text_removal_script = get_script_path('remove_text_ocr.py')
    try:
        result = subprocess.run([
            sys.executable, str(text_removal_script),
            str(input_path),
            str(output_path)
        ], capture_output=True, text=True, timeout=120)  # 2 minute timeout
        
        if result.returncode != 0:
            raise Exception(f"Text removal failed: {result.stderr}")
    except subprocess.TimeoutExpired:
        raise Exception(f"Text removal timed out after 120 seconds (file may be too large)")

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
    # Support test-job for development
    if job_id == 'test-job':
        if file_num == '1':
            image_path = OUTPUT_FOLDER / 'test-job' / 'file1_final.png'
        elif file_num == '2':
            image_path = OUTPUT_FOLDER / 'test-job' / 'file2_final.png'
        else:
            return jsonify({'error': 'Invalid file number'}), 400
        
        if not image_path.exists():
            return jsonify({'error': 'Test image not found'}), 404
        
        response = send_file(image_path, mimetype='image/png')
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Cross-Origin-Resource-Policy'] = 'cross-origin'
        return response
    
    # Normal job handling
    # If job not in memory, try to find files on disk (handles server restart)
    if job_id not in processing_jobs:
        job_output = OUTPUT_FOLDER / job_id
        if file_num == '1':
            image_path = job_output / 'file1_final.png'
        elif file_num == '2':
            image_path = job_output / 'file2_final.png'
        else:
            return jsonify({'error': 'Invalid file number'}), 400
        
        if not image_path.exists():
            return jsonify({'error': 'Job not found or image not ready'}), 404
        
        response = send_file(image_path, mimetype='image/png')
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Cross-Origin-Resource-Policy'] = 'cross-origin'
        return response
    
    job = processing_jobs[job_id]
    
    if file_num == '1':
        image_path = job['file1_processed']
    elif file_num == '2':
        image_path = job['file2_processed']
    else:
        return jsonify({'error': 'Invalid file number'}), 400
    
    if not image_path or not os.path.exists(image_path):
        return jsonify({'error': 'Image not ready'}), 404
    
    response = send_file(image_path, mimetype='image/png')
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Cross-Origin-Resource-Policy'] = 'cross-origin'
    return response

@app.route('/cleanup/<job_id>', methods=['DELETE'])
def cleanup_job(job_id):
    """Clean up specific job files"""
    job_folder = UPLOAD_FOLDER / job_id
    job_output = OUTPUT_FOLDER / job_id
    
    deleted = False
    if job_folder.exists():
        shutil.rmtree(job_folder, ignore_errors=True)
        deleted = True
    if job_output.exists():
        shutil.rmtree(job_output, ignore_errors=True)
        deleted = True
    
    if job_id in processing_jobs:
        del processing_jobs[job_id]
        deleted = True
    
    if deleted:
        return jsonify({'message': 'Job cleaned up successfully'})
    return jsonify({'error': 'Job not found'}), 404

@app.route('/cleanup-all', methods=['POST'])
def cleanup_all():
    """Clean up ALL old processed files immediately"""
    try:
        upload_count = 0
        processed_count = 0
        
        # Get current active job IDs from request (optional)
        active_jobs = set()
        if request.json and 'active_job_ids' in request.json:
            active_jobs = set(request.json['active_job_ids'])
        
        # Clean upload folders
        for folder in UPLOAD_FOLDER.iterdir():
            if folder.is_dir() and folder.name not in active_jobs:
                try:
                    shutil.rmtree(folder)
                    upload_count += 1
                except Exception as e:
                    print(f"Failed to remove {folder}: {e}")
        
        # Clean processed folders
        for folder in OUTPUT_FOLDER.iterdir():
            if folder.is_dir() and folder.name not in active_jobs:
                try:
                    shutil.rmtree(folder)
                    processed_count += 1
                except Exception as e:
                    print(f"Failed to remove {folder}: {e}")
        
        # Clean in-memory jobs (keep active ones)
        jobs_to_remove = [jid for jid in processing_jobs.keys() if jid not in active_jobs]
        for job_id in jobs_to_remove:
            del processing_jobs[job_id]
        
        message = f"Cleaned {upload_count} upload folders, {processed_count} processed folders, and {len(jobs_to_remove)} jobs from memory"
        print(message)
        return jsonify({
            'message': message,
            'upload_folders_removed': upload_count,
            'processed_folders_removed': processed_count,
            'jobs_removed': len(jobs_to_remove)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get-analysis/<job_id>', methods=['GET'])
def get_analysis(job_id):
    """
    Get cached AI analysis for a job (lightweight)
    Returns analysis if ready, or status if still processing
    """
    try:
        job_folder = OUTPUT_FOLDER / job_id
        if not job_folder.exists():
            return jsonify({'error': 'Job not found'}), 404
        
        # Check if analysis file exists
        analysis_file = job_folder / 'analysis.txt'
        
        if analysis_file.exists():
            summary = analysis_file.read_text()
            return jsonify({
                'status': 'ready',
                'summary': summary,
                'job_id': job_id
            })
        else:
            # Analysis not ready yet
            return jsonify({
                'status': 'processing',
                'message': 'AI analysis in progress...',
                'job_id': job_id
            })
        
    except Exception as e:
        print(f"Error getting analysis: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 ArchiDiff Processing API")
    print("=" * 60)
    print(f"📁 Upload folder: {UPLOAD_FOLDER.absolute()}")
    print(f"📁 Output folder: {OUTPUT_FOLDER.absolute()}")
    print(f"🌐 Server: http://localhost:5004")
    print("=" * 60)
    
    # Cleanup old files on startup
    print("\n🧹 Running startup cleanup...")
    cleanup_old_uploads()
    print("✓ Startup cleanup complete\n")
    print("=" * 60)
    print("\nEndpoints:")
    print("  POST   /upload          - Upload and process 2 files")
    print("  GET    /status/<job_id> - Get processing status")
    print("  GET    /image/<job_id>/<file_num> - Get processed image")
    print("  DELETE /cleanup/<job_id> - Clean up specific job files")
    print("  POST   /cleanup-all     - Clean up ALL old files (preserves active jobs)")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5004, debug=True, threaded=True)
