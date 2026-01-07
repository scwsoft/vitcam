// app/api/machine-info/route.ts
import { NextRequest, NextResponse } from 'next/server';
import os from 'os';
import { promisify } from 'util';
import { exec } from 'child_process';
import { createClient } from '@/utils/supabase/server';

const execAsync = promisify(exec);

// Initialize Supabase client

export interface MachineInfoResponse {
  cpu: {
    usage: number;
    cores: number;
    model: string;
  };
  memory: {
    usage: number;
    total: string;
    free: string;
    used: string;
  };
  disk: {
    usage: number;
    total: string;
    free: string;
    used: string;
  };
  network: {
    status: 'active' | 'idle' | 'error';
    interfaces: Array<{
      name: string;
      address: string;
      status: string;
    }>;
  };
  system: {
    platform: string;
    arch: string;
    uptime: number;
    hostname: string;
    nodeVersion: string;
  };
  timestamp: string;
}

interface SystemLogEntry {
  level: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  category: string;
  subcategory?: string;
  source_file: string;
  source_function: string;
  message: string;
  details?: Record<string, any>;
  performance_metrics?: Record<string, any>;
}

// Cache for CPU usage calculation
let lastCpuTimes: any = null;
let lastCpuUsage: number = 0;

class MachineInfoService {
  
