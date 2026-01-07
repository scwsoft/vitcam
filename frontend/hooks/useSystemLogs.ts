import { useState, useCallback, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { SystemLogsService } from '@/services/system-logs.service';
import type { SystemLog, LogFilters, UseSystemLogsReturn } from '@/types/system-logs.types';

export const useSystemLogs = (
  filters: LogFilters,
  page: number,
  pageSize: number,
  user: any
): UseSystemLogsReturn => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);

  // Initialize Supabase client and service
  const service = useMemo(() => {
    try {
      const supabase = createClient();
      return new SystemLogsService(supabase);
    } catch (error) {
      console.error('Failed to initialize service:', error);
      return null;
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    if (!service || !user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, count } = await service.fetchLogs(filters, page, pageSize);
      setLogs(data);
      setTotalCount(count);
    } catch (err: any) {
      console.error('Error fetching logs:', err);
      setError(err?.message || 'Failed to fetch logs');
      setLogs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [service, filters, page, pageSize, user]);

  const loadCategories = useCallback(async () => {
    if (!service || !user) return;

    try {
      const [cats, subcats] = await Promise.all([
        service.getUniqueValues('category'),
        service.getUniqueValues('subcategory'),
      ]);

      setCategories(cats);
      setSubcategories(subcats);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  }, [service, user]);

  const exportLogs = useCallback(async () => {
    if (!service) return;

    try {
      const data = await service.exportLogs(filters);
      const csv = convertToCSV(data);
      downloadCSV(csv, 'system-logs.csv');
    } catch (err: any) {
      console.error('Error exporting logs:', err);
      throw new Error(err?.message || 'Failed to export logs');
    }
  }, [service, filters]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    loading,
    error,
    totalCount,
    categories,
    subcategories,
    fetchLogs,
    exportLogs,
  };
};

// Helper functions
function convertToCSV(data: SystemLog[]): string {
  if (data.length === 0) return '';

  const headers = ['Timestamp', 'Level', 'Category', 'Subcategory', 'Message', 'Camera ID', 'Session ID'];
  const rows = data.map(log => [
    log.timestamp,
    log.level,
    log.category,
    log.subcategory || '',
    log.message.replace(/"/g, '""'),
    log.camera_id || '',
    log.session_id || '',
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');
}

function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}