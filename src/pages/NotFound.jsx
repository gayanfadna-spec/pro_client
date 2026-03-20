import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6 animate-in fade-in duration-500">
            <h1 className="text-9xl font-black text-gray-200 mb-4">404</h1>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Page Not Found</h2>
            <p className="text-gray-500 max-w-md mb-8">
                The page you are looking for doesn't exist or has been moved.
            </p>
            <Link
                to="/"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
            >
                🏠 Return to Dashboard
            </Link>
        </div>
    );
};

export default NotFound;
