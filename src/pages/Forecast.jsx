import React, { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';
import qoflLogo from '../assets/qofl_logo.png';

const Forecast = () => {
    const { user } = useAuth();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [calculating, setCalculating] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);
    const [requirements, setRequirements] = useState([]);
    const [breakdown, setBreakdown] = useState([]);

    // Get next 3 month names
    const getMonths = () => {
        const months = [];
        const date = new Date();
        for (let i = 0; i < 3; i++) {
            const d = new Date(date.getFullYear(), date.getMonth() + i, 1);
            months.push(d.toLocaleString('default', { month: 'short' }));
        }
        return months;
    };

    const monthNames = getMonths();

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const { data } = await axios.get(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/inventory/finished-goods`);
            setProducts(data);
        } catch (error) {
            console.error("Error fetching products", error);
        }
        setLoading(false);
    };

    const addItem = () => {
        setSelectedItems([...selectedItems, { finishedGoodId: '', m1: 0, m2: 0, m3: 0 }]);
    };

    const removeItem = (index) => {
        setSelectedItems(selectedItems.filter((_, i) => i !== index));
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...selectedItems];
        newItems[index][field] = value;
        setSelectedItems(newItems);
    };

    const getProductStock = (id) => {
        const prod = products.find(p => p._id === id);
        return prod ? prod.currentQuantity : 0;
    };

    const handleCalculate = async (e) => {
        e.preventDefault();
        if (selectedItems.length === 0) return;

        setCalculating(true);
        try {
            const config = { headers: { Authorization: `Bearer ${user?.token}` } };

            // Map items to calculate "Net Production Needed"
            const payload = selectedItems.map(item => {
                const totalTarget = item.m1 + item.m2 + item.m3;
                const stock = getProductStock(item.finishedGoodId);
                const netNeeded = Math.max(0, totalTarget - stock);
                return {
                    finishedGoodId: item.finishedGoodId,
                    targetQuantity: netNeeded // Send net needed to the RM calculator
                };
            }).filter(item => item.targetQuantity > 0);

            if (payload.length === 0) {
                setRequirements([]);
                alert("No production needed. Current stock covers the target.");
                setCalculating(false);
                return;
            }

            const { data } = await axios.post(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/planning/calculate`, { items: payload }, config);
            setRequirements(data.aggregated);
            setBreakdown(data.breakdown);
        } catch (error) {
            alert(error.response?.data?.message || "Error calculating requirements");
        }
        setCalculating(false);
    };

    const generateRequirementsReport = () => {
        if (requirements.length === 0) return;

        const doc = new jsPDF();

        // Header
        try {
            doc.addImage(qoflLogo, 'PNG', 155, 10, 25, 25);
        } catch (error) {
            console.error("Error adding logo to PDF", error);
        }

        doc.setFontSize(22);
        doc.setTextColor(79, 70, 229); // Indigo-600
        doc.text("Raw Material Requirements Report", 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

        // Production Plan Summary
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Planned Production:", 14, 45);

        let yPos = 52;
        selectedItems.forEach(item => {
            const product = products.find(p => p._id === item.finishedGoodId);
            const totalTarget = item.m1 + item.m2 + item.m3;
            const stock = getProductStock(item.finishedGoodId);
            const netNeeded = Math.max(0, totalTarget - stock);

            if (netNeeded > 0 && product) {
                doc.setFontSize(10);
                doc.text(`- ${product.name}: ${netNeeded} units needed (Total Target: ${totalTarget}, Stock: ${stock})`, 16, yPos);
                yPos += 6;
            }
        });

        // Requirements Table
        const tableData = requirements.map(req => {
            const shortage = Math.max(0, req.requiredQuantity - req.currentQuantity);
            const balance = req.currentQuantity - req.requiredQuantity;
            return [
                req.name,
                req.sku,
                `${req.requiredQuantity} ${req.uom}`,
                `${req.currentQuantity} ${req.uom}`,
                `${balance > 0 ? '+' : ''}${balance} ${req.uom}`,
                shortage > 0 ? `${shortage} ${req.uom} SHORT` : 'STOCK OK'
            ];
        });

        autoTable(doc, {
            startY: yPos + 10,
            head: [['Material', 'SKU', 'Required', 'On-Hand', 'Balance', 'Status']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillStyle: [79, 70, 229], textColor: [255, 255, 255] },
            didParseCell: function (data) {
                if (data.section === 'body' && data.column.index === 5) {
                    if (data.cell.raw.includes('SHORT')) {
                        data.cell.styles.textColor = [220, 38, 38]; // Red-600
                        data.cell.styles.fontStyle = 'bold';
                    } else if (data.cell.raw.includes('STOCK OK')) {
                        data.cell.styles.textColor = [5, 150, 105]; // Emerald-600
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            }
        });

        // Recipe Breakdown Section
        if (breakdown && breakdown.length > 0) {
            let finalY = doc.lastAutoTable.finalY;

            // Check if we need a new page for the section header
            if (finalY > 240) {
                doc.addPage();
                finalY = 20;
            }

            doc.setFontSize(16);
            doc.setTextColor(79, 70, 229);
            doc.text("Recipe Breakdown (Product-Wise)", 14, finalY + 15);
            finalY += 22;

            breakdown.forEach((item) => {
                // Check for page break before each product header
                if (finalY > 240) {
                    doc.addPage();
                    finalY = 20;
                }

                doc.setFontSize(12);
                doc.setTextColor(0);
                doc.setFont("helvetica", "bold");
                doc.text(`${item.productName} (${item.targetQuantity} units)`, 14, finalY);

                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                doc.setTextColor(100);
                doc.text(`SKU: ${item.productSku}`, 14, finalY + 5);

                const ingredientData = item.ingredients.map(ing => {
                    const isShortage = ing.quantity > ing.available;
                    return [
                        ing.name,
                        ing.sku,
                        `${ing.quantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${ing.uom}`,
                        `${ing.available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${ing.uom}`,
                        isShortage ? 'SHORTAGE' : 'OK'
                    ];
                });

                autoTable(doc, {
                    startY: finalY + 8,
                    head: [['Material', 'SKU', 'Required', 'Available', 'Status']],
                    body: ingredientData,
                    theme: 'striped',
                    headStyles: { fillStyle: [51, 65, 85], textColor: [255, 255, 255] },
                    styles: { fontSize: 8 },
                    didParseCell: function (data) {
                        if (data.section === 'body' && data.column.index === 4) {
                            if (data.cell.raw === 'SHORTAGE') {
                                data.cell.styles.textColor = [220, 38, 38];
                                data.cell.styles.fontStyle = 'bold';
                            } else {
                                data.cell.styles.textColor = [5, 150, 105];
                                data.cell.styles.fontStyle = 'bold';
                            }
                        }
                    }
                });

                finalY = doc.lastAutoTable.finalY + 15;
            });
        }

        doc.save(`RawMaterialRequirements_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    if (loading) return <div className="p-10 text-center">Loading Forecast...</div>;

    return (
        <div className="p-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
                <img src={qoflLogo} alt="QOFL Logo" className="h-20 sm:h-24 w-auto object-contain" />
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 text-center sm:text-left">Production Forecast</h1>
            </div>

            <div className="flex flex-col gap-10">
                {/* Planning Form */}
                <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                        <h2 className="text-xl font-bold text-gray-700 w-full sm:w-auto text-center sm:text-left">3-Month Planning Table</h2>
                        <button
                            type="button" onClick={addItem}
                            className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-blue-700 transition-all flex justify-center items-center gap-2"
                        >
                            <span>+</span> Add Product
                        </button>
                    </div>

                    <form onSubmit={handleCalculate}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-gray-400 text-xs uppercase font-bold tracking-widest border-b border-gray-100">
                                        <th className="p-4">Finished Good</th>
                                        <th className="p-4 w-32">{monthNames[0]}</th>
                                        <th className="p-4 w-32">{monthNames[1]}</th>
                                        <th className="p-4 w-32">{monthNames[2]}</th>
                                        <th className="p-4 w-24 text-center">In Stock</th>
                                        <th className="p-4 w-32 text-center text-indigo-600">Net Prod. Needed</th>
                                        <th className="p-4 w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {selectedItems.map((item, idx) => {
                                        const stock = getProductStock(item.finishedGoodId);
                                        const totalTarget = item.m1 + item.m2 + item.m3;
                                        const netNeeded = Math.max(0, totalTarget - stock);

                                        return (
                                            <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="p-4">
                                                    <select
                                                        required value={item.finishedGoodId}
                                                        onChange={(e) => handleItemChange(idx, 'finishedGoodId', e.target.value)}
                                                        className="w-full bg-white border-2 border-gray-100 rounded-lg px-3 py-2 outline-none focus:border-blue-500 transition-all font-medium"
                                                    >
                                                        <option value="">Select Product</option>
                                                        {products.map(p => (
                                                            <option key={p._id} value={p._id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="p-4">
                                                    <input
                                                        type="number" min="0" required value={item.m1}
                                                        onChange={(e) => handleItemChange(idx, 'm1', Number(e.target.value))}
                                                        className="w-full bg-white border-2 border-gray-100 rounded-lg px-4 py-3 outline-none focus:border-blue-500 font-black text-center text-xl"
                                                    />
                                                </td>
                                                <td className="p-4">
                                                    <input
                                                        type="number" min="0" required value={item.m2}
                                                        onChange={(e) => handleItemChange(idx, 'm2', Number(e.target.value))}
                                                        className="w-full bg-white border-2 border-gray-100 rounded-lg px-4 py-3 outline-none focus:border-blue-500 font-black text-center text-xl"
                                                    />
                                                </td>
                                                <td className="p-4">
                                                    <input
                                                        type="number" min="0" required value={item.m3}
                                                        onChange={(e) => handleItemChange(idx, 'm3', Number(e.target.value))}
                                                        className="w-full bg-white border-2 border-gray-100 rounded-lg px-4 py-3 outline-none focus:border-blue-500 font-black text-center text-xl"
                                                    />
                                                </td>
                                                <td className="p-4 text-center font-bold text-gray-500">
                                                    {stock}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-4 py-1.5 rounded-full text-sm font-black ${netNeeded > 0 ? 'bg-indigo-100 text-indigo-700 h-8 flex items-center justify-center' : 'bg-green-100 text-green-700 h-8 flex items-center justify-center'}`}>
                                                        {netNeeded}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <button
                                                        type="button" onClick={() => removeItem(idx)}
                                                        className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100 transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {selectedItems.length > 0 && (
                            <div className="mt-8 flex justify-center">
                                <button
                                    type="submit"
                                    disabled={calculating}
                                    className={`w-full sm:w-auto px-6 sm:px-12 py-3 sm:py-4 rounded-2xl font-black text-white shadow-xl transition-all scale-100 active:scale-95 ${calculating
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-indigo-200 shadow-indigo-100'
                                        }`}
                                >
                                    {calculating ? 'Syncing...' : '🔥 Calculate RM Requirements'}
                                </button>
                            </div>
                        )}
                    </form>
                </div>

                {/* Results Table */}
                <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-100 pb-4 gap-4">
                        <h2 className="text-xl sm:text-2xl font-black text-gray-800 tracking-tight">Raw Material Requirements</h2>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
                            {requirements.length > 0 && (
                                <div className="bg-indigo-50 text-indigo-700 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider self-start sm:self-auto">
                                    {requirements.length} Components Needed
                                </div>
                            )}
                            {requirements.length > 0 && (
                                <button
                                    onClick={generateRequirementsReport}
                                    className="w-full sm:w-auto justify-center bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg hover:bg-indigo-700 transition-all font-bold text-sm flex items-center gap-2"
                                    title="Download PDF Report"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12V4m0 8l-4-4m4 4l4-4" />
                                    </svg>
                                    <span>Download Report</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {requirements.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
                                        <th className="pb-4 px-4">Material</th>
                                        <th className="pb-4 px-4">Required</th>
                                        <th className="pb-4 px-4">On-Hand</th>
                                        <th className="pb-4 px-4">Balance</th>
                                        <th className="pb-4 px-4 text-center">Shortage</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {requirements.map((req, idx) => {
                                        const shortage = Math.max(0, req.requiredQuantity - req.currentQuantity);
                                        const balance = req.currentQuantity - req.requiredQuantity;
                                        return (
                                            <tr key={idx} className="hover:bg-indigo-50/20 transition-colors">
                                                <td className="py-5 px-4">
                                                    <div className="font-bold text-gray-800 text-lg leading-tight">{req.name}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono uppercase tracking-tighter">{req.sku}</div>
                                                </td>
                                                <td className="py-5 px-4">
                                                    <span className="text-xl font-black text-indigo-600">
                                                        {req.requiredQuantity.toLocaleString()}
                                                    </span>
                                                    <span className="text-[10px] uppercase ml-1 font-bold text-gray-400">{req.uom}</span>
                                                </td>
                                                <td className="py-5 px-4 font-bold text-gray-600">
                                                    {req.currentQuantity.toLocaleString()}
                                                </td>
                                                <td className={`py-5 px-4 font-black ${balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    {balance > 0 ? '+' : ''}{balance.toLocaleString()}
                                                </td>
                                                <td className="py-5 px-4 text-center">
                                                    {shortage > 0 ? (
                                                        <span className="bg-rose-100 text-rose-700 px-4 py-2 rounded-xl text-xs font-black shadow-sm ring-1 ring-rose-200">
                                                            {shortage.toLocaleString()} {req.uom} Short
                                                        </span>
                                                    ) : (
                                                        <span className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl text-xs font-black shadow-sm ring-1 ring-emerald-200">
                                                            STOCK OK
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-24 bg-gray-50 rounded-3xl border-4 border-dashed border-gray-100">
                            <div className="text-4xl mb-4">📉</div>
                            <p className="text-gray-400 font-bold max-w-xs mx-auto">No production plan detected. Start by adding products to the planning table above.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Product Breakdown Section */}
            {breakdown.length > 0 && (
                <div className="mt-10">
                    <h2 className="text-2xl font-black text-gray-800 mb-6 px-2">Recipe Breakdown (Product-Wise)</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {breakdown.map((item, idx) => (
                            <div key={idx} className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col">
                                <div className="bg-gradient-to-r from-gray-900 to-slate-800 p-6">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-white font-black text-xl leading-tight">{item.productName}</h3>
                                            <p className="text-slate-400 font-mono text-xs mt-1 uppercase tracking-widest">{item.productSku}</p>
                                        </div>
                                        <div className="bg-indigo-500/20 border border-indigo-500/30 px-4 py-2 rounded-2xl text-center">
                                            <span className="block text-[10px] text-indigo-300 font-black uppercase tracking-tighter">Target Qty</span>
                                            <span className="text-white font-black text-lg">{item.targetQuantity.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 border-b border-gray-50 pb-2">Material Contribution</h4>
                                    <div className="space-y-4">
                                        {item.ingredients.map((ing, i) => {
                                            const isShortage = ing.quantity > ing.available;
                                            return (
                                                <div key={i} className={`flex justify-between items-center group p-3 rounded-2xl transition-all ${isShortage ? 'bg-rose-50 border border-rose-100 shadow-sm' : 'hover:bg-gray-50'}`}>
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`font-bold text-sm leading-tight transition-colors ${isShortage ? 'text-rose-700' : 'text-gray-700 group-hover:text-indigo-600'}`}>
                                                                {ing.name}
                                                            </span>
                                                            {isShortage && (
                                                                <span className="bg-rose-600 text-white text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase">Shortage</span>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] text-gray-400 font-mono uppercase mt-0.5">
                                                            {ing.sku}
                                                        </span>
                                                        {isShortage && (
                                                            <span className="text-[9px] text-rose-500 font-bold mt-1">
                                                                Available: {ing.available.toLocaleString()} {ing.uom}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <div className={`text-base font-black ${isShortage ? 'text-rose-600' : 'text-gray-900'}`}>
                                                            {ing.quantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                        <div className={`text-[9px] font-black uppercase tracking-tighter ${isShortage ? 'text-rose-400' : 'text-indigo-500'}`}>
                                                            {ing.uom}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="mt-auto bg-gray-50 p-4 border-t border-gray-100">
                                    <p className="text-[10px] text-gray-400 italic text-center">Scaled requirements based on production recipe</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Forecast;
