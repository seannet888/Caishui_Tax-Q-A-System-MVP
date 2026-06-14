export function LoadingSpinner() {
  return (
    <div
      className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"
      role="status"
      aria-label="加载中"
    />
  );
}
