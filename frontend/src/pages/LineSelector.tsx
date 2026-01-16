import React, { useState } from 'react';
import { FileUpload } from '../components/FileUpload';
import { ImageCanvas } from '../components/ImageCanvas';
import { StatusMessage } from '../components/StatusMessage';
import { lineSelectorService } from '../services/backendService';
import type { UploadedFile } from '../types';

export const LineSelector: React.FC = () => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [totalLines, setTotalLines] = useState(0);
  const [selectedLines, setSelectedLines] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);

  const handleFileSelect = async (files: UploadedFile[]) => {
    if (files.length === 0) return;
    
    try {
      setLoading(true);
      const response = await lineSelectorService.getImage();
      setImageUrl(response.image);
      setTotalLines(response.totalLines);
      setSelectedLines(response.selectedLines);
      setMessage({ type: 'info', text: `Detected ${response.totalLines} lines. Click to select.` });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load image' });
    } finally {
      setLoading(false);
    }
  };

  const handleCanvasClick = async (x: number, y: number) => {
    try {
      setLoading(true);
      await lineSelectorService.clickLine({ x, y });
      
      const response = await lineSelectorService.getImage();
      setImageUrl(response.image);
      setSelectedLines(response.selectedLines);
      setMessage({ type: 'success', text: `Selected: ${response.selectedLines}/${response.totalLines} lines` });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to select line' });
    } finally {
      setLoading(false);
    }
  };

  const handleClearSelection = async () => {
    try {
      setLoading(true);
      await lineSelectorService.clearSelection();
      const response = await lineSelectorService.getImage();
      setImageUrl(response.image);
      setSelectedLines(0);
      setMessage({ type: 'info', text: 'Selection cleared' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to clear selection' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSelected = async () => {
    try {
      setLoading(true);
      const response = await lineSelectorService.removeSelected();
      setImageUrl(response.image);
      setMessage({ type: 'success', text: 'Lines removed (preview)' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to remove lines' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const response = await lineSelectorService.saveResult();
      setMessage({ type: 'success', text: `Saved to: ${response.path}` });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save result' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Line Selector</h1>
      
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
        {/* Upload & Controls */}
        <div className="lg:col-span-1">
          <div className="card mb-4">
            <h2 className="text-xl font-semibold mb-4">Upload Image</h2>
            <FileUpload
              accept="image/*"
              onFileSelect={handleFileSelect}
              label="Select Image"
            />
          </div>

          {imageUrl && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Statistics</h2>
              <div className="space-y-2 mb-4">
                <p className="text-sm">
                  <span className="font-medium">Total Lines:</span> {totalLines}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Selected:</span> {selectedLines}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Remaining:</span> {totalLines - selectedLines}
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleRemoveSelected}
                  disabled={selectedLines === 0 || loading}
                  className="btn-primary w-full"
                >
                  Preview Removal
                </button>

                <button
                  onClick={handleClearSelection}
                  disabled={selectedLines === 0 || loading}
                  className="btn-secondary w-full"
                >
                  Clear Selection
                </button>

                <button
                  onClick={handleSave}
                  disabled={!imageUrl || loading}
                  className="btn-success w-full"
                >
                  Save Result
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Interactive Canvas</h2>
            {imageUrl ? (
              <ImageCanvas
                imageUrl={imageUrl}
                onClick={handleCanvasClick}
              />
            ) : (
              <div className="flex items-center justify-center h-96 bg-gray-100 dark:bg-gray-800 rounded">
                <p className="text-gray-500">Upload an image to start</p>
              </div>
            )}
            
            {totalLines > 0 && (
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                <p>Click near a line to select/deselect it</p>
                <p>Selected lines are highlighted in green</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
