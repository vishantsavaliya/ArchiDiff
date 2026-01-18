#!/usr/bin/env python3
"""
Gemini Analyzer - Async AI analysis service
Analyzes architectural drawings during preprocessing
"""

import os
import base64
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai
from PIL import Image
import io

load_dotenv()

class GeminiAnalyzer:
    """Lightweight Gemini analyzer for architectural drawings"""
    
    def __init__(self):
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            raise ValueError('GEMINI_API_KEY not found in environment')
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Architectural analysis prompt
        self.prompt = """Analyze the provided set of architectural detail drawings. Identify the key structural differences in how the wall is constructed or layered across the different versions.

Please follow these rules:

1. Focus on Physical Build: Look for variations in wall layers (like drywall/GWB), framing, or blocking. Ignore text about heights, ADA compliance, or labels unless they change the actual build method.

2. Compare Variations: If some drawings are detailed and others are simplified, explain what specific physical material or layer is missing from the simpler versions.

3. Keep it Brief: Summarize the findings in 1-2 short paragraphs."""
    
    def resize_for_api(self, image_path, max_dimension=1024):
        """
        Resize image to reduce API payload size
        Maintains aspect ratio
        """
        try:
            img = Image.open(image_path)
            
            # Calculate new size
            width, height = img.size
            if max(width, height) <= max_dimension:
                return img  # No resize needed
            
            if width > height:
                new_width = max_dimension
                new_height = int((max_dimension / width) * height)
            else:
                new_height = max_dimension
                new_width = int((max_dimension / height) * width)
            
            # Resize with high quality
            resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            return resized
            
        except Exception as e:
            print(f"Error resizing image: {e}")
            return Image.open(image_path)  # Return original if resize fails
    
    def analyze_images(self, image1_path, image2_path):
        """
        Analyze two architectural drawings
        Returns summary text
        """
        try:
            # Load and resize images to reduce payload
            print(f"Loading images for analysis...")
            image1 = self.resize_for_api(image1_path)
            image2 = self.resize_for_api(image2_path)
            
            print(f"Sending to Gemini API...")
            # Generate analysis
            response = self.model.generate_content([self.prompt, image1, image2])
            
            print(f"✓ Analysis complete")
            return response.text
            
        except Exception as e:
            error_msg = f"Analysis failed: {str(e)}"
            print(error_msg)
            return error_msg
    
    def analyze_from_job(self, job_folder):
        """
        Analyze images from a job folder
        Returns summary text or None if images not ready
        """
        job_path = Path(job_folder)
        
        # Check for final processed images
        image1_path = job_path / 'file1_final.png'
        image2_path = job_path / 'file2_final.png'
        
        if not image1_path.exists() or not image2_path.exists():
            print(f"Images not ready for analysis")
            return None
        
        return self.analyze_images(str(image1_path), str(image2_path))


# Standalone function for async calls
def analyze_job_async(job_id, output_folder):
    """
    Analyze a job asynchronously
    Saves result to <job_folder>/analysis.txt
    """
    try:
        job_folder = Path(output_folder) / job_id
        analysis_file = job_folder / 'analysis.txt'
        
        # Check cache first - skip if analysis already exists
        if analysis_file.exists():
            print(f"✓ Analysis already exists for job {job_id}, skipping...")
            return analysis_file.read_text()
        
        analyzer = GeminiAnalyzer()
        
        # Wait for images to be ready (check periodically)
        image1_path = job_folder / 'file1_final.png'
        image2_path = job_folder / 'file2_final.png'
        
        import time
        max_wait = 300  # 5 minutes max
        waited = 0
        
        while waited < max_wait:
            if image1_path.exists() and image2_path.exists():
                break
            time.sleep(5)
            waited += 5
        
        if not (image1_path.exists() and image2_path.exists()):
            print(f"Timeout waiting for images to process")
            return None
        
        # Perform analysis
        print(f"\n🤖 Starting AI analysis for job {job_id}...")
        summary = analyzer.analyze_from_job(job_folder)
        
        if summary:
            # Save to file
            analysis_file = job_folder / 'analysis.txt'
            analysis_file.write_text(summary)
            print(f"✓ Analysis saved to {analysis_file}")
            return summary
        
        return None
        
    except Exception as e:
        print(f"Error in async analysis: {e}")
        return None


if __name__ == '__main__':
    # Test mode
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python gemini_analyzer.py <image1_path> <image2_path>")
        sys.exit(1)
    
    analyzer = GeminiAnalyzer()
    summary = analyzer.analyze_images(sys.argv[1], sys.argv[2])
    print("\n" + "="*60)
    print("ANALYSIS SUMMARY")
    print("="*60)
    print(summary)
    print("="*60)
