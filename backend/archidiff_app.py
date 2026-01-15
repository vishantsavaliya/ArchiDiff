#!/usr/bin/env python3
"""
ArchiDiff - Structure-Only Visual Comparison Tool for Architectural Drawings
============================================================================
Compares two architectural details by removing text/annotations and overlaying
them with color tinting (Green for Reference, Pink for Comparison).

Author: Senior CV Engineer
Tech Stack: Streamlit, OpenCV, PaddleOCR, PyMuPDF
"""

import streamlit as st
import cv2
import numpy as np
import fitz  # PyMuPDF
from PIL import Image
from io import BytesIO
from paddleocr import PaddleOCR
import tempfile
from pathlib import Path

# ============================================================================
# Configuration
# ============================================================================

PDF_DPI = 3.0  # 300 DPI for PDF rendering
INPAINT_RADIUS = 7  # Inpainting radius for text removal
MASK_DILATION_KERNEL = (5, 5)  # Kernel size for mask dilation

# ============================================================================
# File Loading Functions
# ============================================================================

def load_file(uploaded_file):
    """
    Load and convert uploaded file (PDF or PNG) to NumPy array.
    
    Args:
        uploaded_file: Streamlit UploadedFile object
        
    Returns:
        numpy.ndarray: BGR image array
    """
    file_extension = Path(uploaded_file.name).suffix.lower()
    
    try:
        if file_extension == '.pdf':
            # Handle PDF: Render first page at high DPI
            pdf_bytes = uploaded_file.read()
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            if len(doc) == 0:
                st.error(f"PDF file '{uploaded_file.name}' has no pages")
                return None
            
            # Render first page
            page = doc[0]
            mat = fitz.Matrix(PDF_DPI, PDF_DPI)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            
            # Convert to NumPy array (RGB)
            img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
                pix.height, pix.width, pix.n
            )
            
            # Convert RGB to BGR for OpenCV
            if pix.n == 3:
                img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
            
            doc.close()
            return img_array
            
        elif file_extension in ['.png', '.jpg', '.jpeg']:
            # Handle image files
            img_bytes = uploaded_file.read()
            img_array = np.frombuffer(img_bytes, dtype=np.uint8)
            img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            
            if img is None:
                st.error(f"Failed to decode image '{uploaded_file.name}'")
                return None
            
            return img
        else:
            st.error(f"Unsupported file format: {file_extension}")
            return None
            
    except Exception as e:
        st.error(f"Error loading file '{uploaded_file.name}': {str(e)}")
        return None

# ============================================================================
# Text Removal Pipeline
# ============================================================================

@st.cache_resource
def get_ocr_model():
    """
    Initialize PaddleOCR model (cached to avoid reloading).
    
    Returns:
        PaddleOCR: Initialized OCR model
    """
    return PaddleOCR(
        use_textline_orientation=True,  # Detect rotated text
        lang='en'                        # English language
    )

def remove_annotations(image):
    """
    Remove text and annotations from architectural drawing using OCR + Inpainting.
    
    Pipeline:
    1. Detect text bounding boxes using PaddleOCR
    2. Create binary mask from bounding boxes
    3. Dilate mask to cover text edges
    4. Use cv2.inpaint (Telea) to fill masked regions
    
    Args:
        image: Input image (BGR numpy array)
        
    Returns:
        numpy.ndarray: Cleaned image with text removed
    """
    if image is None:
        return None
    
    # Initialize OCR
    ocr = get_ocr_model()
    
    # Create mask for inpainting
    mask = np.zeros(image.shape[:2], dtype=np.uint8)
    
    # Run OCR detection
    try:
        # PaddleOCR expects RGB
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = ocr.predict(rgb_image)
        
        if results is None or len(results) == 0 or results[0] is None:
            # No text detected - return original
            return image
        
        # Extract bounding boxes
        num_detections = 0
        for line in results[0]:
            if line is None:
                continue
            
            # Extract box coordinates
            box = line[0]  # [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
            
            # Convert to integer coordinates
            pts = np.array(box, dtype=np.int32)
            
            # Fill polygon on mask
            cv2.fillPoly(mask, [pts], 255)
            num_detections += 1
        
        if num_detections == 0:
            return image
        
        # Dilate mask to cover text edges
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, MASK_DILATION_KERNEL)
        mask = cv2.dilate(mask, kernel, iterations=1)
        
        # Inpaint to remove text
        cleaned = cv2.inpaint(image, mask, INPAINT_RADIUS, cv2.INPAINT_TELEA)
        
        return cleaned
        
    except Exception as e:
        st.warning(f"OCR processing failed: {str(e)}. Returning original image.")
        return image

