# ArchiDiff: Technical Approach & Implementation

## The "Founding Engineer" Workflow for Architectural Comparison

This document explains the professional approach used in ArchiDiff to create clean, accurate overlays of architectural drawings.

---

## 🎯 The Challenge

Architectural PDF drawings contain precise vector lines representing walls, doors, elevators, and fixtures. Traditional image processing with edge detection (Canny) creates **double lines** for every wall because edges detect both sides of a structure. This creates thick, messy overlays that are hard to interpret.

**The Solution:** **Skeletonization** - reducing every structure to its exact single-pixel centerline.

---

## 📚 The Technology Stack

### 1. **PyMuPDF (fitz)** - PDF Extraction

**Why:** It's the only library that can extract raw vector paths (`page.get_drawings()`) directly from PDFs.

```python
# Extract at 400 DPI for maximum architectural detail
mat = fitz.Matrix(4.0, 4.0)  # 4x zoom = 400 DPI
pix = pdf_page.get_pixmap(matrix=mat, alpha=False)
```

**Key Advantage:** Preserves the precision of architectural drawings with high-resolution rasterization.

### 2. **scikit-image** - Structural Processing

**Why:** Its `skeletonize` and `medial_axis` functions are superior to OpenCV for architectural drawings.

```python
from skimage.morphology import skeletonize
from skimage.filters import threshold_otsu

# Automatic thresholding
thresh_value = threshold_otsu(inverted_image)
binary = inverted_image > thresh_value

# Reduce to 1-pixel centerlines
skeleton = skeletonize(binary)
```

**Key Advantage:** Produces true mathematical skeletons - single-pixel centerlines that preserve topology.

### 3. **OpenCV (cv2)** - Image Management & Overlaying

**Why:** Best for the final coloring and overlaying operations.

```python
# Color each skeleton differently
color_img1[mask1] = (0, 255, 0)      # Green
color_img2[mask2] = (255, 100, 150)  # Pink

# Overlay with blending
overlay = cv2.addWeighted(color_img1, 0.5, color_img2, 0.5, 0)
```

**Key Advantage:** Fast, efficient blending where overlaps merge and differences stand out.

---

## 🔬 The Three-Step Workflow

### Step A: Extract High-Resolution Paths

```python
@app.get("/api/skeletonize/{filename}")
async def skeletonize_drawing(filename: str):
    # Extract PDF at 400 DPI
    mat = fitz.Matrix(4.0, 4.0)
    pix = pdf_page.get_pixmap(matrix=mat, alpha=False)

    # Convert to numpy array
    img = np.frombuffer(pix.samples, dtype=np.uint8)
```

**Why 400 DPI?**

- Architectural details have tiny lines (1-2mm thick on paper)
- At 72 DPI, these become 1-2 pixels and disappear
- At 400 DPI, we capture every detail for accurate skeletonization

### Step B: Skeletonization (The Key)

```python
# Invert image (lines become white on black)
inverted = cv2.bitwise_not(gray)

# Automatic thresholding
thresh_value = threshold_otsu(inverted)
binary = inverted > thresh_value

# Skeletonize - reduces walls to exact centerlines
skeleton = skeletonize(binary)
```

**What Skeletonization Does:**

- Iteratively removes boundary pixels
- Preserves topology (connectivity)
- Results in exact 1-pixel wide centerlines
- No more "double lines" from edge detection

**Comparison:**

- ❌ **Canny Edge Detection:** Detects both edges of a wall → 2 parallel lines
- ✅ **Skeletonization:** Finds the medial axis → 1 centerline

### Step C: Vectorization & Coloring

```python
@app.get("/api/overlay/{file1}/{file2}")
async def create_overlay(file1: str, file2: str):
    # Extract both skeletons
    skeleton1 = extract_skeleton(file1_path)
    skeleton2 = extract_skeleton(file2_path)

    # Create colored versions
    color_img1[skeleton1 < 128] = (0, 255, 0)      # Green
    color_img2[skeleton2 < 128] = (255, 100, 150)  # Pink

    # Overlay with 50/50 blending
    overlay = cv2.addWeighted(color_img1, 0.5, color_img2, 0.5, 0)
```

**The Magic:**

