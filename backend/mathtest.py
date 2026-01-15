#!/usr/bin/env python3
"""
Click-based annotation remover - VISUAL VERSION
All objects are shown in RED outlines so you can see them
"""

import cv2
import numpy as np
import sys
from pathlib import Path

MIN_AREA = 50
MAX_AREA = 200000

class ClickRemover:
    def __init__(self, image_path):
        self.original = cv2.imread(str(image_path))
        if self.original is None:
            raise ValueError(f"Cannot load {image_path}")
        
        self.img = self.original.copy()
        
        # Find all objects - try multiple thresholds
        gray = cv2.cvtColor(self.img, cv2.COLOR_BGR2GRAY)
        
        # Debug: save binary image
        _, binary = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY_INV)
        cv2.imwrite('/tmp/debug_binary.png', binary)
        print(f"DEBUG: Saved binary image to /tmp/debug_binary.png")
        
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        print(f"DEBUG: Found {len(contours)} total contours before filtering")
        
        # Filter by area and store with info
        self.contours = []
        for i, cnt in enumerate(contours):
            area = cv2.contourArea(cnt)
            if MIN_AREA < area < MAX_AREA:
                self.contours.append(cnt)
                x, y, w, h = cv2.boundingRect(cnt)
                if i < 10:  # Show first 10
                    print(f"  Object {len(self.contours)-1}: area={area:.0f}, pos=({x},{y}), size={w}x{h}")
        
        self.prototype_idx = None
        self.selected = []
        
        print(f"\n✓ Found {len(self.contours)} objects (filtered {MIN_AREA}-{MAX_AREA} pixels)")
        if len(self.contours) == 0:
            print("⚠ WARNING: No objects found! Try adjusting MIN_AREA/MAX_AREA")
        else:
            print("You should see RED outlines on all objects")
    
    def find_at_point(self, x, y):
        """Find contour at click - with bigger search radius"""
        # Try exact point first
        for i, cnt in enumerate(self.contours):
            if cv2.pointPolygonTest(cnt, (float(x), float(y)), False) >= 0:
                return i
        
        # Try nearby points (10 pixel radius)
        for radius in [5, 10, 15]:
            for dx in range(-radius, radius+1, 5):
                for dy in range(-radius, radius+1, 5):
                    px, py = x + dx, y + dy
                    for i, cnt in enumerate(self.contours):
                        if cv2.pointPolygonTest(cnt, (float(px), float(py)), False) >= 0:
                            print(f"Found object {i} at offset ({dx},{dy})")
                            return i
        return None
    
    def find_similar(self, proto_idx, threshold=0.15):
        """Find similar shapes"""
        proto = self.contours[proto_idx]
        similar = [proto_idx]
        
        for i, cnt in enumerate(self.contours):
            if i == proto_idx:
                continue
            score = cv2.matchShapes(proto, cnt, cv2.CONTOURS_MATCH_I1, 0)
            if score < threshold:
                similar.append(i)
                print(f"  Match: object {i}, score={score:.4f}")
        
        return similar
    
    def get_display(self):
        """Create display image with overlays"""
        display = self.img.copy()
        
        # Draw ALL objects in RED so user can see them
        cv2.drawContours(display, self.contours, -1, (0, 0, 255), 2)
        
        # Draw selected in GREEN
        for idx in self.selected:
            if idx < len(self.contours):
                cv2.drawContours(display, [self.contours[idx]], -1, (0, 255, 0), 3)
        
        # Draw prototype in BLUE (thicker)
        if self.prototype_idx is not None:
            cv2.drawContours(display, [self.contours[self.prototype_idx]], -1, (255, 0, 0), 4)
        
        # Add text instructions
        cv2.putText(display, "All objects in RED | Selected in GREEN | Prototype in BLUE", 
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        cv2.putText(display, f"Found {len(self.contours)} objects | Selected: {len(self.selected)}", 
                    (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        return display
    
    def remove_selected(self):
        """Inpaint selected"""
        if not self.selected:
            print("⚠ Nothing selected")
            return
        
        mask = np.zeros(self.img.shape[:2], np.uint8)
        for idx in self.selected:
            cv2.drawContours(mask, [self.contours[idx]], -1, 255, -1)
        
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        mask = cv2.dilate(mask, kernel, iterations=2)
        
        self.img = cv2.inpaint(self.img, mask, 7, cv2.INPAINT_TELEA)
        
        print(f"✓ Removed {len(self.selected)} objects")
        
        # Reset and re-find
        self.selected = []
        self.prototype_idx = None
        
        gray = cv2.cvtColor(self.img, cv2.COLOR_BGR2GRAY)
        _, binary = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        self.contours = [c for c in contours if MIN_AREA < cv2.contourArea(c) < MAX_AREA]
        print(f"✓ Re-found {len(self.contours)} objects")
    
    def mouse_callback(self, event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            print(f"\n🖱️ Clicked at ({x}, {y})")
            print(f"   Total objects in list: {len(self.contours)}")
            
            idx = self.find_at_point(x, y)
            if idx is not None:
                self.prototype_idx = idx
                self.selected = [idx]
                print(f"✓ Selected object #{idx} as prototype (BLUE)")
                print("  Press 'F' to find similar objects")
                cv2.imshow('Click Remover - RED=all, BLUE=prototype, GREEN=selected', self.get_display())
            else:
                print("⚠ No object found at that location")
                print("  Searching nearby points...")
                # Show which contours are closest
                min_dist = float('inf')
                closest_idx = None
                for i, cnt in enumerate(self.contours):
                    M = cv2.moments(cnt)
                    if M["m00"] != 0:
                        cx = int(M["m10"] / M["m00"])
                        cy = int(M["m01"] / M["m00"])
                        dist = np.sqrt((cx - x)**2 + (cy - y)**2)
                        if dist < min_dist:
                            min_dist = dist
                            closest_idx = i
                if closest_idx is not None:
                    print(f"  Closest object is #{closest_idx} at {min_dist:.0f} pixels away")
                    print(f"  Try clicking closer to the RED outlines!")
    
    def run(self):
        print("\n" + "="*70)
        print("CLICK anywhere on a RED object to select it")
        print("Press 'F' - Find similar shapes (they turn GREEN)")
        print("Press 'D' - Delete all selected (GREEN + BLUE)")
        print("Press 'C' - Clear selection")
        print("Press 'S' - Save result")
        print("Press 'Q' - Quit")
        print("="*70 + "\n")
        
        window = 'Click Remover - RED=all, BLUE=prototype, GREEN=selected'
        cv2.namedWindow(window, cv2.WINDOW_NORMAL)
        cv2.setMouseCallback(window, self.mouse_callback)
        
        cv2.imshow(window, self.get_display())
        
        while True:
            key = cv2.waitKey(1) & 0xFF
            
            if key == ord('f'):
                if self.prototype_idx is not None:
                    print(f"\n🔍 Finding shapes similar to object #{self.prototype_idx}...")
                    self.selected = self.find_similar(self.prototype_idx)
                    print(f"✓ Found {len(self.selected)} similar objects (now GREEN)")
                    cv2.imshow(window, self.get_display())
                else:
                    print("⚠ Click on a RED object first!")
            
            elif key == ord('d'):
                self.remove_selected()
                cv2.imshow(window, self.get_display())
            
            elif key == ord('c'):
                self.selected = []
                self.prototype_idx = None
                print("✓ Cleared selection")
                cv2.imshow(window, self.get_display())
            
            elif key == ord('s'):
                out = Path(sys.argv[1]).parent / f"{Path(sys.argv[1]).stem}_cleaned.png"
                cv2.imwrite(str(out), self.img)
                print(f"💾 Saved to {out}")
            
            elif key == ord('q'):
                break
        
        cv2.destroyAllWindows()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 mathtest.py <image_path>")
        sys.exit(1)
    
    try:
        remover = ClickRemover(sys.argv[1])
        remover.run()
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
