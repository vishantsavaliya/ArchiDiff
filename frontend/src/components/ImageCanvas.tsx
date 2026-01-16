import React, { useRef, useEffect, useState } from 'react';

interface ImageCanvasProps {
  imageUrl: string;
  onClick?: (x: number, y: number) => void;
  maskUrl?: string;
  showMask?: boolean;
  width?: number;
  height?: number;
}

export const ImageCanvas: React.FC<ImageCanvasProps> = ({
  imageUrl,
  onClick,
  maskUrl,
  showMask = true,
  width,
  height,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      const aspectRatio = img.width / img.height;
      const maxWidth = width || canvas.parentElement?.clientWidth || 800;
      const maxHeight = height || 600;

      let drawWidth = maxWidth;
      let drawHeight = drawWidth / aspectRatio;

      if (drawHeight > maxHeight) {
        drawHeight = maxHeight;
        drawWidth = drawHeight * aspectRatio;
      }

      canvas.width = drawWidth;
      canvas.height = drawHeight;
      setDimensions({ width: drawWidth, height: drawHeight });

      // Draw base image
      ctx.drawImage(img, 0, 0, drawWidth, drawHeight);

      // Draw mask overlay if available
      if (maskUrl && showMask) {
        const maskImg = new Image();
        maskImg.onload = () => {
          ctx.globalAlpha = 0.5;
          ctx.drawImage(maskImg, 0, 0, drawWidth, drawHeight);
          ctx.globalAlpha = 1.0;
        };
        maskImg.src = maskUrl;
      }
    };
    img.src = imageUrl;
  }, [imageUrl, maskUrl, showMask, width, height]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onClick) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert to image coordinates
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const imageX = x * scaleX;
    const imageY = y * scaleY;

    onClick(imageX, imageY);
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="border border-gray-300 dark:border-gray-600 rounded cursor-crosshair max-w-full"
        style={{ display: 'block' }}
      />
      {dimensions.width > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          {dimensions.width} × {dimensions.height}
        </p>
      )}
    </div>
  );
};
