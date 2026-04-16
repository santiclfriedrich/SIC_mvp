export const ProductSkeleton = () => (
  <div className="bg-white rounded-xl border border-[#E3E1DC] overflow-hidden animate-pulse"
       style={{ borderLeftWidth: "3px", borderLeftColor: "#E3E1DC" }}>
    {/* Image area */}
    <div className="h-44 bg-[#F2F1EE]" />

    {/* Content */}
    <div className="p-3.5 space-y-3">
      {/* Name */}
      <div className="space-y-1.5">
        <div className="h-3 bg-[#E8E6E0] rounded w-full" />
        <div className="h-3 bg-[#E8E6E0] rounded w-3/4" />
      </div>

      {/* SKU */}
      <div className="h-2.5 bg-[#EEECe8] rounded w-1/3" />

      {/* Price */}
      <div>
        <div className="h-6 bg-[#E3E1DC] rounded w-1/2 mb-1" />
        <div className="h-2.5 bg-[#EEECe8] rounded w-1/4" />
      </div>

      {/* Footer */}
      <div className="flex justify-between pt-2.5 border-t border-[#F0EEEA]">
        <div className="h-5 bg-[#EEECe8] rounded-full w-20" />
        <div className="h-5 bg-[#EEECe8] rounded w-14" />
      </div>
    </div>
  </div>
);
