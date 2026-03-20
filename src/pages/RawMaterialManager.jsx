import React, { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import qoflLogo from '../assets/qofl_logo.png';

const RawMaterialManager = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('inventory');
    const [materials, setMaterials] = useState([]);
    const [grns, setGrns] = useState([]);
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);

    // Inventory Form State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [form, setForm] = useState({
        name: '', sku: '', uom: '', currentQuantity: 0, minStockQty: 0
    });

    // Transaction Modal State
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [transactionType, setTransactionType] = useState('IN'); // IN = GRN, OUT = Issue Note
    const [transactionForm, setTransactionForm] = useState({
        number: '',
        entity: '', // Supplier for GRN, Recipient for Issue Note
        date: new Date().toISOString().split('T')[0],
        remarks: '',
        items: [{ material: '', quantity: 0 }]
    });

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const config = { headers: { Authorization: `Bearer ${user?.token}` } };
            if (activeTab === 'inventory') {
                const { data } = await axios.get(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/inventory/raw-materials`, config);
                setMaterials(data.sort((a, b) => a.name.localeCompare(b.name)));
            } else if (activeTab === 'in') {
                const [matRes, grnRes] = await Promise.all([
                    axios.get(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/inventory/raw-materials`, config),
                    axios.get(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/grn`, config)
                ]);
                setMaterials(matRes.data.sort((a, b) => a.name.localeCompare(b.name)));
                setGrns(grnRes.data.sort((a, b) => new Date(b.receivedDate) - new Date(a.receivedDate) || new Date(b.createdAt) - new Date(a.createdAt)));
            } else if (activeTab === 'out') {
                const [matRes, noteRes] = await Promise.all([
                    axios.get(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/inventory/raw-materials`, config),
                    axios.get(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/issue-notes`, config)
                ]);
                setMaterials(matRes.data.sort((a, b) => a.name.localeCompare(b.name)));
                setNotes(noteRes.data.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate) || new Date(b.createdAt) - new Date(a.createdAt)));
            }
        } catch (error) {
            console.error("Error fetching data", error);
        }
        setLoading(false);
    };

    // Auto-generate SKU for new materials
    useEffect(() => {
        if (!editingMaterial && form.name.length >= 3) {
            const prefix = form.name.slice(0, 3).toUpperCase();
            if (!form.sku || form.sku.startsWith('RM-')) {
                const random = Math.floor(1000 + Math.random() * 9000);
                setForm(prev => ({ ...prev, sku: `RM-${prefix}-${random}` }));
            }
        }
    }, [form.name, editingMaterial]);

    const openModal = (material = null) => {
        if (material) {
            setEditingMaterial(material);
            setForm({
                name: material.name,
                sku: material.sku,
                uom: material.uom,
                currentQuantity: material.currentQuantity,
                minStockQty: material.minStockQty || 0
            });
        } else {
            setEditingMaterial(null);
            setForm({ name: '', sku: '', uom: '', currentQuantity: 0, minStockQty: 0 });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const config = { headers: { Authorization: `Bearer ${user?.token}` } };
            if (editingMaterial) {
                await axios.put(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/inventory/raw-materials/${editingMaterial._id}`, form, config);
            } else {
                await axios.post(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/inventory/raw-materials`, form, config);
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || "Error saving material");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this material?")) return;
        try {
            const config = { headers: { Authorization: `Bearer ${user?.token}` } };
            await axios.delete(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/inventory/raw-materials/${id}`, config);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || "Error deleting material");
        }
    };

    const openTransactionModal = (type) => {
        setTransactionType(type);
        setTransactionForm({
            number: type === 'IN' ? `GRN-${Date.now().toString().slice(-6)}` : `ISN-${Date.now().toString().slice(-6)}`,
            entity: '',
            date: new Date().toISOString().split('T')[0],
            remarks: '',
            items: [{ material: '', quantity: 0 }]
        });
        setIsTransactionModalOpen(true);
    };

    const handleTransactionItemChange = (index, field, value) => {
        const newItems = [...transactionForm.items];
        newItems[index][field] = value;
        setTransactionForm({ ...transactionForm, items: newItems });
    };

    const handleAddTransactionItem = () => {
        setTransactionForm({
            ...transactionForm,
            items: [...transactionForm.items, { material: '', quantity: 0 }]
        });
    };

    const handleRemoveTransactionItem = (index) => {
        const newItems = transactionForm.items.filter((_, i) => i !== index);
        setTransactionForm({ ...transactionForm, items: newItems });
    };

    const generatePDF = (data, type) => {
        const doc = new jsPDF();
        try {
            doc.addImage(qoflLogo, 'PNG', 155, 10, 25, 25);
        } catch (e) { }

        doc.setFontSize(22);
        doc.setTextColor(type === 'IN' ? 79 : 234, type === 'IN' ? 70 : 88, type === 'IN' ? 229 : 12);
        doc.text(type === 'IN' ? "Goods Received Note (GRN)" : "Material Issue Note", 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`${type === 'IN' ? 'GRN' : 'Issue'} Number: ${type === 'IN' ? data.grnNumber : data.issueNumber}`, 14, 45);
        doc.text(`${type === 'IN' ? 'Supplier' : 'Recipient'}: ${type === 'IN' ? data.supplier : data.recipient}`, 14, 52);
        doc.text(`Date: ${new Date(type === 'IN' ? data.receivedDate : data.issueDate).toLocaleDateString()}`, 14, 59);
        if (data.remarks) doc.text(`Remarks: ${data.remarks}`, 14, 66);

        const tableData = data.items.map(item => [
            item.material?.name || 'Unknown',
            item.material?.sku || '-',
            `${item.quantity} ${item.material?.uom || ''}`
        ]);

        autoTable(doc, {
            startY: data.remarks ? 75 : 68,
            head: [['Material Name', 'SKU', 'Quantity']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillStyle: type === 'IN' ? [79, 70, 229] : [234, 88, 12] }
        });

        doc.save(`RM_${type}_${type === 'IN' ? data.grnNumber : data.issueNumber}.pdf`);
    };

    const handleTransactionSave = async (e) => {
        e.preventDefault();
        try {
            const config = { headers: { Authorization: `Bearer ${user?.token}` } };
            const endpoint = transactionType === 'IN' ? `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/grn` : `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/issue-notes`;
            const payload = transactionType === 'IN' ? {
                grnNumber: transactionForm.number,
                supplier: transactionForm.entity,
                receivedDate: transactionForm.date,
                remarks: transactionForm.remarks,
                items: transactionForm.items
            } : {
                issueNumber: transactionForm.number,
                recipient: transactionForm.entity,
                issueDate: transactionForm.date,
                remarks: transactionForm.remarks,
                items: transactionForm.items
            };

            const response = await axios.post(endpoint, payload, config);

            // Re-populate material details for PDF
            const savedData = response.data;
            const reportData = {
                ...savedData,
                items: savedData.items.map(item => ({
                    ...item,
                    material: materials.find(m => m._id === item.material)
                }))
            };
            generatePDF(reportData, transactionType);

            setIsTransactionModalOpen(false);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || "Error saving transaction");
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-500">Loading...</div>;

    const tabClass = (tab) => `px-6 py-3 font-bold transition-all border-b-2 cursor-pointer ${activeTab === tab ? 'text-teal-600 border-teal-600' : 'text-gray-400 border-transparent hover:text-teal-500'}`;

    return (
        <div className="p-6">
            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <img src={qoflLogo} alt="QOFL Logo" className="h-20 sm:h-24 w-auto object-contain" />
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 text-shadow-sm text-center sm:text-left">Raw Materials</h1>
                </div>
                <div className="w-full md:w-auto flex justify-center md:justify-end">
                    {user?.role === 'admin' && activeTab === 'inventory' && (
                        <button onClick={() => openModal()} className="w-full sm:w-auto justify-center bg-gradient-to-r from-teal-600 to-emerald-600 text-white px-6 py-2.5 rounded-xl shadow-lg hover:shadow-emerald-200 transition-all font-semibold flex items-center gap-2">
                            <span>+</span> Add New Material
                        </button>
                    )}
                    {(activeTab === 'in' || activeTab === 'out') && (user?.role === 'admin' || user?.role === 'user') && (
                        <button onClick={() => openTransactionModal(activeTab === 'in' ? 'IN' : 'OUT')} className={`w-full sm:w-auto justify-center bg-gradient-to-r ${activeTab === 'in' ? 'from-purple-600 to-indigo-600' : 'from-orange-600 to-red-600'} text-white px-6 py-2.5 rounded-xl shadow-lg transition-all font-semibold flex items-center gap-2`}>
                            <span>+</span> Record {activeTab === 'in' ? 'Inward (GRN)' : 'Outward (Issue)'}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap gap-2 sm:gap-4 mb-8 border-b border-gray-200">
                <div onClick={() => setActiveTab('inventory')} className={tabClass('inventory')}>Inventory List</div>
                <div onClick={() => setActiveTab('in')} className={tabClass('in')}>Stock IN (Receipts)</div>
                <div onClick={() => setActiveTab('out')} className={tabClass('out')}>Stock OUT (Issuance)</div>
            </div>

            {/* Inventory Tab */}
            {activeTab === 'inventory' && (
                <>
                    <div className="mb-6">
                        <div className="relative inline-block">
                            <input
                                type="text"
                                placeholder="Search by name or SKU..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-teal-500 outline-none w-full sm:w-80 transition-all shadow-sm"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-xl overflow-x-auto border border-gray-100">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider font-bold">
                                    <th className="p-5 border-b border-gray-100">Material Name</th>
                                    <th className="p-5 border-b border-gray-100">SKU</th>
                                    <th className="p-5 border-b border-gray-100 text-center">Stock Level</th>
                                    <th className="p-5 border-b border-gray-100 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {materials.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.sku.toLowerCase().includes(searchTerm.toLowerCase())).map((material) => (
                                    <tr key={material._id} className="hover:bg-teal-50/30 transition-colors">
                                        <td className="p-5 font-bold text-gray-900">{material.name}</td>
                                        <td className="p-5 text-gray-500 font-mono text-sm">{material.sku}</td>
                                        <td className="p-5 text-center">
                                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${material.currentQuantity < (material.minStockQty || 0) ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                                {material.currentQuantity} {material.uom}
                                            </span>
                                        </td>
                                        <td className="p-5 text-right flex justify-end gap-2">
                                            {user?.role === 'admin' && (
                                                <>
                                                    <button onClick={() => openModal(material)} className="text-teal-600 hover:text-teal-900 font-bold text-sm bg-teal-50 px-3 py-1.5 rounded-lg">Edit</button>
                                                    <button onClick={() => handleDelete(material._id)} className="text-red-600 hover:text-red-900 font-bold text-sm bg-red-50 px-3 py-1.5 rounded-lg">Delete</button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* In Transactions Tab */}
            {activeTab === 'in' && (
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider font-bold">
                                <th className="p-5 border-b border-gray-100">GRN Number</th>
                                <th className="p-5 border-b border-gray-100">Supplier</th>
                                <th className="p-5 border-b border-gray-100">Date</th>
                                <th className="p-5 border-b border-gray-100">Items</th>
                                <th className="p-5 border-b border-gray-100">Remarks</th>
                                <th className="p-5 border-b border-gray-100 text-right text-xs">Report</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {grns.map((tr) => (
                                <tr key={tr._id} className="hover:bg-purple-50/30 transition-colors">
                                    <td className="p-5 font-bold text-gray-900">{tr.grnNumber}</td>
                                    <td className="p-5 text-gray-700 font-semibold">{tr.supplier}</td>
                                    <td className="p-5 text-gray-500 text-sm">
                                        <div>{new Date(tr.receivedDate).toLocaleDateString()}</div>
                                        {tr.createdAt && <div className="text-[10px] text-gray-400 mt-0.5">{new Date(tr.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                                    </td>
                                    <td className="p-5">
                                        <div className="flex flex-wrap gap-1">
                                            {tr.items.map((item, idx) => (
                                                <span key={idx} className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                                    {item.material?.name}: {item.quantity}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-5 text-gray-600 text-sm max-w-[150px] truncate" title={tr.remarks}>{tr.remarks || '-'}</td>
                                    <td className="p-5 text-right">
                                        <button onClick={() => generatePDF(tr, 'IN')} className="text-indigo-600 hover:text-indigo-800 font-black text-xs uppercase tracking-widest bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 shadow-sm">PDF</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Out Transactions Tab */}
            {activeTab === 'out' && (
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider font-bold">
                                <th className="p-5 border-b border-gray-100">Issue Number</th>
                                <th className="p-5 border-b border-gray-100">Recipient</th>
                                <th className="p-5 border-b border-gray-100">Date</th>
                                <th className="p-5 border-b border-gray-100">Items</th>
                                <th className="p-5 border-b border-gray-100">Remarks</th>
                                <th className="p-5 border-b border-gray-100 text-right text-xs">Report</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {notes.map((tr) => (
                                <tr key={tr._id} className="hover:bg-orange-50/30 transition-colors">
                                    <td className="p-5 font-bold text-gray-900">{tr.issueNumber}</td>
                                    <td className="p-5 text-gray-700 font-semibold">{tr.recipient}</td>
                                    <td className="p-5 text-gray-500 text-sm">
                                        <div>{new Date(tr.issueDate).toLocaleDateString()}</div>
                                        {tr.createdAt && <div className="text-[10px] text-gray-400 mt-0.5">{new Date(tr.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                                    </td>
                                    <td className="p-5">
                                        <div className="flex flex-wrap gap-1">
                                            {tr.items.map((item, idx) => (
                                                <span key={idx} className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                                    {item.material?.name}: {item.quantity}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-5 text-gray-600 text-sm max-w-[150px] truncate" title={tr.remarks}>{tr.remarks || '-'}</td>
                                    <td className="p-5 text-right">
                                        <button onClick={() => generatePDF(tr, 'OUT')} className="text-orange-600 hover:text-orange-800 font-black text-xs uppercase tracking-widest bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 shadow-sm">PDF</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Material Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8">
                        <h2 className="text-2xl font-bold mb-6 text-gray-800">{editingMaterial ? 'Edit' : 'Add'} Material</h2>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Name</label>
                                <input list="existing-materials" type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 focus:border-teal-500 outline-none" />
                                <datalist id="existing-materials">
                                    {[...new Set(materials.map(m => m.name))].filter(Boolean).map((name, index) => (
                                        <option key={index} value={name} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">SKU</label>
                                    <input type="text" required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 focus:border-teal-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">UOM</label>
                                    <select required value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })} className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 focus:border-teal-500 outline-none bg-white">
                                        <option value="">Select Unit</option>
                                        <option value="kg">kg</option><option value="g">g</option><option value="L">L</option><option value="ml">ml</option><option value="units">units</option><option value="pcs">pcs</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 mb-2">Initial Qty</label>
                                    <input type="number" step="0.01" required value={form.currentQuantity} onChange={(e) => setForm({ ...form, currentQuantity: Number(e.target.value) })} className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 focus:border-teal-500 outline-none" />
                                </div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-2">Min Qty</label>
                                    <input type="number" step="0.01" required value={form.minStockQty} onChange={(e) => setForm({ ...form, minStockQty: Number(e.target.value) })} className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 focus:border-teal-500 outline-none" />
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-gray-500 font-bold w-full sm:w-auto border sm:border-none rounded-xl">Cancel</button>
                                <button type="submit" className="bg-teal-600 text-white px-10 py-3 rounded-xl shadow-lg hover:bg-teal-700 font-bold w-full sm:w-auto">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Transaction Modal */}
            {isTransactionModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8">
                        <h2 className="text-2xl font-bold mb-6 text-gray-800">Record {transactionType === 'IN' ? 'Goods Receipt' : 'Material Issue'}</h2>
                        <form onSubmit={handleTransactionSave} className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Number</label>
                                    <input type="text" required value={transactionForm.number} onChange={(e) => setTransactionForm({ ...transactionForm, number: e.target.value })} className="w-full border-2 border-gray-100 rounded-xl px-4 py-2" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{transactionType === 'IN' ? 'Supplier' : 'Recipient'}</label>
                                    <input type="text" required value={transactionForm.entity} onChange={(e) => setTransactionForm({ ...transactionForm, entity: e.target.value })} className="w-full border-2 border-gray-100 rounded-xl px-4 py-2" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                                    <input type="date" required value={transactionForm.date} onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })} className="w-full border-2 border-gray-100 rounded-xl px-4 py-2" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center"><span className="font-bold text-gray-700">Items</span>
                                    <button type="button" onClick={handleAddTransactionItem} className="text-teal-600 font-bold text-sm">+ Add</button>
                                </div>
                                {transactionForm.items.map((item, idx) => (
                                    <div key={idx} className="flex flex-col sm:flex-row gap-4 sm:items-end bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <div className="flex-1 w-full">
                                            <SearchableSelect options={materials} value={item.material} onChange={(val) => handleTransactionItemChange(idx, 'material', val)} placeholder="Select Material" label="Material" />
                                        </div>
                                        <div className="w-full sm:w-32 flex items-center gap-2">
                                            <input type="number" step="0.01" required value={item.quantity} onChange={(e) => handleTransactionItemChange(idx, 'quantity', Number(e.target.value))} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg" placeholder="Qty" />
                                            {transactionForm.items.length > 1 && (
                                                <button type="button" onClick={() => handleRemoveTransactionItem(idx)} className="text-red-500 p-2 text-xl hover:bg-red-50 rounded-lg transition-colors shrink-0">🗑️</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <textarea placeholder="Remarks..." value={transactionForm.remarks} onChange={(e) => setTransactionForm({ ...transactionForm, remarks: e.target.value })} className="w-full border-2 border-gray-100 rounded-xl px-4 py-2 min-h-[80px]" />

                            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setIsTransactionModalOpen(false)} className="px-6 py-2 text-gray-500 font-bold w-full sm:w-auto border sm:border-none rounded-xl">Cancel</button>
                                <button type="submit" className={`px-10 py-2 text-white font-bold rounded-xl shadow-lg w-full sm:w-auto ${transactionType === 'IN' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-orange-600 hover:bg-orange-700'}`}>Save Record</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RawMaterialManager;
