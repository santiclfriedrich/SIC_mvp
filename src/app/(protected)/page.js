"use client";

import { Footer } from "../../components/Footer/Footer";
import { LandingPage } from "../../components/LandingPage/LandingPage";
import { ProductGrid } from "../../components/ProductGrid/ProductGrid";
import { ProductModal } from "../../components/Modal/ProductModal";
import { SearchBar } from "../../components/SearchBar/SearchBar";
import { SortFilter } from "../../components/SortFilter/SortFilter";
import { Pagination } from "../../components/Pagination/Pagination";
import { WhatsNewModal } from "../../components/WhatsNewModal/WhatsNewModal";

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

  const ProductBar = () => {
    if (loading || (loadingAll && !showSearchResults)) {
      return (
        <div className="mb-5 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-ink-400">
            <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-brand-500" />
            {showSearchResults
              ? "Buscando en todos los proveedores…"
              : "Cargando catálogo completo…"}
          </p>
        </div>
      );
    }

    if (sortedProducts.length === 0 && !error) return null;

    return (
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-ink-400">
          {showSearchResults ? (
            <>
              <span className="font-semibold text-slate-900 dark:text-ink-100">{sortedProducts.length}</span>{" "}
              {sortedProducts.length === 1 ? "resultado" : "resultados"} para{" "}
              <span className="font-medium text-slate-900 dark:text-ink-100">"{lastQuery}"</span>
            </>
          ) : (
            <>
              <span className="font-semibold text-slate-900 dark:text-ink-100">{sortedProducts.length}</span>{" "}
              {sortedProducts.length === 1 ? "producto" : "productos"} en el catálogo
            </>
          )}
        </p>
        <SortFilter sortBy={sortBy} onChange={(v) => { setSortBy(v); }} />
      </div>
    );
  };

  return (
    <div className="flex min-h-full flex-col">
      <main className="flex-1 px-4 py-6 sm:py-8">
        <div className="mx-auto max-w-7xl">

          {showInitialLanding && (
            <LandingPage
              searchQuery={query}
              setSearchQuery={setQuery}
              onSearch={fetchProducts}
            />
          )}

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

          {showSearchResults && (
            <>
              <div className="mb-6">
                <div className="mx-auto mb-3 max-w-xl">
                  <SearchBar
                    searchQuery={query}
                    setSearchQuery={setQuery}
                    onSearch={fetchProducts}
                    variant="small"
                  />
                </div>
              </div>

              <ProductBar />

              {!loading && hasSearched && error && (
                <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">
                  Error al buscar. Por favor reintentá.
                </p>
              )}

              {!loading && hasSearched && sortedProducts.length === 0 && !error && (
                <div className="py-20 text-center">
                  <p className="mb-4 select-none text-4xl">🔍</p>
                  <p className="mb-1 text-base font-semibold text-slate-900 dark:text-ink-100">
                    Sin resultados para "{lastQuery}"
                  </p>
                  <p className="text-sm text-slate-500 dark:text-ink-400">
                    Probá con otro código de producto o nombre.
                  </p>
                </div>
              )}

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

      <WhatsNewModal />

      <ProductModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      <Footer />
    </div>
  );
}

export default App;
