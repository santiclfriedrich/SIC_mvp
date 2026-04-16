"use client";

import { Footer } from "../../components/Footer/Footer";
import { LandingPage } from "../../components/LandingPage/LandingPage";
import { ProductGrid } from "../../components/ProductGrid/ProductGrid";
import { ProductModal } from "../../components/Modal/ProductModal";
import { SearchBar } from "../../components/SearchBar/SearchBar";
import { SortFilter } from "../../components/SortFilter/SortFilter";
import { Pagination } from "../../components/Pagination/Pagination";

import {
  useProductStore,
  applySortAndFilter,
  PAGE_SIZE,
} from "../../store/productStore";
import { useState, useEffect, useMemo } from "react";

function App() {
  const {
    query,
    setQuery,
    fetchProducts,
    fetchAllProducts,
    products,
    allProducts,
    loading,
    loadingAll,
    hasSearched,
    lastQuery,
    error,
    sortBy,
    setSortBy,
    currentPage,
    setCurrentPage,
  } = useProductStore();

  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    fetch("/api/warmup", { method: "POST" }).catch(() => {});
    fetchAllProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Which products are "active" depends on the current view
  const showSearchResults = hasSearched || loading;
  const showBrowseAll = !showSearchResults && (loadingAll || allProducts.length > 0);
  const showInitialLanding = !showSearchResults && !showBrowseAll;

  const activeRaw = showSearchResults ? products : allProducts;

  const sortedProducts = useMemo(
    () => applySortAndFilter(activeRaw, sortBy),
    [activeRaw, sortBy]
  );

  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / PAGE_SIZE));
  const safePage   = Math.min(currentPage, totalPages);

  const paginatedProducts = useMemo(
    () => sortedProducts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sortedProducts, safePage]
  );

  // ── Shared product bar (sort + count) ────────────────────────────────────
  const ProductBar = () => {
    if (loading || (loadingAll && !showSearchResults)) {
      return (
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-[#9B978F] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-ping inline-block" />
            {showSearchResults
              ? "Buscando en todos los proveedores…"
              : "Cargando catálogo completo…"}
          </p>
        </div>
      );
    }

    if (sortedProducts.length === 0 && !error) return null;

    return (
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <p className="text-sm text-[#9B978F]">
          {showSearchResults ? (
            <>
              <span className="font-semibold text-[#1A1917]">{sortedProducts.length}</span>{" "}
              {sortedProducts.length === 1 ? "resultado" : "resultados"} para{" "}
              <span className="font-medium text-[#1A1917]">"{lastQuery}"</span>
            </>
          ) : (
            <>
              <span className="font-semibold text-[#1A1917]">{sortedProducts.length}</span>{" "}
              {sortedProducts.length === 1 ? "producto" : "productos"} en el catálogo
            </>
          )}
        </p>
        <SortFilter sortBy={sortBy} onChange={(v) => { setSortBy(v); }} />
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F2F1EE]">
      <main className="flex-1 px-4 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto">

          {/* ── Estado inicial: landing full-height ── */}
          {showInitialLanding && (
            <LandingPage
              searchQuery={query}
              setSearchQuery={setQuery}
              onSearch={fetchProducts}
            />
          )}

          {/* ── Catálogo completo (auto-carga al login) ── */}
          {showBrowseAll && (
            <>
              <LandingPage
                searchQuery={query}
                setSearchQuery={setQuery}
                onSearch={fetchProducts}
                compact
              />

              <div className="mt-8">
                <ProductBar />

                {paginatedProducts.length > 0 && (
                  <>
                    <ProductGrid
                      products={paginatedProducts}
                      onProductClick={setSelectedProduct}
                    />
                    <Pagination
                      currentPage={safePage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                    />
                  </>
                )}
              </div>
            </>
          )}

          {/* ── Resultados de búsqueda ── */}
          {showSearchResults && (
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
              </div>

              <ProductBar />

              {/* Error */}
              {!loading && hasSearched && error && (
                <p className="text-sm text-red-600 text-center mt-4">
                  Error al buscar. Por favor reintentá.
                </p>
              )}

              {/* Sin resultados */}
              {!loading && hasSearched && sortedProducts.length === 0 && !error && (
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

              {/* Grid */}
              {paginatedProducts.length > 0 && (
                <>
                  <ProductGrid
                    products={paginatedProducts}
                    onProductClick={setSelectedProduct}
                  />
                  <Pagination
                    currentPage={safePage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                </>
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
