import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusMessage } from '../components/StatusMessage';
import { imageEditorService, type Layer } from '../services/imageEditorService';
import { WebGLRenderer } from '../utils/webglRenderer';

const TEST_MODE = !localStorage.getItem('dashboard_job_id');

export const CanvasEditor: React.FC = () => {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [layers, setLayers] = useState<Record<number, Layer>>({
    1: {
      id: 1,
      visible: true,
      active: true,
      transform: { x: 0, y: 0, rotation: 0, opacity: 1.0, scale: 1.0 },
    },
    2: {
      id: 2,
      visible: true,
      active: false,
      transform: { x: 0, y: 0, rotation: 0, opacity: 1.0, scale: 1.0 },
    },
  });
  
  const [images, setImages] = useState<Record<number, HTMLImageElement>>({});
  const [processedImages, setProcessedImages] = useState<Record<number, HTMLCanvasElement>>({});
  const [editableImages, setEditableImages] = useState<Record<number, HTMLCanvasElement>>({});
  const [eraseLayer, setEraseLayer] = useState<Record<number, HTMLCanvasElement>>({});
  const [undoHistory, setUndoHistory] = useState<Array<{ layerId: number; imageData: ImageData }>>([]);
  const [redoHistory, setRedoHistory] = useState<Array<{ layerId: number; imageData: ImageData }>>([]);
  const MAX_UNDO_HISTORY = 10; // Limit to prevent memory issues
  const [currentTool, setCurrentTool] = useState<'overlay' | 'edit'>('overlay');
  const [editSubTool, setEditSubTool] = useState<'brush' | 'box' | 'line'>('brush');
  const [brushSize, setBrushSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [isErasing, setIsErasing] = useState(false);
  const [boxStart, setBoxStart] = useState<{ x: number; y: number } | null>(null);
  const [boxEnd, setBoxEnd] = useState<{ x: number; y: number } | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [detectedLines, setDetectedLines] = useState<Array<{x1: number; y1: number; x2: number; y2: number}>>([]);
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [message, setMessage] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>({
    type: 'info',
    text: 'Loading images...',
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [layerOrder, setLayerOrder] = useState<[number, number]>([1, 2]); // [bottom, top]
  const [visualLayerOrder, setVisualLayerOrder] = useState<[number, number]>([1, 2]); // UI display order
  const [isSwapping, setIsSwapping] = useState(false);
  const renderRequestRef = useRef<number | null>(null);
  const pendingTransformRef = useRef<{ dx: number; dy: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const boxPosRef = useRef<{ start: { x: number; y: number } | null; end: { x: number; y: number } | null }>({ start: null, end: null });
  const webglRendererRef = useRef<WebGLRenderer | null>(null);
  const [useWebGL, setUseWebGL] = useState(true);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1.0 });

  const jobId = localStorage.getItem('dashboard_job_id') || 'test-job';
  
  // Memoize derived state to prevent unnecessary recalculations
  const activeLayerId = useMemo(() => layers[1].active ? 1 : 2, [layers]);
  const activeLayer = useMemo(() => layers[activeLayerId], [layers, activeLayerId]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !images[1] || !images[2]) return;

    // Cache context
    if (!canvasCtxRef.current) {
      canvasCtxRef.current = canvas.getContext('2d', { alpha: true, desynchronized: true });
    }
    const ctx = canvasCtxRef.current;
    if (!ctx) return;

    // Set canvas to fixed rectangular size (landscape orientation)
    const CANVAS_WIDTH = 1600;
    const CANVAS_HEIGHT = 1200;
    
    if (canvas.width !== CANVAS_WIDTH || canvas.height !== CANVAS_HEIGHT) {
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      canvasCtxRef.current = null; // Reset context on resize
      return renderCanvas(); // Re-render after resize
    }

    // Disable image smoothing for better performance on large images
    ctx.imageSmoothingEnabled = false;

    // Clear canvas with black background
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate scale to fit images within canvas
    const maxImageWidth = Math.max(images[1].width, images[2].width);
    const maxImageHeight = Math.max(images[1].height, images[2].height);
    const scaleToFit = Math.min(CANVAS_WIDTH / maxImageWidth, CANVAS_HEIGHT / maxImageHeight);

    // Draw layers in specified order
    layerOrder.forEach((layerId) => {
      const layer = layers[layerId];
      // Always use editableImages if they exist (they contain any edits made)
      // Fall back to processedImages or original images if no edits have been made
      const img = editableImages[layerId] || processedImages[layerId] || images[layerId];
      if (!layer.visible || !img) return;

      ctx.save();
      ctx.globalAlpha = layer.transform.opacity;

      // Apply both fit-to-canvas scale and user's transform scale
      const scale = layer.transform.scale * scaleToFit;
      const centerX = (img.width * scaleToFit) / 2;
      const centerY = (img.height * scaleToFit) / 2;

      ctx.translate(centerX + layer.transform.x, centerY + layer.transform.y);
      ctx.rotate((layer.transform.rotation * Math.PI) / 180);
      ctx.scale(scale, scale);

      ctx.drawImage(img, -(img.width / 2), -(img.height / 2));
      ctx.restore();
    });

    // Draw box selection outline if dragging (after transforms are reset)
    const currentBoxStart = boxPosRef.current.start || boxStart;
    const currentBoxEnd = boxPosRef.current.end || boxEnd;
    if (currentTool === 'edit' && editSubTool === 'box' && currentBoxStart && currentBoxEnd) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to draw in canvas pixel space
      
      // Box coordinates are in image space, need to forward transform to canvas space
      const transform = layers[activeLayerId].transform;
      const scale = transform.scale;
      const offsetX = transform.x;
      const offsetY = transform.y;
      
      const canvasStartX = currentBoxStart.x * scale + offsetX;
      const canvasStartY = currentBoxStart.y * scale + offsetY;
      const canvasEndX = currentBoxEnd.x * scale + offsetX;
      const canvasEndY = currentBoxEnd.y * scale + offsetY;
      
      // Make it VERY visible for debugging
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; // Semi-transparent white fill
      ctx.lineWidth = 5; // Thicker line
      ctx.setLineDash([10, 5]);
      
      const width = canvasEndX - canvasStartX;
      const height = canvasEndY - canvasStartY;
      
      // Draw filled rectangle first
      ctx.fillRect(canvasStartX, canvasStartY, width, height);
      // Then stroke  
      ctx.strokeRect(canvasStartX, canvasStartY, width, height);
      
      ctx.restore();
    }

    // Draw brush cursor preview (after transforms are reset)
    if (currentTool === 'edit' && editSubTool === 'brush' && cursorPos) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to draw in canvas pixel space
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cursorPos.x, cursorPos.y, brushSize, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Draw detected lines for line selection
    if (currentTool === 'edit' && editSubTool === 'line' && detectedLines.length > 0) {
      ctx.save();
      ctx.lineWidth = 3;
      detectedLines.forEach((line, idx) => {
        ctx.strokeStyle = selectedLines.has(idx) ? '#00ff00' : '#888888';
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.stroke();
      });
      ctx.restore();
    }
  }, [images, layers, currentTool, layerOrder, processedImages, editableImages, eraseLayer, editSubTool, boxStart, boxEnd, detectedLines, selectedLines, cursorPos, brushSize]);

  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      setMessage({ type: 'info', text: 'Loading images...' });

      const img1 = new Image();
      const img2 = new Image();

      const img1Url = TEST_MODE
        ? '/test/image1.png'
        : imageEditorService.getProcessedImageUrl(jobId, 1);
      const img2Url = TEST_MODE
        ? '/test/image2.png'
        : imageEditorService.getProcessedImageUrl(jobId, 2);

      await Promise.all([
        new Promise((resolve, reject) => {
          img1.onload = () => {
            resolve(true);
          };
          img1.onerror = () => reject(new Error('Image 1 load failed'));
          img1.crossOrigin = 'anonymous';
          img1.src = img1Url;
        }),
        new Promise((resolve, reject) => {
          img2.onload = () => resolve(true);
          img2.onerror = () => reject(new Error('Image 2 load failed'));
          img2.crossOrigin = 'anonymous';
          img2.src = img2Url;
        }),
      ]);

      setImages({ 1: img1, 2: img2 });
      
      // Pre-process images for colored overlay (do this once)
      processImagesForOverlay(img1, img2);
      
      setMessage({ type: 'success', text: TEST_MODE ? 'Test images loaded' : 'Images loaded' });
      setLoading(false);
      
      // Force initial render
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          renderCanvas();
        }
      }, 100);
    } catch (error) {
      console.error('Error loading images:', error);
      setMessage({ type: 'error', text: `Failed to load images: ${error}` });
      setLoading(false);
    }
  }, [jobId]);

  const processImagesForOverlay = (img1: HTMLImageElement, img2: HTMLImageElement) => {
    const processImage = (img: HTMLImageElement, isLayer1: boolean): HTMLCanvasElement => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      if (!tempCtx) return tempCanvas;

      tempCtx.drawImage(img, 0, 0);
      const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
      const data = imageData.data;

      // Quick sample to detect if image is inverted (black bg vs white bg)
      let sampleWhite = 0;
      let sampleBlack = 0;
      const sampleSize = Math.min(10000, data.length / 4);
      const step = Math.floor(data.length / (sampleSize * 4));
      
      for (let i = 0; i < data.length; i += step * 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (r > 240 && g > 240 && b > 240) sampleWhite++;
        else if (r < 20 && g < 20 && b < 20) sampleBlack++;
      }
      const isInverted = sampleBlack > sampleWhite;

      // Single pass: process all pixels
      if (isLayer1) {
        // Layer 1: Red lines
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          if (isInverted ? (r < 30 && g < 30 && b < 30) : (r > 200 && g > 200 && b > 200)) {
            data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0; // Transparent
          } else {
            data[i] = 255; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255; // Red
          }
        }
      } else {
        // Layer 2: Green lines
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          if (isInverted ? (r < 30 && g < 30 && b < 30) : (r > 200 && g > 200 && b > 200)) {
            data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0; // Transparent
          } else {
            data[i] = 0; data[i + 1] = 255; data[i + 2] = 0; data[i + 3] = 255; // Green
          }
        }
      }

      tempCtx.putImageData(imageData, 0, 0);
      return tempCanvas;
    };

    const processed = {
      1: processImage(img1, true),
      2: processImage(img2, false),
    };
    setProcessedImages(processed);
    
    // Create editable canvases from the processed (red/green) images
    const editCanvas1 = document.createElement('canvas');
    editCanvas1.width = processed[1].width;
    editCanvas1.height = processed[1].height;
    const ctx1 = editCanvas1.getContext('2d');
    if (ctx1) ctx1.drawImage(processed[1], 0, 0);
    
    const editCanvas2 = document.createElement('canvas');
    editCanvas2.width = processed[2].width;
    editCanvas2.height = processed[2].height;
    const ctx2 = editCanvas2.getContext('2d');
    if (ctx2) ctx2.drawImage(processed[2], 0, 0);
    
    setEditableImages({ 1: editCanvas1, 2: editCanvas2 });
    
    // Create transparent erase layers
    const eraseCanvas1 = document.createElement('canvas');
    eraseCanvas1.width = processed[1].width;
    eraseCanvas1.height = processed[1].height;
    
    const eraseCanvas2 = document.createElement('canvas');
    eraseCanvas2.width = processed[2].width;
    eraseCanvas2.height = processed[2].height;
    
    setEraseLayer({ 1: eraseCanvas1, 2: eraseCanvas2 });
  };

  // Load images on mount
  useEffect(() => {
    loadImages();
  }, [loadImages]);

  // Render canvas when layers or images change with requestAnimationFrame
  useEffect(() => {
    if (images[1] && images[2]) {
      if (renderRequestRef.current) {
        cancelAnimationFrame(renderRequestRef.current);
      }
      renderRequestRef.current = requestAnimationFrame(() => {
        renderCanvas();
        renderRequestRef.current = null;
      });
    }
    return () => {
      if (renderRequestRef.current) {
        cancelAnimationFrame(renderRequestRef.current);
      }
    };
  }, [images, renderCanvas]);

  const setActiveLayer = useCallback((layerId: number) => {
    setLayers((prev) => ({
      ...prev,
      1: { ...prev[1], active: layerId === 1 },
      2: { ...prev[2], active: layerId === 2 },
    }));
  }, []);

  const toggleLayerVisibility = useCallback((layerId: number) => {
    setLayers((prev) => ({
      ...prev,
      [layerId]: { ...prev[layerId], visible: !prev[layerId].visible },
    }));
  }, []);

  const updateTransform = useCallback((key: keyof Layer['transform'], value: number) => {
    setLayers((prev) => ({
      ...prev,
      [activeLayerId]: {
        ...prev[activeLayerId],
        transform: { ...prev[activeLayerId].transform, [key]: value },
      },
    }));
  }, [activeLayerId]);

  const resetTransform = useCallback(() => {
    setLayers((prev) => ({
      ...prev,
      [activeLayerId]: {
        ...prev[activeLayerId],
        transform: { x: 0, y: 0, rotation: 0, opacity: 1.0, scale: 1.0 },
      },
    }));
    setMessage({ type: 'success', text: 'Transform reset' });
  }, [activeLayerId]);

  const downloadCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `canvas-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
    setMessage({ type: 'success', text: 'Downloaded!' });
  }, []);

  // Mouse dragging handlers with throttled updates
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (currentTool === 'overlay') {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (currentTool === 'edit') {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top) * scaleY;

      if (editSubTool === 'brush') {
        // Save undo state before brushing
        saveUndoState();
        setIsErasing(true);
        eraseAtPoint(e);
      } else if (editSubTool === 'box') {
        // Start box selection - store in image space (inverse transform)
        const transform = layers[activeLayerId].transform;
        const scale = transform.scale;
        const offsetX = transform.x;
        const offsetY = transform.y;
        const imageX = (canvasX - offsetX) / scale;
        const imageY = (canvasY - offsetY) / scale;
        
        const pos = { x: imageX, y: imageY };
        setBoxStart(pos);
        setBoxEnd(pos);
        boxPosRef.current = { start: pos, end: pos };
      } else if (editSubTool === 'line') {
        // Find and toggle line near click - inverse transform coordinates first
        const transform = layers[activeLayerId].transform;
        const scale = transform.scale;
        const offsetX = transform.x;
        const offsetY = transform.y;
        const imageX = (canvasX - offsetX) / scale;
        const imageY = (canvasY - offsetY) / scale;
        
        const lineIdx = findLineNearPoint(imageX, imageY);
        if (lineIdx !== null) {
          setSelectedLines(prev => {
            const newSet = new Set(prev);
            if (newSet.has(lineIdx)) {
              newSet.delete(lineIdx);
            } else {
              newSet.add(lineIdx);
            }
            return newSet;
          });
          renderCanvas();
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    if (currentTool === 'edit') {
      // Update cursor position for brush preview
      if (editSubTool === 'brush') {
        setCursorPos({ x: canvasX, y: canvasY });
        if (isErasing) {
          eraseAtPoint(e);
        } else {
          renderCanvas();
        }
        return;
      } else if (editSubTool === 'box' && boxStart) {
        // Update box end position - store in image space (inverse transform)
        const transform = layers[activeLayerId].transform;
        const scale = transform.scale;
        const offsetX = transform.x;
        const offsetY = transform.y;
        const imageX = (canvasX - offsetX) / scale;
        const imageY = (canvasY - offsetY) / scale;
        
        const pos = { x: imageX, y: imageY };
        boxPosRef.current.end = pos;
        setBoxEnd(pos);
        renderCanvas();
        return;
      }
    }
    
    if (!isDragging || !dragStart || currentTool !== 'overlay') return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    // Apply 4x multiplier for more responsive movement
    const MOVEMENT_MULTIPLIER = 4;

    // Store pending transform instead of updating state immediately
    pendingTransformRef.current = { dx: dx * MOVEMENT_MULTIPLIER, dy: dy * MOVEMENT_MULTIPLIER };
    setDragStart({ x: e.clientX, y: e.clientY });

    // Apply transform on next animation frame (throttled)
    if (!animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(() => {
        if (pendingTransformRef.current) {
          const { dx: deltaX, dy: deltaY } = pendingTransformRef.current;
          
          setLayers((prev) => ({
            ...prev,
            [activeLayerId]: {
              ...prev[activeLayerId],
              transform: { 
                ...prev[activeLayerId].transform, 
                x: prev[activeLayerId].transform.x + deltaX,
                y: prev[activeLayerId].transform.y + deltaY
              },
            },
          }));

          pendingTransformRef.current = null;
        }
        animationFrameRef.current = null;
      });
    }
  };

  const handleMouseUp = () => {
    if (currentTool === 'edit' && editSubTool === 'box' && boxStart && boxEnd) {
      // Erase everything in the box
      saveUndoState();
      eraseBox();
      setBoxStart(null);
      setBoxEnd(null);
      boxPosRef.current = { start: null, end: null };
    }
    
    setIsDragging(false);
    setIsErasing(false);
    setDragStart(null);
    pendingTransformRef.current = null;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    handleMouseUp();
    setCursorPos(null);
  };

  const saveUndoState = useCallback(() => {
    const canvas = editableImages[activeLayerId];
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setUndoHistory(prev => {
          const newHistory = [...prev, { layerId: activeLayerId, imageData }];
          return newHistory.slice(-MAX_UNDO_HISTORY);
        });
        setRedoHistory([]);
      }
    }
  }, [activeLayerId, editableImages]);

  const eraseBox = useCallback(() => {
    if (!boxStart || !boxEnd) return;

    const canvas = editableImages[activeLayerId];
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Box coordinates are already in image space, no transform needed
    const x = Math.min(boxStart.x, boxEnd.x);
    const y = Math.min(boxStart.y, boxEnd.y);
    const width = Math.abs(boxEnd.x - boxStart.x);
    const height = Math.abs(boxEnd.y - boxStart.y);

    // Erase rectangle area
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(x, y, width, height);
    ctx.globalCompositeOperation = 'source-over';

    renderCanvas();
    setMessage({ type: 'success', text: 'Box erased' });
  }, [boxStart, boxEnd, activeLayerId, editableImages, renderCanvas]);

  const findLineNearPoint = (x: number, y: number, threshold = 15): number | null => {
    let minDist = Infinity;
    let nearestIdx: number | null = null;

    detectedLines.forEach((line, idx) => {
      const dist = pointToSegmentDistance(x, y, line.x1, line.y1, line.x2, line.y2);
      if (dist < minDist && dist < threshold) {
        minDist = dist;
        nearestIdx = idx;
      }
    });

    return nearestIdx;
  };

  const pointToSegmentDistance = (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
    const dx = x2 - x1;
    const dy = y2 - y1;

    if (dx === 0 && dy === 0) {
      return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    }

    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;

    return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
  };

  const eraseSelectedLines = useCallback(() => {
    if (selectedLines.size === 0) {
      setMessage({ type: 'error', text: 'No lines selected' });
      return;
    }

    saveUndoState();

    const canvas = editableImages[activeLayerId];
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 5;

    selectedLines.forEach(idx => {
      const line = detectedLines[idx];
      if (line) {
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.stroke();
      }
    });

    ctx.globalCompositeOperation = 'source-over';
    
    setSelectedLines(new Set());
    renderCanvas();
    setMessage({ type: 'success', text: `${selectedLines.size} line(s) erased` });
  }, [selectedLines, activeLayerId, editableImages, detectedLines, saveUndoState, renderCanvas]);

  const detectLinesOnCanvas = useCallback(() => {
    const canvas = editableImages[activeLayerId];
    if (!canvas) return;

    // Create a temporary canvas for edge detection
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return;

    tempCtx.drawImage(canvas, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Simple line detection - find continuous colored pixels
    // This is a simplified version - in production you'd use the backend
    const lines: Array<{x1: number; y1: number; x2: number; y2: number}> = [];
    
    // For now, we'll detect horizontal and vertical lines
    // You can enhance this with proper line detection algorithm
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Detect horizontal lines
    for (let y = 0; y < height; y += 10) {
      let lineStart = null;
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const isColored = data[idx] > 100 || data[idx + 1] > 100 || data[idx + 2] > 100;
        
        if (isColored && lineStart === null) {
          lineStart = x;
        } else if (!isColored && lineStart !== null) {
          if (x - lineStart > 20) {
            lines.push({ x1: lineStart, y1: y, x2: x, y2: y });
          }
          lineStart = null;
        }
      }
    }

    setDetectedLines(lines);
    setMessage({ type: 'success', text: `Detected ${lines.length} lines` });
  }, [activeLayerId, editableImages]);

  const swapLayerOrder = useCallback(() => {
    setIsSwapping(true);
    // Update canvas render order immediately
    setLayerOrder((prev) => [prev[1], prev[0]]);
    
    // Wait for animation to complete, then update visual order
    setTimeout(() => {
      setVisualLayerOrder((prev) => [prev[1], prev[0]]);
      setIsSwapping(false);
      setMessage({ 
        type: 'success', 
        text: `Layer order swapped` 
      });
    }, 300);
  }, []);

  const eraseAtPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const editCanvas = editableImages[activeLayerId];
    if (!canvas || !editCanvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    // Get layer transform and inverse transform the coordinates
    const transform = layers[activeLayerId].transform;
    const scale = transform.scale;
    const offsetX = transform.x;
    const offsetY = transform.y;
    
    // Inverse transform back to original image space
    const x = (canvasX - offsetX) / scale;
    const y = (canvasY - offsetY) / scale;

    // Use willReadFrequently only for erase operations
    const ctx = editCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Erase in a circle on the editable image
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, brushSize / scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Trigger re-render
    renderCanvas();
  }, [activeLayerId, editableImages, brushSize, layers, renderCanvas]);

  const undo = useCallback(() => {
    if (undoHistory.length === 0) return;

    const lastState = undoHistory[undoHistory.length - 1];
    const canvas = editableImages[lastState.layerId];
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Save current state to redo history (limit to MAX_UNDO_HISTORY)
    const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setRedoHistory(prev => {
      const newHistory = [...prev, { layerId: lastState.layerId, imageData: currentImageData }];
      return newHistory.slice(-MAX_UNDO_HISTORY);
    });

    // Restore previous state
    ctx.putImageData(lastState.imageData, 0, 0);

    // Remove from undo history
    setUndoHistory(prev => prev.slice(0, -1));

    renderCanvas();
    setMessage({ type: 'success', text: 'Undo' });
  }, [undoHistory, editableImages, renderCanvas]);

  const redo = useCallback(() => {
    if (redoHistory.length === 0) return;

    const nextState = redoHistory[redoHistory.length - 1];
    const canvas = editableImages[nextState.layerId];
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Save current state to undo history (limit to MAX_UNDO_HISTORY)
    const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setUndoHistory(prev => {
      const newHistory = [...prev, { layerId: nextState.layerId, imageData: currentImageData }];
      return newHistory.slice(-MAX_UNDO_HISTORY);
    });

    // Restore next state
    ctx.putImageData(nextState.imageData, 0, 0);

    // Remove from redo history
    setRedoHistory(prev => prev.slice(0, -1));

    renderCanvas();
    setMessage({ type: 'success', text: 'Redo' });
  }, [redoHistory, editableImages, renderCanvas]);

  const convertLayer2ToGreen = async () => {
    try {
      setLoading(true);
      setMessage({ type: 'info', text: 'Converting Layer 2 to green...' });
      
      await imageEditorService.convertToGreenTransparent(2);
      
      // Reload image 2
      const img2 = new Image();
      img2.src = imageEditorService.getImageUrl(2);
      await new Promise((resolve) => {
        img2.onload = resolve;
      });
      
      setImages((prev) => ({ ...prev, 2: img2 }));
      setMessage({ type: 'success', text: 'Layer 2 converted to green with transparent background!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to convert layer' });
      console.error('Convert error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Toolbar */}
      <div className="w-20 bg-gray-900 border-r border-gray-700 flex flex-col items-center py-5 space-y-2">
        <button
          onClick={() => setCurrentTool('overlay')}
          className={`w-14 h-14 flex flex-col items-center justify-center rounded-lg transition ${
            currentTool === 'overlay' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-800 text-gray-300'
          }`}
        >
          <span className="text-2xl">▦</span>
          <span className="text-xs">Overlay</span>
        </button>
        
        <button
          onClick={() => setCurrentTool('edit')}
          className={`w-14 h-14 flex flex-col items-center justify-center rounded-lg transition ${
            currentTool === 'edit' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-800 text-gray-300'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          <span className="text-xs">Edit</span>
        </button>
        
        <div className="flex-1" />
        <button
          onClick={() => navigate('/')}
          className="w-14 h-14 flex flex-col items-center justify-center rounded-lg hover:bg-gray-800 text-gray-300"
        >
          <span className="text-2xl">⌂</span>
          <span className="text-xs">Home</span>
        </button>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col bg-gray-800">
        <div className="bg-gray-900 text-white px-5 py-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Canvas Editor</h2>
          <div className="text-sm opacity-80">
            {TEST_MODE ? 'TEST MODE' : jobId}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          {loading && <div className="text-white text-lg">Loading...</div>}
          <canvas
            ref={canvasRef}
            className={`bg-white shadow-2xl ${
              currentTool === 'overlay' ? 'cursor-move' : 
              currentTool === 'edit' ? 'cursor-crosshair' : 
              'cursor-default'
            }`}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          />
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 bg-gray-900 border-l border-gray-700 overflow-y-auto">
        {/* Message */}
        {message && (
          <div className="p-4">
            <StatusMessage
              type={message.type}
              message={message.text}
              onDismiss={() => setMessage(null)}
            />
          </div>
        )}

        {/* Layers Panel */}
        <div className="p-5 border-b border-gray-700">
          <h3 className="text-sm font-semibold mb-4 text-gray-300">Layers</h3>

          <div className="space-y-2 relative pr-10">
            {visualLayerOrder.map((layerId, index) => (
              <React.Fragment key={layerId}>
                <div
                  onClick={() => setActiveLayer(layerId)}
                  className={`flex items-center p-2 rounded-lg cursor-pointer transition-all duration-300 ${
                    layers[layerId].active ? 'bg-indigo-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  } ${
                    isSwapping ? 'transform translate-y-0' : ''
                  }`}
                  style={{
                    transform: isSwapping ? `translateY(${index === 0 ? 100 : -100}%)` : 'translateY(0)',
                    transition: 'transform 0.3s ease-in-out, background-color 0.2s'
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLayerVisibility(layerId);
                    }}
                    className="mr-2 cursor-pointer"
                  >
                    {layers[layerId].visible ? (
                      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1">
                    <div className="font-medium text-xs text-gray-300">{layerId === 1 ? 'Red Layer' : 'Green Layer'}</div>
                    <div className="text-[10px] text-gray-300 opacity-70">
                      Drawing {layerId} {layers[layerId].active && '• Active'}
                    </div>
                  </div>
                </div>
                
              </React.Fragment>
            ))}
            
            {/* Floating swap button between layers */}
            <button
              onClick={swapLayerOrder}
              className="absolute -right-1 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-700 transition-all duration-200 hover:scale-110 shadow-sm group z-10"
              title="Swap layer order"
            >
              <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Overlay Controls */}
        {currentTool === 'overlay' && (
          <div className="p-5 border-b border-gray-700">
            <h3 className="text-sm font-semibold mb-4 text-gray-300">Overlay Controls</h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 flex justify-between mb-1">
                  <span>X Position</span>
                  <span>{activeLayer.transform.x}</span>
                </label>
                <input
                  type="range"
                  min="-500"
                  max="500"
                  value={activeLayer.transform.x}
                  onChange={(e) => updateTransform('x', Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 flex justify-between mb-1">
                  <span>Y Position</span>
                  <span>{activeLayer.transform.y}</span>
                </label>
                <input
                  type="range"
                  min="-500"
                  max="500"
                  value={activeLayer.transform.y}
                  onChange={(e) => updateTransform('y', Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 flex justify-between mb-1">
                  <span>Rotation</span>
                  <span>{activeLayer.transform.rotation}°</span>
                </label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={activeLayer.transform.rotation}
                  onChange={(e) => updateTransform('rotation', Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 flex justify-between mb-1">
                  <span>Opacity</span>
                  <span>{Math.round(activeLayer.transform.opacity * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={activeLayer.transform.opacity * 100}
                  onChange={(e) => updateTransform('opacity', Number(e.target.value) / 100)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 flex justify-between mb-1">
                  <span>Scale</span>
                  <span>{Math.round(activeLayer.transform.scale * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="200"
                  value={activeLayer.transform.scale * 100}
                  onChange={(e) => updateTransform('scale', Number(e.target.value) / 100)}
                  className="w-full"
                />
              </div>

              <button
                onClick={resetTransform}
                className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 text-sm"
              >
                Reset Transform
              </button>

              <button
                onClick={downloadCanvas}
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 text-sm"
              >
                Download Canvas
              </button>
            </div>
          </div>
        )}

        {/* Edit Controls */}
        {currentTool === 'edit' && (
          <div className="p-5 border-b border-gray-700">
            <h3 className="text-sm font-semibold mb-4 text-gray-300">Edit Tools</h3>

            <div className="space-y-4">
              {/* Sub-tool Selection */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setEditSubTool('brush')}
                  className={`p-3 rounded-lg transition text-xs flex flex-col items-center ${
                    editSubTool === 'brush' ? 'bg-indigo-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="3" strokeWidth="2" />
                  </svg>
                  Brush
                </button>
                <button
                  onClick={() => setEditSubTool('box')}
                  className={`p-3 rounded-lg transition text-xs flex flex-col items-center ${
                    editSubTool === 'box' ? 'bg-indigo-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="4" y="4" width="16" height="16" strokeWidth="2" />
                  </svg>
                  Box
                </button>
                <button
                  onClick={() => setEditSubTool('line')}
                  className={`p-3 rounded-lg transition text-xs flex flex-col items-center ${
                    editSubTool === 'line' ? 'bg-indigo-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20L20 4" />
                  </svg>
                  Line
                </button>
              </div>

              {/* Brush Size (only for brush tool) */}
              {editSubTool === 'brush' && (
                <div>
                  <label className="text-xs text-gray-400 flex justify-between mb-1">
                    <span>Eraser Size</span>
                    <span>{brushSize}px</span>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}

              {/* Line tool controls */}
              {editSubTool === 'line' && (
                <div className="space-y-2">
                  <button
                    onClick={detectLinesOnCanvas}
                    className="w-full bg-gray-700 text-white py-2 px-4 rounded-lg hover:bg-gray-600 text-sm"
                  >
                    Detect Lines
                  </button>
                  {detectedLines.length > 0 && (
                    <>
                      <div className="text-xs text-gray-400 text-center">
                        {detectedLines.length} lines detected, {selectedLines.size} selected
                      </div>
                      <button
                        onClick={eraseSelectedLines}
                        disabled={selectedLines.size === 0}
                        className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Erase Selected Lines
                      </button>
                      <button
                        onClick={() => setSelectedLines(new Set())}
                        disabled={selectedLines.size === 0}
                        className="w-full bg-gray-700 text-white py-2 px-4 rounded-lg hover:bg-gray-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Clear Selection
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Undo/Redo */}
              <div className="flex gap-2">
                <button
                  onClick={undo}
                  disabled={undoHistory.length === 0}
                  className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ↶ Undo
                </button>
                <button
                  onClick={redo}
                  disabled={redoHistory.length === 0}
                  className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ↷ Redo
                </button>
              </div>

              <button
                onClick={downloadCanvas}
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 text-sm"
              >
                Download Canvas
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
