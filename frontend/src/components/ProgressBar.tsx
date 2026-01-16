import React from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  color?: 'primary' | 'success' | 'danger';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  showPercentage = true,
  color = 'primary',
}) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const colorClasses = {
    primary: 'bg-primary',
    success: 'bg-green-500',
    danger: 'bg-red-500',
  };

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && <span className="text-sm font-medium">{label}</span>}
          {showPercentage && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {clampedProgress.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-300 ease-out`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};
