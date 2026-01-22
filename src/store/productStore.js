// src/store/productStore.js
import { create } from "zustand";

export const useProductStore = create((set, get) => ({
  query: "",
  loading: false,
  products: [],
  error: null,

  setQuery: (q) => set({ query: q }),

  fetchProducts: async () => {
    const query = get().query;
    if (!query || query.trim().length < 2) return;

    set({ loading: true, error: null });

    try {
      const res = await fetch(
        `/api/products?q=${encodeURIComponent(query.trim())}`
      );

      if (!res.ok) throw new Error("Error backend");

      const data = await res.json();
      set({ products: data, loading: false });
    } catch  {
      set({ error: "Error al buscar productos", loading: false });
    }
  },
}));