  // Get CPU usage percentage
  static async getCpuUsage(): Promise<number> {
    try {
      const cpus = os.cpus();
      
      // Calculate total CPU times
      let totalIdle = 0;
      let totalTick = 0;
      
      cpus.forEach(cpu => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type as keyof typeof cpu.times];
        }
        totalIdle += cpu.times.idle;
      });
      
      const currentTimes = { idle: totalIdle, total: totalTick };
      
      if (lastCpuTimes) {
        const idleDifference = currentTimes.idle - lastCpuTimes.idle;
        const totalDifference = currentTimes.total - lastCpuTimes.total;
        const cpuPercentage = 100 - Math.floor(100 * idleDifference / totalDifference);
        lastCpuUsage = Math.max(0, Math.min(100, cpuPercentage));
      }
      
      lastCpuTimes = currentTimes;
      return lastCpuUsage;
    } catch (error) {
      console.error('Error getting CPU usage:', error);
      return 0;
    }
  }

  // Get memory information
  static getMemoryInfo() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usage = Math.round((usedMem / totalMem) * 100);

    return {
      usage,
      total: this.formatBytes(totalMem),
      free: this.formatBytes(freeMem),
      used: this.formatBytes(usedMem)
    };
  }

  // Get disk information
  static async getDiskInfo() {
  try {
    const platform = os.platform();
    let diskData;

    if (platform === 'win32') {
      const { stdout } = await execAsync('wmic logicaldisk get size,freespace,caption');
      // Parse Windows disk info
      const lines = stdout.split('\n').filter(line => line.trim());
      const dataLine = lines[1]; // Skip header
      const [caption, freeSpace, size] = dataLine.trim().split(/\s+/);
      
      diskData = {
        total: parseInt(size),
        free: parseInt(freeSpace)
      };
    } else if (platform === 'darwin') {
      // macOS - use df without -B flag (BSD version)
      const { stdout } = await execAsync("df -k / | tail -1 | awk '{print $2, $4}'");
      const [total, available] = stdout.trim().split(' ').map(Number);
      
      diskData = {
        total: total * 1024, // Convert from KB to bytes
        free: available * 1024 // Convert from KB to bytes
      };
    } else {
      // Linux - use df with -B1 flag (GNU version)
      const { stdout } = await execAsync("df -B1 / | tail -1 | awk '{print $2, $4}'");
      const [total, available] = stdout.trim().split(' ').map(Number);
      
      diskData = {
        total,
        free: available
      };
    }

    const used = diskData.total - diskData.free;
    const usage = Math.round((used / diskData.total) * 100);

    return {
      usage,
      total: this.formatBytes(diskData.total),
      free: this.formatBytes(diskData.free),
      used: this.formatBytes(used)
    };
  } catch (error) {
    console.error('Error getting disk info:', error);
    return {
      usage: 0,
      total: '0 GB',
      free: '0 GB',
      used: '0 GB'
    };
  }
}
  // Get network information
  static getNetworkInfo() {
    try {
      const interfaces = os.networkInterfaces();
      const networkInterfaces: Array<{name: string; address: string; status: string}> = [];
      let hasActiveConnection = false;

      for (const [name, nets] of Object.entries(interfaces)) {
        if (nets) {
          nets.forEach(net => {
            if (net.family === 'IPv4' && !net.internal) {
              networkInterfaces.push({
                name,
                address: net.address,
                status: net.address !== '127.0.0.1' ? 'active' : 'inactive'
              });
              if (net.address !== '127.0.0.1') {
                hasActiveConnection = true;
              }
            }
          });
        }
      }

      return {
        status: hasActiveConnection ? 'active' as const : 'idle' as const,
        interfaces: networkInterfaces
      };
    } catch (error) {
      console.error('Error getting network info:', error);
      return {
        status: 'error' as const,
        interfaces: []
      };
    }
  }

  // Get system information
  static getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      uptime: Math.round(os.uptime()),
      hostname: os.hostname(),
      nodeVersion: process.version
    };
  }

  // Format bytes to human readable format
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  // Log to Supabase system_logs
  static async logToSupabase(logEntry: SystemLogEntry): Promise<void> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from('system_logs')
        .insert({
          level: logEntry.level,
          category: logEntry.category,
          subcategory: logEntry.subcategory || null,
          source_file: logEntry.source_file,
          source_function: logEntry.source_function,
          message: logEntry.message,
          details: logEntry.details || null,
          performance_metrics: logEntry.performance_metrics || null,
        });

      if (error) {
        console.error('Error logging to Supabase:', error);
      }
    } catch (error) {
      console.error('Exception while logging to Supabase:', error);
    }
  }

  // Check resource thresholds and log warnings/critical alerts
  static async checkResourceThresholds(machineInfo: MachineInfoResponse): Promise<void> {
    const hostname = machineInfo.system.hostname;
    const timestamp = machineInfo.timestamp;

      // Check Network status
    const networkStatus = machineInfo.network.status;
    if (networkStatus === 'error') {
      await this.logToSupabase({
        level: 'CRITICAL',
        category: 'SYSTEM',
        subcategory: 'network',
        source_file: 'route.ts',
        source_function: 'checkResourceThresholds',
        message: `Critical network error detected: Network is down or unavailable`,
        details: {
          hostname,
          network_status: networkStatus,
          interfaces: machineInfo.network.interfaces,
          severity: 'critical',
          error_type: 'network_unavailable'
        },
        performance_metrics: {
          network_status: networkStatus,
          active_interfaces: machineInfo.network.interfaces.length,
          timestamp
        }
      });
    } 

    // Check CPU usage
    const cpuUsage = machineInfo.cpu.usage;
    if (cpuUsage >= 80) {
      await this.logToSupabase({
        level: 'CRITICAL',
        category: 'SYSTEM',
        subcategory: 'cpu',
        source_file: 'route.ts',
        source_function: 'checkResourceThresholds',
        message: `Critical CPU usage detected: ${cpuUsage}%`,
        details: {
          hostname,
          cpu_usage: cpuUsage,
          cpu_cores: machineInfo.cpu.cores,
          cpu_model: machineInfo.cpu.model,
          threshold: '80%',
          severity: 'critical'
        },
        performance_metrics: {
          cpu_usage: cpuUsage,
          cores: machineInfo.cpu.cores,
          timestamp
        }
      });
    } else if (cpuUsage >= 50) {
      await this.logToSupabase({
        level: 'WARNING',
        category: 'SYSTEM',
        subcategory: 'cpu',
        source_file: 'route.ts',
        source_function: 'checkResourceThresholds',
        message: `High CPU usage detected: ${cpuUsage}%`,
        details: {
          hostname,
          cpu_usage: cpuUsage,
          cpu_cores: machineInfo.cpu.cores,
          cpu_model: machineInfo.cpu.model,
          threshold: '50%',
          severity: 'warning'
        },
        performance_metrics: {
          cpu_usage: cpuUsage,
          cores: machineInfo.cpu.cores,
          timestamp
        }
      });
    }

    // Check RAM usage
    const ramUsage = machineInfo.memory.usage;
    if (ramUsage >= 80) {
      await this.logToSupabase({
        level: 'CRITICAL',
        category: 'SYSTEM',
        subcategory: 'memory',
        source_file: 'route.ts',
        source_function: 'checkResourceThresholds',
        message: `Critical memory usage detected: ${ramUsage}%`,
        details: {
          hostname,
          memory_usage: ramUsage,
          memory_total: machineInfo.memory.total,
          memory_used: machineInfo.memory.used,
          memory_free: machineInfo.memory.free,
          threshold: '80%',
          severity: 'critical'
        },
        performance_metrics: {
          memory_usage: ramUsage,
          memory_total: machineInfo.memory.total,
          memory_used: machineInfo.memory.used,
          timestamp
        }
      });
    } else if (ramUsage >= 50) {
      await this.logToSupabase({
        level: 'WARNING',
        category: 'SYSTEM',
        subcategory: 'memory',
        source_file: 'route.ts',
        source_function: 'checkResourceThresholds',
        message: `High memory usage detected: ${ramUsage}%`,
        details: {
          hostname,
          memory_usage: ramUsage,
          memory_total: machineInfo.memory.total,
          memory_used: machineInfo.memory.used,
          memory_free: machineInfo.memory.free,
          threshold: '50%',
          severity: 'warning'
        },
        performance_metrics: {
          memory_usage: ramUsage,
          memory_total: machineInfo.memory.total,
          memory_used: machineInfo.memory.used,
          timestamp
        }
      });
    }

    // Check Disk usage
    const diskUsage = machineInfo.disk.usage;
    if (diskUsage >= 80) {
      await this.logToSupabase({
        level: 'CRITICAL',
        category: 'SYSTEM',
        subcategory: 'disk',
        source_file: 'route.ts',
        source_function: 'checkResourceThresholds',
        message: `Critical disk usage detected: ${diskUsage}%`,
        details: {
          hostname,
          disk_usage: diskUsage,
          disk_total: machineInfo.disk.total,
          disk_used: machineInfo.disk.used,
          disk_free: machineInfo.disk.free,
          threshold: '80%',
          severity: 'critical'
        },
        performance_metrics: {
          disk_usage: diskUsage,
          disk_total: machineInfo.disk.total,
          disk_used: machineInfo.disk.used,
          timestamp
        }
      });
    } else if (diskUsage >= 75) {
      await this.logToSupabase({
        level: 'WARNING',
        category: 'SYSTEM',
        subcategory: 'disk',
        source_file: 'route.ts',
        source_function: 'checkResourceThresholds',
        message: `High disk usage detected: ${diskUsage}%`,
        details: {
          hostname,
          disk_usage: diskUsage,
          disk_total: machineInfo.disk.total,
          disk_used: machineInfo.disk.used,
          disk_free: machineInfo.disk.free,
          threshold: '75%',
          severity: 'warning'
        },
        performance_metrics: {
          disk_usage: diskUsage,
          disk_total: machineInfo.disk.total,
          disk_used: machineInfo.disk.used,
          timestamp
        }
      });
    }
  }

  // Main method to get all machine info
  static async getAllMachineInfo(): Promise<MachineInfoResponse> {
    try {
      const [cpuUsage, diskInfo] = await Promise.all([
        this.getCpuUsage(),
        this.getDiskInfo()
      ]);

      const cpus = os.cpus();
      
      return {
        cpu: {
          usage: cpuUsage,
          cores: cpus.length,
          model: cpus[0]?.model || 'Unknown'
        },
        memory: this.getMemoryInfo(),
        disk: diskInfo,
        network: this.getNetworkInfo(),
        system: this.getSystemInfo(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting machine info:', error);
      throw error;
    }
  }
}

// GET endpoint
export async function GET(request: NextRequest) {
  try {
    const machineInfo = await MachineInfoService.getAllMachineInfo();
    
    // Check resource thresholds and log to Supabase if needed
    await MachineInfoService.checkResourceThresholds(machineInfo);
    
    return NextResponse.json(machineInfo, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Machine info API error:', error);
    
    // Log the error to Supabase
    await MachineInfoService.logToSupabase({
      level: 'ERROR',
      category: 'api',
      subcategory: 'machine_info',
      source_file: 'route.ts',
      source_function: 'GET',
      message: 'Failed to fetch machine information',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack_trace: error instanceof Error ? error.stack : undefined
      }
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch machine information',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Optional: Add rate limiting
const requestCounts = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const userRequests = requestCounts.get(ip);
  
  if (!userRequests || now - userRequests.timestamp > RATE_WINDOW) {
    requestCounts.set(ip, { count: 1, timestamp: now });
    return true;
  }
  
  if (userRequests.count >= RATE_LIMIT) {
    return false;
  }
  
  userRequests.count++;
  return true;
}

// Enhanced GET with rate limiting
export async function GETWithRateLimit(request: NextRequest) {
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429 }
    );
  }
  
  return GET(request);
}