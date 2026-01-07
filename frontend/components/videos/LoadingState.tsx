export default function LoadingState() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto" />
        <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">
          Loading cameras...
        </p>
      </div>
    </div>
  );
}