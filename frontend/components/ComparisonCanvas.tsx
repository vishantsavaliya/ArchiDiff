"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { getDetailFileUrl, compareSSIM, getHeatmapUrl, SSIMResult } from '@/lib/api';
import { toast } from 'sonner';
import { Download, RotateCcw, ZoomIn, ZoomOut, Scan } from 'lucide-react';

interface ComparisonCanvasProps {
  detail1Filename: string | null;
  detail2Filename: string | null;
  detail1Color: string;
  detail2Color: string;
}

export default function ComparisonCanvas({
  detail1Filename,
  detail2Filename,
  detail1Color,
  detail2Color,
}: ComparisonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const [opacity1, setOpacity1] = useState(70);
  const [opacity2, setOpacity2] = useState(70);
  const [loading, setLoading] = useState(false);
  const image1Ref = useRef<fabric.FabricImage | null>(null);
  const image2Ref = useRef<fabric.FabricImage | null>(null);
  const [ssimResult, setSSIMResult] = useState<SSIMResult | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [analyzingSSIM, setAnalyzingSSIM] = useState(false);

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (canvasRef.current && !fabricCanvasRef.current) {
      const canvas = new fabric.Canvas(canvasRef.current, {
        width: 800,
        height: 600,
        backgroundColor: '#ffffff',
      });
      
      fabricCanvasRef.current = canvas;

      // Enable panning with Alt+drag
      canvas.on('mouse:down', function(opt) {
        const evt = opt.e;
        if (evt.altKey === true) {
          this.isDragging = true;
          this.selection = false;
          this.lastPosX = evt.clientX;
          this.lastPosY = evt.clientY;
        }
      });

      canvas.on('mouse:move', function(opt) {
        if (this.isDragging) {
          const evt = opt.e;
          const vpt = this.viewportTransform;
          vpt[4] += evt.clientX - this.lastPosX;
          vpt[5] += evt.clientY - this.lastPosY;
          this.requestRenderAll();
          this.lastPosX = evt.clientX;
          this.lastPosY = evt.clientY;
        }
      });

      canvas.on('mouse:up', function() {
        this.setViewportTransform(this.viewportTransform);
        this.isDragging = false;
        this.selection = true;
      });

      // Mouse wheel zoom
      canvas.on('mouse:wheel', function(opt) {
        const delta = opt.e.deltaY;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        if (zoom > 20) zoom = 20;
        if (zoom < 0.1) zoom = 0.1;
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        opt.e.preventDefault();
        opt.e.stopPropagation();
      });

      return () => {
        canvas.dispose();
        fabricCanvasRef.current = null;
      };
    }
  }, []);

  // Load images when filenames change
  useEffect(() => {
    if (detail1Filename && detail2Filename && fabricCanvasRef.current) {
      loadImages();
    }
  }, [detail1Filename, detail2Filename]);

  // Update opacity for image 1
  useEffect(() => {
    if (image1Ref.current) {
      image1Ref.current.set('opacity', opacity1 / 100);
      fabricCanvasRef.current?.requestRenderAll();
    }
  }, [opacity1]);

  // Update opacity for image 2
  useEffect(() => {
    if (image2Ref.current) {
      image2Ref.current.set('opacity', opacity2 / 100);
      fabricCanvasRef.current?.requestRenderAll();
    }
  }, [opacity2]);

  // Update colors
  useEffect(() => {
    if (image1Ref.current) {
      applyColorFilter(image1Ref.current, detail1Color);
    }
  }, [detail1Color]);

  useEffect(() => {
    if (image2Ref.current) {
      applyColorFilter(image2Ref.current, detail2Color);
    }
  }, [detail2Color]);

  const applyColorFilter = (image: fabric.FabricImage, color: string) => {
    // Apply color tint filter using Fabric v7 API
    const filter = new fabric.filters.BlendColor({
      color: color,
      mode: 'tint',
      alpha: 0.5,
    });

    image.filters = [filter];
    image.applyFilters();
    fabricCanvasRef.current?.renderAll();
  };

  const loadImages = async () => {
    if (!detail1Filename || !detail2Filename || !fabricCanvasRef.current) return;

    setLoading(true);
    const canvas = fabricCanvasRef.current;
    
    try {
      // Clear existing objects
      canvas.clear();
      canvas.backgroundColor = '#ffffff';
      image1Ref.current = null;
      image2Ref.current = null;

      const url1 = getDetailFileUrl(detail1Filename);
      const url2 = getDetailFileUrl(detail2Filename);

      console.log('Loading images from:', { url1, url2 });

      // Load both images
      const [img1, img2] = await Promise.all([
        loadImage(url1),
        loadImage(url2),
      ]);

      console.log('Images loaded successfully:', {
        img1: { width: img1.width, height: img1.height },
        img2: { width: img2.width, height: img2.height }
      });

      // Scale images to fit canvas
      const scale1 = Math.min(
        (canvas.width! * 0.8) / img1.width!,
        (canvas.height! * 0.8) / img1.height!
      );
      const scale2 = Math.min(
        (canvas.width! * 0.8) / img2.width!,
        (canvas.height! * 0.8) / img2.height!
      );

      img1.scale(scale1);
      img2.scale(scale2);

      // Center images
      img1.set({
        left: canvas.width! / 2,
        top: canvas.height! / 2,
        originX: 'center',
        originY: 'center',
        opacity: opacity1 / 100,
      });

      img2.set({
        left: canvas.width! / 2,
        top: canvas.height! / 2,
        originX: 'center',
        originY: 'center',
        opacity: opacity2 / 100,
      });

      // Apply color filters
      applyColorFilter(img1, detail1Color);
      applyColorFilter(img2, detail2Color);

      // Add to canvas
      canvas.add(img1, img2);
      image1Ref.current = img1;
      image2Ref.current = img2;

      canvas.requestRenderAll();
      toast.success('Details loaded successfully');
      
      // Automatically analyze similarity after images finish loading
      setTimeout(() => analyzeSSIM(), 500);
    } catch (error) {
      console.error('Error loading images:', error);
      toast.error('Failed to load detail files. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // Analyze SSIM similarity
  const analyzeSSIM = async () => {
    if (!detail1Filename || !detail2Filename) return;
    
    setAnalyzingSSIM(true);
    try {
      const result = await compareSSIM(detail1Filename, detail2Filename);
      setSSIMResult(result);
      
      // Show toast based on similarity
      if (result.status === 'identical') {
        toast.success(`Drawings are ${result.similarity_percent}% identical!`);
      } else if (result.status === 'very_similar') {
        toast.info(`Drawings are ${result.similarity_percent}% similar`);
      } else if (result.status === 'similar') {
        toast.warning(`Drawings have ${result.similarity_percent}% similarity`);
      } else {
        toast.error(`Drawings are significantly different (${result.similarity_percent}% similar)`);
      }
    } catch (error) {
      console.error('SSIM analysis failed:', error);
      // Don't show error toast - SSIM is optional feature
    } finally {
      setAnalyzingSSIM(false);
    }
  };

  const toggleHeatmap = () => {
    if (!detail1Filename || !detail2Filename) return;
    setShowHeatmap(!showHeatmap);
    
    if (!showHeatmap) {
      // Load heatmap
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      
      canvas.clear();
      const heatmapUrl = getHeatmapUrl(detail1Filename, detail2Filename);
      
      fabric.FabricImage.fromURL(heatmapUrl, (img) => {
        img.set({
          left: canvas.width! / 2,
          top: canvas.height! / 2,
          originX: 'center',
          originY: 'center',
        });
        canvas.add(img);
        canvas.renderAll();
      });
      
      toast.info('Showing difference heatmap');
    } else {
      // Reload normal comparison
      loadImages();
    }
  };

  const loadImage = async (url: string): Promise<fabric.FabricImage> => {
    try {
      const img = await fabric.FabricImage.fromURL(url, {
        crossOrigin: 'anonymous'
      });
      if (img.width && img.height) {
        return img;
      }
      throw new Error('Failed to load image');
    } catch (error) {
      throw new Error('Failed to load image');
    }
  };

  const handleZoomIn = () => {
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      const zoom = canvas.getZoom();
      canvas.setZoom(Math.min(zoom * 1.2, 20));
    }
  };

  const handleZoomOut = () => {
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      const zoom = canvas.getZoom();
      canvas.setZoom(Math.max(zoom * 0.8, 0.1));
    }
  };

  const handleReset = () => {
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      canvas.requestRenderAll();
    }
  };

  const handleExport = () => {
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      const dataURL = canvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 2, // Higher resolution
      });

      const link = document.createElement('a');
      link.download = `archidiff-comparison-${Date.now()}.png`;
      link.href = dataURL;
      link.click();
      
      toast.success('Comparison exported as PNG');
    }
  };

  const canvasReady = detail1Filename && detail2Filename;

  return (
    <div className="space-y-4">
      {/* Canvas */}
      <Card className="bg-white border-gray-300">
        <CardContent className="p-6">
          <div className="flex justify-center items-center bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-300">
            {!canvasReady ? (
              <div className="w-[800px] h-[600px] flex items-center justify-center">
                <p className="text-gray-700 text-center text-lg font-semibold">
                  Select two details to compare
                </p>
              </div>
            ) : loading ? (
              <div className="w-[800px] h-[600px] flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-700">Loading details...</p>
                </div>
              </div>
            ) : (
              <canvas ref={canvasRef} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      {canvasReady && (
        <Card className="bg-white border-gray-300">
          <CardContent className="p-6 space-y-6">
            {/* Opacity Controls */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-black mb-2 block">
                  Detail 1 Opacity: {opacity1}%
                </label>
                <Slider
                  value={[opacity1]}
                  onValueChange={(value) => setOpacity1(value[0])}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-black mb-2 block">
                  Detail 2 Opacity: {opacity2}%
                </label>
                <Slider
                  value={[opacity2]}
                  onValueChange={(value) => setOpacity2(value[0])}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>

            {/* SSIM Analysis Results */}
            {ssimResult && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-semibold text-black mb-2">Similarity Analysis (SSIM)</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Similarity Score</p>
                    <p className="text-xl font-bold text-black">{ssimResult.similarity_percent}%</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Status</p>
                    <p className={`text-sm font-medium ${
                      ssimResult.status === 'identical' ? 'text-green-600' :
                      ssimResult.status === 'very_similar' ? 'text-blue-600' :
                      ssimResult.status === 'similar' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {ssimResult.status.replace('_', ' ').toUpperCase()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Different Area</p>
                    <p className="text-sm font-semibold text-black">{ssimResult.difference_area_percent.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Resolution</p>
                    <p className="text-sm font-semibold text-black">
                      {ssimResult.dimensions.width} × {ssimResult.dimensions.height}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleZoomIn} variant="outline" size="sm">
                <ZoomIn className="mr-2 h-4 w-4" />
                Zoom In
              </Button>
              <Button onClick={handleZoomOut} variant="outline" size="sm">
                <ZoomOut className="mr-2 h-4 w-4" />
                Zoom Out
              </Button>
              <Button onClick={handleReset} variant="outline" size="sm">
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset View
              </Button>
              <Button 
                onClick={toggleHeatmap} 
                variant={showHeatmap ? "default" : "outline"} 
                size="sm"
                disabled={analyzingSSIM}
              >
                <Scan className="mr-2 h-4 w-4" />
                {showHeatmap ? 'Hide Heatmap' : 'Show Heatmap'}
              </Button>
              <Button onClick={handleExport} className="ml-auto" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export PNG
              </Button>
            </div>

            <p className="text-xs text-gray-600">
              💡 Tip: Hold Alt and drag to pan. Use mouse wheel to zoom. Click "Show Heatmap" to see mathematical difference analysis.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
