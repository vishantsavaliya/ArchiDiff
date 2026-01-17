import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FileUpload } from '../components/FileUpload';
import { StatusMessage } from '../components/StatusMessage';
import { ProgressBar } from '../components/ProgressBar';
import type { UploadedFile } from '../types';

const PROCESSING_API = 'http://localhost:5004';

interface ProcessingStatus {
  status: string;
  progress: number;
  current_step: string;
  file1: string;
  file2: string;
  error?: string;
}

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [message, setMessage] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);

  const handleFile1Select = (files: UploadedFile[]) => {
    if (files.length === 0) return;
    // Create File object from UploadedFile
    fetch(files[0].path)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], files[0].name, { type: files[0].type });
        setFile1(file);
        setMessage({ type: 'success', text: `Selected: ${file.name}` });
      });
  };

  const handleFile2Select = (files: UploadedFile[]) => {
    if (files.length === 0) return;
    fetch(files[0].path)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], files[0].name, { type: files[0].type });
        setFile2(file);
        setMessage({ type: 'success', text: `Selected: ${file.name}` });
      });
  };

  const handleStartProcessing = async () => {
    if (!file1 || !file2) {
      setMessage({ type: 'error', text: 'Please upload both files' });
      return;
    }

    const formData = new FormData();
    formData.append('file1', file1);
    formData.append('file2', file2);

    try {
      setProcessing(true);
      setMessage({ type: 'info', text: 'Uploading files...' });

      const response = await axios.post(`${PROCESSING_API}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const jobId = response.data.job_id;
      setMessage({ type: 'info', text: 'Processing started...' });

      // Poll for status
      pollStatus(jobId);
    } catch (error) {
      console.error('Upload error:', error);
      setProcessing(false);
      setMessage({ type: 'error', text: 'Network error. Make sure backend is running on port 5004.' });
    }
  };

  const pollStatus = async (jobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await axios.get(`${PROCESSING_API}/status/${jobId}`);
        const statusData = response.data;
        setStatus(statusData);

        if (statusData.status === 'completed') {
          clearInterval(pollInterval);
          setProcessing(false);
          setMessage({ type: 'success', text: 'Processing complete! Redirecting...' });

          setTimeout(() => {
            localStorage.setItem('dashboard_job_id', jobId);
            localStorage.setItem('dashboard_file1', statusData.file1);
            localStorage.setItem('dashboard_file2', statusData.file2);
            navigate('/canvas-editor');
          }, 2000);
        } else if (statusData.status === 'failed') {
          clearInterval(pollInterval);
          setProcessing(false);
          setMessage({ type: 'error', text: `Error: ${statusData.error || 'Processing failed'}` });
        }
      } catch (error) {
        console.error('Status poll error:', error);
      }
    }, 1000);
  };

  const getStepIcon = (step: string) => {
    if (step.includes('PDF')) return '📄';
    if (step.includes('Upscaling')) return '🔍';
    if (step.includes('text') || step.includes('Text')) return '✏️';
    if (step.includes('Complete')) return '✅';
    return '⚙️';
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            ArchiDiff
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Upload 2 drawings to compare
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

        {/* Upload Section */}
        {!processing && (
          <div className="card bg-white dark:bg-gray-800 p-8">
            <div className="border-4 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8">
              <div className="text-6xl mb-6 text-center">📁</div>
              <h2 className="text-2xl font-bold mb-8 text-center">Upload 2 Files</h2>

              <div className="space-y-4 mb-8">
                <FileUpload
                  label="First Drawing"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onFileSelect={handleFile1Select}
                />
                {file1 && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                    <p className="text-sm font-medium">✓ {file1.name}</p>
                  </div>
                )}

                <FileUpload
                  label="Second Drawing"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onFileSelect={handleFile2Select}
                />
                {file2 && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                    <p className="text-sm font-medium">✓ {file2.name}</p>
                  </div>
                )}
              </div>

              <button
                onClick={handleStartProcessing}
                disabled={!file1 || !file2}
                className="btn-primary text-xl px-16 py-5 w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Processing
              </button>
            </div>
          </div>
        )}

        {/* Processing Status */}
        {processing && status && (
          <div className="card bg-white dark:bg-gray-800 p-8">
            <div className="flex items-center justify-center mb-6">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-medium flex items-center">
                    <span className="text-3xl mr-3">{getStepIcon(status.current_step)}</span>
                    {status.current_step}
                  </span>
                  <span className="text-lg font-bold text-blue-600">{status.progress}%</span>
                </div>
                <ProgressBar progress={status.progress} showPercentage={false} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
