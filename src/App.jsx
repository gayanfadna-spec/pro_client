import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';
import FinishedGoodManager from './pages/FinishedGoodManager';
import RawMaterialManager from './pages/RawMaterialManager';
import Forecast from './pages/Forecast';
import ProducibilityManager from './pages/ProducibilityManager';
import UserManager from './pages/UserManager';
import PackingMaterialManager from './pages/PackingMaterialManager';
import NotFound from './pages/NotFound';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  return user ? children : <Navigate to="/login" />;
};

// Admin Route Wrapper
const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  return user && user.role === 'admin' ? children : <Navigate to="/" />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="finished-goods" element={<FinishedGoodManager />} />
            <Route path="materials" element={<RawMaterialManager />} />
            <Route path="packing-materials" element={<PackingMaterialManager />} />
            <Route path="forecast" element={<AdminRoute><Forecast /></AdminRoute>} />
            <Route path="producible" element={<AdminRoute><ProducibilityManager /></AdminRoute>} />
            <Route path="users" element={<AdminRoute><UserManager /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
