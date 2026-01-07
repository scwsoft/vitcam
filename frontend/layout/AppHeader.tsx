"use client";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import UserDropdown from "@/components/header/UserDropdown";
import { useMachineInfo, getStatusColors, getTempColors } from "@/hooks/useMachineInfo";
import React, { useMemo, useCallback } from "react";

const AppHeader: React.FC = () => {
  // Memoize the error callback to prevent it from changing on every render
  const handleMachineInfoError = useCallback((error: Error) => {
    console.error('Machine info error:', error);
  }, []);

  // Memoize the options object to prevent the hook from reinitializing
  const machineInfoOptions = useMemo(() => ({
    refreshInterval: 30000, // Update every 30 seconds
    enabled: true,
    onError: handleMachineInfoError,
    retryAttempts: 3,
    retryDelay: 5000
  }), [handleMachineInfoError]);

  // Use the real machine info hook with memoized options
  const { data: machineInfo, loading, error, lastUpdated } = useMachineInfo(machineInfoOptions);

  // Fallback data when loading or error
  const metrics = machineInfo || {
    cpu: { usage: 0, temp: 0, cores: 0, model: 'Unknown' },
    memory: { usage: 0, total: '0 GB', free: '0 GB', used: '0 GB' },
    disk: { usage: 0, total: '0 GB', free: '0 GB', used: '0 GB' },
    network: { status: 'error' as const, interfaces: [] }
  };

  const getNetworkColor = (status: string) => {
    switch (status) {
      case 'active': return { bg: 'bg-blue-600', text: 'text-blue-600"', ring: 'ring-blue-600/20' };
      case 'idle': return { bg: 'bg-amber-500', text: 'text-amber-500', ring: 'ring-amber-500/20' };
      default: return { bg: 'bg-red-500', text: 'text-red-500', ring: 'ring-red-500/20' };
    }
  };

  const ProgressBar: React.FC<{ value: number; color: string }> = ({ value, color }) => (
    <div className="w-full bg-gray-300/30 dark:bg-gray-600/30 rounded-full h-1.5 overflow-hidden transition-colors duration-300">
      <div 
        className={`h-full ${color} transition-all duration-500 ease-out rounded-full`}
        style={{ width: `${value}%` }}
      />
    </div>
  );

  const StatusIndicator: React.FC<{ color: { bg: string; ring: string }; isLoading?: boolean }> = ({ color, isLoading }) => (
    <div className={`w-2 h-2 ${color.bg} rounded-full ring-4 ${color.ring} ${isLoading ? 'animate-pulse' : 'animate-pulse'}`} />
  );

  const ErrorIndicator = () => (
    <div className="flex items-center space-x-2 px-3 py-2 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm rounded-lg border border-red-200/50 dark:border-red-800/50">
      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
      <span className="text-xs font-medium text-red-600 dark:text-red-400">
        {error || 'Connection Error'}
      </span>
    </div>
  );

  const LoadingIndicator = () => (
    <div className="flex items-center space-x-2 px-3 py-2 bg-blue-50/80 dark:bg-blue-900/20 backdrop-blur-sm rounded-lg border border-blue-200/50 dark:border-blue-800/50">
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
        Loading...
      </span>
    </div>
  );

  return (
    <header className="sticky top-0 flex w-full bg-white/60 backdrop-blur-md border-b border-gray-200/30 z-99999 dark:border-gray-700/30 dark:bg-gray-900/60 transition-all duration-300">
      <div className="flex items-center justify-between w-full px-4 py-3 lg:px-6 lg:py-4">
        
        {/* System Diagnostics Panel */}
        <div className="flex items-center space-x-1">
          
          {/* Show error state */}
          {error && !loading && (
            <ErrorIndicator />
          )}

          {/* Show loading state */}
          {loading && !machineInfo && (
            <LoadingIndicator />
          )}

          {/* Desktop View - Full Metrics */}
          {!error && (
            <div className="hidden lg:flex items-center space-x-6">
              
              {/* CPU Metrics */}
              <div className="flex items-center space-x-3 px-3 py-2 bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm rounded-lg border border-gray-300/20 dark:border-gray-600/20 transition-all duration-300 hover:bg-white/60 dark:hover:bg-gray-800/60">
                <StatusIndicator color={getStatusColors(metrics.cpu.usage)} isLoading={loading} />
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors duration-300">CPU</span>
                    <span className={`text-sm font-bold ${getStatusColors(metrics.cpu.usage).text} ${loading ? 'animate-pulse' : ''}`}>
                      {metrics.cpu.usage}%
                    </span>
                  </div>
                  <ProgressBar value={metrics.cpu.usage} color={getStatusColors(metrics.cpu.usage).bg} />
                </div>
              </div>

              {/* Memory Metrics */}
              <div className="flex items-center space-x-3 px-3 py-2 bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm rounded-lg border border-gray-300/20 dark:border-gray-600/20 transition-all duration-300 hover:bg-white/60 dark:hover:bg-gray-800/60">
                <StatusIndicator color={getStatusColors(metrics.memory.usage)} isLoading={loading} />
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors duration-300">RAM</span>
                    <span className={`text-sm font-bold ${getStatusColors(metrics.memory.usage).text} ${loading ? 'animate-pulse' : ''}`}>
                      {metrics.memory.usage}%
                    </span>
                  </div>
                  <ProgressBar value={metrics.memory.usage} color={getStatusColors(metrics.memory.usage).bg} />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {metrics.memory.total}
                  </span>
                </div>
              </div>

              {/* Disk Metrics */}
              <div className="flex items-center space-x-3 px-3 py-2 bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm rounded-lg border border-gray-300/20 dark:border-gray-600/20 transition-all duration-300 hover:bg-white/60 dark:hover:bg-gray-800/60">
                <StatusIndicator color={getStatusColors(metrics.disk.usage)} isLoading={loading} />
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors duration-300">DISK</span>
                    <span className={`text-sm font-bold ${getStatusColors(metrics.disk.usage).text} ${loading ? 'animate-pulse' : ''}`}>
                      {metrics.disk.usage}%
                    </span>
                  </div>
                  <ProgressBar value={metrics.disk.usage} color={getStatusColors(metrics.disk.usage).bg} />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {metrics.disk.total}
                  </span>
                </div>
              </div>

              {/* Network Status */}
              <div className="flex items-center space-x-3 px-3 py-2 bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm rounded-lg border border-gray-300/20 dark:border-gray-600/20 transition-all duration-300 hover:bg-white/60 dark:hover:bg-gray-800/60">
                <StatusIndicator color={getNetworkColor(metrics.network.status)} isLoading={loading} />
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors duration-300">NET</span>
                  <span className={`text-xs font-semibold capitalize ${getNetworkColor(metrics.network.status).text} ${loading ? 'animate-pulse' : ''}`}>
                    {metrics.network.status}
                  </span>
                </div>
              </div>

            </div>
          )}

          {/* Mobile View - Compact */}
          {!error && (
            <div className="flex lg:hidden items-center space-x-2">
              <div className="flex items-center space-x-3 px-3 py-2 bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm rounded-lg border border-gray-300/20 dark:border-gray-600/20 transition-all duration-300 hover:bg-white/60 dark:hover:bg-gray-800/60">
                <div className="flex items-center space-x-2">
                  <StatusIndicator color={getStatusColors(metrics.cpu.usage)} isLoading={loading} />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors duration-300">SYS</span>
                </div>
                <div className="flex space-x-3 text-xs">
                  <span className={`font-bold ${getStatusColors(metrics.cpu.usage).text} ${loading ? 'animate-pulse' : ''}`}>
                    {metrics.cpu.usage}%
                  </span>
                  <span className={`font-bold ${getStatusColors(metrics.memory.usage).text} ${loading ? 'animate-pulse' : ''}`}>
                    {metrics.memory.usage}%
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right Section - User Controls */}
        <div className="flex items-center space-x-3">

          {/* Theme Toggle */}
          <div className="p-1.5 bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm rounded-lg border border-gray-300/20 dark:border-gray-600/20 transition-all duration-300 hover:bg-white/60 dark:hover:bg-gray-800/60">
            <ThemeToggleButton />
          </div>
          
          {/* Notifications */}
          <div className="p-1 bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm rounded-lg border border-gray-300/20 dark:border-gray-600/20 transition-all duration-300 hover:bg-white/60 dark:hover:bg-gray-800/60">
            <NotificationDropdown />
          </div>
          
          {/* User Menu */}
          <div className="p-1 bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm rounded-lg border border-gray-300/20 dark:border-gray-600/20 transition-all duration-300 hover:bg-white/60 dark:hover:bg-gray-800/60">
            <UserDropdown />
          </div>

        </div>

      </div>
    </header>
  );
};

export default AppHeader;