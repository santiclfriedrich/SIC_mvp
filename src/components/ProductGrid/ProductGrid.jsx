"use client";
import { ProductCard } from "../ProductCard/ProductCard";

export const ProductGrid = ({ products, onProductClick }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {products.map((p) => (
        <ProductCard
          key={p.sku}
          product={p}
          onClick={() => onProductClick(p)}
        />
      ))}
    </div>
  );
};
