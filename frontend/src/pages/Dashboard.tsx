import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusMessage } from '../components/StatusMessage';
import axios from 'axios';

const PROCESSING_API = 'http://localhost:5004';

interface ProcessedImages {
  jobId: string;
  file1Name: string;
  file2Name: string;
  image1Url: string;
  image2Url: string;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [images, setImages] = useState<ProcessedImages | null>(null);
  const [message, setMessage] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);
  const [selectedImage, setSelectedImage] = useState<1 | 2>(1);

  useEffect(() => {
    // Load processed images from localStorage
    const jobId = localStorage.getItem('dashboard_job_id');
    const file1Name = localStorage.getItem('dashboard_file1');
    const file2Name = localStorage.getItem('dashboard_file2');

    if (jobId && file1Name && file2Name) {
      setImages({
        jobId,
        file1Name,
        file2Name,
        image1Url: `${PROCESSING_API}/image/${jobId}/1`,
        image2Url: `${PROCESSING_API}/image/${jobId}/2`,
      });
      setMessage({ type: 'success', text: 'Processing complete! Choose a tool below.' });
    } else {
      setMessage({ type: 'error', text: 'No processed images found. Please upload files first.' });
    }
  }, []);

  const handleOverlayComparison = () => {
    if (!images) return;
    // Pass job ID to overlay page
    localStorage.setItem('overlay_job_id', images.jobId);
    navigate('/overlay');
  };

  const handleSAMRemover = (imageNum: 1 | 2) => {
    if (!images) return;
    // Store selected image URL for SAM tool
    const imageUrl = imageNum === 1 ? images.image1Url : images.image2Url;
    localStorage.setItem('sam_image_url', imageUrl);
    navigate('/sam-remover');
  };

  const handleLineSelector = (imageNum: 1 | 2) => {
    if (!images) return;
    // Store selected image URL for Line Selector tool
    const imageUrl = imageNum === 1 ? images.image1Url : images.image2Url;
    localStorage.setItem('line_selector_image_url', imageUrl);
    navigate('/line-selector');
  };

  const handleDownload = async (imageNum: 1 | 2) => {
    if (!images) return;
    
    try {
      const imageUrl = imageNum === 1 ? images.image1Url : images.image2Url;
      const fileName = imageNum === 1 ? images.file1Name : images.file2Name;
      
      const response = await axios.get(imageUrl, { responseType: 'blob' });
      const blob = response.data;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `processed_${fileName}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setMessage({ type: 'success', text: `Downloaded ${fileName}` });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to download image' });
    }
  };

  const handleStartOver = () => {
    // Clear localStorage
    localStorage.removeItem('dashboard_job_id');
    localStorage.removeItem('dashboard_file1');
    localStorage.removeItem('dashboard_file2');
    localStorage.removeItem('overlay_job_id');
    navigate('/');
  };

  if (!images) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          {message && (
            <StatusMessage
              type={message.type}
              message={message.text}
              onDismiss={() => setMessage(null)}
            />
          )}
          <button onClick={handleStartOver} className="btn-primary mt-6">
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Processing Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Your images are ready! Choose a tool to continue editing.
        </p>
      </div>

      {/* Message */}
      {message && (
        <div className="mb-6">
          <StatusMessage
            type={message.type}
            message={message.text}
            onDismiss={() => setMessage(null)}
          />
        </div>
      )}

      {/* Processed Images Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Image 1 */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Drawing 1</h3>
            <span className="text-sm text-gray-500">{images.file1Name}</span>
          </div>
          <div className="mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
            <img 
              src={images.image1Url} 
              alt="Processed Drawing 1"
              className="w-full h-auto"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleDownload(1)}
              className="btn-secondary flex-1"
            >
              📥 Download
            </button>
            <button
              onClick={() => setSelectedImage(1)}
              className={`flex-1 ${selectedImage === 1 ? 'btn-primary' : 'btn-secondary'}`}
            >
              {selectedImage === 1 ? '✓ Selected' : 'Select'}
            </button>
          </div>
        </div>

        {/* Image 2 */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Drawing 2</h3>
            <span className="text-sm text-gray-500">{images.file2Name}</span>
          </div>
          <div className="mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
            <img 
              src={images.image2Url} 
              alt="Processed Drawing 2"
              className="w-full h-auto"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleDownload(2)}
              className="btn-secondary flex-1"
            >
              📥 Download
            </button>
            <button
              onClick={() => setSelectedImage(2)}
              className={`flex-1 ${selectedImage === 2 ? 'btn-primary' : 'btn-secondary'}`}
            >
              {selectedImage === 2 ? '✓ Selected' : 'Select'}
            </button>
          </div>
        </div>
      </div>

      {/* Tools Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-6">Available Tools</h2>

        {/* Compare Both Images */}
        <div className="card mb-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-2 border-blue-200 dark:border-blue-800">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-2xl font-bold mb-2 flex items-center">
                <span className="text-4xl mr-3">🔄</span>
                Overlay Comparison
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Compare both drawings side-by-side with red/green/blue overlay. Adjust position, rotation, and scale to align perfectly.
              </p>
              <div className="flex gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 rounded">🔴 Drawing 1 only</span>
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded">🟢 Drawing 2 only</span>
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded">🔵 Both match</span>
              </div>
            </div>
            <button
              onClick={handleOverlayComparison}
              className="btn-primary text-lg px-8 py-4"
            >
              Compare Both →
            </button>
          </div>
        </div>

        {/* Edit Individual Images */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* SAM Remover */}
          <div className="card hover:shadow-xl transition-shadow">
            <div className="text-center mb-4">
              <div className="text-6xl mb-3">🎯</div>
              <h3 className="text-2xl font-bold mb-2">SAM Annotation Remover</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Click on annotations to remove them using AI segmentation (MobileSAM).
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => handleSAMRemover(1)}
                className="btn-primary w-full"
              >
                Edit Drawing 1
              </button>
              <button
                onClick={() => handleSAMRemover(2)}
                className="btn-primary w-full"
              >
                Edit Drawing 2
              </button>
            </div>
          </div>

          {/* Line Selector */}
          <div className="card hover:shadow-xl transition-shadow">
            <div className="text-center mb-4">
              <div className="text-6xl mb-3">📏</div>
              <h3 className="text-2xl font-bold mb-2">Line Selector</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Detect and selectively remove lines from drawings using Hough Transform.
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => handleLineSelector(1)}
                className="btn-primary w-full"
              >
                Edit Drawing 1
              </button>
              <button
                onClick={() => handleLineSelector(2)}
                className="btn-primary w-full"
              >
                Edit Drawing 2
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <button
          onClick={handleStartOver}
          className="btn-secondary"
        >
          ← Start Over
        </button>
        
        <div className="text-sm text-gray-500">
          <p>✓ PDF Converted</p>
          <p>✓ Images Upscaled 2x</p>
          <p>✓ Text Annotations Removed</p>
        </div>
      </div>
    </div>
  );
};
