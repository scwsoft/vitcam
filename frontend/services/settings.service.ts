import { createClient } from '@/utils/supabase/client';
import type { GeneralSettings } from '@/types/settings.types';

class SettingsService {
  private supabase = createClient();

  async getSettings(userId: string): Promise<GeneralSettings | null> {
    try {
      console.log('🔍 Fetching settings for user:', userId);
      
      const { data, error } = await this.supabase
        .from('general_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ Error fetching settings:', error);
        return null;
      }

      if (!data) {
        console.log('ℹ️ No settings found, will use defaults');
        return null;
      }

      console.log('✅ Raw settings from database:', data);

      // Parse the signaling_ip to extract protocol, ip, and port
      let protocol = 'ws';
      let ip = 'localhost';
      let port = '8765';

      if (data.signaling_ip) {
        try {
          const url = new URL(data.signaling_ip);
          protocol = url.protocol.replace(':', '') as 'ws' | 'wss';
          ip = url.hostname;
          port = url.port || data.signaling_port || '8765';
        } catch {
          // If URL parsing fails, use the IP as hostname
          ip = data.signaling_ip;
          port = data.signaling_port || '8765';
          protocol = data.signaling_protocol || 'ws';
        }
      }

      // Convert database format to application format
      const settings: GeneralSettings = {
        signalingServer: {
          protocol: protocol as 'ws' | 'wss',
          ip: ip,
          port: port.toString(),
          name: data.signaling_name || '',
        },
        dateTimeSettings: {
          enabled: data.datetime_enabled ?? true,
          format: data.datetime_format || 'YYYY-MM-DD HH:mm:ss',
        },
      };

      console.log('✅ Parsed settings:', settings);
      return settings;
    } catch (err) {
      console.error('💥 Unexpected error in getSettings:', err);
      return null;
    }
  }

  async saveSettings(userId: string, settings: GeneralSettings): Promise<boolean> {
    try {
      console.log('💾 Saving settings for user:', userId);
      console.log('Settings to save:', settings);

      // Build the full URL from protocol, ip, and port
      const fullUrl = `${settings.signalingServer.protocol}://${settings.signalingServer.ip.trim()}:${settings.signalingServer.port.trim()}`;

      // Convert application format to database format
      const settingsData = {
        user_id: userId,
        signaling_protocol: settings.signalingServer.protocol,
        signaling_ip: fullUrl,
        signaling_port: settings.signalingServer.port.trim(),
        signaling_name: settings.signalingServer.name.trim() || null,
        datetime_enabled: settings.dateTimeSettings.enabled,
        datetime_format: settings.dateTimeSettings.format,
        updated_at: new Date().toISOString(),
      };

      console.log('📤 Database payload:', settingsData);

      const { error } = await this.supabase
        .from('general_settings')
        .upsert(settingsData, { onConflict: 'user_id' });

      if (error) {
        console.error('❌ Error saving settings:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        return false;
      }

      console.log('✅ Settings saved successfully');
      return true;
    } catch (err) {
      console.error('💥 Unexpected error saving settings:', err);
      return false;
    }
  }

  async clearLogs(userId: string): Promise<boolean> {
    try {
      console.log('🗑️ Clearing logs for user:', userId);
      
      const { error } = await this.supabase
        .from('system_logs')
        .delete()
        .neq('id', 0); // Delete all rows (using neq as workaround)

      if (error) {
        console.error('❌ Error clearing logs:', error);
        return false;
      }

      console.log('✅ Logs cleared successfully');
      return true;
    } catch (err) {
      console.error('💥 Unexpected error clearing logs:', err);
      return false;
    }
  }

  async clearAnalytics(userId: string): Promise<boolean> {
    try {
      console.log('🗑️ Clearing logs for user:', userId);
      
      const { error } = await this.supabase
        .from('object_detection_events')
        .delete()
        .neq('id', 0); // Delete all rows (using neq as workaround)

      if (error) {
        console.error('❌ Error clearing object detection events:', error);
        return false;
      }

      console.log('✅ Object detection event cleared successfully');
      return true;
    } catch (err) {
      console.error('💥 Unexpected error clearing object detection events:', err);
      return false;
    }
  }

  async clearRecordings(userId: string): Promise<boolean> {
    try {
      console.log('🗑️ Clearing recordings for user:', userId);
      
      // First, try to clear storage files
      const bucketName = 'vitcam-recordings';
      let storageCleared = false;
      let storageError = null;
      
      try {
        const { data: fileList, error: listError } = await this.supabase.storage
          .from(bucketName)
          .list('', {
            limit: 1000,
            sortBy: { column: 'name', order: 'asc' }
          });

        if (!listError && fileList && fileList.length > 0) {
          console.log(`Found ${fileList.length} files to delete`);
          
          // Get all file paths recursively
          const getAllFilePaths = async (prefix = ''): Promise<string[]> => {
            const { data: items, error } = await this.supabase.storage
              .from(bucketName)
              .list(prefix, {
                limit: 1000,
                sortBy: { column: 'name', order: 'asc' }
              });

            if (error) throw error;
            
            let allPaths: string[] = [];
            
            for (const item of items) {
              const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
              
              // Check if it's a file (has size in metadata)
              if (item.metadata && 'size' in item.metadata) {
                allPaths.push(fullPath);
              } else {
                // It's a folder, recurse
                try {
                  const subPaths = await getAllFilePaths(fullPath);
                  allPaths = allPaths.concat(subPaths);
                } catch (subError) {
                  console.error(`Error listing files in ${fullPath}:`, subError);
                }
              }
            }
            
            return allPaths;
          };

          const allFilePaths = await getAllFilePaths();
          
          if (allFilePaths.length > 0) {
            console.log(`Deleting ${allFilePaths.length} files...`);
            
            // Delete in batches of 100
            const batchSize = 100;
             let deletedCount = 0;

            for (let i = 0; i < allFilePaths.length; i += batchSize) {
              const batch = allFilePaths.slice(i, i + batchSize);
              
              const { error: deleteError } = await this.supabase.storage
                .from(bucketName)
                .remove(batch);
              
              if (deleteError) {
                console.error('Batch delete error:', deleteError);
                storageError = deleteError;
                break;

              } else {
                deletedCount += batch.length;
                console.log(`Deleted batch ${Math.floor(i/batchSize) + 1}: ${batch.length} files`);
              }
            }

            if (!storageError) {
              console.log(`Successfully deleted ${deletedCount} storage files`);
              storageCleared = true;
            }
          } else {
            console.log('No files found in storage bucket');
            storageCleared = true;
          }
        } else {
          console.log('Storage bucket is empty');
          storageCleared = true;
        }
      } catch (storageError) {
        console.error('Storage error (non-fatal):', storageError);
        // Continue even if storage deletion fails
      }

      if (!storageCleared) {
        console.error('❌ Error clearing recordings from database:', error);
        return false;
      }

      console.log('✅ Recordings cleared successfully');
      return true;
    } catch (err) {
      console.error('💥 Unexpected error clearing recordings:', err);
      return false;
    }
  }

  async clearDetectionImages(userId: string): Promise<boolean> {
    try {
      console.log('🗑️ Clearing detection images for user:', userId);
      
      const bucketName = 'detection-images';
      let storageCleared = false;
      let storageError = null;
      
      try {
        const { data: fileList, error: listError } = await this.supabase.storage
          .from(bucketName)
          .list('', {
            limit: 1000,
            sortBy: { column: 'name', order: 'asc' }
          });

        if (!listError && fileList && fileList.length > 0) {
          console.log(`Found ${fileList.length} detection images to delete`);
          
          // Get all file paths recursively
          const getAllFilePaths = async (prefix = ''): Promise<string[]> => {
            const { data: items, error } = await this.supabase.storage
              .from(bucketName)
              .list(prefix, {
                limit: 1000,
                sortBy: { column: 'name', order: 'asc' }
              });

            if (error) throw error;
            
            let allPaths: string[] = [];
            
            for (const item of items) {
              const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
              
              // Check if it's a file (has size in metadata)
              if (item.metadata && 'size' in item.metadata) {
                allPaths.push(fullPath);
              } else {
                // It's a folder, recurse
                try {
                  const subPaths = await getAllFilePaths(fullPath);
                  allPaths = allPaths.concat(subPaths);
                } catch (subError) {
                  console.error(`Error listing files in ${fullPath}:`, subError);
                }
              }
            }
            
            return allPaths;
          };

          const allFilePaths = await getAllFilePaths();
          
          if (allFilePaths.length > 0) {
            console.log(`Deleting ${allFilePaths.length} detection images...`);
            
            // Delete in batches of 100
            const batchSize = 100;
            let deletedCount = 0;

            for (let i = 0; i < allFilePaths.length; i += batchSize) {
              const batch = allFilePaths.slice(i, i + batchSize);
              
              const { error: deleteError } = await this.supabase.storage
                .from(bucketName)
                .remove(batch);
              
              if (deleteError) {
                console.error('Batch delete error:', deleteError);
                storageError = deleteError;
                break;
              } else {
                deletedCount += batch.length;
                console.log(`Deleted batch ${Math.floor(i/batchSize) + 1}: ${batch.length} files`);
              }
            }

            if (!storageError) {
              console.log(`Successfully deleted ${deletedCount} detection images`);
              storageCleared = true;
            }
          } else {
            console.log('No detection images found in storage bucket');
            storageCleared = true;
          }
        } else {
          console.log('Detection images bucket is empty');
          storageCleared = true;
        }
      } catch (error) {
        console.error('Storage error (non-fatal):', error);
        // Continue even if storage deletion fails
      }

      if (!storageCleared) {
        console.error('❌ Error clearing detection images from storage');
        return false;
      }

      console.log('✅ Detection images cleared successfully');
      return true;
    } catch (err) {
      console.error('💥 Unexpected error clearing detection images:', err);
      return false;
    }
  }
}

export const settingsService = new SettingsService();