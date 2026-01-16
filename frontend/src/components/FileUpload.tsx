import React, { useRef, useState } from 'react';
import type { UploadedFile } from '../types';

interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  onFileSelect: (files: UploadedFile[]) => void;
  maxSize?: number; // in MB
  label?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  accept = 'image/*',
  multiple = false,
  onFileSelect,
  maxSize = 50,
  label = 'Upload File',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string>('');

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    setError('');

    const uploadedFiles: UploadedFile[] = [];
    const maxSizeBytes = maxSize * 1024 * 1024;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (file.size > maxSizeBytes) {
        setError(`File ${file.name} exceeds ${maxSize}MB limit`);
        continue;
      }

      uploadedFiles.push({
        name: file.name,
        size: file.size,
        type: file.type,
        path: URL.createObjectURL(file),
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      });
    }

    if (uploadedFiles.length > 0) {
      onFileSelect(uploadedFiles);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-primary bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-primary'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
        />
        
        <div className="flex flex-col items-center space-y-2">
          <svg
            className="w-12 h-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-lg font-medium">{label}</p>
          <p className="text-sm text-gray-500">
            Drag & drop or click to browse
          </p>
          <p className="text-xs text-gray-400">
            Max size: {maxSize}MB
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
};
