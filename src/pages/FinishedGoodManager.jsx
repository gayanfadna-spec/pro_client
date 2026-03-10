import React, { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import qoflLogo from '../assets/qofl_logo.png';

const FinishedGoodManager = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('inventory');
    const [products, setProducts] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [packingMaterials, setPackingMaterials] = useState([]);
    const [productions, setProductions] = useState([]);
    const [dispatches, setDispatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [recipeLoading, setRecipeLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Form state for creating/editing products and recipes
    const [editingProduct, setEditingProduct] = useState(null);
    const [productForm, setProductForm] = useState({
        name: '',
        sku: '',
        category: '',
        unitPrice: 0,
        currentQuantity: 0,
        minStockQty: 0
    });
    const [recipeData, setRecipeData] = useState({
        batchSize: 1,
        notes: '',
        ingredients: [],
        packaging: []
    });

    // Hover Preview State
    const [hoveredRecipe, setHoveredRecipe] = useState(null);
    const [recipeCache, setRecipeCache] = useState({});
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0, isAbove: false, bottom: 0 });

    // Transaction Modal State
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [transactionType, setTransactionType] = useState('IN'); // IN = Production, OUT = Dispatch
    const [transactionForm, setTransactionForm] = useState({
        number: '',
        entity: '', // Not really used for Production, Customer for Dispatch
        date: new Date().toISOString().split('T')[0],
        remarks: '',
        items: [{ product: '', batchNumber: '', quantity: 0 }]
    });

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const config = { headers: { Authorization: `Bearer ${user?.token}` } };
            if (activeTab === 'inventory') {
                const [prodRes, matRes, packRes] = await Promise.all([
                    axios.get(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/inventory/finished-goods`, config),
                    axios.get(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/inventory/raw-materials`, config),
                    axios.get(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/inventory/packing-materials`, config)
                ]);
                setProducts(prodRes.data);
                setMaterials(matRes.data);
                setPackingMaterials(packRes.data);
            } else if (activeTab === 'in') {
                const [fgRes, prodRes] = await Promise.all([
                    axios.get(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/inventory/finished-goods`, config),
                    axios.get(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/fg-transactions/production`, config)
                ]);
                setProducts(fgRes.data);
                setProductions(prodRes.data.sort((a, b) => new Date(b.productionDate) - new Date(a.productionDate) || new Date(b.createdAt) - new Date(a.createdAt)));
            } else if (activeTab === 'out') {
                const [fgRes, dispRes] = await Promise.all([
                    axios.get(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/inventory/finished-goods`, config),
                    axios.get(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/fg-transactions/dispatch`, config)
                ]);
                setProducts(fgRes.data);
                setDispatches(dispRes.data.sort((a, b) => new Date(b.dispatchDate) - new Date(a.dispatchDate) || new Date(b.createdAt) - new Date(a.createdAt)));
            }
        } catch (error) {
            console.error("Error fetching data", error);
        }
        setLoading(false);
    };

    const openModal = async (product = null) => {
        setIsProductModalOpen(true);
        if (product) {
            setEditingProduct(product);
            setProductForm({
                name: product.name,
                sku: product.sku,
                category: product.category || '',
                unitPrice: product.unitPrice || product.price || 0,
                currentQuantity: product.currentQuantity || 0,
                minStockQty: product.minStockQty || 0
            });

            setRecipeLoading(true);
            setRecipeData({ batchSize: 1, notes: '', ingredients: [], packaging: [] }); // Reset while loading

            try {
                const config = { headers: { Authorization: `Bearer ${user?.token}` } };
                const { data } = await axios.get(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/planning/recipes/${product._id}`, config);
                console.log("Fetched Recipe:", data);
                setRecipeData({
                    batchSize: data.batchSize || 1,
                    notes: data.notes || '',
                    ingredients: (data.ingredients || []).map(ing => ({
                        rawMaterialId: ing.rawMaterialId?._id || ing.rawMaterialId || '',
                        quantity: ing.quantity || 0
                    })),
                    packaging: (data.packaging || []).map(pack => ({
                        packingMaterialId: pack.packingMaterialId?._id || pack.packingMaterialId || '',
                        quantity: pack.quantity || 0
                    }))
                });
            } catch (error) {
                console.error("Fetch Error:", error);
                setRecipeData({ batchSize: 1, notes: '', ingredients: [], packaging: [] });
            } finally {
                setRecipeLoading(false);
            }
        } else {
            setEditingProduct(null);
            setProductForm({ name: '', sku: '', category: '', unitPrice: 0, currentQuantity: 0, minStockQty: 0 });
            setRecipeData({ batchSize: 1, notes: '', ingredients: [], packaging: [] });
            setRecipeLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const config = { headers: { Authorization: `Bearer ${user?.token}` } };

            let productId = editingProduct?._id;

            if (editingProduct) {
                await axios.put(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/inventory/finished-goods/${productId}`, productForm, config);
            } else {
                const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/inventory/finished-goods`, productForm, config);
                productId = res.data._id;
            }

            // Save recipe
            await axios.post(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/planning/recipes`, {
                finishedGoodId: productId,
                ...recipeData
            }, config);

            // Clear the specific product from cache so the tooltip fetches fresh data
            setRecipeCache(prev => {
                const newCache = { ...prev };
                delete newCache[productId];
                return newCache;
            });

            setIsProductModalOpen(false);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || "Error saving product");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this product? This will also delete its recipe.")) return;
        try {
            const config = { headers: { Authorization: `Bearer ${user?.token}` } };
            await axios.delete(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/inventory/finished-goods/${id}`, config);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || "Error deleting product");
        }
    };

    const toggleRecipePreview = async (e, productId) => {
        // If clicking the SAME product that is already open, close it
        if (hoveredRecipe && hoveredRecipe._id === productId) {
            setHoveredRecipe(null);
            return;
        }

        const rect = e.currentTarget.getBoundingClientRect();

        let x = rect.left;
        let y = rect.bottom + 10;
        let isAbove = false;
        let bottom = 0;

        if (x + 340 > window.innerWidth) {
            x = Math.max(10, window.innerWidth - 340);
        }

        if (y + 350 > window.innerHeight && rect.top > 300) {
            isAbove = true;
            bottom = window.innerHeight - rect.top + 10;
        }

        setHoverPosition({ x, y, isAbove, bottom });

        if (recipeCache[productId]) {
            setHoveredRecipe(recipeCache[productId]);
            return;
        }

        try {
            const config = { headers: { Authorization: `Bearer ${user?.token}` } };
            const { data } = await axios.get(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/planning/recipes/${productId}`, config);
            setRecipeCache(prev => ({ ...prev, [productId]: data }));
            setHoveredRecipe(data);
        } catch (error) {
            setHoveredRecipe({ _id: productId, error: "No recipe configured" });
        }
    };

    const handleIngredientChange = (index, field, value) => {
        const newIngredients = [...recipeData.ingredients];
        newIngredients[index][field] = value;
        setRecipeData({ ...recipeData, ingredients: newIngredients });
    };

    const addIngredient = () => {
        setRecipeData({
            ...recipeData,
            ingredients: [...recipeData.ingredients, { rawMaterialId: '', quantity: 0 }]
        });
    };

    const removeIngredient = (index) => {
        const newIngredients = recipeData.ingredients.filter((_, i) => i !== index);
        setRecipeData({ ...recipeData, ingredients: newIngredients });
    };

    const handlePackagingChange = (index, field, value) => {
        const newPackaging = [...recipeData.packaging];
        newPackaging[index][field] = value;
        setRecipeData({ ...recipeData, packaging: newPackaging });
    };

    const addPackaging = () => {
        setRecipeData({
            ...recipeData,
            packaging: [...recipeData.packaging, { packingMaterialId: '', quantity: 0 }]
        });
    };

    const removePackaging = (index) => {
        const newPackaging = recipeData.packaging.filter((_, i) => i !== index);
        setRecipeData({ ...recipeData, packaging: newPackaging });
    };

    const openTransactionModal = (type) => {
        setTransactionType(type);
        setTransactionForm({
            number: type === 'IN' ? `PR-${Date.now().toString().slice(-6)}` : `DS-${Date.now().toString().slice(-6)}`,
            entity: '',
            date: new Date().toISOString().split('T')[0],
            remarks: '',
            items: [{ product: '', batchNumber: '', quantity: 0 }]
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
            items: [...transactionForm.items, { product: '', batchNumber: '', quantity: 0 }]
        });
    };

    const handleRemoveTransactionItem = (index) => {
        const newItems = transactionForm.items.filter((_, i) => i !== index);
        setTransactionForm({ ...transactionForm, items: newItems });
    };

    const generatePDF = (rec, type) => {
        const doc = new jsPDF();
        try {
            doc.addImage(qoflLogo, 'PNG', 155, 10, 25, 25);
        } catch (e) { }

        doc.setFontSize(22);
        if (type === 'IN') {
            doc.setTextColor(5, 150, 105);
        } else {
            doc.setTextColor(37, 99, 235);
        }
        doc.text(type === 'IN' ? "Production Entry" : "Dispatch Note", 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`${type === 'IN' ? 'Production' : 'Dispatch'} ID: ${type === 'IN' ? rec.productionId : rec.dispatchId}`, 14, 45);
        if (type === 'OUT') doc.text(`Customer: ${rec.customer}`, 14, 52);
        doc.text(`Date: ${new Date(type === 'IN' ? rec.productionDate : rec.dispatchDate).toLocaleDateString()}`, 14, type === 'OUT' ? 59 : 52);
        if (rec.remarks) doc.text(`Remarks: ${rec.remarks}`, 14, type === 'OUT' ? 66 : 59);

        const tableBody = rec.items.map(item => [
            item.product?.name || 'Unknown',
            item.product?.sku || '-',
            type === 'IN' ? (item.batchNumber || 'N/A') : item.quantityDispatched || item.quantity,
            type === 'IN' ? (item.quantityProduced || item.quantity) : ''
        ].filter(v => v !== ''));

        autoTable(doc, {
            startY: rec.remarks ? (type === 'OUT' ? 75 : 68) : (type === 'OUT' ? 68 : 61),
            head: [type === 'IN' ? ['Product', 'SKU', 'Batch Number', 'Quantity'] : ['Product', 'SKU', 'Quantity']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: type === 'IN' ? [5, 150, 105] : [37, 99, 235] }
        });

        doc.save(`${type === 'IN' ? 'Production' : 'Dispatch'}_${type === 'IN' ? rec.productionId : rec.dispatchId}.pdf`);
    };

    const handleTransactionSave = async (e) => {
        e.preventDefault();

        // Validation for items
        if (transactionForm.items.some(it => !it.product || it.quantity <= 0)) {
            alert("Please select a product and enter a valid quantity for all items.");
            return;
        }

        try {
            const config = { headers: { Authorization: `Bearer ${user?.token}` } };
            const endpoint = transactionType === 'IN' ? `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/fg-transactions/production` : `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/fg-transactions/dispatch`;

            const payload = transactionType === 'IN' ? {
                productionId: transactionForm.number,
                productionDate: transactionForm.date,
                remarks: transactionForm.remarks,
                items: transactionForm.items.map(it => ({ product: it.product, batchNumber: it.batchNumber, quantityProduced: it.quantity }))
            } : {
                dispatchId: transactionForm.number,
                customer: transactionForm.entity,
                dispatchDate: transactionForm.date,
                remarks: transactionForm.remarks,
                items: transactionForm.items.map(it => ({ product: it.product, quantityDispatched: it.quantity }))
            };

            const response = await axios.post(endpoint, payload, config);

            const savedData = response.data;
            const reportData = {
                ...savedData,
                items: savedData.items.map(item => ({
                    ...item,
                    product: products.find(p => p._id === item.product)
                }))
            };
            generatePDF(reportData, transactionType);

            setIsTransactionModalOpen(false);
            fetchData();
        } catch (error) {
            console.error("Save Transaction Error:", error);
            alert(error.response?.data?.message || error.message || "Error saving transaction");
        }
    };

    if (loading) return <div className="p-10 text-center">Loading Manager...</div>;

    const tabClass = (tab) => `px-6 py-3 font-bold transition-all border-b-2 cursor-pointer ${activeTab === tab ? 'text-indigo-600 border-indigo-600' : 'text-gray-400 border-transparent hover:text-indigo-500'}`;


    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <img src={qoflLogo} alt="QOFL Logo" className="h-20 sm:h-24 w-auto object-contain" />
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 text-shadow-sm text-center sm:text-left">Finished Goods Manager</h1>
                </div>
                <div className="w-full md:w-auto flex justify-center md:justify-end">
                    {user?.role === 'admin' && activeTab === 'inventory' && (
                        <button onClick={() => openModal()} className="w-full sm:w-auto justify-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2.5 rounded-xl shadow-lg hover:shadow-indigo-200 transition-all font-semibold flex items-center gap-2">
                            <span>+</span> Create Product
                        </button>
                    )}
                    {(activeTab === 'in' || activeTab === 'out') && (
                        <button onClick={() => openTransactionModal(activeTab === 'in' ? 'IN' : 'OUT')} className={`w-full sm:w-auto justify-center bg-gradient-to-r ${activeTab === 'in' ? 'from-green-600 to-emerald-600' : 'from-blue-600 to-indigo-600'} text-white px-6 py-2.5 rounded-xl shadow-lg transition-all font-semibold flex items-center gap-2`}>
                            <span>+</span> {activeTab === 'in' ? 'Record Production' : 'Create Dispatch'}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap gap-2 sm:gap-4 mb-8 border-b border-gray-200">
                <div onClick={() => setActiveTab('inventory')} className={tabClass('inventory')}>Inventory & Recipes</div>
                <div onClick={() => setActiveTab('in')} className={tabClass('in')}>Stock IN (Production)</div>
                <div onClick={() => setActiveTab('out')} className={tabClass('out')}>Stock OUT (Dispatch)</div>
            </div>

            {activeTab === 'inventory' && (
                <>
                    <div className="mb-6">
                        <div className="relative inline-block">
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none w-full sm:w-80 transition-all shadow-sm"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-xl overflow-x-auto border border-gray-100">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider font-bold">
                                    <th className="p-5 border-b border-gray-100">Product Name</th>
                                    <th className="p-5 border-b border-gray-100">SKU</th>
                                    <th className="p-5 border-b border-gray-100">Category</th>
                                    <th className="p-5 border-b border-gray-100">Price</th>
                                    <th className="p-5 border-b border-gray-100">Quantity</th>
                                    <th className="p-5 border-b border-gray-100 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {products
                                    .filter(product =>
                                        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        (product.category && product.category.toLowerCase().includes(searchTerm.toLowerCase()))
                                    )
                                    .map((product) => (
                                        <tr key={product._id} className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="p-5 relative">
                                                <div
                                                    className="font-bold text-gray-900 cursor-pointer border-b border-dashed border-gray-400 hover:text-indigo-600 hover:border-indigo-600 transition-all inline-block"
                                                    onClick={(e) => toggleRecipePreview(e, product._id)}
                                                >
                                                    {product.name}
                                                </div>
                                            </td>
                                            <td className="p-5 text-gray-500 font-mono text-sm">{product.sku}</td>
                                            <td className="p-5">
                                                <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tight">
                                                    {product.category || 'Uncategorized'}
                                                </span>
                                            </td>
                                            <td className="p-5 font-bold text-gray-700">Rs. {product.unitPrice || product.price}</td>
                                            <td className="p-5">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${product.currentQuantity < (product.minStockQty || 0) ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                                    {product.currentQuantity || 0}
                                                </span>
                                                {product.minStockQty > 0 && (
                                                    <div className="text-[10px] text-gray-400 mt-1">Min: {product.minStockQty}</div>
                                                )}
                                            </td>
                                            <td className="p-5 text-right flex justify-end gap-2">
                                                {user?.role === 'admin' && (
                                                    <>
                                                        <button
                                                            onClick={() => openModal(product)}
                                                            className="text-indigo-600 hover:text-indigo-900 font-bold text-sm bg-indigo-50 px-4 py-2 rounded-lg transition-colors"
                                                        >
                                                            Edit Details & Recipe
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(product._id)}
                                                            className="text-red-600 hover:text-red-900 font-bold text-sm bg-red-50 px-4 py-2 rounded-lg transition-colors"
                                                        >
                                                            Delete
                                                        </button>
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

            {activeTab === 'in' && (
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider font-bold">
                                <th className="p-5 border-b border-gray-100">ID</th>
                                <th className="p-5 border-b border-gray-100">Products</th>
                                <th className="p-5 border-b border-gray-100">Date</th>
                                <th className="p-5 border-b border-gray-100">Remarks</th>
                                <th className="p-5 border-b border-gray-100 text-right">PDF</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {productions.map((rec) => (
                                <tr key={rec._id} className="hover:bg-green-50/30 transition-colors">
                                    <td className="p-5 font-bold text-gray-900">{rec.productionId}</td>
                                    <td className="p-5">
                                        <div className="space-y-1">
                                            {rec.items.map((item, idx) => (
                                                <div key={idx} className="text-xs">
                                                    <span className="font-bold">{item.product?.name}</span>
                                                    <span className="ml-2 text-gray-400">Batch: {item.batchNumber}</span>
                                                    <span className="ml-2 bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-bold">+{item.quantityProduced}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-5 text-gray-500 text-sm">
                                        <div>{new Date(rec.productionDate).toLocaleDateString()}</div>
                                        {rec.createdAt && <div className="text-[10px] text-gray-400 mt-0.5">{new Date(rec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                                    </td>
                                    <td className="p-5 text-gray-600 text-sm">{rec.remarks || '-'}</td>
                                    <td className="p-5 text-right"><button onClick={() => generatePDF(rec, 'IN')} className="text-emerald-600 hover:text-emerald-800 font-bold bg-emerald-50 px-3 py-1 rounded-lg">PDF</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'out' && (
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider font-bold">
                                <th className="p-5 border-b border-gray-100">ID</th>
                                <th className="p-5 border-b border-gray-100">Products</th>
                                <th className="p-5 border-b border-gray-100">Customer</th>
                                <th className="p-5 border-b border-gray-100">Date</th>
                                <th className="p-5 border-b border-gray-100">Remarks</th>
                                <th className="p-5 border-b border-gray-100 text-right">PDF</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {dispatches.map((rec) => (
                                <tr key={rec._id} className="hover:bg-blue-50/30 transition-colors">
                                    <td className="p-5 font-bold text-gray-900">{rec.dispatchId}</td>
                                    <td className="p-5">
                                        <div className="space-y-1">
                                            {rec.items.map((item, idx) => (
                                                <div key={idx} className="text-xs">
                                                    <span className="font-bold">{item.product?.name}</span>
                                                    <span className="ml-2 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold">-{item.quantityDispatched}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-5 text-gray-700 text-sm">{rec.customer}</td>
                                    <td className="p-5 text-gray-500 text-sm">
                                        <div>{new Date(rec.dispatchDate).toLocaleDateString()}</div>
                                        {rec.createdAt && <div className="text-[10px] text-gray-400 mt-0.5">{new Date(rec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                                    </td>
                                    <td className="p-5 text-gray-600 text-sm">{rec.remarks || '-'}</td>
                                    <td className="p-5 text-right"><button onClick={() => generatePDF(rec, 'OUT')} className="text-blue-600 hover:text-blue-800 font-bold bg-blue-50 px-3 py-1 rounded-lg">PDF</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Transaction Modal */}
            {isTransactionModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-8">
                        <h2 className="text-2xl font-bold mb-6 text-gray-800">Record {transactionType === 'IN' ? 'Production' : 'Dispatch'}</h2>
                        <form onSubmit={handleTransactionSave} className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">ID</label>
                                    <input type="text" required value={transactionForm.number} onChange={(e) => setTransactionForm({ ...transactionForm, number: e.target.value })} className="w-full border-2 border-gray-100 rounded-xl px-4 py-2" />
                                </div>
                                {transactionType === 'OUT' && (
                                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Customer</label>
                                        <input type="text" required value={transactionForm.entity} onChange={(e) => setTransactionForm({ ...transactionForm, entity: e.target.value })} className="w-full border-2 border-gray-100 rounded-xl px-4 py-2" />
                                    </div>
                                )}
                                <div className={transactionType === 'IN' ? 'sm:col-span-2' : ''}><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                                    <input type="date" required value={transactionForm.date} onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })} className="w-full border-2 border-gray-100 rounded-xl px-4 py-2" />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center"><span className="font-bold text-gray-700">Products</span>
                                    <button type="button" onClick={handleAddTransactionItem} className="text-indigo-600 font-bold text-sm">+ Add</button>
                                </div>
                                {transactionForm.items.map((item, idx) => (
                                    <div key={idx} className="flex flex-col sm:flex-row gap-4 sm:items-end bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <div className="flex-[2] w-full">
                                            <SearchableSelect options={products} value={item.product} onChange={(val) => handleTransactionItemChange(idx, 'product', val)} placeholder="Select Product" label="Product" />
                                        </div>
                                        {transactionType === 'IN' && (
                                            <div className="flex-1 w-full">
                                                <input type="text" placeholder="Batch" value={item.batchNumber} onChange={(e) => handleTransactionItemChange(idx, 'batchNumber', e.target.value)} className="w-full px-3 py-2 border-2 border-gray-100 rounded-lg text-sm" />
                                            </div>
                                        )}
                                        <div className="w-full sm:w-24 flex items-center gap-2">
                                            <input type="number" required value={item.quantity} onChange={(e) => handleTransactionItemChange(idx, 'quantity', Number(e.target.value))} className="w-full px-3 py-2 border-2 border-gray-100 rounded-lg text-sm" placeholder="Qty" />
                                            {transactionForm.items.length > 1 && (
                                                <button type="button" onClick={() => handleRemoveTransactionItem(idx)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg">🗑️</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <textarea placeholder="Remarks..." value={transactionForm.remarks} onChange={(e) => setTransactionForm({ ...transactionForm, remarks: e.target.value })} className="w-full border-2 border-gray-100 rounded-xl px-4 py-2" />
                            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4"><button type="button" onClick={() => setIsTransactionModalOpen(false)} className="px-6 py-2 text-gray-500 font-bold w-full sm:w-auto border sm:border-none rounded-xl">Cancel</button>
                                <button type="submit" className={`px-10 py-2 text-white font-bold rounded-xl shadow-lg w-full sm:w-auto ${transactionType === 'IN' ? 'bg-green-600' : 'bg-indigo-600'}`}>Save Record</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal */}
            {isProductModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[85vh] overflow-y-auto">
                        <div className="p-8">
                            <h2 className="text-2xl font-bold mb-6 text-gray-800">
                                {editingProduct ? 'Edit Product & Recipe' : 'New Product & Recipe'}
                            </h2>
                            <form onSubmit={handleSave}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Product Name</label>
                                        <input
                                            type="text" required value={productForm.name}
                                            onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                                            className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 focus:border-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">SKU</label>
                                        <input
                                            type="text" required value={productForm.sku}
                                            onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                                            className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 focus:border-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Category</label>
                                        <input
                                            type="text" required value={productForm.category}
                                            onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                                            className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 focus:border-blue-500 outline-none transition-all"
                                            placeholder="e.g. Skin Care"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Price (Rs.)</label>
                                        <input
                                            type="number" required value={productForm.unitPrice}
                                            onChange={(e) => setProductForm({ ...productForm, unitPrice: e.target.value })}
                                            className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 focus:border-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Stock Quantity</label>
                                        <input
                                            type="number" required value={productForm.currentQuantity}
                                            onChange={(e) => setProductForm({ ...productForm, currentQuantity: e.target.value })}
                                            className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 focus:border-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Min Stock Quantity</label>
                                        <input
                                            type="number" required value={productForm.minStockQty}
                                            onChange={(e) => setProductForm({ ...productForm, minStockQty: e.target.value })}
                                            className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 focus:border-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="border-t pt-6 mb-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="font-bold text-gray-800">Recipe Details & Materials (BOM)</h3>
                                        <div className="flex gap-2">
                                            <button
                                                type="button" onClick={addIngredient}
                                                className="bg-blue-50 text-blue-600 text-xs px-3 py-1.5 rounded-lg hover:bg-blue-100 font-bold border border-blue-100 transition-colors"
                                            >
                                                + Raw Material
                                            </button>
                                            <button
                                                type="button" onClick={addPackaging}
                                                className="bg-indigo-50 text-indigo-600 text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-100 font-bold border border-indigo-100 transition-colors"
                                            >
                                                + Packaging
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Batch Size (Produced Qty)</label>
                                            <input
                                                type="number" required value={recipeData.batchSize}
                                                onChange={(e) => setRecipeData({ ...recipeData, batchSize: Number(e.target.value) })}
                                                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 transition-all font-semibold text-gray-700"
                                                disabled={recipeLoading}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Recipe Notes</label>
                                            <input
                                                type="text" value={recipeData.notes}
                                                onChange={(e) => setRecipeData({ ...recipeData, notes: e.target.value })}
                                                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 transition-all text-gray-600"
                                                placeholder="Process notes..."
                                                disabled={recipeLoading}
                                            />
                                        </div>
                                    </div>

                                    {recipeLoading ? (
                                        <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                                            <p className="text-sm text-gray-500 italic">Fetching formulation...</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-8">
                                            {/* Raw Materials Section */}
                                            <div>
                                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                    <span className="w-8 h-[1px] bg-gray-200"></span>
                                                    Raw Materials
                                                    <span className="flex-1 h-[1px] bg-gray-200"></span>
                                                </h4>
                                                <div className="space-y-3">
                                                    {recipeData.ingredients.map((ing, idx) => (
                                                        <div key={idx} className="flex flex-col sm:flex-row gap-3 sm:items-end bg-white p-3 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                                            <div className="flex-1 w-full">
                                                                <select
                                                                    required value={ing.rawMaterialId}
                                                                    onChange={(e) => handleIngredientChange(idx, 'rawMaterialId', e.target.value)}
                                                                    className="w-full bg-gray-50 border-2 border-transparent rounded-xl px-3 py-2 text-sm outline-none focus:bg-white focus:border-blue-500 transition-all font-medium"
                                                                >
                                                                    <option value="">Select Material</option>
                                                                    {materials.map(m => (
                                                                        <option key={m._id} value={m._id}>{m.name} ({m.sku})</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="w-full sm:w-28 flex gap-2">
                                                                <input
                                                                    type="number" step="0.001" required value={ing.quantity}
                                                                    onChange={(e) => handleIngredientChange(idx, 'quantity', e.target.value)}
                                                                    className="w-full bg-gray-50 border-2 border-transparent rounded-xl px-3 py-2 text-sm outline-none focus:bg-white focus:border-blue-500 transition-all text-center font-bold text-blue-600"
                                                                    placeholder="0.00"
                                                                />
                                                                <button
                                                                    type="button" onClick={() => removeIngredient(idx)}
                                                                    className="bg-red-50 text-red-500 p-2.5 rounded-xl hover:bg-red-500 hover:text-white transition-all shrink-0"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {recipeData.ingredients.length === 0 && (
                                                        <div className="text-center py-6 text-xs text-gray-400 italic bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                                                            No raw materials added to this recipe.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Packaging Section */}
                                            <div>
                                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                    <span className="w-8 h-[1px] bg-indigo-100"></span>
                                                    Packaging Materials
                                                    <span className="flex-1 h-[1px] bg-indigo-100"></span>
                                                </h4>
                                                <div className="space-y-3">
                                                    {recipeData.packaging.map((pack, idx) => (
                                                        <div key={idx} className="flex flex-col sm:flex-row gap-3 sm:items-end bg-white p-3 rounded-2xl border border-indigo-50 shadow-sm hover:shadow-md transition-shadow">
                                                            <div className="flex-1 w-full">
                                                                <select
                                                                    required value={pack.packingMaterialId}
                                                                    onChange={(e) => handlePackagingChange(idx, 'packingMaterialId', e.target.value)}
                                                                    className="w-full bg-indigo-50/50 border-2 border-transparent rounded-xl px-3 py-2 text-sm outline-none focus:bg-white focus:border-indigo-500 transition-all font-medium"
                                                                >
                                                                    <option value="">Select Packing</option>
                                                                    {packingMaterials.map(m => (
                                                                        <option key={m._id} value={m._id}>{m.name} ({m.sku})</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="w-full sm:w-28 flex gap-2">
                                                                <input
                                                                    type="number" step="0.001" required value={pack.quantity}
                                                                    onChange={(e) => handlePackagingChange(idx, 'quantity', e.target.value)}
                                                                    className="w-full bg-indigo-50/50 border-2 border-transparent rounded-xl px-3 py-2 text-sm outline-none focus:bg-white focus:border-indigo-500 transition-all text-center font-bold text-indigo-600"
                                                                    placeholder="0.00"
                                                                />
                                                                <button
                                                                    type="button" onClick={() => removePackaging(idx)}
                                                                    className="bg-red-50 text-red-500 p-2.5 rounded-xl hover:bg-red-500 hover:text-white transition-all shrink-0"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {recipeData.packaging.length === 0 && (
                                                        <div className="text-center py-6 text-xs text-gray-400 italic bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">
                                                            No packaging materials added to this recipe.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8">
                                    <button
                                        type="button" onClick={() => setIsProductModalOpen(false)}
                                        className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all w-full sm:w-auto border sm:border-none"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="bg-blue-600 text-white px-10 py-3 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all font-bold w-full sm:w-auto"
                                    >
                                        {editingProduct ? 'Update Product' : 'Create Product'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            {/* Clickable Backdrop for Recipe Preview (closes when clicking outside) */}
            {hoveredRecipe && (
                <div
                    className="fixed inset-0 z-[55]"
                    onClick={() => setHoveredRecipe(null)}
                ></div>
            )}

            {/* Recipe Preview Tooltip */}
            {hoveredRecipe && (
                <div
                    className="fixed z-[60] bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl p-5 w-80 pointer-events-auto mb-4 animate-in fade-in zoom-in duration-200"
                    style={{ left: `${hoverPosition.x}px`, ...(hoverPosition.isAbove ? { bottom: `${hoverPosition.bottom}px` } : { top: `${hoverPosition.y}px` }) }}
                >
                    <button
                        onClick={() => setHoveredRecipe(null)}
                        className="absolute -top-2 -right-2 bg-slate-800 text-slate-400 hover:text-white w-6 h-6 rounded-full flex items-center justify-center text-xs border border-slate-700 shadow-xl"
                    >
                        ✕
                    </button>
                    <div className={`absolute left-6 transform rotate-45 w-4 h-4 bg-slate-900 border-slate-800 ${hoverPosition.isAbove ? 'bottom-0 translate-y-1/2 border-r border-b' : 'top-0 -translate-y-1/2 border-l border-t'}`}></div>

                    {hoveredRecipe.error ? (
                        <div className="text-slate-400 italic text-sm text-center py-2 flex items-center justify-center gap-2">
                            <span>⚠️</span> {hoveredRecipe.error}
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
                                <div>
                                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">Recipe BOM</h4>
                                    <div className="text-white text-xs font-bold opacity-60">Standard Formulation</div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-1 rounded-md font-bold">
                                        BATCH: {hoveredRecipe.batchSize}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-3 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                                {/* Raw Materials Section */}
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-800/50 pb-1">Raw Materials</div>
                                {hoveredRecipe.ingredients.map((ing, i) => (
                                    <div key={`ing-${i}`} className="flex justify-between items-start group mb-3">
                                        <div className="flex flex-col">
                                            <span className="text-slate-200 text-sm font-medium leading-tight">
                                                {ing.rawMaterialId?.name || 'Unknown Material'}
                                            </span>
                                            <div className="flex gap-2 items-center mt-0.5">
                                                <span className="text-[10px] text-slate-500 font-mono uppercase">
                                                    {ing.rawMaterialId?.sku || 'NO-SKU'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right ml-4">
                                            <div className="text-sm font-black text-white">
                                                {ing.quantity}
                                            </div>
                                            <div className="text-[9px] text-indigo-400 font-bold uppercase tracking-tighter">
                                                {ing.rawMaterialId?.uom || 'units'}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Packaging Section */}
                                {hoveredRecipe.packaging && hoveredRecipe.packaging.length > 0 && (
                                    <>
                                        <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mt-6 mb-2 border-b border-indigo-900/50 pb-1">Packaging</div>
                                        {hoveredRecipe.packaging.map((pack, i) => (
                                            <div key={`pack-${i}`} className="flex justify-between items-start group mb-3">
                                                <div className="flex flex-col">
                                                    <span className="text-slate-200 text-sm font-medium leading-tight">
                                                        {pack.packingMaterialId?.name || 'Unknown Packing'}
                                                    </span>
                                                    <div className="flex gap-2 items-center mt-0.5">
                                                        <span className="text-[10px] text-slate-500 font-mono uppercase">
                                                            {pack.packingMaterialId?.sku || 'NO-SKU'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right ml-4">
                                                    <div className="text-sm font-black text-white">
                                                        {pack.quantity}
                                                    </div>
                                                    <div className="text-[9px] text-indigo-300 font-bold uppercase tracking-tighter">
                                                        {pack.packingMaterialId?.uom || 'units'}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>

                            {hoveredRecipe.notes && (
                                <div className="mt-4 pt-3 border-t border-slate-800">
                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Process Notes</div>
                                    <div className="text-[11px] text-slate-300 italic leading-relaxed bg-slate-800/50 p-2 rounded-lg">
                                        {hoveredRecipe.notes}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default FinishedGoodManager;
