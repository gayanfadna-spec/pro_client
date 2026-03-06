import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import qoflLogo from '../assets/qofl_logo.png';

const UserManager = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        username: '',
        password: '',
        role: 'user'
    });
    const [error, setError] = useState('');

    const config = {
        headers: {
            Authorization: `Bearer ${user?.token}`,
        },
    };

    const fetchUsers = async () => {
        try {
            const { data } = await axios.get('http://localhost:5000/api/auth', config);
            setUsers(data);
            setLoading(false);
        } catch (err) {
            setError('Failed to fetch users');
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (editingUser) {
                // Remove password from update if empty
                const updateData = { ...formData };
                if (!updateData.password) delete updateData.password;

                await axios.put(`http://localhost:5000/api/auth/${editingUser._id}`, updateData, config);
            } else {
                await axios.post('http://localhost:5000/api/auth/register', formData, config);
            }
            setIsModalOpen(false);
            setEditingUser(null);
            setFormData({ name: '', username: '', password: '', role: 'user' });
            fetchUsers();
        } catch (err) {
            setError(err.response?.data?.message || 'Operation failed');
        }
    };

    const handleEdit = (user) => {
        setEditingUser(user);
        setFormData({
            name: user.name,
            username: user.username,
            password: '', // Don't show password
            role: user.role
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this user?')) {
            try {
                await axios.delete(`http://localhost:5000/api/auth/${id}`, config);
                fetchUsers();
            } catch (err) {
                setError('Failed to delete user');
            }
        }
    };

    if (loading) return <div className="text-center p-10">Loading User Manager...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                    <img src={qoflLogo} alt="QOFL Logo" className="h-20 sm:h-24 w-auto object-contain" />
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-800 tracking-tight mt-0 sm:mt-6">User Management</h1>
                </div>
                <button
                    onClick={() => {
                        setEditingUser(null);
                        setFormData({ name: '', username: '', password: '', role: 'user' });
                        setIsModalOpen(true);
                    }}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95 mt-0 sm:mt-6"
                >
                    + Add New User
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-bold animate-pulse">
                    {error}
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                    <thead className="bg-gray-50/50 border-b border-gray-100">
                        <tr className="text-gray-400 text-[10px] uppercase font-black tracking-widest">
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Username</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {users.map((u) => (
                            <tr key={u._id} className="hover:bg-gray-50/50 transition-colors group">
                                <td className="px-6 py-4 font-bold text-gray-800">{u.name}</td>
                                <td className="px-6 py-4 text-gray-500 font-mono text-xs">{u.username}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                        {u.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button
                                        onClick={() => handleEdit(u)}
                                        className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors"
                                        title="Edit User"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => handleDelete(u._id)}
                                        className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                        title="Delete User"
                                        disabled={u._id === user._id}
                                    >
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                        <div className="p-8">
                            <h2 className="text-2xl font-black text-gray-800 mb-6">
                                {editingUser ? 'Edit User' : 'Add New User'}
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Full Name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-bold text-gray-800"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Username</label>
                                    <input
                                        type="text"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-bold text-gray-800"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                        Password {editingUser && '(Leave blank to keep current)'}
                                    </label>
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-bold text-gray-800"
                                        required={!editingUser}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Role</label>
                                    <select
                                        name="role"
                                        value={formData.role}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-bold text-gray-800 appearance-none"
                                    >
                                        <option value="user">User (Standard)</option>
                                        <option value="admin">Admin (System Access)</option>
                                    </select>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="w-full sm:flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-3 rounded-xl font-bold transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="w-full sm:flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 active:scale-95"
                                    >
                                        {editingUser ? 'Save Changes' : 'Create User'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManager;
