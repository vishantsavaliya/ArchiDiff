import React, { useState, useEffect } from 'react';
import { FileUpload } from '../components/FileUpload';
import { ImageCanvas } from '../components/ImageCanvas';
import { StatusMessage } from '../components/StatusMessage';
import { overlayService, downloadFile } from '../services/backendService';
import type { UploadedFile } from '../types';

const PROCESSING_API = 'http://localhost:5004';

export const OverlayComparison: React.FC = () => {
  const [overlayUrl, setOverlayUrl] = useState<string>('');
  const [transform, setTransform] = useState({
    dx: 0,
    dy: 0,
    rotation: 0,
    scale_x: 1.0,
    scale_y: 1.0,
    opacity: 1.0,
    thickness: 2,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);
  const [lowerImage, setLowerImage] = useState<string>('');
  const [upperImage, setUpperImage] = useState<string>('');

  // Check if redirected from home page with processed images
  useEffect(() => {
    const jobId = localStorage.getItem('overlay_job_id');
    if (jobId) {
      loadProcessedImages(jobId);
      localStorage.removeItem('overlay_job_id');
    }
  }, []);

  const loadProcessedImages = async (jobId: string) => {
    try {
      setLoading(true);
      setMessage({ type: 'info', text: 'Loading processed images...' });
      
      const img1Url = `${PROCESSING_API}/image/${jobId}/1`;
      const img2Url = `${PROCESSING_API}/image/${jobId}/2`;
      
      setLowerImage(img1Url);
      setUpperImage(img2Url);
      setMessage({ type: 'success', text: 'Images loaded! Adjust transform controls.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load processed images' });
    } finally {
      setLoading(false);
    }
  };

  const handleLowerImageSelect = (files: UploadedFile[]) => {
    if (files.length > 0) {
      setLowerImage(files[0].preview || '');
      setMessage({ type: 'info', text: 'Lower image loaded' });
    }
  };

  const handleUpperImageSelect = (files: UploadedFile[]) => {
    if (files.length > 0) {
      setUpperImage(files[0].preview || '');
      setMessage({ type: 'info', text: 'Upper image loaded' });
    }
  };

  const handleUpdateTransform = async () => {
    if (!lowerImage || !upperImage) {
      setMessage({ type: 'error', text: 'Please upload both images' });
      return;
    }

    try {
      setLoading(true);
      const response = await overlayService.updateTransform(transform);
      setOverlayUrl(response.overlayImage);
      setMessage({ type: 'success', text: 'Overlay updated' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update overlay' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const blob = await overlayService.save();
      downloadFile(blob, 'overlay_comparison.png');
      setMessage({ type: 'success', text: 'Overlay saved' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save overlay' });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTransform({ dx: 0, dy: 0, rotation: 0, scale_x: 1.0, scale_y: 1.0, opacity: 1.0, thickness: 2 });
    setMessage({ type: 'info', text: 'Transform reset' });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Interactive Overlay Comparison</h1>
      
      {message && (
        <div className="mb-4">
          <StatusMessage
            type={message.type}
            message={message.text}
            onDismiss={() => setMessage(null)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Lower Image (Red)</h2>
            <FileUpload
              accept="image/*"
              onFileSelect={handleLowerImageSelect}
              label="Upload Lower Image"
            />
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Upper Image (Green)</h2>
            <FileUpload
              accept="image/*"
              onFileSelect={handleUpperImageSelect}
              label="Upload Upper Image"
            />
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Transform Controls</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Translate X: {transform.dx}px
                </label>
                <input
                  type="range"
                  min="-500"
                  max="500"
                  value={transform.dx}
                  onChange={(e) => setTransform({ ...transform, dx: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Translate Y: {transform.dy}px
                </label>
                <input
                  type="range"
                  min="-500"
                  max="500"
                  value={transform.dy}
                  onChange={(e) => setTransform({ ...transform, dy: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Rotation: {transform.rotation}°
                </label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={transform.rotation}
                  onChange={(e) => setTransform({ ...transform, rotation: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Scale: {transform.scale_x.toFixed(2)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.01"
                  value={transform.scale_x}
                  onChange={(e) => {
                    const scale = Number(e.target.value);
                    setTransform({ ...transform, scale_x: scale, scale_y: scale });
                  }}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Opacity: {transform.opacity.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={transform.opacity}
                  onChange={(e) => setTransform({ ...transform, opacity: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <button
                onClick={handleUpdateTransform}
                disabled={!lowerImage || !upperImage || loading}
                className="btn-primary w-full"
              >
                Update Overlay
              </button>

              <button
                onClick={handleReset}
                disabled={loading}
                className="btn-secondary w-full"
              >
                Reset Transform
              </button>

              <button
                onClick={handleSave}
                disabled={!overlayUrl || loading}
                className="btn-success w-full"
              >
                Save Overlay
              </button>
            </div>
          </div>
        </div>

        {/* Display */}
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Overlay Result</h2>
            {overlayUrl ? (
              <ImageCanvas imageUrl={overlayUrl} />
            ) : (
              <div className="flex items-center justify-center h-96 bg-gray-100 dark:bg-gray-800 rounded">
                <p className="text-gray-500">Upload both images and adjust transform</p>
              </div>
            )}
            
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              <p>🔴 Red: Lower image only</p>
              <p>🟢 Green: Upper image only</p>
              <p>🔵 Blue: Both images match</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
