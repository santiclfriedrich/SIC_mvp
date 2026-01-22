"use client";
import { Search } from 'lucide-react';

export const SearchBar = ({ searchQuery, setSearchQuery, onSearch, variant = 'large' }) => {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  const inputClasses =
  variant === 'large'
    ? 'w-full px-6 py-4 pr-14 text-lg text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
    : 'w-full px-6 py-3 pr-14 text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Buscar productos..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyPress={handleKeyPress}
        className={inputClasses}
      />
      <button
        onClick={onSearch}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
      >
        <Search size={variant === 'large' ? 24 : 20} />
      </button>
    </div>
  );
};