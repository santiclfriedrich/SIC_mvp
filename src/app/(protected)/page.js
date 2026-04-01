"use client";

import { Header } from "../../components/Header/Header";
import { Footer } from "../../components/Footer/Footer";
import { LandingPage } from "../../components/LandingPage/LandingPage";
import { ProductGrid } from "../../components/ProductGrid/ProductGrid";
import { ProductModal } from "../../components/Modal/ProductModal";
import { SearchBar } from "../../components/SearchBar/SearchBar";

import { useProductStore } from "../../store/productStore";
import { useState } from "react";

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

  const showResults = hasSearched || loading;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
  

      <main className="flex-1 px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {!showResults ? (
            <LandingPage
              searchQuery={query}
              setSearchQuery={setQuery}
              onSearch={fetchProducts}
            />
          ) : (
            <>
              {/* Header resultados */}
              <div className="mb-8 text-center">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">
                  Todos tus proveedores, una sola búsqueda
                </h2>

                <div className="relative max-w-2xl mx-auto">
                  <SearchBar
                    searchQuery={query}
                    setSearchQuery={setQuery}
                    onSearch={fetchProducts}
                    variant="small"
                  />
                </div>

                {loading && (
                  <p className="mt-4 text-sm text-gray-500">
                    Buscando en todos los proveedores…
                  </p>
                )}

                {!loading && hasSearched && products.length > 0 && (
                  <p className="mt-2 text-sm text-gray-500">
                    {products.length} {products.length === 1 ? "producto" : "productos"} encontrados para{" "}
                    <span className="font-medium text-gray-700">&quot;{lastQuery}&quot;</span>
                  </p>
                )}

                {!loading && hasSearched && error && (
                  <p className="mt-4 text-sm text-red-600">
                    Error al buscar. Por favor reintentá.
                  </p>
                )}
              </div>

              {!loading && hasSearched && products.length === 0 && !error && (
                <div className="text-center py-16 text-gray-500">
                  <p className="text-lg font-medium">Sin resultados para &quot;{lastQuery}&quot;</p>
                  <p className="text-sm mt-1">
                    Probá con otro código de producto o nombre.
                  </p>
                </div>
              )}

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
