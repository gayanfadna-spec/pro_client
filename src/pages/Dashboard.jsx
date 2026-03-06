import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import qoflLogo from '../assets/qofl_logo.png';

const Dashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        rawMaterialCount: 0,
        finishedGoodCount: 0,
        packingMaterialCount: 0,
        rawMaterials: [],
        finishedGoods: [],
        packingMaterials: []
    });
    const [loading, setLoading] = useState(true);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [recipeMaterials, setRecipeMaterials] = useState(null);
    const [recipePackingMaterials, setRecipePackingMaterials] = useState(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { data } = await axios.get('http://localhost:5000/api/inventory/stats');
                setStats(data);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching stats", error);
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    const handleProductClick = async (product) => {
        if (selectedProduct?._id === product._id) {
            setSelectedProduct(null);
            setRecipeMaterials(null);
            return;
        }

        setSelectedProduct(product);
        try {
            const config = { headers: { Authorization: `Bearer ${user?.token}` } };
            const { data } = await axios.get(`http://localhost:5000/api/planning/recipes/${product._id}`, config);

            // Extract material IDs. Handle both populated and non-populated cases
            const materialIds = data.ingredients.map(ing =>
                (typeof ing.rawMaterialId === 'object') ? ing.rawMaterialId._id : ing.rawMaterialId
            );
            setRecipeMaterials(materialIds);

            // Extract packing IDs
            const packingIds = data.packaging?.map(p =>
                (typeof p.packingMaterialId === 'object') ? p.packingMaterialId._id : p.packingMaterialId
            ) || [];
            setRecipePackingMaterials(packingIds);

        } catch (error) {
            console.error("Error fetching recipe", error);
            setRecipeMaterials([]);
            setRecipePackingMaterials([]);
        }
    };

    const displayedMaterials = recipeMaterials
        ? stats.rawMaterials.filter(rm => recipeMaterials.includes(rm._id))
        : stats.rawMaterials;

    const displayedPacking = recipePackingMaterials
        ? stats.packingMaterials.filter(pm => recipePackingMaterials.includes(pm._id))
        : stats.packingMaterials;

    const lowStockFG = stats.finishedGoods?.filter(fg => fg.currentQuantity < (fg.minStockQty || 0)) || [];
    const lowStockRM = stats.rawMaterials?.filter(rm => rm.currentQuantity < (rm.minStockQty || 0)) || [];
    const lowStockPM = stats.packingMaterials?.filter(pm => pm.currentQuantity < (pm.minStockQty || 0)) || [];

    if (loading) return <div className="text-center p-10">Loading Dashboard...</div>;

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <img src={qoflLogo} alt="QOFL Logo" className="h-20 sm:h-24 w-auto object-contain" />
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 text-shadow-sm text-center sm:text-left">System Dashboard</h1>
                </div>
                {selectedProduct && (
                    <button
                        onClick={() => { setSelectedProduct(null); setRecipeMaterials(null); }}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 w-full sm:w-auto justify-center"
                    >
                        ✕ Clear Filter
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Stat Cards */}
                <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 flex items-center justify-between group hover:border-blue-500 transition-all">
                    <div>
                        <h3 className="text-gray-400 text-xs uppercase font-bold tracking-widest mb-1">Raw Materials</h3>
                        <p className="text-4xl font-black text-gray-800">{stats.rawMaterialCount}</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                        📦
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 flex items-center justify-between group hover:border-green-500 transition-all">
                    <div>
                        <h3 className="text-gray-400 text-xs uppercase font-bold tracking-widest mb-1">Finished Goods</h3>
                        <p className="text-4xl font-black text-gray-800">{stats.finishedGoodCount}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-xl text-green-600 group-hover:bg-green-600 group-hover:text-white transition-all">
                        ✨
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 flex items-center justify-between group hover:border-orange-500 transition-all">
                    <div>
                        <h3 className="text-gray-400 text-xs uppercase font-bold tracking-widest mb-1">Packing Materials</h3>
                        <p className="text-4xl font-black text-gray-800">{stats.packingMaterialCount}</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-xl text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-all">
                        🗳️
                    </div>
                </div>
            </div>

            {(lowStockFG.length > 0 || lowStockRM.length > 0 || lowStockPM.length > 0) && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <span className="text-2xl">⚠️</span>
                        <h2 className="text-xl font-black text-red-800 uppercase tracking-tight">Reorder Immediately</h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Low Stock Finished Goods */}
                        <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
                            <div className="px-4 py-3 bg-red-100/50 border-b border-red-100 flex justify-between items-center">
                                <h3 className="text-sm font-bold text-red-700">Finished Goods Below Minimum</h3>
                                <span className="bg-red-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">{lowStockFG.length} Items</span>
                            </div>
                            <div className="max-h-60 overflow-y-auto overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50/50">
                                        <tr className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                                            <th className="px-4 py-2 text-red-900">Product</th>
                                            <th className="px-4 py-2 text-right text-red-900">Qty</th>
                                            <th className="px-4 py-2 text-right text-red-900">Min</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {lowStockFG.length > 0 ? lowStockFG.map(fg => (
                                            <tr key={fg._id} className="hover:bg-red-50/30 transition-colors">
                                                <td className="px-4 py-3 font-bold text-gray-800">{fg.name}</td>
                                                <td className="px-4 py-3 text-right text-red-600 font-black">{fg.currentQuantity}</td>
                                                <td className="px-4 py-3 text-right text-gray-400 text-xs">{fg.minStockQty}</td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="3" className="px-4 py-6 text-center text-gray-400 italic">None</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Low Stock Raw Materials */}
                        <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
                            <div className="px-4 py-3 bg-red-100/50 border-b border-red-100 flex justify-between items-center">
                                <h3 className="text-sm font-bold text-red-700">Raw Materials Below Minimum</h3>
                                <span className="bg-red-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">{lowStockRM.length} Items</span>
                            </div>
                            <div className="max-h-60 overflow-y-auto overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50/50">
                                        <tr className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                                            <th className="px-4 py-2 text-red-900">Material</th>
                                            <th className="px-4 py-2 text-right text-red-900">Qty</th>
                                            <th className="px-4 py-2 text-right text-red-900">Min</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {lowStockRM.length > 0 ? lowStockRM.map(rm => (
                                            <tr key={rm._id} className="hover:bg-red-50/30 transition-colors">
                                                <td className="px-4 py-3 font-bold text-gray-800">{rm.name}</td>
                                                <td className="px-4 py-3 text-right text-red-600 font-black">{rm.currentQuantity} {rm.uom}</td>
                                                <td className="px-4 py-3 text-right text-gray-400 text-xs">{rm.minStockQty}</td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="3" className="px-4 py-6 text-center text-gray-400 italic">None</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Low Stock Packing Materials */}
                        <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
                            <div className="px-4 py-3 bg-red-100/50 border-b border-red-100 flex justify-between items-center">
                                <h3 className="text-sm font-bold text-red-700">Packing Materials Below Minimum</h3>
                                <span className="bg-red-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">{lowStockPM.length} Items</span>
                            </div>
                            <div className="max-h-60 overflow-y-auto overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50/50">
                                        <tr className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                                            <th className="px-4 py-2 text-red-900">Material</th>
                                            <th className="px-4 py-2 text-right text-red-900">Qty</th>
                                            <th className="px-4 py-2 text-right text-red-900">Min</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {lowStockPM.length > 0 ? lowStockPM.map(pm => (
                                            <tr key={pm._id} className="hover:bg-red-50/30 transition-colors">
                                                <td className="px-4 py-3 font-bold text-gray-800">{pm.name}</td>
                                                <td className="px-4 py-3 text-right text-red-600 font-black">{pm.currentQuantity} {pm.uom}</td>
                                                <td className="px-4 py-3 text-right text-gray-400 text-xs">{pm.minStockQty}</td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="3" className="px-4 py-6 text-center text-gray-400 italic">None</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )
            }

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Finished Goods Inventory */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    <div className="p-6 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-800">Finished Goods Inventory</h2>
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">Select to filter materials</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-white shadow-sm">
                                <tr className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                                    <th className="px-6 py-4">Product</th>
                                    <th className="px-6 py-4">SKU</th>
                                    <th className="px-6 py-4 text-right">Qty</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {stats.finishedGoods?.map(fg => (
                                    <tr
                                        key={fg._id}
                                        onClick={() => handleProductClick(fg)}
                                        className={`transition-colors cursor-pointer ${selectedProduct?._id === fg._id ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                                    >
                                        <td className="px-6 py-4">
                                            <div className={`font-bold ${selectedProduct?._id === fg._id ? 'text-green-700' : 'text-gray-800'}`}>
                                                {fg.name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 font-mono text-xs">{fg.sku}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`font-bold ${fg.currentQuantity >= (fg.minStockQty || 0) ? 'text-green-600' : 'text-red-600'}`}>
                                                {fg.currentQuantity}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Raw Materials Inventory */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    <div className="p-6 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-800">
                            {selectedProduct ? `Required Raw Materials` : 'All Raw Materials'}
                        </h2>
                        {selectedProduct ? (
                            <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">Filtered View</span>
                        ) : (
                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">In Stock</span>
                        )}
                    </div>
                    <div className="max-h-60 overflow-y-auto overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-white shadow-sm">
                                <tr className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                                    <th className="px-6 py-4">Material</th>
                                    <th className="px-6 py-4">SKU</th>
                                    <th className="px-6 py-4 text-right">Qty</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {displayedMaterials.map(rm => (
                                    <tr key={rm._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-gray-800">{rm.name}</td>
                                        <td className="px-6 py-4 text-gray-500 font-mono text-xs">{rm.sku}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`font-bold ${rm.currentQuantity >= (rm.minStockQty || 0) ? 'text-blue-600' : 'text-red-600'}`}>
                                                {rm.currentQuantity} {rm.uom}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {selectedProduct && displayedMaterials.length === 0 && (
                                    <tr>
                                        <td colSpan="3" className="px-6 py-10 text-center text-gray-400 italic">
                                            No materials required.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Filtered Packing Materials Section - Only show when filtering */}
                    {selectedProduct && (
                        <>
                            <div className="p-6 bg-slate-50/50 border-t border-b border-gray-100 flex justify-between items-center">
                                <h2 className="text-lg font-bold text-indigo-800">Required Packaging</h2>
                                <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">Recipe Content</span>
                            </div>
                            <div className="max-h-60 overflow-y-auto overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 bg-white shadow-sm">
                                        <tr className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                                            <th className="px-6 py-4">Material</th>
                                            <th className="px-6 py-4">SKU</th>
                                            <th className="px-6 py-4 text-right">Qty</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {displayedPacking.map(pm => (
                                            <tr key={pm._id} className="hover:bg-indigo-50/30 transition-colors">
                                                <td className="px-6 py-4 font-bold text-gray-800">{pm.name}</td>
                                                <td className="px-6 py-4 text-gray-500 font-mono text-xs">{pm.sku}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`font-bold ${pm.currentQuantity >= (pm.minStockQty || 0) ? 'text-indigo-600' : 'text-red-600'}`}>
                                                        {pm.currentQuantity} {pm.uom}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {displayedPacking.length === 0 && (
                                            <tr>
                                                <td colSpan="3" className="px-6 py-10 text-center text-gray-400 italic">
                                                    No packaging required.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Packing Materials Inventory Section */}
            {!selectedProduct && (
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    <div className="p-6 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-800">All Packing Materials</h2>
                        <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">In Stock</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-white shadow-sm">
                                <tr className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                                    <th className="px-6 py-4">Material</th>
                                    <th className="px-6 py-4">SKU</th>
                                    <th className="px-6 py-4 text-right">Qty</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {stats.packingMaterials?.map(pm => (
                                    <tr key={pm._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-gray-800">{pm.name}</td>
                                        <td className="px-6 py-4 text-gray-500 font-mono text-xs">{pm.sku}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`font-bold ${pm.currentQuantity >= (pm.minStockQty || 0) ? 'text-orange-600' : 'text-red-600'}`}>
                                                {pm.currentQuantity} {pm.uom}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {stats.packingMaterials?.length === 0 && (
                                    <tr>
                                        <td colSpan="3" className="px-6 py-10 text-center text-gray-400 italic">
                                            No packing materials found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className={`p-6 sm:p-8 rounded-2xl text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-white/10 transition-colors duration-500 ${selectedProduct ? 'bg-green-600 shadow-green-100' : 'bg-indigo-600 shadow-indigo-100'}`}>
                <div className="w-full sm:w-auto">
                    <p className="text-base sm:text-lg font-bold">
                        {selectedProduct ? `Currently Inspecting: ${selectedProduct.name}` : 'Operations Status: Normal'}
                    </p>
                    <p className={`${selectedProduct ? 'text-green-50' : 'text-indigo-100'} text-xs sm:text-sm mt-1 sm:mt-0`}>
                        {selectedProduct
                            ? `Showing BOM requirements for ${selectedProduct.sku}.`
                            : `System is tracking ${stats.rawMaterialCount + stats.finishedGoodCount + stats.packingMaterialCount} active line items across all categories.`}
                    </p>
                </div>
                <div className="bg-white/20 px-4 py-2 rounded-lg backdrop-blur-md font-mono text-sm self-start sm:self-auto whitespace-nowrap">
                    {new Date().toLocaleDateString()}
                </div>
            </div>
        </div >
    );
};

export default Dashboard;
