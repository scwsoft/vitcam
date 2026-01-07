"use client";

import React, { useState } from 'react';
import { Activity, Download, RefreshCw, Filter as FilterIcon } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { useSystemLogs } from '@/hooks/useSystemLogs';
import { useRouter } from 'next/navigation';

import { FilterPanel } from '@/components/settings/FilterPanel';
import { LogsTable } from '@/components/settings/LogsTable';
import { Pagination } from '@/components/settings/Pagination';
import { LogDetailModal } from '@/components/settings/LogDetailModal';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyLogState } from '@/components/ui/EmptyLogState';

import { INITIAL_FILTERS, DEFAULT_PAGE_SIZE } from '@/constants/system-logs.constants';
import type { SystemLog, LogFilters } from '@/types/system-logs.types';

const SystemLogsViewer: React.FC = () => {
  // Authentication
  const { user, loading: authLoading, error: authError } = useAuth();
  const router = useRouter();

  // State management
  const [filters, setFilters] = useState<LogFilters>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Data fetching
  const {
    logs,
    loading,
    error,
    totalCount,
    categories,
    subcategories,
    fetchLogs,
    exportLogs,
  } = useSystemLogs(filters, page, pageSize, user);

  // Event handlers
  const handleFilterChange = (newFilters: LogFilters) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
  };

  const handleViewDetails = (log: SystemLog) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const handleExport = async () => {
    try {
      await exportLogs();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  if(!authLoading && !user)
     router.push('/signin');
 
  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <LoadingState />
      </div>
    );
  }

  // Auth error state
  if (authError || !user) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <ErrorState message={authError || 'Authentication required'} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg mb-6">
          <div className="px-6 py-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                  <Activity className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    System Logs
                  </h1>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Monitor and analyze system events
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all ${
                    showFilters
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <FilterIcon className="w-4 h-4 mr-2" />
                  {showFilters ? 'Hide' : 'Show'} Filters
                </button>

                <button
                  onClick={fetchLogs}
                  disabled={loading}
                  className="flex items-center px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </button>

                <button
                  onClick={handleExport}
                  disabled={logs.length === 0}
                  className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </button>
              </div>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <FilterPanel
              filters={filters}
              categories={categories}
              subcategories={subcategories}
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
            />
          )}
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          {loading && !logs.length ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={fetchLogs} />
          ) : logs.length === 0 ? (
            <EmptyLogState isFiltered={showFilters}  onClearFilters={showFilters ? handleClearFilters : undefined}/>
          ) : (
            <>
              <LogsTable logs={logs} onViewDetails={handleViewDetails} />
              {totalCount > 0 && (
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  totalCount={totalCount}
                  onPageChange={setPage}
                  onPageSizeChange={handlePageSizeChange}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <LogDetailModal
        log={selectedLog}
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
      />
    </div>
  );
};

export default SystemLogsViewer;