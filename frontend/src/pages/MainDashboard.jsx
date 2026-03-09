import React, { useState, useEffect, lazy, Suspense } from 'react';
import { 
  LayoutDashboard, 
  Clock, 
  RefreshCw, 
  ShieldCheck,
  Users
} from 'lucide-react';

// Lazy load departmental dashboards
const SalesDashboard = lazy(() => import('./SalesDashboard'));
const DesignDashboard = lazy(() => import('./DesignDashboard'));
const ProcurementDashboard = lazy(() => import('./ProcurementDashboard'));
const ProductionDashboard = lazy(() => import('./ProductionDashboard'));
const InventoryDashboard = lazy(() => import('./InventoryDashboard'));
const QualityDashboard = lazy(() => import('./QualityDashboard'));
const ShipmentDashboard = lazy(() => import('./ShipmentDashboard'));
const AccountsDashboard = lazy(() => import('./AccountsDashboard'));

// Admin/Unified Dashboard View
const AdminDashboard = lazy(() => import('./AdminDashboard'));

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const MainDashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('authUser');
    if (storedUser) setUser(JSON.parse(storedUser));
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-bold tracking-widest uppercase text-xs">Loading Workspace...</p>
      </div>
    );
  }

  const dept = user?.department_code || 'ADMIN';

  // Map department codes to their respective dashboards
  const renderDepartmentDashboard = () => {
    switch (dept) {
      case 'SALES':
        return <SalesDashboard />;
      case 'DESIGN_ENG':
        return <DesignDashboard />;
      case 'PROCUREMENT':
        return <ProcurementDashboard />;
      case 'PRODUCTION':
        return <ProductionDashboard />;
      case 'INVENTORY':
        return <InventoryDashboard />;
      case 'QUALITY':
        return <QualityDashboard />;
      case 'SHIPMENT':
        return <ShipmentDashboard />;
      case 'ACCOUNTS':
        return <AccountsDashboard />;
      case 'ADMIN':
        return <AdminDashboard />;
      default:
        return <AdminDashboard />; 
    }
  };

  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-bold tracking-widest uppercase text-xs">Initializing Departmental Hub...</p>
      </div>
    }>
      {renderDepartmentDashboard()}
    </Suspense>
  );
};

export default MainDashboard;
