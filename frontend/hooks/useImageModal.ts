/**
 * useImageModal Hook
 * Manages image modal state
 */

import { useState, useCallback } from 'react';

interface UseImageModalReturn {
  selectedImage: string | null;
  showImageModal: boolean;
  openImageModal: (imageUrl: string) => void;
  closeImageModal: () => void;
}

export const useImageModal = (): UseImageModalReturn => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  const openImageModal = useCallback((imageUrl: string) => {
    setSelectedImage(imageUrl);
    setShowImageModal(true);
  }, []);

  const closeImageModal = useCallback(() => {
    setShowImageModal(false);
    setSelectedImage(null);
  }, []);

  return {
    selectedImage,
    showImageModal,
    openImageModal,
    closeImageModal,
  };
};