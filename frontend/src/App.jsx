import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LayoutDashboard, Boxes, Download, Upload, Repeat, Settings2, Recycle, Brain } from 'lucide-react'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import InventoryDashboardPage from './pages/InventoryDashboardPage'
import WarehouseControlPage from './pages/WarehouseControlPage'
import MaterialInwardPage from './pages/MaterialInwardPage'
import MaterialOutwardPage from './pages/MaterialOutwardPage'
import TransferPage from './pages/TransferPage'
import InventoryControlPage from './pages/InventoryControlPage'
import ScrapWastePage from './pages/ScrapWastePage'
import StockIntelligencePage from './pages/StockIntelligencePage'

const navigation = [
  { label: 'Inventory Dashboard', path: '/inventory/dashboard', icon: LayoutDashboard },
  { label: 'Warehouse Control', path: '/inventory/warehouses', icon: Boxes },
  { label: 'Material Inward', path: '/inventory/inward', icon: Download },
  { label: 'Material Outward', path: '/inventory/outward', icon: Upload },
  { label: 'Inter-Warehouse Transfer', path: '/inventory/transfers', icon: Repeat },
  { label: 'Inventory Control', path: '/inventory/control', icon: Settings2 },
  { label: 'Scrap & Waste', path: '/inventory/scrap', icon: Recycle },
  { label: 'Stock Intelligence', path: '/inventory/intel', icon: Brain }
]

const App = () => (
  <BrowserRouter>
    <div className="app-shell">
      <Sidebar items={navigation} />
      <div className="app-main">
        <TopBar />
        <div className="page-shell">
          <Routes>
            <Route path="/" element={<Navigate to="/inventory/dashboard" replace />} />
            <Route path="/inventory/dashboard" element={<InventoryDashboardPage />} />
            <Route path="/inventory/warehouses" element={<WarehouseControlPage />} />
            <Route path="/inventory/inward" element={<MaterialInwardPage />} />
            <Route path="/inventory/outward" element={<MaterialOutwardPage />} />
            <Route path="/inventory/transfers" element={<TransferPage />} />
            <Route path="/inventory/control" element={<InventoryControlPage />} />
            <Route path="/inventory/scrap" element={<ScrapWastePage />} />
            <Route path="/inventory/intel" element={<StockIntelligencePage />} />
            <Route path="*" element={<Navigate to="/inventory/dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  </BrowserRouter>
)

export default App
