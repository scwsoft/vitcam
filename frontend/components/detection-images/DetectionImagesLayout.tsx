// components/detection-images/DetectionImagesLayout.tsx

/**
 * DetectionImagesLayout Component
 * 
 * Main layout wrapper for detection images page.
 * Provides consistent structure and spacing.
 */

import React from 'react';

interface DetectionImagesLayoutProps {
  children: React.ReactNode;
}

export function DetectionImagesLayout({ children }: DetectionImagesLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-[1800px] mx-auto p-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Detection Images
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Manage and view captured detection images from all cameras
          </p>
        </div>

        {/* Content */}
        {children}
      </div>
    </div>
  );
}