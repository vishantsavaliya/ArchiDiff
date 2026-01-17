import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusMessage } from '../components/StatusMessage';
import { imageEditorService, type Layer } from '../services/imageEditorService';

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
  const [currentTool, setCurrentTool] = useState<'overlay' | 'resize' | 'crop'>('overlay');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>({
    type: 'info',
    text: 'Loading images...',
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [layerOrder, setLayerOrder] = useState<[number, number]>([1, 2]); // [bottom, top]
  const renderRequestRef = useRef<number | null>(null);
  const pendingTransformRef = useRef<{ dx: number; dy: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const jobId = localStorage.getItem('dashboard_job_id') || 'test-job';
  const activeLayerId = layers[1].active ? 1 : 2;
  const activeLayer = layers[activeLayerId];

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !images[1] || !images[2]) return;

    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) return;

    // Set canvas size only if changed
    const maxWidth = Math.max(images[1].width, images[2].width, 800);
    const maxHeight = Math.max(images[1].height, images[2].height, 600);
    if (canvas.width !== maxWidth || canvas.height !== maxHeight) {
      canvas.width = maxWidth;
      canvas.height = maxHeight;
    }

    // Clear canvas with black background
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw layers in specified order
    layerOrder.forEach((layerId) => {
      const layer = layers[layerId];
      const img = currentTool === 'overlay' && processedImages[layerId] 
        ? processedImages[layerId] 
        : images[layerId];
      if (!layer.visible || !img) return;

      ctx.save();
      ctx.globalAlpha = layer.transform.opacity;

      const scale = layer.transform.scale;
      const centerX = img.width / 2;
      const centerY = img.height / 2;

      ctx.translate(centerX + layer.transform.x, centerY + layer.transform.y);
      ctx.rotate((layer.transform.rotation * Math.PI) / 180);
      ctx.scale(scale, scale);

      ctx.drawImage(img, -centerX, -centerY);
      ctx.restore();
    });
  }, [images, layers, currentTool, layerOrder, processedImages]);

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
          img1.src = img1Url;
        }),
        new Promise((resolve, reject) => {
          img2.onload = () => resolve(true);
          img2.onerror = () => reject(new Error('Image 2 load failed'));
          img2.src = img2Url;
        }),
      ]);

      setImages({ 1: img1, 2: img2 });
      
      // Pre-process images for colored overlay (do this once)
      processImagesForOverlay(img1, img2);
      
      setMessage({ type: 'success', text: TEST_MODE ? 'Test images loaded' : 'Images loaded' });
      setLoading(false);
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

  const setActiveLayer = (layerId: number) => {
    setLayers((prev) => ({
      ...prev,
      1: { ...prev[1], active: layerId === 1 },
      2: { ...prev[2], active: layerId === 2 },
    }));
  };

  const toggleLayerVisibility = (layerId: number) => {
    setLayers((prev) => ({
      ...prev,
      [layerId]: { ...prev[layerId], visible: !prev[layerId].visible },
    }));
  };

  const updateTransform = (key: keyof Layer['transform'], value: number) => {
    setLayers((prev) => ({
      ...prev,
      [activeLayerId]: {
        ...prev[activeLayerId],
        transform: { ...prev[activeLayerId].transform, [key]: value },
      },
    }));
  };

  const resetTransform = () => {
    setLayers((prev) => ({
      ...prev,
      [activeLayerId]: {
        ...prev[activeLayerId],
        transform: { x: 0, y: 0, rotation: 0, opacity: 1.0, scale: 1.0 },
      },
    }));
    setMessage({ type: 'success', text: 'Transform reset' });
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `canvas-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
    setMessage({ type: 'success', text: 'Downloaded!' });
  };

  // Mouse dragging handlers with throttled updates
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool !== 'overlay') return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
    setIsDragging(false);
    setDragStart(null);
    pendingTransformRef.current = null;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const swapLayerOrder = () => {
    setLayerOrder((prev) => [prev[1], prev[0]]);
    setMessage({ 
      type: 'success', 
      text: `Layer ${layerOrder[1]} is now on top` 
    });
  };

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
      <div className="w-20 bg-white border-r border-gray-300 flex flex-col items-center py-5 space-y-2">
        <button
          onClick={() => setCurrentTool('overlay')}
          className={`w-14 h-14 flex flex-col items-center justify-center rounded-lg transition ${
            currentTool === 'overlay' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100 text-gray-900'
          }`}
        >
          <span className="text-2xl">▦</span>
          <span className="text-xs">Overlay</span>
        </button>
        <div className="flex-1" />
        <button
          onClick={() => navigate('/')}
          className="w-14 h-14 flex flex-col items-center justify-center rounded-lg hover:bg-gray-100 text-gray-900"
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
            className={`bg-white shadow-2xl ${currentTool === 'overlay' ? 'cursor-move' : ''}`}
            style={{ maxWidth: '100%', maxHeight: '100%' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 bg-white border-l border-gray-300 overflow-y-auto">
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
        <div className="p-5 border-b border-gray-200">
          <h3 className="text-sm font-semibold mb-4 text-gray-700">Layers</h3>

          <div
            onClick={() => setActiveLayer(1)}
            className={`flex items-center p-3 rounded-lg cursor-pointer transition ${
              layers[1].active ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
            }`}
          >
            <span
              onClick={(e) => {
                e.stopPropagation();
                toggleLayerVisibility(1);
              }}
              className={`text-xl mr-3 cursor-pointer ${
                layers[1].active ? 'text-white' : 'text-gray-900'
              }`}
            >
              {layers[1].visible ? '●' : '○'}
            </span>
            <div className="flex-1">
              <div className="font-medium text-sm">Layer 1</div>
              <div className="text-xs opacity-70">
                Drawing 1 {layers[1].active && '• Active'}
              </div>
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center my-2">
            <button
              onClick={swapLayerOrder}
              className="p-2 rounded-full hover:bg-gray-200 transition-all duration-200 hover:scale-110 group"
              title="Swap layer order"
            >
              <svg className="w-5 h-5 text-gray-600 group-hover:text-indigo-600 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          <div
            onClick={() => setActiveLayer(2)}
            className={`flex items-center p-3 rounded-lg cursor-pointer transition ${
              layers[2].active ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
            }`}
          >
            <span
              onClick={(e) => {
                e.stopPropagation();
                toggleLayerVisibility(2);
              }}
              className={`text-xl mr-3 cursor-pointer ${
                layers[2].active ? 'text-white' : 'text-gray-900'
              }`}
            >
              {layers[2].visible ? '●' : '○'}
            </span>
            <div className="flex-1">
              <div className="font-medium text-sm">Layer 2</div>
              <div className="text-xs opacity-70">
                Drawing 2 {layers[2].active && '• Active'}
              </div>
            </div>
          </div>
        </div>

        {/* Overlay Controls */}
        {currentTool === 'overlay' && (
          <div className="p-5 border-b border-gray-200">
            <h3 className="text-sm font-semibold mb-4 text-gray-700">Overlay Controls</h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-600 flex justify-between mb-1">
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
                <label className="text-xs text-gray-600 flex justify-between mb-1">
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
                <label className="text-xs text-gray-600 flex justify-between mb-1">
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
                <label className="text-xs text-gray-600 flex justify-between mb-1">
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
                <label className="text-xs text-gray-600 flex justify-between mb-1">
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
      </div>
    </div>
  );
};
