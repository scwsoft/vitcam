import { SupabaseClient } from '@supabase/supabase-js';
import type { SystemLog, LogFilters } from '@/types/system-logs.types';

export class SystemLogsService {
  constructor(private supabase: SupabaseClient) {}

  async fetchLogs(
    filters: LogFilters,
    page: number,
    pageSize: number
  ): Promise<{ data: SystemLog[]; count: number }> {
    let query = this.supabase
      .from('system_logs')
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters.level) {
      query = query.eq('level', filters.level);
    }

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.subcategory) {
      query = query.eq('subcategory', filters.subcategory);
    }

    if (filters.search) {
      query = query.or(
        `message.ilike.%${filters.search}%,details::text.ilike.%${filters.search}%`
      );
    }

    if (filters.startDate) {
      query = query.gte('timestamp', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('timestamp', filters.endDate);
    }

    if (filters.cameraId) {
      query = query.eq('camera_id', filters.cameraId);
    }

    // Apply pagination and sorting
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query
      .order('timestamp', { ascending: false })
      .range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch logs: ${error.message}`);
    }

    return {
      data: data || [],
      count: count || 0,
    };
  }

  async getUniqueValues(
    column: 'category' | 'subcategory'
  ): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('system_logs')
      .select(column)
      .not(column, 'is', null)
      .order(column);

    if (error) {
      throw new Error(`Failed to fetch ${column}: ${error.message}`);
    }

    return [...new Set(data?.map(item => item[column]) || [])];
  }

  async exportLogs(
    filters: LogFilters
  ): Promise<SystemLog[]> {
    let query = this.supabase
      .from('system_logs')
      .select('*')
      .order('timestamp', { ascending: false });

    // Apply the same filters as fetch
    if (filters.level) query = query.eq('level', filters.level);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.subcategory) query = query.eq('subcategory', filters.subcategory);
    if (filters.search) {
      query = query.or(
        `message.ilike.%${filters.search}%,details::text.ilike.%${filters.search}%`
      );
    }
    if (filters.startDate) query = query.gte('timestamp', filters.startDate);
    if (filters.endDate) query = query.lte('timestamp', filters.endDate);
    if (filters.cameraId) query = query.eq('camera_id', filters.cameraId);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to export logs: ${error.message}`);
    }

    return data || [];
  }
}