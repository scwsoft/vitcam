// app/detection-images/page.tsx - UPDATED FOR DYNAMIC DETECTION TYPES
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useDetectionImages } from '@/hooks/useDetectionImages';
import { DetectionImagesLayout } from '@/components/detection-images/DetectionImagesLayout';
import { FilterControls } from '@/components/detection-images/FilterControls';
import { DetectionImageGrid } from '@/components/detection-images/DetectionImageGrid';
import { DetectionImageList } from '@/components/detection-images/DetectionImageList';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/detection-images/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ImageModal } from '@/components/detection-images/ImageModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DetectionImagesGridSkeleton } from '@/components/detection-images/Skeletons';
import type { 
  DetectionImage,
  DetectionImageFilterState, 
  DetectionImageSortConfig, 
  ViewMode 
} from '@/types/detection-images.types';
import { DEFAULT_ITEMS_PER_PAGE } from '@/constants/detection-images.constants';
import { createClient } from '@/utils/supabase/client';

export default function DetectionImagesPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  // View and UI state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());

  // Modal state
  const [selectedImage, setSelectedImage] = useState<DetectionImage | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Filter state
  const [filters, setFilters] = useState<DetectionImageFilterState>({
    camera: 'all',
    detectionType: 'all',
    dateFrom: '',
    dateTo: '',
  });

  // Sort configuration
  const [sortConfig, setSortConfig] = useState<DetectionImageSortConfig>({
    sortBy: 'date',
    sortOrder: 'desc',
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);

  // Authentication check
  useEffect(() => {
    let mounted = true;

    async function checkUser() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          setAuthLoading(false);
        } else {
          router.push('/signin');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        if (mounted) {
          router.push('/signin');
        }
      }
    }

    checkUser();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  // Reset pagination helper
  const resetPagination = () => {
    setCurrentPage(1);
  };

  // Memoize the options object to prevent infinite loops
  const hookOptions = useMemo(() => ({
    filters: {
      ...filters,
      minConfidence: 0,
    },
    searchQuery,
    sortConfig,
    currentPage,
    itemsPerPage,
  }), [filters, searchQuery, sortConfig, currentPage, itemsPerPage]);

  // Fetch detection images with all filters and pagination
  const {
    images,
    cameras,
    detectionTypes, // NEW: Get dynamic detection types
    loading,
    error,
    totalCount,
    totalPages,
    totalStorage,
    refetch,
    deleteImage,
    deleteImages,
    downloadImage,
  } = useDetectionImages(hookOptions);

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<DetectionImageFilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    resetPagination();
  };

  // Handle sort changes
  const handleSortChange = (sortBy: DetectionImageSortConfig['sortBy']) => {
    setSortConfig((prev) => ({
      sortBy,
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
    resetPagination();
  };

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    resetPagination();
  };

  // Handle items per page change
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    resetPagination();
  };

  // Clear all filters
  const handleClearFilters = () => {
    setFilters({
      camera: 'all',
      detectionType: 'all',
      dateFrom: '',
      dateTo: '',
    });
    setSearchQuery('');
    resetPagination();
  };

  // Selection handlers
  const handleSelectImage = (id: string) => {
    setSelectedImages((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return newSelected;
    });
  };

  const handleSelectAll = () => {
    if (selectedImages.size === images.length && images.length > 0) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(images.map((img) => img.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedImages(new Set());
  };

  // Image modal handlers
  const handleImageClick = (image: DetectionImage) => {
    setSelectedImage(image);
    setIsImageModalOpen(true);
  };

  const handleCloseImageModal = () => {
    setIsImageModalOpen(false);
    setTimeout(() => setSelectedImage(null), 300);
  };

  const handleModalNavigate = (direction: 'prev' | 'next') => {
    if (!selectedImage) return;
    
    const currentIndex = images.findIndex(img => img.id === selectedImage.id);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < images.length) {
      setSelectedImage(images[newIndex]);
    }
  };

  // Delete handlers with confirmation
  const handleDeleteSelected = () => {
    if (selectedImages.size === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: 'Delete Images',
      message: `Are you sure you want to delete ${selectedImages.size} image${selectedImages.size > 1 ? 's' : ''}? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await deleteImages(Array.from(selectedImages));
          handleClearSelection();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (error) {
          console.error('Failed to delete images:', error);
          alert('Failed to delete images. Please try again.');
        }
      },
    });
  };

  const handleDeleteSingle = (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Image',
      message: image 
        ? `Are you sure you want to delete this ${image.detection_type} detection from ${image.camera_name}?`
        : 'Are you sure you want to delete this image?',
      onConfirm: async () => {
        try {
          await deleteImage(imageId);
          setSelectedImages((prev) => {
            const newSelected = new Set(prev);
            newSelected.delete(imageId);
            return newSelected;
          });
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          
          if (selectedImage?.id === imageId) {
            handleCloseImageModal();
          }
        } catch (error) {
          console.error('Failed to delete image:', error);
          alert('Failed to delete image. Please try again.');
        }
      },
    });
  };

  const handleCancelConfirm = () => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
  };

  // Check if any filters are active
  const hasActiveFilters =
    filters.camera !== 'all' ||
    filters.detectionType !== 'all' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '' ||
    searchQuery !== '';

  // Auth loading state
  if (authLoading) {
    return (
      <DetectionImagesLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Authenticating...</p>
          </div>
        </div>
      </DetectionImagesLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <DetectionImagesLayout>
        <ErrorState 
          message={error}
          onRetry={refetch}
        />
      </DetectionImagesLayout>
    );
  }

  const currentImageIndex = selectedImage ? images.findIndex(img => img.id === selectedImage.id) : -1;

  return (
    <DetectionImagesLayout>
      {/* Filter Controls - NOW WITH DYNAMIC DETECTION TYPES */}
      <FilterControls
        cameras={cameras}
        detectionTypes={detectionTypes} // NEW: Pass dynamic detection types
        filters={filters}
        searchQuery={searchQuery}
        sortConfig={sortConfig}
        viewMode={viewMode}
        itemsPerPage={itemsPerPage}
        showFilters={showFilters}
        hasActiveFilters={hasActiveFilters}
        selectedCount={selectedImages.size}
        totalCount={totalCount}
        totalStorage={totalStorage}
        onFilterChange={handleFilterChange}
        onSearchChange={handleSearch}
        onSortChange={handleSortChange}
        onViewModeChange={setViewMode}
        onItemsPerPageChange={handleItemsPerPageChange}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onClearFilters={handleClearFilters}
        onDeleteSelected={handleDeleteSelected}
        onSelectAll={handleSelectAll}
        allSelected={selectedImages.size === images.length && images.length > 0}
      />

      {/* Loading State */}
      {loading && images.length === 0 ? (
        <DetectionImagesGridSkeleton />
      ) : images.length === 0 ? (
        <EmptyState 
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
        />
      ) : (
        <>
          {viewMode === 'grid' ? (
            <DetectionImageGrid
              images={images}
              selectedImages={selectedImages}
              onSelectImage={handleSelectImage}
              onDeleteImage={handleDeleteSingle}
              onDownloadImage={downloadImage}
              onImageClick={handleImageClick}
            />
          ) : (
            <DetectionImageList
              images={images}
              selectedImages={selectedImages}
              onSelectImage={handleSelectImage}
              onSelectAll={handleSelectAll}
              onDeleteImage={handleDeleteSingle}
              onDownloadImage={downloadImage}
              onImageClick={handleImageClick}
              allSelected={selectedImages.size === images.length && images.length > 0}
            />
          )}

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              totalCount={totalCount}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}

      {loading && images.length > 0 && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-white dark:bg-[#1a2332] rounded-lg p-6 shadow-xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-700 dark:text-gray-300">Loading images...</p>
          </div>
        </div>
      )}

      {selectedImage && (
        <ImageModal
          image={selectedImage}
          isOpen={isImageModalOpen}
          onClose={handleCloseImageModal}
          onDownload={() => downloadImage(selectedImage)}
          onDelete={() => handleDeleteSingle(selectedImage.id)}
          onPrevious={() => handleModalNavigate('prev')}
          onNext={() => handleModalNavigate('next')}
          hasPrevious={currentImageIndex > 0}
          hasNext={currentImageIndex < images.length - 1}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        onConfirm={confirmDialog.onConfirm}
        onCancel={handleCancelConfirm}
      />
    </DetectionImagesLayout>
  );
}