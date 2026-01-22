"use client";
import { SearchBar } from '../SearchBar/SearchBar';

export const LandingPage = ({ searchQuery, setSearchQuery, onSearch }) => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-4xl w-full text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
          Todos tus proveedores, una sola búsqueda
        </h2>
        
        <p className="text-lg md:text-xl text-gray-600 mb-12">
          Encuentra todos los productos con stock, precios y detalles para acelerar tus ventas.
        </p>

        <div className="max-w-2xl mx-auto">
          <SearchBar 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSearch={onSearch}
            variant="large"
          />
        </div>
      </div>
    </div>
  );
};
