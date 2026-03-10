import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import qoflLogo from '../assets/qofl_logo.png';

const ProducibilityManager = () => {
    const { user } = useAuth();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProducibleData();
    }, []);

    const fetchProducibleData = async () => {
        setLoading(true);
        try {
            const config = { headers: { Authorization: `Bearer ${user?.token}` } };
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/planning/producible`, config);
            setData(res.data);
        } catch (error) {
            console.error("Error fetching producible data", error);
        }
        setLoading(false);
    };

    if (loading) return <div className="p-10 text-center text-gray-500 italic">Calculating production potential...</div>;

    return (
        <div className="p-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                    <img src={qoflLogo} alt="QOFL Logo" className="h-20 sm:h-24 w-auto object-contain" />
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 text-shadow-sm">Potential Production</h1>
                        <p className="text-gray-500 mt-1 text-sm sm:text-base">Estimating how many finished goods can be made from current raw material stocks.</p>
                    </div>
                </div>
                <button
                    onClick={fetchProducibleData}
                    className="w-full md:w-auto justify-center bg-white border-2 border-indigo-100 text-indigo-600 px-6 py-2.5 rounded-xl shadow-sm hover:shadow-indigo-100 hover:border-indigo-200 transition-all font-semibold flex items-center gap-2"
                >
                    🔄 Refresh Data
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-xl overflow-x-auto border border-gray-100">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider font-bold">
                            <th className="p-5 border-b border-gray-100">Product Name</th>
                            <th className="p-5 border-b border-gray-100">SKU</th>
                            <th className="p-5 border-b border-gray-100">Category</th>
                            <th className="p-5 border-b border-gray-100">Current Stock</th>
                            <th className="p-5 border-b border-gray-100 bg-indigo-50/30 text-indigo-700">Producible Quantity</th>
                            <th className="p-5 border-b border-gray-100">Limiting Factor</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {(Array.isArray(data) ? data : []).map((item) => {
                            // Find the material with the lowest possible production to show as limiting factor
                            let limitingMaterial = null;
                            let minRatio = Infinity;

                            item.recipe.ingredients.forEach(ing => {
                                const ratio = ing.available / ing.needed;
                                if (ratio < minRatio) {
                                    minRatio = ratio;
                                    limitingMaterial = ing;
                                }
                            });

                            return (
                                <tr key={item._id} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="p-5">
                                        <div className="font-bold text-gray-900">{item.name}</div>
                                    </td>
                                    <td className="p-5 text-gray-500 font-mono text-sm">{item.sku}</td>
                                    <td className="p-5">
                                        <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tight">
                                            {item.category || 'Uncategorized'}
                                        </span>
                                    </td>
                                    <td className="p-5 font-bold text-gray-700">{item.currentQuantity}</td>
                                    <td className="p-5 bg-indigo-50/20">
                                        <span className={`px-4 py-1.5 rounded-full text-sm font-black ${item.potentialProduction > 0 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-red-100 text-red-600'}`}>
                                            {item.potentialProduction}
                                        </span>
                                    </td>
                                    <td className="p-5 text-sm">
                                        {item.potentialProduction === 0 && limitingMaterial ? (
                                            <div className="flex flex-col">
                                                <span className="text-red-500 font-bold">{limitingMaterial.name}</span>
                                                <span className="text-[10px] text-gray-400">0 available (needs {limitingMaterial.needed})</span>
                                            </div>
                                        ) : limitingMaterial ? (
                                            <div className="flex flex-col">
                                                <span className="text-gray-600 font-medium">{limitingMaterial.name}</span>
                                                <span className="text-[10px] text-gray-400">{limitingMaterial.available} left / {limitingMaterial.needed} per batch</span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 italic">No limitations</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {(!Array.isArray(data) || data.length === 0) && (
                            <tr>
                                <td colSpan="6" className="p-20 text-center text-gray-400 italic">
                                    No products with defined recipes found. Define recipes in the Finished Goods Manager to see production potential.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-8 bg-indigo-900 rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden">
                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                    <div className="bg-white/10 p-4 rounded-xl backdrop-blur-md shrink-0">
                        <span className="text-3xl">💡</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold mb-1">Production Planning Tip</h3>
                        <p className="text-indigo-100 text-sm max-w-2xl">
                            The "Producible Quantity" is calculated by checking every ingredient in a product's recipe against your current raw material stock. The ingredient that allows for the fewest production runs is your limiting factor.
                        </p>
                    </div>
                </div>
                <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
            </div>
        </div>
    );
};

export default ProducibilityManager;
