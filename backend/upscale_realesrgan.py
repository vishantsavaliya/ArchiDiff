#!/usr/bin/env python3
"""
Real-ESRGAN Image Upscaling
Upscale images 4x using Real-ESRGAN for better quality before processing
"""

import cv2
import numpy as np
import sys
import os
from pathlib import Path
import requests
import torch
from PIL import Image

class RealESRGAN:
    def __init__(self, model_path=None, device='cpu'):
        """Initialize Real-ESRGAN model"""
        self.device = device
        self.model_path = model_path or self.download_model()
        
        # Load model
        print(f"Loading Real-ESRGAN model from {self.model_path}...")
        try:
            self.model = torch.jit.load(self.model_path, map_location=device)
            self.model.eval()
            print("Model loaded successfully!")
        except Exception as e:
            print(f"Error loading model: {e}")
            print("Will use simple bicubic upscaling as fallback")
            self.model = None
    
    def download_model(self):
        """Download Real-ESRGAN model if not exists"""
        model_dir = Path(__file__).parent / 'models'
        model_dir.mkdir(exist_ok=True)
        
        model_path = model_dir / 'RealESRGAN_x4plus.pth'
        
        if model_path.exists():
            return str(model_path)
        
        print("Downloading Real-ESRGAN model (67MB)...")
        url = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth"
        
        try:
            response = requests.get(url, stream=True)
            response.raise_for_status()
            
            total_size = int(response.headers.get('content-length', 0))
            block_size = 8192
            downloaded = 0
            
            with open(model_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=block_size):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        progress = (downloaded / total_size) * 100 if total_size > 0 else 0
                        print(f"\rDownloading: {progress:.1f}%", end='', flush=True)
            
            print("\nModel downloaded successfully!")
            return str(model_path)
        
        except Exception as e:
            print(f"\nError downloading model: {e}")
            print("Will use simple bicubic upscaling as fallback")
            return None
    
    def upscale(self, image):
        """Upscale image 4x"""
        if self.model is None:
            # Fallback to bicubic upscaling
            h, w = image.shape[:2]
            return cv2.resize(image, (w * 4, h * 4), interpolation=cv2.INTER_CUBIC)
        
        try:
            # Prepare image for model
            if len(image.shape) == 2:  # Grayscale
                image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
            
            # Convert to tensor
            img_tensor = torch.from_numpy(image).float().permute(2, 0, 1).unsqueeze(0) / 255.0
            img_tensor = img_tensor.to(self.device)
            
            # Process
            with torch.no_grad():
                output = self.model(img_tensor)
            
            # Convert back to numpy
            output = output.squeeze(0).permute(1, 2, 0).cpu().numpy()
            output = np.clip(output * 255.0, 0, 255).astype(np.uint8)
            
            return output
        
        except Exception as e:
            print(f"Error during upscaling: {e}")
            print("Falling back to bicubic upscaling")
            h, w = image.shape[:2]
            return cv2.resize(image, (w * 4, h * 4), interpolation=cv2.INTER_CUBIC)


def upscale_image(input_path, output_path, scale=4):
    """
    Upscale a single image using Real-ESRGAN
    
    Args:
        input_path: Path to input image
        output_path: Path to save upscaled image
        scale: Upscaling factor (default: 4)
    """
    print(f"\nUpscaling: {input_path}")
    print(f"Scale: {scale}x")
    
    # Read image
    img = cv2.imread(input_path)
    if img is None:
        print(f"Error: Could not read image {input_path}")
        return False
    
    original_size = img.shape[:2]
    print(f"Original size: {original_size[1]}x{original_size[0]} pixels")
    
    # Use simple bicubic upscaling (faster, good for technical drawings)
    # Real-ESRGAN is better for photos but slower
    h, w = img.shape[:2]
    upscaled = cv2.resize(img, (w * scale, h * scale), interpolation=cv2.INTER_CUBIC)
    
    new_size = upscaled.shape[:2]
    print(f"Upscaled size: {new_size[1]}x{new_size[0]} pixels")
    
    # Save result
    cv2.imwrite(output_path, upscaled)
    print(f"Saved to: {output_path}")
    
    return True


def upscale_directory(input_dir, output_dir, scale=4):
    """
    Upscale all images in a directory
    
    Args:
        input_dir: Directory containing input images
        output_dir: Directory to save upscaled images
        scale: Upscaling factor (default: 4)
    """
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    
    if not input_path.exists():
        print(f"Error: Input directory does not exist: {input_dir}")
        return
    
    # Create output directory
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Get all image files
    image_extensions = {'.png', '.jpg', '.jpeg', '.bmp', '.tiff'}
    image_files = [f for f in input_path.iterdir() 
                   if f.is_file() and f.suffix.lower() in image_extensions]
    
    if not image_files:
        print(f"No image files found in {input_dir}")
        return
    
    print(f"\nFound {len(image_files)} images to upscale")
    print(f"Output directory: {output_dir}")
    print("=" * 50)
    
    # Process each image
    for i, img_file in enumerate(image_files, 1):
        print(f"\n[{i}/{len(image_files)}]")
        
        output_file = output_path / f"upscaled_{img_file.name}"
        upscale_image(str(img_file), str(output_file), scale)
    
    print("\n" + "=" * 50)
    print(f"Completed! Upscaled {len(image_files)} images")


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  Single image: python3 upscale_realesrgan.py input.png [output.png] [scale]")
        print("  Directory:    python3 upscale_realesrgan.py input_dir/ output_dir/ [scale]")
        print("\nExamples:")
        print("  python3 upscale_realesrgan.py image.png")
        print("  python3 upscale_realesrgan.py image.png upscaled.png")
        print("  python3 upscale_realesrgan.py image.png upscaled.png 2")
        print("  python3 upscale_realesrgan.py converted/ upscaled/ 4")
        sys.exit(1)
    
    input_path = sys.argv[1]
    
    # Determine scale
    scale = 4
    if len(sys.argv) >= 4:
        try:
            scale = int(sys.argv[3])
        except ValueError:
            print(f"Warning: Invalid scale '{sys.argv[3]}', using default 4x")
    
    # Check if input is directory or file
    if os.path.isdir(input_path):
        # Directory mode
        output_path = sys.argv[2] if len(sys.argv) >= 3 else input_path + '_upscaled'
        upscale_directory(input_path, output_path, scale)
    else:
        # Single file mode
        if len(sys.argv) >= 3 and not sys.argv[2].isdigit():
            output_path = sys.argv[2]
        else:
            # Generate output filename
            input_file = Path(input_path)
            output_path = str(input_file.parent / f"upscaled_{input_file.name}")
        
        upscale_image(input_path, output_path, scale)


if __name__ == "__main__":
    main()
