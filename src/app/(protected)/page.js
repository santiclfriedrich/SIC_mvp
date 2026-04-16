"use client";

import { Footer } from "../../components/Footer/Footer";
import { LandingPage } from "../../components/LandingPage/LandingPage";
import { ProductGrid } from "../../components/ProductGrid/ProductGrid";
import { ProductModal } from "../../components/Modal/ProductModal";
import { SearchBar } from "../../components/SearchBar/SearchBar";

import { useProductStore } from "../../store/productStore";
import { useState, useEffect } from "react";

function App() {
  const {
    query,
    setQuery,
    fetchProducts,
    products,
    loading,
    hasSearched,
    lastQuery,
    error,
  } = useProductStore();

  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    fetch("/api/warmup", { method: "POST" }).catch(() => {});
  }, []);

  const showResults = hasSearched || loading;

  return (
    <div className="min-h-screen flex flex-col bg-[#F2F1EE]">
      <main className="flex-1 px-4 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto">

          {!showResults ? (
            <LandingPage
              searchQuery={query}
              setSearchQuery={setQuery}
              onSearch={fetchProducts}
            />
          ) : (
            <>
              {/* Barra de búsqueda compacta */}
              <div className="mb-6">
                <div className="max-w-xl mx-auto mb-3">
                  <SearchBar
                    searchQuery={query}
                    setSearchQuery={setQuery}
                    onSearch={fetchProducts}
                    variant="small"
                  />
                </div>

                {/* Estado de búsqueda */}
                <div className="text-center">
                  {loading && (
                    <p className="text-sm text-[#9B978F] flex items-center justify-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-ping inline-block" />
                      Buscando en todos los proveedores…
                    </p>
                  )}

                  {!loading && hasSearched && products.length > 0 && (
                    <p className="text-sm text-[#9B978F]">
                      <span className="font-semibold text-[#1A1917]">{products.length}</span>{" "}
                      {products.length === 1 ? "producto" : "productos"} para{" "}
                      <span className="font-medium text-[#1A1917]">"{lastQuery}"</span>
                    </p>
                  )}

                  {!loading && hasSearched && error && (
                    <p className="text-sm text-red-600">
                      Error al buscar. Por favor reintentá.
                    </p>
                  )}
                </div>
              </div>

              {/* Sin resultados */}
              {!loading && hasSearched && products.length === 0 && !error && (
                <div className="text-center py-20">
                  <p className="text-4xl mb-4 select-none">🔍</p>
                  <p className="text-base font-semibold text-[#1A1917] mb-1">
                    Sin resultados para "{lastQuery}"
                  </p>
                  <p className="text-sm text-[#9B978F]">
                    Probá con otro código de producto o nombre.
                  </p>
                </div>
              )}

              {/* Grid de productos */}
              {products.length > 0 && (
                <ProductGrid
                  products={products}
                  onProductClick={setSelectedProduct}
                />
              )}
            </>
          )}
        </div>
      </main>

      <ProductModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      <Footer />
    </div>
  );
}

export default App;