- **Perfect Overlap:** Green + Pink = Blended color (shows similarity)
- **Differences:** Pure green or pure pink (shows what's unique to each drawing)
- **Visual Pop:** The eye immediately sees what's different

---

## 🎨 Color Theory for Overlays

### Recommended Color Combinations

1. **Green + Pink** (Default)

   - Overlap: Yellowish-gray
   - Best for: General comparison
   - Why: High contrast, culturally neutral

2. **Red + Blue**

   - Overlap: Purple
   - Best for: Engineering reviews
   - Why: Traditional "redline" + blueprint association

3. **Cyan + Yellow**
   - Overlap: Green
   - Best for: Print-friendly versions
   - Why: CMYK complementary colors

---

## 📊 API Endpoints

### 1. `/api/skeletonize/{filename}`

**Purpose:** Convert PDF to clean 1-pixel skeleton

**Parameters:**

- `filename`: PDF file name
- `page`: Page number (default: 0)

**Returns:** PNG image (grayscale, 400 DPI)

**Headers:**

```
X-DPI: 400
X-Processing: skeletonized
Cache-Control: public, max-age=3600
```

**Example:**

```bash
curl -o skeleton.png "http://localhost:8000/api/skeletonize/elevator.pdf?page=0"
```

### 2. `/api/overlay/{file1}/{file2}`

**Purpose:** Create professional pink/green overlay

**Parameters:**

- `file1`: First PDF filename
- `file2`: Second PDF filename
- `color1`: Color for first detail (default: green)
- `color2`: Color for second detail (default: pink)

**Supported Colors:** green, red, blue, pink, cyan, yellow

**Returns:** PNG image (RGB, 400 DPI)

**Example:**

```bash
curl -o overlay.png "http://localhost:8000/api/overlay/detail1.pdf/detail2.pdf?color1=green&color2=pink"
```

---

## 🔍 Advanced: SSIM Analysis

In addition to visual overlay, ArchiDiff uses **Structural Similarity Index (SSIM)** for mathematical comparison.

```python
from skimage.metrics import structural_similarity as ssim

# Calculate similarity (0 = different, 1 = identical)
score, diff = ssim(gray1, gray2, full=True)

# Analyze different regions
difference_area = np.sum(diff < 0.5) / diff.size * 100
```

**What SSIM Tells You:**

- **>95%:** Essentially identical (minor annotation changes only)
- **85-95%:** Very similar (same design, small variations)
- **70-85%:** Similar (same concept, moderate differences)
- **<70%:** Different designs

---

## 🚀 Performance Optimizations

### 1. **Caching**

All processed images are cached with HTTP headers:

```python
headers={"Cache-Control": "public, max-age=3600"}
```

### 2. **High DPI Processing**

Processing time for 400 DPI:

- Elevator detail: ~2-3 seconds
- Complex floor plan: ~5-8 seconds

### 3. **Streaming Response**

Images stream directly without disk writes:

```python
return StreamingResponse(
    io.BytesIO(buffer.tobytes()),
    media_type="image/png"
)
```

---

## 📈 Future Enhancements

### 1. **DeepLSD Integration** (Optional)

For very messy/scanned drawings:

```python
from deeplsd import DeepLSD
model = DeepLSD()
lines = model.predict(image)
```

**Use Case:** Hand-drawn sketches, poor-quality scans

### 2. **Vector Output**

Convert skeleton back to SVG paths:

```python
# Trace skeleton to vector paths
contours = cv2.findContours(skeleton, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
# Convert to SVG polylines
```

**Use Case:** CAD integration, scalable output

### 3. **Batch Processing**

Process entire drawing sets:

```python
@app.post("/api/batch-overlay")
async def batch_overlay(files: List[str]):
    # Process all combinations
    # Return comparison matrix
```

---

## 💡 Interview Talking Points

### "Why skeletonization over edge detection?"

> "Edge detection like Canny detects boundaries, which gives you two lines for every wall in an architectural drawing - one for each edge. This creates thick, double-outlined structures that are hard to compare. Skeletonization uses morphological thinning to find the exact mathematical centerline of every structure, giving you a clean 1-pixel representation that preserves topology. It's the difference between outlining something and finding its true center."

### "Why 400 DPI?"

> "Architectural drawings have precision requirements down to millimeters. At standard screen resolution (72-96 DPI), fine details like thin walls or small fixtures can disappear entirely. By extracting at 400 DPI, we ensure every architectural element is captured with at least 4-5 pixels of width before skeletonization reduces it to a centerline. This prevents information loss and ensures accurate comparison."

### "How does the color overlay show differences?"

> "We use addWeighted blending with 50/50 alpha. When both skeletons have a line in the same place, the colors blend (green + pink = grayish), showing similarity. When only one drawing has a structure, you see pure green or pure pink, which immediately stands out to the eye. It's like overlaying two transparency sheets - overlaps darken, differences remain bright."

---

## 🎓 References

1. **Skeletonization Algorithm:** Zhang-Suen thinning algorithm
2. **SSIM Paper:** "Image Quality Assessment: From Error Visibility to Structural Similarity" (Wang et al., 2004)
3. **PyMuPDF Docs:** https://pymupdf.readthedocs.io/
4. **scikit-image Morphology:** https://scikit-image.org/docs/stable/api/skimage.morphology.html

---

## 🛠️ Testing Commands

```bash
# Test single skeleton
curl -o test_skeleton.png "http://localhost:8000/api/skeletonize/elevator.pdf"
open test_skeleton.png

# Test overlay
curl -o test_overlay.png "http://localhost:8000/api/overlay/detail1.pdf/detail2.pdf?color1=green&color2=pink"
open test_overlay.png

# Test SSIM analysis
curl "http://localhost:8000/api/compare-ssim/detail1.pdf/detail2.pdf" | jq

# Test different colors
curl -o cyan_yellow.png "http://localhost:8000/api/overlay/detail1.pdf/detail2.pdf?color1=cyan&color2=yellow"
```

---

## ✅ Summary

ArchiDiff implements a **founding engineer workflow** for architectural comparison:

1. ✅ **High-resolution extraction** (400 DPI) via PyMuPDF
2. ✅ **Skeletonization** (1-pixel centerlines) via scikit-image
3. ✅ **Color overlay** (pink/green blending) via OpenCV
4. ✅ **Mathematical analysis** (SSIM scoring) for quantitative comparison

**Result:** Clean, professional overlays that immediately show similarities and differences in architectural details.
