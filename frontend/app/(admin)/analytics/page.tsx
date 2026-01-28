'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  TrendingUp,
  Camera,
  Activity,
  Eye,
  Filter,
  Calendar,
  Download,
  RefreshCw,
} from 'lucide-react';
import {
  DetectionEvent,
  CameraStats,
  ObjectClassStats
} from '@/types/detection';
import StatsCard from '@/components/analytics/StatsCard';
import DetectionTimeline from '@/components/analytics/DetectionTimeline';
import ObjectDistribution from '@/components/analytics/ObjectDistribution';
import SpatialHeatmap from '@/components/analytics/SpatialHeatmap';
import LiveDetectionFeed from '@/components/analytics/LiveDetectionFeed';
import CameraGrid from '@/components/analytics/CameraGrid';
import AnalyticsFilters from '@/components/analytics/AnalyticsFilters';

const VideoAnalyticsPage: React.FC = () => {
  const supabase = createClientComponentClient();
  const [detections, setDetections] = useState<DetectionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<AnalyticsFilters>({
    cameraIds: [],
    objectClasses: [],
    confidenceMin: 0,
    timeRange: 'day',
  });

  // Fetch detection data
  const fetchDetections = async () => {
    try {
      setRefreshing(true);
      let query = supabase
        .from('object_detection_events')
        .select('unique_tracker_id_view')
        .order('timestamp', { ascending: false });

      // Apply filters
      if (filters.cameraIds.length > 0) {
        query = query.in('camera_id', filters.cameraIds);
      }
      if (filters.objectClasses.length > 0) {
        query = query.in('object_class_name', filters.objectClasses);
      }
      if (filters.confidenceMin > 0) {
        query = query.gte('confidence', filters.confidenceMin);
      }

      // Time range filter
      const now = new Date();
      let startTime: Date;
      switch (filters.timeRange) {
        case 'hour':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case 'day':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = filters.startDate || new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }
      query = query.gte('timestamp', startTime.toISOString());

      if (filters.timeRange === 'custom' && filters.endDate) {
        query = query.lte('timestamp', filters.endDate.toISOString());
      }

      const { data, error } = await query.select();

      if (error) throw error;
      setDetections(data || []);
    } catch (error) {
      console.error('Error fetching detections:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDetections();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('detection_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'object_detection_events',
        },
        (payload) => {
          setDetections((prev) => [payload.new as DetectionEvent, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filters]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalDetections = detections.length;
    const uniqueCameras = new Set(detections.map((d) => d.camera_id)).size;
    const avgConfidence =
      detections.reduce((sum, d) => sum + (d.confidence || 0), 0) / totalDetections || 0;
    const uniqueObjects = new Set(detections.map((d) => d.object_class_name)).size;

    // Recent activity (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentDetections = detections.filter(
      (d) => new Date(d.timestamp) > oneHourAgo
    ).length;

    return {
      totalDetections,
      uniqueCameras,
      avgConfidence,
      uniqueObjects,
      recentDetections,
    };
  }, [detections]);

  // Calculate camera statistics
  const cameraStats: CameraStats[] = useMemo(() => {
    const cameraMap = new Map<number, CameraStats>();

    detections.forEach((detection) => {
      const cameraId = detection.camera_id;
      if (!cameraMap.has(cameraId)) {
        cameraMap.set(cameraId, {
          camera_id: cameraId,
          camera_name: detection.camera_name || `Camera ${cameraId}`,
          total_detections: 0,
          avg_confidence: 0,
          last_detection: detection.timestamp,
          active_objects: [],
        });
      }

      const stats = cameraMap.get(cameraId)!;
      stats.total_detections++;
      stats.avg_confidence += detection.confidence || 0;

      if (detection.object_class_name && !stats.active_objects.includes(detection.object_class_name)) {
        stats.active_objects.push(detection.object_class_name);
      }
    });

    cameraMap.forEach((stats) => {
      stats.avg_confidence = stats.avg_confidence / stats.total_detections;
    });

    return Array.from(cameraMap.values());
  }, [detections]);

  // Calculate object class statistics
  const objectStats: ObjectClassStats[] = useMemo(() => {
    const objectMap = new Map<string, { count: number; totalConfidence: number }>();

    detections.forEach((detection) => {
      const className = detection.object_class_name || 'Unknown';
      if (!objectMap.has(className)) {
        objectMap.set(className, { count: 0, totalConfidence: 0 });
      }
      const stats = objectMap.get(className)!;
      stats.count++;
      stats.totalConfidence += detection.confidence || 0;
    });

    const colors = [
      '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
      '#ef4444', '#14b8a6', '#f97316', '#06b6d4', '#a855f7',
    ];

    return Array.from(objectMap.entries())
      .map(([class_name, stats], index) => ({
        class_name,
        count: stats.count,
        avg_confidence: stats.totalConfidence / stats.count,
        color: colors[index % colors.length],
      }))
      .sort((a, b) => b.count - a.count);
  }, [detections]);

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Camera', 'Object Class', 'Confidence', 'Position'],
      ...detections.map((d) => [
        d.timestamp,
        d.camera_name || d.camera_id,
        d.object_class_name || 'Unknown',
        d.confidence?.toFixed(2) || '0',
        `(${d.bbox_x}, ${d.bbox_y})`,
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detections_${new Date().toISOString()}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600 dark:text-gray-400 text-lg">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 dark:from-violet-400 dark:to-fuchsia-400 bg-clip-text text-transparent">
                Video Analytics
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Real-time detection insights and performance metrics</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchDetections}
                disabled={refreshing}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-violet-50 hover:bg-violet-100 dark:bg-violet-600/10 dark:hover:bg-violet-600/20 border border-violet-200 dark:border-violet-500/30 rounded-xl text-violet-700 dark:text-violet-400 flex items-center gap-2 transition-all"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-8">
        {/* Filters */}
        <div className="mb-8">
          <AnalyticsFilters filters={filters} onFiltersChange={setFilters} />
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <StatsCard
            title="Total Detections"
            value={stats.totalDetections.toLocaleString()}
            icon={Activity}
            trend={{ value: stats.recentDetections, label: 'last hour' }}
            color="violet"
          />
          <StatsCard
            title="Active Cameras"
            value={stats.uniqueCameras.toString()}
            icon={Camera}
            color="blue"
          />
          <StatsCard
            title="Avg Confidence"
            value={`${(stats.avgConfidence * 100).toFixed(1)}%`}
            icon={TrendingUp}
            color="emerald"
          />
          <StatsCard
            title="Object Classes"
            value={stats.uniqueObjects.toString()}
            icon={Eye}
            color="fuchsia"
          />
          <StatsCard
            title="Recent Activity"
            value={stats.recentDetections.toLocaleString()}
            icon={Activity}
            subtitle="Last hour"
            color="amber"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          {/* Detection Timeline - Takes 2 columns */}
          <div className="xl:col-span-2">
            <DetectionTimeline detections={detections} />
          </div>

          {/* Object Distribution */}
          <div>
            <ObjectDistribution objectStats={objectStats} />
          </div>
        </div>

        {/* Secondary Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          {/* Spatial Heatmap */}
          <SpatialHeatmap detections={detections} />

          {/* Live Detection Feed */}
          <LiveDetectionFeed detections={detections.slice(0, 10)} />
        </div>

        {/* Camera Performance Grid */}
        <div>
          <CameraGrid cameraStats={cameraStats} />
        </div>
      </div>
    </div>
  );
};

export default VideoAnalyticsPage;