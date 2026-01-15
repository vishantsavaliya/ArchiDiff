#!/usr/bin/env python3
"""
SAM-based Interactive Annotation Remover
Click on any arrow/annotation and SAM will segment it automatically.
Press 'Delete' or 'D' to remove selected items.
"""

import cv2
import numpy as np
import sys
import os
from pathlib import Path
import urllib.request

# Check if mobile_sam is available
try:
    from mobile_sam import sam_model_registry, SamPredictor
except ImportError:
    print("Error: mobile-sam not installed. Run: pip install git+https://github.com/ChaoningZhang/MobileSAM.git")
    sys.exit(1)

# --- CONFIGURATION ---
SELECTION_COLOR = (0, 255, 0)  # Green for selected items
MODEL_TYPE = "vit_t"  # MobileSAM uses vit_t (tiny) - much lighter than vit_b
MODEL_URL = "https://github.com/ChaoningZhang/MobileSAM/raw/master/weights/mobile_sam.pt"
MODEL_PATH = "mobile_sam.pt"
ZOOM_FACTOR = 0.2  # Zoom increment per key press
MIN_ZOOM = 0.5
MAX_ZOOM = 5.0
MAX_LINE_AREA = 500000  # Maximum pixels for a line/annotation (increased for long lines)
MAX_ASPECT_RATIO = 50  # Allow very long thin lines (length/width ratio)
BACKGROUND_COLOR = (255, 255, 255)  # White background
# ---------------------

def download_sam_model(model_path, model_url):
    """Download MobileSAM model if not present"""
    if os.path.exists(model_path):
        print(f"Model already downloaded: {model_path}")
        return
    
    print(f"Downloading MobileSAM model (~40MB)...")
    print(f"From: {model_url}")
    
    def progress_callback(block_num, block_size, total_size):
        downloaded = block_num * block_size
        percent = min(100, (downloaded / total_size) * 100)
        mb_downloaded = downloaded / (1024 * 1024)
        mb_total = total_size / (1024 * 1024)
        print(f"\rDownloading: {mb_downloaded:.1f}/{mb_total:.1f} MB ({percent:.1f}%)", end="")
    
    try:
        urllib.request.urlretrieve(model_url, model_path, progress_callback)
        print(f"\n✓ Model downloaded successfully: {model_path}")
    except Exception as e:
        print(f"\n✗ Error downloading model: {e}")
        sys.exit(1)


