import React, { useState, useEffect, lazy, Suspense } from 'react';
import { SkeletonCard, SkeletonTable } from '../components/ui.jsx';

// Lazy load dashboards for code splitting
const AdminDashboard = lazy(() => import('./AdminDashboard.jsx'));
const SalesDashboard = lazy(() => import('./SalesDashboard.jsx'));
const DesignDashboard = lazy(() => import('./DesignDashboard.jsx'));
const ProcurementDashboard = lazy(() => import('./ProcurementDashboard.jsx'));
const ProductionDashboard = lazy(() => import('./ProductionDashboard.jsx'));
const InventoryDashboard = lazy(() => import('./InventoryDashboard.jsx'));
const QualityDashboard = lazy(() => import('./QualityDashboard.jsx'));
const ShipmentDashboard = lazy(() => import('./ShipmentDashboard.jsx'));
const AccountsDashboard = lazy(() => import('./AccountsDashboard.jsx'));

const MainDashboard = ({ apiRequest }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('authUser');
    if (storedUser) setUser(JSON.parse(storedUser));
  }, []);

  const dept = user?.department_code || 'ADMIN';

  // Map department codes to their respective dashboards
  const renderDepartmentDashboard = () => {
    const props = { apiRequest };
    switch (dept) {
      case 'SALES':
        return <SalesDashboard {...props} />;
      case 'DESIGN_ENG':
        return <DesignDashboard {...props} />;
      case 'PROCUREMENT':
        return <ProcurementDashboard {...props} />;
      case 'PRODUCTION':
        return <ProductionDashboard {...props} />;
      case 'INVENTORY':
        return <InventoryDashboard {...props} />;
      case 'QUALITY':
        return <QualityDashboard {...props} />;
      case 'SHIPMENT':
        return <ShipmentDashboard {...props} />;
      case 'ACCOUNTS':
        return <AccountsDashboard {...props} />;
      case 'ADMIN':
        return <AdminDashboard {...props} />;
      default:
        return <AdminDashboard {...props} />; 
    }
  };

  return (
    <Suspense fallback={
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="bg-white rounded border border-slate-100 p-4">
          <SkeletonTable rows={4} columns={5} />
        </div>
      </div>
    }>
      {renderDepartmentDashboard()}
    </Suspense>
  );
};

export default MainDashboard;
