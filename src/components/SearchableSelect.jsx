import React, { useState, useRef, useEffect } from 'react';

const SearchableSelect = ({ options, value, onChange, placeholder, displayField = 'name', secondaryField = 'sku', label = 'Item' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef(null);

    // Filter options based on search term
    const filteredOptions = options.filter(opt =>
        (opt[displayField] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (opt[secondaryField] || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Find current selected item
    const selectedItem = options.find(opt => opt._id === value);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (item) => {
        onChange(item._id);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-white border-2 rounded-lg px-3 py-2 cursor-pointer transition-all flex justify-between items-center ${isOpen ? 'border-indigo-500 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}
            >
                <div className="flex-1 truncate">
                    {selectedItem ? (
                        <div className="flex items-center gap-2">
                            <span className="text-gray-900 font-medium">{selectedItem[displayField]}</span>
                            <span className="text-gray-400 text-xs font-mono">{selectedItem[secondaryField]}</span>
                        </div>
                    ) : (
                        <span className="text-gray-400">{placeholder || `Select ${label}`}</span>
                    )}
                </div>
                <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="p-2 border-b border-gray-50 flex items-center gap-2 bg-gray-50/50">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            autoFocus
                            placeholder="Search by name or SKU..."
                            className="w-full bg-transparent border-none outline-none text-sm py-1"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => (
                                <div
                                    key={opt._id}
                                    onClick={() => handleSelect(opt)}
                                    className={`px-4 py-2.5 hover:bg-indigo-50 cursor-pointer transition-colors flex flex-col ${opt._id === value ? 'bg-indigo-50/50' : ''}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-semibold text-gray-800">{opt[displayField]}</span>
                                        <span className="text-[10px] font-mono bg-gray-100 border border-gray-200 text-gray-500 px-1.5 py-0.5 rounded uppercase">{opt[secondaryField]}</span>
                                    </div>
                                    {opt.currentQuantity !== undefined && (
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <div className={`w-1.5 h-1.5 rounded-full ${opt.currentQuantity > 0 ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                                            <span className="text-[10px] text-gray-500">
                                                Stock: <span className="font-bold">{opt.currentQuantity}</span> {opt.uom || ''}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-center text-gray-400 text-sm italic">
                                No items found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