class SAMRemover:
    def __init__(self, image_path, model_path):
        self.image_path = image_path
        self.original_img = cv2.imread(str(image_path))
        
        if self.original_img is None:
            raise ValueError(f"Error: Could not load image {image_path}")
        
        self.img = self.original_img.copy()
        self.display_img = self.img.copy()
        self.selected_masks = []
        self.zoom = 1.0
        self.pan_x = 0
        self.pan_y = 0
        
        print(f"Loaded image: {image_path}")
        print(f"Image size: {self.img.shape[1]}x{self.img.shape[0]}")
        
        # Initialize MobileSAM
        print("Loading MobileSAM model...")
        try:
            sam = sam_model_registry[MODEL_TYPE](checkpoint=model_path)
            self.predictor = SamPredictor(sam)
            
            # Convert to RGB for SAM
            image_rgb = cv2.cvtColor(self.img, cv2.COLOR_BGR2RGB)
            self.predictor.set_image(image_rgb)
            print("✓ MobileSAM model loaded successfully")
        except Exception as e:
            raise RuntimeError(f"Failed to load MobileSAM model: {e}")
    
    def segment_at_point(self, x, y):
        """Use SAM to segment object at clicked point"""
        # Adjust coordinates for zoom
        actual_x = int((x - self.pan_x) / self.zoom)
        actual_y = int((y - self.pan_y) / self.zoom)
        
        # Check bounds
        if actual_x < 0 or actual_x >= self.img.shape[1] or actual_y < 0 or actual_y >= self.img.shape[0]:
            print(f"Click out of bounds: ({actual_x}, {actual_y})")
            return None
        
        # Create point prompt for SAM
        input_point = np.array([[actual_x, actual_y]])
        input_label = np.array([1])  # 1 = foreground point
        
        try:
            # Get segmentation mask from SAM
            masks, scores, logits = self.predictor.predict(
                point_coords=input_point,
                point_labels=input_label,
                multimask_output=True  # Get 3 masks and pick the best
            )
            
            # Pick the mask with highest score
            best_mask_idx = np.argmax(scores)
            mask = masks[best_mask_idx]
            score = scores[best_mask_idx]
            
            # Convert to uint8
            mask_uint8 = (mask * 255).astype(np.uint8)
            
            # Check if mask is valid (not too large or too small)
            area = cv2.countNonZero(mask_uint8)
            img_area = self.img.shape[0] * self.img.shape[1]
            
            if area < 10:
                print(f"Mask too small (area: {area})")
                return None
            
            # Get bounding box and check if it's a line-like shape
            contours, _ = cv2.findContours(mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if len(contours) > 0:
                x, y, w, h = cv2.boundingRect(contours[0])
                aspect_ratio = max(w, h) / max(min(w, h), 1)
                
                # Allow if it's line-like (high aspect ratio) even if large area
                if aspect_ratio > 5:  # It's a line
                    print(f"✓ Segmented line: area={area} pixels, size={w}x{h}, aspect={aspect_ratio:.1f}, confidence={score:.2f}")
                    return mask_uint8
            
            # Otherwise check area limit
            if area > MAX_LINE_AREA:
                print(f"Component too large (area: {area}) - try clicking directly on the line")
                return None
            
            # Check if selecting too much of the image (likely background)
            if area > img_area * 0.2:
                print(f"Selected {area/img_area*100:.1f}% of image - click on annotation, not background")
                return None
            
            print(f"✓ Segmented object: area={area} pixels, confidence={score:.2f}")
            return mask_uint8
            
        except Exception as e:
            print(f"Segmentation failed: {e}")
            return None
    
    def update_display(self):
        """Update display with selected components highlighted"""
        self.display_img = self.img.copy()
        
        # Overlay selected masks in green
        for mask in self.selected_masks:
            self.display_img[mask > 0] = SELECTION_COLOR
        
        # Apply zoom
        if self.zoom != 1.0:
            h, w = self.display_img.shape[:2]
            new_w = int(w * self.zoom)
            new_h = int(h * self.zoom)
            self.display_img = cv2.resize(self.display_img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
    
    def mouse_callback(self, event, x, y, flags, param):
        """Mouse callback for clicking"""
        if event == cv2.EVENT_LBUTTONDOWN:
            print(f"Processing click at ({x}, {y})...")
            mask = self.segment_at_point(x, y)
            
            if mask is not None:
                # Check if already selected (deselect if so)
                already_selected = False
                for i, existing_mask in enumerate(self.selected_masks):
                    if np.array_equal(mask, existing_mask):
                        self.selected_masks.pop(i)
                        already_selected = True
                        print(f"Deselected component (Total: {len(self.selected_masks)})")
                        break
                
                if not already_selected:
                    self.selected_masks.append(mask)
                    print(f"Selected component (Total: {len(self.selected_masks)})")
                
                self.update_display()
    
    def remove_selected(self):
        """Remove all selected components"""
        if not self.selected_masks:
            print("No components selected!")
            return
        
        # Combine all selected masks
        combined_mask = np.zeros(self.img.shape[:2], np.uint8)
        for mask in self.selected_masks:
            combined_mask = cv2.bitwise_or(combined_mask, mask)
        
        # Dilate slightly to cover edges
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        combined_mask = cv2.dilate(combined_mask, kernel, iterations=1)
        
        # Fill with background color (no blur)
        self.img[combined_mask > 0] = BACKGROUND_COLOR
        
        # Update SAM with new image
        image_rgb = cv2.cvtColor(self.img, cv2.COLOR_BGR2RGB)
        self.predictor.set_image(image_rgb)
        
        # Clear selections
        count = len(self.selected_masks)
        self.selected_masks = []
        self.update_display()
        
        print(f"✓ Removed {count} component(s)")
    
    def run(self):
        """Run the interactive removal tool"""
        window_name = 'MobileSAM Remover - Click to select, D to delete'
        cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
        cv2.setMouseCallback(window_name, self.mouse_callback)
        
        print("\n" + "="*60)
        print("INSTRUCTIONS:")
        print("="*60)
        print("1. Press 'Y' to ZOOM IN, 'U' to ZOOM OUT")
        print("2. CLICK on lines/arrows - SAM segments them (green)")
        print("3. Click again on green item to DESELECT")
        print("4. Press 'D' or Delete to REMOVE selected items (white fill)")
        print("5. Press 'C' to CLEAR selection")
        print("6. Press 'S' to SAVE")
        print("7. Press 'R' to RESET")
        print("8. Press 'Q' to QUIT")
        print("="*60 + "\n")
        
        while True:
            cv2.imshow(window_name, self.display_img)
            k = cv2.waitKey(1) & 0xFF
            
            if k == ord('y'):  # Zoom in
                self.zoom = min(self.zoom + ZOOM_FACTOR, MAX_ZOOM)
                self.update_display()
                print(f"Zoom: {self.zoom:.1f}x")
            
            elif k == ord('u'):  # Zoom out
                self.zoom = max(self.zoom - ZOOM_FACTOR, MIN_ZOOM)
                self.update_display()
                print(f"Zoom: {self.zoom:.1f}x")
            
            elif k == ord('d') or k == 127:
                self.remove_selected()
            
            elif k == ord('c'):
                self.selected_masks = []
                self.update_display()
                print("✓ Cleared selection")
            
            elif k == ord('s'):
                output_path = Path(self.image_path).parent / f"{Path(self.image_path).stem}_sam_cleaned{Path(self.image_path).suffix}"
                cv2.imwrite(str(output_path), self.img)
                print(f"✓ Saved as: {output_path}")
            
            elif k == ord('r'):
                self.img = self.original_img.copy()
                image_rgb = cv2.cvtColor(self.img, cv2.COLOR_BGR2RGB)
                self.predictor.set_image(image_rgb)
                self.selected_masks = []
                self.update_display()
                print("✓ Reset to original")
            
            elif k == ord('q'):
                print("Exiting...")
                break
        
        cv2.destroyAllWindows()


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 sam_remover.py <image_path>")
        print("\nExample:")
        print("  python3 sam_remover.py examples/cleaned_Sheet-600_FIRE_EXTINGUISHER_CABINET.png")
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not Path(image_path).exists():
        print(f"Error: Image file not found: {image_path}")
        sys.exit(1)
    
    # Download model if needed
    download_sam_model(MODEL_PATH, MODEL_URL)
    
    try:
        remover = SAMRemover(image_path, MODEL_PATH)
        remover.run()
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
