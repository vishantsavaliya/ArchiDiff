import React, { useState } from 'react';
import { FileUpload } from '../components/FileUpload';
import { ImageCanvas } from '../components/ImageCanvas';
import { StatusMessage } from '../components/StatusMessage';
import { samService, downloadFile } from '../services/backendService';
import type { UploadedFile } from '../types';

type Point = { x: number; y: number; label: 1 | 0 };

export const SAMRemover: React.FC = () => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [maskUrl, setMaskUrl] = useState<string>('');
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);
  const [showMask, setShowMask] = useState(true);

  const handleFileSelect = async (files: UploadedFile[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setImageUrl(file.preview || '');
    setPoints([]);
    setMaskUrl('');
    setMessage({ type: 'info', text: 'Image loaded. Click to add points.' });
  };

  const handleCanvasClick = async (x: number, y: number) => {
    // Positive point (label 1)
    const newPoint: Point = { x, y, label: 1 };
    const updatedPoints = [...points, newPoint];
    setPoints(updatedPoints);

    try {
      setLoading(true);
      const response = await samService.predictMask({
        points: updatedPoints,
      });
      setMaskUrl(response.maskImage);
      setMessage({ type: 'success', text: `Mask generated (${updatedPoints.length} points)` });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to generate mask' });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyMask = async () => {
    try {
      setLoading(true);
      const response = await samService.applyMask();
      setImageUrl(response.image);
      setMaskUrl('');
      setPoints([]);
      setMessage({ type: 'success', text: 'Annotation removed successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to apply mask' });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      setLoading(true);
      const response = await samService.reset();
      setImageUrl(response.image);
      setMaskUrl('');
      setPoints([]);
      setMessage({ type: 'info', text: 'Reset to original image' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to reset image' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const blob = await samService.save();
      downloadFile(blob, 'sam_removed.png');
      setMessage({ type: 'success', text: 'Image saved' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save image' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">SAM Annotation Remover</h1>
      
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
        {/* Upload Section */}
        <div className="lg:col-span-1">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Upload Image</h2>
            <FileUpload
              accept="image/*"
              onFileSelect={handleFileSelect}
              label="Select Image"
            />
            
            {imageUrl && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showMask"
                    checked={showMask}
                    onChange={(e) => setShowMask(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="showMask" className="text-sm">Show mask overlay</label>
                </div>
                
                <button
                  onClick={handleApplyMask}
                  disabled={!maskUrl || loading}
                  className="btn-success w-full"
                >
                  Apply Mask & Remove
                </button>
                
                <button
                  onClick={handleReset}
                  disabled={loading}
                  className="btn-secondary w-full"
                >
                  Reset
                </button>
                
                <button
                  onClick={handleSave}
                  disabled={!imageUrl || loading}
                  className="btn-primary w-full"
                >
                  Save Result
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Canvas Section */}
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Interactive Canvas</h2>
            {imageUrl ? (
              <ImageCanvas
                imageUrl={imageUrl}
                maskUrl={maskUrl}
                showMask={showMask}
                onClick={handleCanvasClick}
              />
            ) : (
              <div className="flex items-center justify-center h-96 bg-gray-100 dark:bg-gray-800 rounded">
                <p className="text-gray-500">Upload an image to start</p>
              </div>
            )}
            
            {points.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Points: {points.length} | Click to add more points
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
