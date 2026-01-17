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
  const [currentTool, setCurrentTool] = useState<'overlay' | 'erase' | 'brush' | 'select'>('overlay');
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState<'red' | 'green'>('red');
  const [loading, setLoading] = useState(true);
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
          onClick={() => setCurrentTool('brush')}
          className={`w-14 h-14 flex flex-col items-center justify-center rounded-lg transition ${
            currentTool === 'brush' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-800 text-gray-300'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          <span className="text-xs">Brush</span>
        </button>
        
        <button
          onClick={() => setCurrentTool('erase')}
          className={`w-14 h-14 flex flex-col items-center justify-center rounded-lg transition ${
            currentTool === 'erase' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-800 text-gray-300'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="text-xs">Erase</span>
        </button>
        
        <button
          onClick={() => setCurrentTool('select')}
          className={`w-14 h-14 flex flex-col items-center justify-center rounded-lg transition ${
            currentTool === 'select' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-800 text-gray-300'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          <span className="text-xs">Select</span>
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
              currentTool === 'brush' ? 'cursor-crosshair' : 
              currentTool === 'erase' ? 'cursor-pointer' : 
              'cursor-default'
            }`}
            style={{ maxWidth: '100%', maxHeight: '100%' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
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
      </div>
    </div>
  );
};
