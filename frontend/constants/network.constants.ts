export const NETWORK_CONSTANTS = {
  SPEED_TEST_URL: 'https://httpbin.org/bytes/1048576',
  LATENCY_TEST_URL: 'https://httpbin.org/get',
  TEST_FILE_SIZE_BYTES: 1048576,
  BITS_PER_BYTE: 8,
  BYTES_PER_MEGABIT: 1024 * 1024,
  MIN_PASSWORD_LENGTH: 6,
} as const;

export const CONNECTION_TYPE_COLORS = {
  '4g': 'text-green-600 dark:text-green-400',
  '3g': 'text-blue-600 dark:text-blue-400',
  '2g': 'text-orange-600 dark:text-orange-400',
  'slow-2g': 'text-red-600 dark:text-red-400',
  default: 'text-gray-600 dark:text-gray-400',
} as const;

export const SPEED_THRESHOLDS = {
  FAST: 10,
  MEDIUM: 5,
} as const;