import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const activeLink = "flex items-center space-x-3 bg-blue-600/20 text-blue-400 p-3 rounded-lg border-r-4 border-blue-500 shadow-sm transition-all";
    const normalLink = "flex items-center space-x-3 p-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-all";

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden">
            {/* Sidebar Toggle Button */}
            <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={`fixed top-6 z-50 p-2.5 bg-gray-900 text-white shadow-2xl hover:bg-gray-800 transition-all border-y border-r border-gray-700/50 flex items-center justify-center rounded-r-xl group ${isSidebarOpen ? 'left-80' : 'left-0'}`}
                title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
            >
                <span className={`text-xl transition-transform duration-300 ${isSidebarOpen ? 'rotate-0' : 'rotate-180'}`}>
                    {isSidebarOpen ? '❮' : '❯'}
                </span>
            </button>

            {/* Sidebar */}
            <div className={`bg-[#0f172a] text-white flex flex-col shadow-2xl transition-all duration-500 ease-in-out relative z-40 ${isSidebarOpen ? 'w-80 p-4 opacity-100' : 'w-0 p-0 opacity-0 overflow-hidden'}`}>
                <div className="flex flex-col items-center mt-6 mb-10">
                    <h2 className="text-2xl font-black text-center text-white tracking-tighter ">INVENTORY APP</h2>
                    <p className="mt-3 px-4 py-1.5 text-[10px] font-black tracking-[0.2em] text-white bg-slate-800/40 border border-slate-500/30 rounded-full uppercase text-center shadow-lg shadow-white/5">
                        Q of L and Life Science
                    </p>
                </div>

                <nav className="flex-1 space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
                    <NavLink to="/" className={({ isActive }) => isActive ? activeLink : normalLink}>
                        <span className="font-bold">Dashboard</span>
                    </NavLink>

                    <NavLink to="/finished-goods" className={({ isActive }) => isActive ? activeLink : normalLink}>
                        <span className="font-bold">Finished Goods</span>
                    </NavLink>
                    <NavLink to="/materials" className={({ isActive }) => isActive ? activeLink : normalLink}>
                        <span className="font-bold">Raw Materials</span>
                    </NavLink>
                    <NavLink to="/packing-materials" className={({ isActive }) => isActive ? activeLink : normalLink}>
                        <span className="font-bold">Packing Materials</span>
                    </NavLink>
                    {user?.role === 'admin' && (
                        <NavLink to="/forecast" className={({ isActive }) => isActive ? activeLink : normalLink}>
                            <span className="font-bold">Forecast</span>
                        </NavLink>
                    )}
                    {user?.role === 'admin' && (
                        <NavLink to="/producible" className={({ isActive }) => isActive ? activeLink : normalLink}>
                            <span className="font-bold">Potential Production</span>
                        </NavLink>
                    )}

                    {user?.role === 'admin' && (
                        <NavLink to="/users" className={({ isActive }) => isActive ? activeLink : normalLink}>
                            <span className="font-bold">User Management</span>
                        </NavLink>
                    )}
                </nav>

                <div className="pt-4 mt-4 border-t border-gray-800">
                    <div className="mb-4 px-3 text-[10px] text-gray-500 uppercase font-black tracking-widest">
                        User: <span className="text-white font-black">{user?.name}</span>
                    </div>
                    <button onClick={handleLogout} className="w-full flex items-center justify-center bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 p-3 rounded-xl text-white font-black transition-all shadow-lg shadow-red-900/20 active:scale-95 text-sm uppercase tracking-widest">
                        Logout
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto bg-gray-50">
                <main className="p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;