# ============================================================================
# Image Alignment & Normalization
# ============================================================================

def align_images(img_a, img_b):
    """
    Resize images to match dimensions (use img_a as reference).
    
    Args:
        img_a: Reference image
        img_b: Comparison image
        
    Returns:
        tuple: (aligned_img_a, aligned_img_b)
    """
    if img_a is None or img_b is None:
        return None, None
    
    # Get reference dimensions
    h_ref, w_ref = img_a.shape[:2]
    h_cmp, w_cmp = img_b.shape[:2]
    
    # Warn if aspect ratios are very different
    aspect_ref = w_ref / h_ref
    aspect_cmp = w_cmp / h_cmp
    
    if abs(aspect_ref - aspect_cmp) > 0.3:
        st.warning(
            f"⚠️ Images have different aspect ratios:\n"
            f"- Reference: {aspect_ref:.2f}\n"
            f"- Comparison: {aspect_cmp:.2f}\n"
            f"Overlay may be distorted."
        )
    
    # Resize comparison image to match reference
    if (h_cmp, w_cmp) != (h_ref, w_ref):
        img_b_aligned = cv2.resize(img_b, (w_ref, h_ref), interpolation=cv2.INTER_AREA)
    else:
        img_b_aligned = img_b.copy()
    
    return img_a.copy(), img_b_aligned

# ============================================================================
# Pink/Green Overlay Logic
# ============================================================================

def create_structure_overlay(img_a, img_b):
    """
    Create color-tinted overlay: Green for A, Pink for B.
    
    Strategy:
    1. Convert both images to grayscale
    2. Invert (so lines are white on black)
    3. Create RGB composite:
       - Green channel = Image A
       - Red channel = Image B
       - Blue channel = 0
    4. Overlapping structures blend to yellow/white
    
    Args:
        img_a: Cleaned reference image (BGR)
        img_b: Cleaned comparison image (BGR)
        
    Returns:
        numpy.ndarray: RGB overlay image
    """
    # Convert to grayscale
    gray_a = cv2.cvtColor(img_a, cv2.COLOR_BGR2GRAY)
    gray_b = cv2.cvtColor(img_b, cv2.COLOR_BGR2GRAY)
    
    # Invert: lines become white (255), background becomes black (0)
    inv_a = cv2.bitwise_not(gray_a)
    inv_b = cv2.bitwise_not(gray_b)
    
    # Normalize to 0-1 range for better blending
    inv_a_norm = inv_a.astype(np.float32) / 255.0
    inv_b_norm = inv_b.astype(np.float32) / 255.0
    
    # Create RGB composite
    h, w = inv_a.shape
    overlay = np.zeros((h, w, 3), dtype=np.float32)
    
    # Channel assignment:
    overlay[:, :, 0] = 0                # Blue = 0
    overlay[:, :, 1] = inv_a_norm      # Green = Image A
    overlay[:, :, 2] = inv_b_norm      # Red = Image B
    
    # Convert back to 0-255 range
    overlay = (overlay * 255).astype(np.uint8)
    
    # Convert BGR to RGB for display
    overlay_rgb = cv2.cvtColor(overlay, cv2.COLOR_BGR2RGB)
    
    return overlay_rgb

# ============================================================================
# Utility Functions
# ============================================================================

def image_to_bytes(image, format='PNG'):
    """Convert NumPy image to bytes for download."""
    pil_img = Image.fromarray(image)
    buf = BytesIO()
    pil_img.save(buf, format=format)
    return buf.getvalue()

# ============================================================================
# Streamlit UI
# ============================================================================

