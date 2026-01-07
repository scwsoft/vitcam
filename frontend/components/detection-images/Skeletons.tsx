// components/ui/Skeletons.tsx (OPTIONAL - Add to your existing Skeletons component)

/**
 * Detection Images Grid Skeleton
 * 
 * Add this to your existing Skeletons component if you want skeleton loading states
 */

export const DetectionImagesGridSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
    {Array.from({ length: 12 }).map((_, i) => (
      <div 
        key={i} 
        className="bg-white dark:bg-[#1a2332] rounded-lg overflow-hidden animate-pulse"
      >
        {/* Image skeleton */}
        <div className="aspect-video bg-gray-200 dark:bg-gray-700" />
        
        {/* Info skeleton */}
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 h-9 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            <div className="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

// ============================================================================
// How to integrate into your existing Skeletons component:
// ============================================================================

/*
// In your components/ui/Skeletons.tsx, add this to the Skeletons object:

export const Skeletons = {
  // ... your existing skeletons
  VideoCard: VideoCardSkeleton,
  
  // Add this:
  DetectionImagesGrid: DetectionImagesGridSkeleton,
};

// Then you can use it in the page like this:
<Skeletons.DetectionImagesGrid />
*/

// ============================================================================
// Or export as standalone component:
// ============================================================================

export default DetectionImagesGridSkeleton;

// Usage:
// import DetectionImagesGridSkeleton from '@/components/ui/Skeletons/DetectionImagesGrid';
// <DetectionImagesGridSkeleton />