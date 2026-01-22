"use client";
import { ProductCard } from '../ProductCard/ProductCard';

export const ProductGrid = ({ products, onProductClick }) => {
  return (
<div className="bg-gray-50 rounded-2xl p-4">
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
    {products.map((p) => (
      <ProductCard
        key={`${p.sku}-${p.provider}`}
        product={p}
        onClick={() => onProductClick(p)}
      />
    ))}
  </div>
</div>

  );
};