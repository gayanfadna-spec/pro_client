import React, { useState } from 'react';
import axios from 'axios';

const FinishedGoodImport = ({ onImportSuccess }) => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setMessage('');
        setError('');
    };

    const handleDownloadTemplate = () => {
        const headers = 'code,name,category,price,finalQty,minStock\nFG-SAMPLE-001,Sample Product,Tea,1500,100,20';
        const blob = new Blob([headers], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Finished_Good_Import_Template.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a file first.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        setMessage('');
        setError('');

        try {
            const userInfo = localStorage.getItem('userInfo');
            const token = userInfo ? JSON.parse(userInfo).token : null;

            const config = {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`,
                },
            };

            const { data } = await axios.post(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/inventory/finished-goods/import`, formData, config);
            
            setMessage(`${data.message}: Updated ${data.updatedCount}, Created ${data.createdCount}${data.skippedCount ? `, Skipped ${data.skippedCount}` : ''}`);
            setFile(null);
            const fileInput = document.getElementById('finishedGoodFileInput');
            if (fileInput) fileInput.value = '';
            
            if (onImportSuccess) onImportSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Error uploading file.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 mb-8 transition-all hover:shadow-2xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-800">Bulk Import Finished Goods</h3>
                    <p className="text-sm text-gray-500 mt-1">Upload an Excel or CSV file to update finished goods inventory.</p>
                </div>
                <button
                    onClick={handleDownloadTemplate}
                    className="text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center gap-1.5 bg-blue-50 px-4 py-2 rounded-xl transition-colors"
                >
                    <span>📥</span> Download Template
                </button>
            </div>

            <div className="flex flex-col md:flex-row items-stretch gap-4">
                <div className="relative flex-grow">
                    <input
                        type="file"
                        id="finishedGoodFileInput"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <label
                        htmlFor="finishedGoodFileInput"
                        className="flex items-center justify-center w-full px-6 py-4 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all group"
                    >
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-2xl group-hover:scale-110 transition-transform">✨</span>
                            <span className="text-sm font-semibold text-gray-600">
                                {file ? file.name : 'Select Excel/CSV File'}
                            </span>
                        </div>
                    </label>
                </div>
                <button
                    onClick={handleUpload}
                    disabled={uploading || !file}
                    className={`px-8 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
                        uploading || !file
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-200 active:transform active:scale-95'
                    }`}
                >
                    {uploading ? (
                        <>
                            <span className="animate-spin">🌀</span>
                            Importing...
                        </>
                    ) : (
                        <>
                            <span>🚀</span>
                            Upload & Process
                        </>
                    )}
                </button>
            </div>
            
            {message && (
                <div className="mt-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl text-sm font-semibold animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">✅</span>
                        {message}
                    </div>
                </div>
            )}
            
            {error && (
                <div className="mt-6 p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl text-sm font-semibold animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">❌</span>
                        {error}
                    </div>
                </div>
            )}

            <div className="mt-6 flex flex-wrap gap-4 text-[11px] text-gray-400 font-medium">
                <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    Required: code, name
                </div>
                <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                    Optional: category, price, finalQty, minStock
                </div>
                <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    Duplicates based on "code" (SKU) will be updated
                </div>
            </div>
        </div>
    );
};

export default FinishedGoodImport;