def main():
    # Page configuration
    st.set_page_config(
        page_title="ArchiDiff - Structure Comparison",
        page_icon="📐",
        layout="wide"
    )
    
    # Title and description
    st.title("📐 ArchiDiff - Structure-Only Visual Comparison")
    st.markdown("""
    Compare two architectural drawings by overlaying them with color tinting:
    - **Green** = Reference Detail (A)
    - **Pink** = Comparison Detail (B)
    - **Yellow/White** = Overlapping structures
    
    Text and annotations are automatically removed to focus on geometry.
    """)
    
    # Sidebar: File uploaders
    st.sidebar.header("📂 Upload Drawings")
    
    file_a = st.sidebar.file_uploader(
        "Reference Detail (A)",
        type=['pdf', 'png', 'jpg', 'jpeg'],
        help="Upload the reference drawing (PDF or PNG)"
    )
    
    file_b = st.sidebar.file_uploader(
        "Comparison Detail (B)",
        type=['pdf', 'png', 'jpg', 'jpeg'],
        help="Upload the comparison drawing (PDF or PNG)"
    )
    
    # Processing options
    st.sidebar.header("⚙️ Options")
    remove_text = st.sidebar.checkbox(
        "Remove Text/Annotations",
        value=True,
        help="Use OCR to detect and remove text before comparison"
    )
    
    # Main processing
    if file_a and file_b:
        # Load files
        with st.spinner("Loading files..."):
            img_a = load_file(file_a)
            img_b = load_file(file_b)
        
        if img_a is None or img_b is None:
            st.error("Failed to load one or both files. Please check the format.")
            return
        
        st.success(f"✓ Loaded: {file_a.name} ({img_a.shape[1]}×{img_a.shape[0]}) and {file_b.name} ({img_b.shape[1]}×{img_b.shape[0]})")
        
        # Process button
        if st.button("🚀 Process & Compare", type="primary"):
            # Text removal (expensive operation)
            if remove_text:
                with st.spinner("Removing text and annotations (this may take 30-60 seconds)..."):
                    col1, col2 = st.columns(2)
                    
                    with col1:
                        st.info("Processing Reference (A)...")
                        cleaned_a = remove_annotations(img_a)
                    
                    with col2:
                        st.info("Processing Comparison (B)...")
                        cleaned_b = remove_annotations(img_b)
                
                st.success("✓ Text removal complete!")
            else:
                cleaned_a = img_a
                cleaned_b = img_b
            
            # Align images
            with st.spinner("Aligning images..."):
                aligned_a, aligned_b = align_images(cleaned_a, cleaned_b)
            
            if aligned_a is None or aligned_b is None:
                st.error("Failed to align images.")
                return
            
            # Create overlay
            with st.spinner("Creating structure overlay..."):
                overlay = create_structure_overlay(aligned_a, aligned_b)
            
            # Display results
            st.header("📊 Results")
            
            # Show overlay prominently
            st.subheader("Structure Overlay")
            st.image(overlay, caption="Green=Reference, Pink=Comparison, Yellow/White=Overlap", use_container_width=True)
            
            # Show side-by-side comparison
            st.subheader("Side-by-Side Comparison")
            col1, col2, col3 = st.columns(3)
            
            with col1:
                st.image(cv2.cvtColor(aligned_a, cv2.COLOR_BGR2RGB), caption="Reference (A)", use_container_width=True)
            
            with col2:
                st.image(cv2.cvtColor(aligned_b, cv2.COLOR_BGR2RGB), caption="Comparison (B)", use_container_width=True)
            
            with col3:
                st.image(overlay, caption="Overlay", use_container_width=True)
            
            # Download button
            st.subheader("💾 Download Result")
            overlay_bytes = image_to_bytes(overlay, format='PNG')
            st.download_button(
                label="Download Overlay Image",
                data=overlay_bytes,
                file_name="archidiff_overlay.png",
                mime="image/png"
            )
            
            # Statistics
            st.subheader("📈 Statistics")
            col1, col2 = st.columns(2)
            
            with col1:
                st.metric("Reference Size", f"{aligned_a.shape[1]} × {aligned_a.shape[0]}")
            
            with col2:
                st.metric("Comparison Size", f"{aligned_b.shape[1]} × {aligned_b.shape[0]}")
    
    else:
        # Instructions when no files uploaded
        st.info("👈 Upload two drawings in the sidebar to begin comparison.")
        
        # Show example
        st.subheader("How It Works")
        st.markdown("""
        1. **Upload** two architectural drawings (PDF or PNG)
        2. **Process** to remove text and annotations using OCR
        3. **Compare** structures with color-coded overlay:
           - Green = Only in Reference (A)
           - Pink = Only in Comparison (B)
           - Yellow/White = Present in both
        4. **Download** the result for documentation
        """)

# ============================================================================
# Entry Point
# ============================================================================

if __name__ == "__main__":
    main()
