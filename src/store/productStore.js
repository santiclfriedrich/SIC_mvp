// src/store/productStore.js
import { create } from "zustand";

export const PAGE_SIZE = 48;

export function getProductStock(p) {
  const best = p.bestPrice || p.providers?.[0] || p;
  return Number(best.stockTotal ?? best.stock ?? p.stockTotal ?? p.stock) || 0;
}

export function applySortAndFilter(products, sortBy) {
  if (sortBy === "no-stock") {
    return [...products].filter((p) => getProductStock(p) === 0);
  }
  const result = [...products];
  switch (sortBy) {
    case "stock-desc":
      return result.sort((a, b) => getProductStock(b) - getProductStock(a));
    case "stock-asc":
      return result.sort((a, b) => getProductStock(a) - getProductStock(b));
    case "a-z":
      return result.sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
    case "z-a":
      return result.sort((a, b) => (b.name || "").localeCompare(a.name || "", "es"));
    default:
      return result;
  }
}

export const useProductStore = create((set, get) => ({
  // Search state
  query: "",
  loading: false,
  products: [],
  error: null,
  hasSearched: false,
  lastQuery: "",

  // All products state (loaded on mount)
  allProducts: [],
  loadingAll: false,

  // Sort + Pagination (shared between browse and search views)
  sortBy: "stock-desc",
  currentPage: 1,

  setQuery: (q) => set({ query: q }),

  setSortBy: (sortBy) => set({ sortBy, currentPage: 1 }),

  setCurrentPage: (page) => set({ currentPage: page }),

  fetchAllProducts: async () => {
    set({ loadingAll: true });
    try {
      const res = await fetch("/api/products?q=");
      if (!res.ok) throw new Error("Error backend");
      const data = await res.json();
      set({ allProducts: data, loadingAll: false });
    } catch {
      set({ loadingAll: false });
    }
  },

  fetchProducts: async () => {
    const query = get().query;
    if (!query || query.trim().length < 2) return;

    set({ loading: true, error: null, hasSearched: false, currentPage: 1 });

    try {
      const res = await fetch(
        `/api/products?q=${encodeURIComponent(query.trim())}`
      );
      if (!res.ok) throw new Error("Error backend");
      const data = await res.json();
      set({ products: data, loading: false, hasSearched: true, lastQuery: query.trim() });
    } catch {
      set({ error: "Error al buscar productos", loading: false, hasSearched: true, lastQuery: query.trim() });
    }
  },
}));
