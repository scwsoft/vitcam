// types/detection-images.types.ts - UPDATED TYPES

/**
 * Add these updates to your existing types file
 */

// Update UseDetectionImagesReturn to include detectionTypes
export interface UseDetectionImagesReturn {
  images: DetectionImage[];
  cameras: Camera[];
  detectionTypes: string[]; // NEW: Dynamic detection types
  loading: boolean;
  error: string | null;
  totalCount: number;
  totalPages: number;
  totalStorage: number;
  refetch: () => Promise<void>;
  deleteImage: (id: string) => Promise<void>;
  deleteImages: (ids: string[]) => Promise<void>;
  downloadImage: (image: DetectionImage) => Promise<void>;
}

// Update FilterControlsProps to include detectionTypes
export interface FilterControlsProps {
  cameras: Camera[];
  detectionTypes: string[]; // NEW: Dynamic detection types
  filters: DetectionImageFilterState;
  searchQuery: string;
  sortConfig: DetectionImageSortConfig;
  viewMode: ViewMode;
  itemsPerPage: number;
  showFilters: boolean;
  hasActiveFilters: boolean;
  selectedCount: number;
  totalCount: number;
  totalStorage: number;
  onFilterChange: (filters: Partial<DetectionImageFilterState>) => void;
  onSearchChange: (query: string) => void;
  onSortChange: (sortBy: DetectionImageSortConfig['sortBy']) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onItemsPerPageChange: (perPage: number) => void;
  onToggleFilters: () => void;
  onClearFilters: () => void;
  onDeleteSelected: () => void;
  onSelectAll: () => void;
  allSelected: boolean;
}