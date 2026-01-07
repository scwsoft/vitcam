"use client";
import Image from "next/image";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";

// Types for system logs
interface SystemLog {
  id: number;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  category: string;
  subcategory?: string;
  message: string;
  details?: any;
  camera_id?: number;
  camera_url?: string;
  session_id?: string;
  client_id?: string;
  resolved: boolean;
  created_at: string;
}

// Level styling configuration
const levelConfig = {
  CRITICAL: {
    bgColor: 'bg-red-100 dark:bg-red-900/20',
    textColor: 'text-red-800 dark:text-red-300',
    iconColor: 'bg-red-500',
    border: 'border-red-200 dark:border-red-800'
  },
  ERROR: {
    bgColor: 'bg-orange-100 dark:bg-orange-900/20',
    textColor: 'text-orange-800 dark:text-orange-300',
    iconColor: 'bg-orange-500',
    border: 'border-orange-200 dark:border-orange-800'
  },
  WARNING: {
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
    textColor: 'text-yellow-800 dark:text-yellow-300',
    iconColor: 'bg-yellow-500',
    border: 'border-yellow-200 dark:border-yellow-800'
  },
  INFO: {
    bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    textColor: 'text-blue-800 dark:text-blue-300',
    iconColor: 'bg-blue-500',
    border: 'border-blue-200 dark:border-blue-800'
  },
  DEBUG: {
    bgColor: 'bg-gray-100 dark:bg-gray-900/20',
    textColor: 'text-gray-800 dark:text-gray-300',
    iconColor: 'bg-gray-500',
    border: 'border-gray-200 dark:border-gray-800'
  }
};

// Category icons mapping
const categoryIcons = {
  CAMERA: '📷',
  STORAGE: '💾',
  CODEC: '🎬',
  NETWORK: '🌐',
  DATABASE: '🗄️',
  RECORDING: '⏺️',
  SYSTEM: '⚙️',
  SECURITY: '🔒',
  DEFAULT: '📋'
};

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [supabase] = useState(() => createClient());

  // Initialize authentication and subscriptions
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event, session) => {
            setUser(session?.user ?? null);
          }
        );

        return () => subscription.unsubscribe();
      } catch (error) {
        console.error('Auth initialization error:', error);
      }
    };

    initializeAuth();
  }, [supabase.auth]);

  // Fetch initial system logs and set up real-time subscription
  useEffect(() => {
    if (!user) {
      setSystemLogs([]);
      setLoading(false);
      return;
    }

    const fetchSystemLogs = async () => {
      try {
        const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .in('level', ['CRITICAL', 'WARNING'])
        .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10);
        
        if (error) throw error;

        setSystemLogs(data || []);
        setNotifying((data || []).length > 0);
      } catch (error) {
        console.error('Error fetching system logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSystemLogs();

    // Set up real-time subscription
    const channel = supabase
      .channel('system_logs_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_logs',
          filter: 'level=in.(CRITICAL,WARNING)'
        },
        (payload) => {
          const newLog = payload.new as SystemLog;
           // Only add if within last 10 minutes
          const logTime = new Date(newLog.created_at).getTime();
          const cutoffTime = Date.now() - 10 * 60 * 1000;
          
          if (logTime >= cutoffTime) {
            setSystemLogs(current => {
              const updated = [newLog, ...current].slice(0, 10);
              setNotifying(true);
              return updated;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  // Utility functions
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const closeDropdown = () => {
    setIsOpen(false);
  };

  const handleClick = () => {
    toggleDropdown();
    setNotifying(false);
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const logTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - logTime.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hr ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  const getCategoryIcon = (category: string) => {
    return categoryIcons[category as keyof typeof categoryIcons] || categoryIcons.DEFAULT;
  };

  const truncateMessage = (message: string, maxLength: number = 80) => {
    return message.length > maxLength ? `${message.substring(0, maxLength)}...` : message;
  };

  // Sign in function (you can customize this)
  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };


  // Authentication check
  if (!user) {
    return (
      <div className="relative">
        <button
          className="relative dropdown-toggle flex items-center justify-center text-gray-400 cursor-not-allowed bg-white border border-gray-200 rounded-full h-11 w-11 dark:border-gray-800 dark:bg-gray-900"
          disabled
          title="Please sign in to view notifications"
        >
          <svg
            className="fill-current opacity-50"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        className="relative dropdown-toggle flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={handleClick}
      >
        <span
          className={`absolute right-0 top-0.5 z-10 h-2 w-2 rounded-full bg-orange-400 ${
            !notifying ? "hidden" : "flex"
          }`}
        >
          <span className="absolute inline-flex w-full h-full bg-orange-400 rounded-full opacity-75 animate-ping"></span>
        </span>
        <svg
          className="fill-current"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
            fill="currentColor"
          />
        </svg>
      </button>
      
      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute -right-[240px] mt-[17px] flex h-[480px] w-[350px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark sm:w-[361px] lg:right-0"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
          <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            System Notifications
          </h5>
          <button
            onClick={toggleDropdown}
            className="text-gray-500 transition dropdown-toggle dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <svg
              className="fill-current"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        <ul className="flex flex-col h-auto overflow-y-auto custom-scrollbar">
          {loading ? (
            <li className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
            </li>
          ) : systemLogs.length === 0 ? (
            <li className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
              <svg
                className="w-12 h-12 mb-2 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm">No critical alerts</p>
              <p className="text-xs">All systems running normally</p>
            </li>
          ) : (
            systemLogs.map((log) => {
              const config = levelConfig[log.level];
              return (
                <li key={log.id}>
                  <DropdownItem
                    onItemClick={closeDropdown}
                    className={`flex gap-3 rounded-lg border-b p-3 px-4.5 py-3 hover:bg-gray-50 dark:hover:bg-white/5 ${config.border} ${config.bgColor}`}
                  >
                    <span className="relative flex items-center justify-center w-10 h-10 text-lg rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                      {getCategoryIcon(log.category)}
                      <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${config.iconColor}`}></span>
                    </span>

                    <span className="block flex-1 min-w-0">
                      <span className={`mb-1 block text-sm font-medium ${config.textColor}`}>
                        {log.level} - {log.category}
                        {log.subcategory && (
                          <span className="text-xs opacity-75"> / {log.subcategory}</span>
                        )}
                      </span>
                      
                      <span className="mb-2 block text-sm text-gray-700 dark:text-gray-300 leading-tight">
                        {truncateMessage(log.message)}
                      </span>

                      {log.camera_id && (
                        <span className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                          📷 Camera ID: {log.camera_id}
                        </span>
                      )}

                      <span className="flex items-center gap-2 text-gray-500 text-xs dark:text-gray-400">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.textColor} ${config.bgColor}`}>
                          {log.level}
                        </span>
                        <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                        <span>{formatTimeAgo(log.created_at)}</span>
                        {!log.resolved && (
                          <>
                            <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                            <span className="text-red-500 text-xs">●</span>
                          </>
                        )}
                      </span>
                    </span>
                  </DropdownItem>
                </li>
              );
            })
          )}
        </ul>

        <Link
          href="/settings/diagnostic"
          className="block px-4 py-2 mt-3 text-sm font-medium text-center text-foreground bg-background border border-border rounded-lg hover:bg-accent"
        >
          View All System Logs
        </Link>
      </Dropdown>
    </div>
  );
}