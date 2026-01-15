# Processed Outputs - ArchiDiff

This directory contains all processed outputs from the ArchiDiff system for future reference and comparison.

## Directory Structure

```
outputs/
├── sketches/          # Text-removed pure line work
├── skeletons/         # Skeletonized (1-pixel centerlines)
├── mlsd/              # M-LSD deep learning line detection
├── overlays/          # Color-coded comparison overlays
└── heatmaps/          # SSIM difference heatmaps
```

## Available Outputs

### Sketches (Text Removed)
Pure line work with all text, dimensions, and annotations removed:

- `water_closet_001_sketch.png` - 45KB - Accessible water closet (CBC 11A)
- `water_closet_alt_sketch.png` - 47KB - Alternative water closet configuration
- `passenger_elevator_sketch.png` - 117KB - Passenger gurney elevator car
- `shuttle_elevator_sketch.png` - 106KB - Shuttle gurney elevator car
- `fire_cabinet_1_sketch.png` - 102KB - Fire extinguisher cabinet
- `fire_cabinet_2_sketch.png` - 112KB - Alternative fire cabinet

**Method:** PyMuPDF vector extraction + M-LSD fallback @ 400 DPI

### Skeletons (1-Pixel Centerlines)
Traditional skeletonization for clean vector PDFs:

- `passenger_elevator_skeleton.png` - 57KB - 2376x2374
- `shuttle_elevator_skeleton.png` - 48KB - 2376x2374
- `fire_cabinet_1_skeleton.png` - 77KB - 2064x3352

**Method:** scikit-image morphological skeletonization @ 400 DPI

### M-LSD Line Detection
Deep learning line detection (robust to noise):

- `passenger_elevator_mlsd.png` - 62KB - 1792x1792
- `fire_cabinet_mlsd.png` - 157KB - 2496x4096

**Method:** ControlNet M-LSD @ 300 DPI, score_threshold=0.1

### Overlays (Comparison Visualizations)
Color-coded overlays showing similarities and differences:

- `elevators_comparison_green_pink.png` - 175KB - Traditional overlay
- `fire_cabinets_comparison_green_pink.png` - 264KB - Traditional overlay
- `fire_cabinets_comparison_cyan_yellow.png` - 196KB - Alternative colors
- `elevators_mlsd_overlay.png` - 121KB - M-LSD based overlay

**Methods:**
- Traditional: Skeletonization + color blending
- M-LSD: Deep learning line detection + color blending
- Colors: green+pink (default), cyan+yellow (alternative)

## Usage

These outputs are ready for:

1. **Visual Inspection** - Open directly in Preview/image viewer
2. **Further Analysis** - Use as input for other tools
3. **Comparison Studies** - Compare different processing methods
4. **Training Data** - Reference images for ML models
5. **Documentation** - Include in reports or presentations

## Regenerating Outputs

All outputs can be regenerated using the API:

```bash
# Sketch extraction (text removal)
curl -o output.png "http://localhost:8000/api/extract-sketch/filename.pdf"

# Skeletonization
curl -o output.png "http://localhost:8000/api/skeletonize/filename.pdf"

# M-LSD line detection
curl -o output.png "http://localhost:8000/api/mlsd/filename.pdf?score_threshold=0.1"

# Traditional overlay
curl -o output.png "http://localhost:8000/api/overlay/file1.pdf/file2.pdf?color1=green&color2=pink"

# M-LSD overlay
curl -o output.png "http://localhost:8000/api/mlsd-overlay/file1.pdf/file2.pdf"
```

## Quality Comparison

| Method | Speed | Quality (Clean PDFs) | Quality (Scanned) | File Size |
|--------|-------|---------------------|-------------------|-----------|
| Sketch Extraction | ⚡⚡⚡ Fast | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Small |
| Skeletonization | ⚡⚡⚡ Fast | ⭐⭐⭐⭐⭐ | ⭐⭐ | Small |
| M-LSD Detection | ⚡ Slow | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Medium |
| Traditional Overlay | ⚡⚡ Medium | ⭐⭐⭐⭐⭐ | ⭐⭐ | Medium |
| M-LSD Overlay | ⚡ Slow | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Medium |

## Notes

- All images are PNG format for lossless quality
- Higher resolution = larger file size but better detail
- M-LSD outputs are slightly smaller resolution (1792px vs 2376px) but robust to noise
- Sketch extraction removes text automatically using vector path filtering
- Traditional methods work best for clean vector PDFs
- M-LSD methods work best for scanned or noisy documents

## Last Updated

January 14, 2026
