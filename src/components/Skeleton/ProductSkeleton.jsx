export const ProductSkeleton = () => (
  <div className="animate-pulse bg-white rounded-xl p-4 border shadow-sm">
    <div className="bg-gray-200 rounded-md aspect-square w-full" />
    <div className="mt-3 space-y-2">
      <div className="h-3 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
      <div className="h-4 bg-gray-300 rounded w-1/3 mt-4" />
    </div>
  </div>
);
