import React, { useState, useEffect } from 'react';
import { AnalyticsFilters as FilterType } from '@/types/detection';
import { Filter, X, ChevronDown } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface AnalyticsFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
}

const AnalyticsFilters: React.FC<AnalyticsFiltersProps> = ({ filters, onFiltersChange }) => {
  const supabase = createClientComponentClient();
  const [isOpen, setIsOpen] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<{ id: number; name: string }[]>([]);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  const fetchFilterOptions = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 Fetching filter options...');
      
      // Approach 1: Try using PostgreSQL functions for distinct values
      // This is more efficient than fetching all rows and deduplicating in JS
      
      // Fetch unique cameras using a raw query approach
      const { data: allDetections, error: detectionsError } = await supabase
        .from('object_detection_events')
        .select('camera_id, camera_name, object_class_name');

      if (detectionsError) {
        console.error('❌ Error fetching detections:', detectionsError);
        return;
      }

      console.log('📊 Total detections fetched:', allDetections?.length || 0);

      if (allDetections && allDetections.length > 0) {
        // Extract unique cameras using JavaScript Map
        const cameraMap = new Map<number, { id: number; name: string; count: number }>();
        const classMap = new Map<string, number>();

        allDetections.forEach((detection) => {
          // Process cameras
          if (detection.camera_id != null) {
            const cameraId = Number(detection.camera_id);
            if (!isNaN(cameraId)) {
              if (!cameraMap.has(cameraId)) {
                cameraMap.set(cameraId, {
                  id: cameraId,
                  name: detection.camera_name || `Camera ${cameraId}`,
                  count: 0,
                });
              }
              const camera = cameraMap.get(cameraId)!;
              camera.count++;
            }
          }

          // Process object classes
          if (detection.object_class_name) {
            const className = detection.object_class_name.trim();
            if (className) {
              classMap.set(className, (classMap.get(className) || 0) + 1);
            }
          }
        });

        // Convert cameras map to sorted array
        const uniqueCameras = Array.from(cameraMap.values())
          .sort((a, b) => a.id - b.id)
          .map(({ id, name }) => ({ id, name }));

        // Convert classes map to sorted array
        const uniqueClasses = Array.from(classMap.keys()).sort();

        console.log('📹 Unique cameras found:', uniqueCameras.length);
        console.log('📹 Camera details:', uniqueCameras);
        console.log('🏷️  Unique classes found:', uniqueClasses.length);
        console.log('🏷️  Class details:', uniqueClasses);

        setAvailableCameras(uniqueCameras);
        setAvailableClasses(uniqueClasses);

        // If we only found one camera, let's debug why
        if (uniqueCameras.length === 1) {
          console.warn('⚠️  Only 1 camera found. Checking data...');
          const cameraIds = new Set(allDetections.map(d => d.camera_id));
          console.log('🔍 Unique camera_id values in data:', Array.from(cameraIds));
          
          // Check if camera_id values are all the same
          const firstTen = allDetections.slice(0, 10);
          console.log('🔍 First 10 detections camera info:', firstTen.map(d => ({
            camera_id: d.camera_id,
            camera_name: d.camera_name
          })));
        }
      } else {
        console.warn('⚠️  No detections found in database');
        setAvailableCameras([]);
        setAvailableClasses([]);
      }
    } catch (error) {
      console.error('❌ Unexpected error in fetchFilterOptions:', error);
    } finally {
      setIsLoading(false);
      console.log('✅ Filter options loading complete');
    }
  };

  const handleCameraToggle = (cameraId: number) => {
    const newCameraIds = filters.cameraIds.includes(cameraId)
      ? filters.cameraIds.filter((id) => id !== cameraId)
      : [...filters.cameraIds, cameraId];
    
    onFiltersChange({ ...filters, cameraIds: newCameraIds });
  };

  const handleClassToggle = (className: string) => {
    const newClasses = filters.objectClasses.includes(className)
      ? filters.objectClasses.filter((c) => c !== className)
      : [...filters.objectClasses, className];
    
    onFiltersChange({ ...filters, objectClasses: newClasses });
  };

  const handleTimeRangeChange = (timeRange: FilterType['timeRange']) => {
    onFiltersChange({ ...filters, timeRange });
  };

  const handleConfidenceChange = (confidence: number) => {
    onFiltersChange({ ...filters, confidenceMin: confidence });
  };

  const clearFilters = () => {
    onFiltersChange({
      cameraIds: [],
      objectClasses: [],
      confidenceMin: 0,
      timeRange: 'day',
    });
  };

  const hasActiveFilters =
    filters.cameraIds.length > 0 ||
    filters.objectClasses.length > 0 ||
    filters.confidenceMin > 0 ||
    filters.timeRange !== 'day';

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-3 px-6 py-3 rounded-xl border transition-all ${
          hasActiveFilters
            ? 'bg-violet-600/20 border-violet-500/50 text-violet-300'
            : 'bg-gray-100/50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-slate-700/50'
        }`}
      >
        <Filter className="w-5 h-5" />
        <span className="font-medium">Filters</span>
        {hasActiveFilters && (
          <span className="px-2 py-0.5 bg-violet-500/30 text-violet-300 rounded-full text-xs font-semibold">
            {filters.cameraIds.length + filters.objectClasses.length + (filters.confidenceMin > 0 ? 1 : 0)}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-[600px] bg-white dark:bg-gray-800/95 backdrop-blur-xl border border-gray-200 dark:border-gray-800/50 rounded-2xl shadow-2xl z-50 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Filter Options</h3>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white transition-colors"
                  >
                    Clear all
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-gray-100 dark:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {/* Time Range */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">Time Range</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['hour', 'day', 'week', 'month'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => handleTimeRangeChange(range)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        filters.timeRange === range
                          ? 'bg-violet-600 text-white'
                          : 'bg-gray-100/50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-slate-700/50'
                      }`}
                    >
                      {range.charAt(0).toUpperCase() + range.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Confidence Threshold */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Minimum Confidence
                  </label>
                  <span className="text-sm font-semibold text-white">
                    {(filters.confidenceMin * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.confidenceMin * 100}
                  onChange={(e) => handleConfidenceChange(Number(e.target.value) / 100)}
                  className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                />
              </div>

              {/* Cameras */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">
                  Cameras {availableCameras.length > 0 && `(${availableCameras.length})`}
                </label>
                {isLoading ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400 py-4 text-center">Loading cameras...</div>
                ) : availableCameras.length === 0 ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400 py-4 text-center">No cameras found</div>
                ) : (
                  <div className="max-h-32 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                    {availableCameras.map((camera) => (
                      <label
                        key={camera.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100/50 dark:bg-gray-800/50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={filters.cameraIds.includes(camera.id)}
                          onChange={() => handleCameraToggle(camera.id)}
                          className="w-4 h-4 rounded border-slate-600 text-violet-600 focus:ring-violet-500 focus:ring-offset-slate-900"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{camera.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Object Classes */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">
                  Object Classes {availableClasses.length > 0 && `(${availableClasses.length})`}
                </label>
                {isLoading ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400 py-4 text-center">Loading classes...</div>
                ) : availableClasses.length === 0 ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400 py-4 text-center">No object classes found</div>
                ) : (
                  <div className="max-h-32 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                    {availableClasses.map((className) => (
                      <label
                        key={className}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100/50 dark:bg-gray-800/50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={filters.objectClasses.includes(className)}
                          onChange={() => handleClassToggle(className)}
                          className="w-4 h-4 rounded border-slate-600 text-violet-600 focus:ring-violet-500 focus:ring-offset-slate-900"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{className}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <style jsx>{`
              .custom-scrollbar::-webkit-scrollbar {
                width: 6px;
              }
              .custom-scrollbar::-webkit-scrollbar-track {
                background: rgba(51, 65, 85, 0.3);
                border-radius: 3px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb {
                background: rgba(139, 92, 246, 0.5);
                border-radius: 3px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: rgba(139, 92, 246, 0.7);
              }
            `}</style>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsFilters;