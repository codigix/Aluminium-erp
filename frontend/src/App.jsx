import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Swal from 'sweetalert2'
import { 
  Building2, ClipboardList, FileText, Package, Palette, PencilLine, Factory, 
  Settings, BarChart3, CheckCircle, Handshake, MessageSquare, ShoppingCart, 
  Inbox, Book, Scale, TrendingUp, Search, Check, XCircle, Files, RotateCw, LogOut, Truck,
  LayoutDashboard, Users, FileSearch, FileCheck, Layers, Box, ListTree, Settings2, 
  FileSpreadsheet, PackageSearch, Calendar, Wrench, FileSignature, Cpu, Activity, 
  FileQuestion, ShoppingBag, ClipboardPlus, ClipboardCheck, Move, BookOpen, Warehouse, 
  ShieldCheck, LogIn, FileBarChart, Receipt, CreditCard, History, CheckCircle2, Contact2,
  Menu, Monitor, ChevronDown, ChevronRight
} from 'lucide-react'
import CompanyMaster from './pages/CompanyMaster'
import AdminCompanyMaster from './pages/AdminCompanyMaster'
import ClientContacts from './pages/ClientContacts'
import CustomerPO from './pages/CustomerPO'
import SalesOrders from './pages/SalesOrders'
import IncomingOrders from './pages/IncomingOrders'
import VendorManagement from './pages/VendorManagement'
import Suppliers from './pages/Suppliers'
import Quotations from './pages/Quotations'
import PurchaseOrders from './pages/PurchaseOrders'
import POReceipts from './pages/POReceipts'
import POReceiptDetails from './pages/POReceiptDetails'
import GRN from './pages/GRN'
import GRNProcessing from './pages/GRNProcessing'
import QCInspections from './pages/QCInspections'
import StockLedger from './pages/StockLedger'
import StockBalance from './pages/StockBalance'
import InventoryDashboard from './pages/InventoryDashboard'
import MainDashboard from './pages/MainDashboard'
import POMaterialRequest from './pages/POMaterialRequest'
import QualityDashboard from './pages/QualityDashboard'
import IncomingQC from './pages/IncomingQC'
import QualityRejections from './pages/QualityRejections'
import QualityReports from './pages/QualityReports'
import QualityRejectionEntry from './pages/QualityRejectionEntry'
import Warehouses from './pages/Warehouses'
import DrawingMaster from './pages/DrawingMaster'
import CustomerDrawing from './pages/CustomerDrawing'
import DesignOrders from './pages/DesignOrders'
import ItemsMaster from './pages/ItemsMaster'
import ClientQuotations from './pages/ClientQuotations'
import QuotationFormPage from './pages/QuotationFormPage'
import BOMCreation from './pages/BOMCreation'
import RoutingOperations from './pages/RoutingOperations'
import ProcessSheet from './pages/ProcessSheet'
import BOMApproval from './pages/BOMApproval'
import BOMFormPage from './pages/BOMFormPage'
import WorkstationMaster from './pages/WorkstationMaster'
import OperationMaster from './pages/OperationMaster'
import ProjectRequests from './pages/ProjectRequests'
import MaterialRequirements from './pages/MaterialRequirements'
import ProductionPlan from './pages/ProductionPlan'
import WorkOrder from './pages/WorkOrder'
import WorkOrderForm from './pages/WorkOrderForm'
import JobCard from "./pages/JobCard";
import ShipmentOrders from "./pages/ShipmentOrders";
import ShipmentPlanning from "./pages/ShipmentPlanning";
import DispatchManagement from "./pages/DispatchManagement";
import DeliveryChallan from "./pages/DeliveryChallan";
import Tracking from "./pages/Tracking";
import ShipmentReturns from "./pages/ShipmentReturns";
import ShipmentDashboard from "./pages/ShipmentDashboard";
import ShipmentReports from "./pages/ShipmentReports";
import StockEntries from "./pages/StockEntries";
import VendorInvoices from "./pages/InvoiceReceived";
import PaymentProcessing from "./pages/PaymentProcessing";
import PaymentHistory from "./pages/PaymentHistory";
import PaymentReceived from "./pages/PaymentReceived";
import CustomerPaymentHistory from "./pages/CustomerPaymentHistory";
import AccountsDashboard from "./pages/AccountsDashboard";
import AccountsReport from "./pages/AccountsReport";
import VendorInwardChallans from "./pages/VendorInwardChallans";
import Challans from "./pages/Challans";
import SalesDashboard from "./pages/SalesDashboard";
import DesignDashboard from "./pages/DesignDashboard";
import ProductionDashboard from "./pages/ProductionDashboard";
import ProcurementDashboard from "./pages/ProcurementDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ProjectAnalysis from "./pages/ProjectAnalysis";
import SalesReport from "./pages/SalesReport";
import SalesReportDetails from "./pages/SalesReportDetails";
import ProcurementReport from "./pages/ProcurementReport";
import ProductionReport from "./pages/ProductionReport";
import InventoryReport from "./pages/InventoryReport";
import OEEAnalysis from "./pages/OEEAnalysis";
import MachineAnalysis from "./pages/MachineAnalysis";
import MaterialConsumption from "./pages/MaterialConsumption";
import WorkOrderDetail from "./pages/WorkOrderDetail";
import GRNPOdetails from "./pages/GRNPOdetails";
import QCGrnDetails from "./pages/QCGrnDetails";
import ShipmentDetails from "./pages/ShipmentDetails";
import TransactionDetails from "./pages/TransactionDetails";
import StockDetails from "./pages/StockDetails";
import ApprovedQuotations from "./pages/ApprovedQuotations";
import ActiveClients from "./pages/ActiveClients";
import { FormControl, StatusBadge, Button } from "./components/ui.jsx";
import './index.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');
const API_HOST = API_BASE
const MODULE_IDS = ['dashboard', 'admin-dashboard', 'project-analysis', 'sales-report', 'approved-quotations', 'active-clients', 'sales-report-details', 'procurement-report', 'production-report', 'inventory-report', 'accounts-report', 'oee-analysis', 'machine-analysis', 'material-consumption', 'sales-dashboard', 'design-dashboard', 'production-dashboard', 'procurement-dashboard', 'item-master', 'company-master', 'client-contacts', 'customer-po', 'sales-order', 'customer-drawing', 'client-quotations', 'quotation-form', 'vendor-management', 'suppliers', 'quotations', 'purchase-orders', 'po-receipts', 'po-receipt-details', 'inventory-dashboard', 'quality-dashboard', 'accounts-dashboard', 'po-material-request', 'grn', 'qc-inspections', 'stock-ledger', 'stock-balance', 'incoming-qc', 'quality-rejections', 'quality-reports', 'quality-rejection-entry', 'warehouses', 'design-orders', 'drawing-master', 'bom-creation', 'routing-operations', 'process-sheet', 'bom-approval', 'bom-form', 'workstation-master', 'operation-master', 'project-requests', 'material-requirements', 'production-plan', 'work-order', 'work-order-form', 'job-card', 'sub-contract-challans', 'stock-entries', 'incoming-orders', 'vendor-inward-challans', 'invoice-received', 'payment-processing', 'payment-received', 'payment-history', 'customer-payment-history', 'shipment-dashboard', 'shipment-orders', 'shipment-planning', 'dispatch-management', 'delivery-challan', 'shipment-tracking', 'shipment-returns', 'shipment-reports', 'work-order-details', 'grn-po-details', 'qc-grn-details', 'shipment-details', 'transaction-details', 'stock-details', 'admin-company-master']
const DEFAULT_MODULE = 'dashboard'
const HOME_PLANT_STATE = (import.meta.env.VITE_PLANT_STATE || 'maharashtra').toLowerCase()
const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2
})
const COMPANY_HINTS = {
  SIDEL: ['sidel'],
  PHOENIX: ['phoenix'],
  BOSSAR: ['bossar']
}

const formatDisplayDate = value => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatCurrencyByCode = (value, currency = 'INR') => {
  const normalized = (currency || 'INR').toUpperCase()
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: normalized, minimumFractionDigits: 2 }).format(Number(value) || 0)
  } catch {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(Number(value) || 0)
  }
}

const formatPercent = value => {
  const numeric = Number(value)
  if (Number.isNaN(numeric)) {
    return '0'
  }
  return Number.isInteger(numeric) ? numeric.toString() : numeric.toFixed(2)
}

const createCompanyForm = () => ({
  companyName: '',
  customerType: 'REGULAR',
  gstin: '',
  cin: '',
  pan: '',
  contactPerson: '',
  contactMobile: '',
  contactEmail: '',
  currency: 'INR',
  freightTerms: '',
  packingForwarding: '',
  insuranceTerms: '',
  billingAddress: {
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India'
  },
  shippingAddress: {
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India'
  }
})

const createContactForm = () => ({
  name: '',
  designation: '',
  email: '',
  phone: '',
  contactType: 'PRIMARY'
})

const mapContactToForm = contact => ({
  name: contact?.name || '',
  designation: contact?.designation || '',
  email: contact?.email || '',
  phone: contact?.phone || '',
  contactType: contact?.contact_type || contact?.contactType || 'PRIMARY'
})

const contactTypeOptions = ['PRIMARY', 'PURCHASE', 'ACCOUNTS', 'TECHNICAL', 'OTHER']
const getContactStatusActionLabel = status => {
  const normalized = (status || '').toUpperCase()
  return normalized === 'ACTIVE' ? 'Deactivate' : 'Activate'
}

const DEPARTMENT_MODULES = {
  SALES: ['dashboard', 'item-master', 'company-master', 'client-contacts', 'customer-po', 'sales-order', 'customer-drawing', 'client-quotations', 'quotation-form', 'sales-report', 'approved-quotations', 'sales-report-details'],
  DESIGN_ENG: ['dashboard', 'item-master', 'design-orders', 'drawing-master', 'bom-creation', 'bom-approval', 'bom-form', 'routing-operations', 'process-sheet'],
  PRODUCTION: ['dashboard', 'item-master', 'project-requests', 'incoming-orders', 'operation-master', 'workstation-master', 'material-requirements', 'production-plan', 'work-order', 'work-order-form', 'job-card', 'sub-contract-challans', 'routing-operations', 'process-sheet', 'production-report', 'work-order-details'],
  QUALITY: ['dashboard', 'item-master', 'incoming-qc', 'quality-rejections', 'quality-reports', 'quality-rejection-entry', 'qc-inspections'],
  SHIPMENT: ['dashboard', 'item-master', 'shipment-orders', 'shipment-planning', 'dispatch-management', 'delivery-challan', 'shipment-tracking', 'shipment-returns', 'shipment-reports'],
  ACCOUNTS: ['dashboard', 'payment-history', 'customer-payment-history', 'accounts-report', 'transaction-details'],
  INVENTORY: ['dashboard', 'item-master', 'po-material-request', 'grn', 'stock-entries', 'stock-ledger', 'stock-balance', 'warehouses', 'suppliers', 'grn-po-details'],
  PROCUREMENT: ['dashboard', 'item-master', 'quotations', 'purchase-orders', 'po-receipts', 'incoming-orders', 'suppliers', 'procurement-report', 'grn-po-details'],
  ADMIN: [
    'dashboard', 'admin-dashboard', 'project-analysis', 'sales-report', 'approved-quotations', 'sales-report-details', 'procurement-report', 'production-report', 'inventory-report', 'accounts-report', 'oee-analysis', 'machine-analysis', 'material-consumption',
    'quality-reports',
    'payment-history', 'customer-payment-history',
    'shipment-tracking', 'shipment-reports', 'work-order-details', 'grn-po-details', 'stock-details', 'active-clients', 'suppliers', 'admin-company-master'
  ]
}

const DEPARTMENT_PREFIXES = {
  SALES: 'sales',
  DESIGN_ENG: 'design',
  PROCUREMENT: 'procurement',
  PRODUCTION: 'production',
  QUALITY: 'quality',
  SHIPMENT: 'shipment',
  ACCOUNTS: 'accounts',
  INVENTORY: 'inventory',
  ADMIN: 'admin'
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const getActiveModuleFromPath = () => {
    const path = location.pathname.replace(/\/$/, '') || '/'
    if (path === '/') return 'dashboard'
    
    // Split the path and handle segments
    const segments = path.split('/').filter(Boolean)
    let firstSegment = segments[0]
    let secondSegment = segments[1]
    
    // Handle ERP module routing structure /*/module-id
    const prefixEntry = Object.entries(DEPARTMENT_PREFIXES).find(([_, prefix]) => prefix === firstSegment)
    if (prefixEntry) {
      const [deptCode] = prefixEntry
      const storedUser = localStorage.getItem('authUser');
      const currentUser = storedUser ? JSON.parse(storedUser) : null;
      
      // Admin bypasses all departmental restrictions
      if (currentUser?.department_code !== deptCode && currentUser?.department_code !== 'ADMIN') {
        return 'unauthorized';
      }

      if (!secondSegment) return 'dashboard'
      firstSegment = secondSegment
      secondSegment = segments[2]
    }

    // Handle special cases for dash-separated module names that might have subpaths
    // For example /item-master/add-items should map to item-master
    if (MODULE_IDS.includes(firstSegment)) {
      if (firstSegment === 'work-order-details') {
        return 'work-order-details';
      }
      if (firstSegment === 'sales-report-details') {
        return 'sales-report-details';
      }
      if (firstSegment === 'work-order' && secondSegment === 'edit-work') {
        return 'work-order-form';
      }
      if (firstSegment === 'job-card' && secondSegment === 'production-entry') {
        return 'job-card';
      }
      if (firstSegment === 'workstation-master' && secondSegment === 'form') {
        return 'workstation-master';
      }
      if (firstSegment === 'operation-master' && secondSegment === 'form') {
        return 'operation-master';
      }
      if (firstSegment === 'drawing-master' && secondSegment === 'edit') {
        return 'drawing-master';
      }
      if (firstSegment === 'po-material-request') {
        return 'po-material-request';
      }
      if (firstSegment === 'grn') {
        return 'grn';
      }
      if (firstSegment === 'stock-entries') {
        return 'stock-entries';
      }
      if (firstSegment === 'warehouses') {
        return 'warehouses';
      }
      if (firstSegment === 'sub-contract-challans') {
        return 'sub-contract-challans';
      }
      if (firstSegment === 'grn-po-details') {
        return 'grn-po-details';
      }
      if (firstSegment === 'qc-grn-details') {
        return 'qc-grn-details';
      }
      if (firstSegment === 'shipment-details') {
        return 'shipment-details';
      }
      if (firstSegment === 'transaction-details') {
        return 'transaction-details';
      }
      if (firstSegment === 'stock-details') {
        return 'stock-details';
      }
      return firstSegment
    }
    
    return DEFAULT_MODULE
  }
  
  const activeModule = getActiveModuleFromPath()
  

  const [token, setToken] = useState(() => {
    try {
      const storedToken = localStorage.getItem('authToken')
      const storedUser = localStorage.getItem('authUser')
      // If token exists but user doesn't, clear the stale token
      if (storedToken && !storedUser) {
        localStorage.removeItem('authToken')
        return null
      }
      return storedToken
    } catch {
      return null
    }
  })
  
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('authUser')
      if (!stored) return null
      const parsed = JSON.parse(stored)
      return parsed && parsed.id ? parsed : null
    } catch {
      localStorage.removeItem('authUser')
      localStorage.removeItem('authToken')
      return null
    }
  })

  const [accessRules, setAccessRules] = useState(null)

  const routeDept = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean)
    const firstSegment = segments[0]
    if (firstSegment) {
      const entry = Object.entries(DEPARTMENT_PREFIXES).find(([_, prefix]) => prefix === firstSegment.toLowerCase())
      if (entry) {
        return entry[0]
      }
    }
    return null
  }, [location.pathname])

  const sidebarDept = routeDept || user?.department_code || 'SALES'

  const allowedModules = useMemo(() => {
    let modules = []
    if (accessRules && accessRules.allowedModules) {
      modules = accessRules.allowedModules
    } else {
      modules = user?.department_code ? (DEPARTMENT_MODULES[user.department_code] || []) : []
    }
    
    // Ensure auxiliary pages are always included if the main module is present
    if ((modules.includes('client-quotations') || modules.includes('approved-quotations')) && !modules.includes('quotation-form')) {
      modules.push('quotation-form')
    }
    if (modules.includes('bom-creation') && !modules.includes('bom-form')) {
      modules.push('bom-form')
    }
    if ((modules.includes('production-report') || modules.includes('work-order') || modules.includes('job-card')) && !modules.includes('work-order-details')) {
      modules.push('work-order-details')
    }
    if (modules.includes('production-report') && !modules.includes('operation-master')) {
      modules.push('operation-master')
    }
    if (modules.includes('sales-report') && !modules.includes('sales-report-details')) {
      modules.push('sales-report-details')
    }
    if (modules.includes('sales-report') && !modules.includes('approved-quotations')) {
      modules.push('approved-quotations')
    }
    if ((modules.includes('sales-report') || modules.includes('production-report') || modules.includes('accounts-report')) && !modules.includes('active-clients')) {
      modules.push('active-clients')
    }
    if ((modules.includes('purchase-orders') || modules.includes('grn') || modules.includes('procurement-report') || modules.includes('po-receipts')) && !modules.includes('grn-po-details')) {
      modules.push('grn-po-details')
    }
    if ((modules.includes('procurement-report') || modules.includes('accounts-report')) && !modules.includes('suppliers')) {
      modules.push('suppliers')
    }
    if ((modules.includes('quality-reports') || modules.includes('qc-inspections')) && !modules.includes('qc-grn-details')) {
      modules.push('qc-grn-details')
    }
    if ((modules.includes('shipment-reports') || modules.includes('shipment-orders') || modules.includes('shipment-planning')) && !modules.includes('shipment-details')) {
      modules.push('shipment-details')
    }
    if ((modules.includes('accounts-report') || modules.includes('invoice-received') || modules.includes('payment-history')) && !modules.includes('transaction-details')) {
      modules.push('transaction-details')
    }
    if ((modules.includes('inventory-report') || modules.includes('stock-balance') || modules.includes('stock-ledger')) && !modules.includes('stock-details')) {
      modules.push('stock-details')
    }
    
    return modules
  }, [user?.department_code, accessRules])

  useEffect(() => {
    if (token && user && activeModule === 'dashboard') {
      // Keep on dashboard, MainDashboard will handle department specific views
    }
  }, [token, user, activeModule, allowedModules, navigate])

  const [authMode, setAuthMode] = useState('login')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openSubMenus, setOpenSubMenus] = useState({})
  const [signupForm, setSignupForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    department_id: '',
    role_id: '',
    phone: ''
  })
  const [departments, setDepartments] = useState([])
  const [roles, setRoles] = useState([])
  const [signupLoading, setSignupLoading] = useState(false)
  const [companyForm, setCompanyForm] = useState(createCompanyForm)
  const [companies, setCompanies] = useState([])
  const [toast, setToast] = useState(null)
  const toastTimeout = useRef(null)
  const [loading, setLoading] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [drawerMode, setDrawerMode] = useState('create')
  const [activeCompany, setActiveCompany] = useState(null)
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false)
  const [contactCompany, setContactCompany] = useState(null)
  const [contactList, setContactList] = useState([])
  const [contactListLoading, setContactListLoading] = useState(false)
  const [contactForm, setContactForm] = useState(createContactForm)
  const [contactSaving, setContactSaving] = useState(false)
  const [editingContactId, setEditingContactId] = useState(null)
  const [editingContactStatus, setEditingContactStatus] = useState('ACTIVE')
  const [showCreatePanel, setShowCreatePanel] = useState(false)
  const [showWorkstationForm, setShowWorkstationForm] = useState(false)
  const [showOperationForm, setShowOperationForm] = useState(false)
  const [quotationRequests, setQuotationRequests] = useState([])
  const [quotationRequestsLoading, setQuotationRequestsLoading] = useState(false)
  const [customerPos, setCustomerPos] = useState([])
  const [customerPosLoading, setCustomerPosLoading] = useState(false)
  const [salesOrders, setSalesOrders] = useState([])
  const [salesOrdersLoading, setSalesOrdersLoading] = useState(false)
  const [poQuotePrices, setPoQuotePrices] = useState({})
  const [poDetailDrawerOpen, setPoDetailDrawerOpen] = useState(false)
  const [poDetailLoading, setPoDetailLoading] = useState(false)
  const [poDetail, setPoDetail] = useState(null)
  const [poDetailError, setPoDetailError] = useState('')
  const [, setSelectedPoId] = useState(null)

  const showToast = useCallback(message => {
    if (toastTimeout.current) {
      clearTimeout(toastTimeout.current)
    }
    setToast(message)
    toastTimeout.current = setTimeout(() => setToast(null), 4000)
  }, [])

  const apiRequest = useCallback(async (path, { method = 'GET', body } = {}) => {
    const config = { 
      method, 
      headers: { 
        'Content-Type': 'application/json',
        'X-ERP-Request': 'true',
        ...(token && { 'Authorization': `Bearer ${token}` })
      } 
    }
    if (body) {
      config.body = JSON.stringify(body)
    }
    const res = await fetch(`${API_BASE}${path}`, config)
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('authToken')
        localStorage.removeItem('authUser')
        setToken(null)
        setUser(null)
        showToast('Session expired. Please login again.')
        return Promise.reject(new Error('Unauthorized'))
      }
      let message = 'Request failed'
      try {
        const errorBody = await res.json()
        message = errorBody.error || errorBody.message || message
      } catch {
        message = 'Request failed'
      }
      throw new Error(message)
    }
    return res.json()
  }, [token, showToast])

  const loadAccessDashboard = useCallback(async () => {
    try {
      const data = await apiRequest('/access/dashboard')
      if (data && data.accessRules) {
        setAccessRules(data.accessRules)
      }
    } catch (error) {
      console.error('Error loading access dashboard:', error)
    }
  }, [apiRequest])

  useEffect(() => {
    if (token && user && !accessRules) {
      loadAccessDashboard().catch(() => null)
    } else if (!token || !user) {
      setAccessRules(null)
    }
  }, [token, user, accessRules, loadAccessDashboard])

  const performLogin = useCallback(async (email, password) => {
    setLoginLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-ERP-Request': 'true'
        },
        body: JSON.stringify({ email, password })
      })
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}))
        throw new Error(errorBody.error || 'Login failed')
      }
      const data = await res.json()
      localStorage.setItem('authToken', data.token)
      localStorage.setItem('authUser', JSON.stringify(data.user))
      setToken(data.token)
      setUser(data.user)
      setLoginEmail('')
      setLoginPassword('')
      showToast(`Welcome, ${data.user.first_name || data.user.username}!`)
      
      // Redirect to first allowed module based on department with prefix
      const userAllowed = DEPARTMENT_MODULES[data.user.department_code] || []
      const prefix = DEPARTMENT_PREFIXES[data.user.department_code]?.toLowerCase() || ''
      
      if (userAllowed.length > 0) {
        const targetModule = userAllowed[0]
        const targetPath = prefix ? `/${prefix}/${targetModule}` : `/${targetModule}`
        navigate(targetPath)
      }
    } catch (error) {
      showToast(error.message)
    } finally {
      setLoginLoading(false)
    }
  }, [navigate, showToast])

  const handleLogin = useCallback(async e => {
    e.preventDefault()
    if (!loginEmail || !loginPassword) {
      showToast('Email and password required')
      return
    }
    await performLogin(loginEmail, loginPassword)
  }, [loginEmail, loginPassword, showToast, performLogin])

  const loadDepartmentsAndRoles = useCallback(async () => {
    try {
      const deptRes = await fetch(`${API_BASE}/departments`, {
        headers: { 'X-ERP-Request': 'true' }
      })
      if (deptRes.ok) {
        const depts = await deptRes.json()
        setDepartments(Array.isArray(depts) ? depts : [])
      }
    } catch (error) {
      console.error('Error loading departments:', error)
    }
  }, [])

  useEffect(() => {
    loadDepartmentsAndRoles().catch(() => null)
  }, [loadDepartmentsAndRoles])



  const handleSignup = useCallback(async e => {
    e.preventDefault()
    if (!signupForm.email || !signupForm.password || !signupForm.first_name || !signupForm.department_id || !signupForm.role_id) {
      showToast('All fields required')
      return
    }
    if (signupForm.password !== signupForm.confirmPassword) {
      showToast('Passwords do not match')
      return
    }
    setSignupLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-ERP-Request': 'true'
        },
        body: JSON.stringify({
          username: signupForm.username || signupForm.email.split('@')[0],
          email: signupForm.email,
          password: signupForm.password,
          first_name: signupForm.first_name,
          last_name: signupForm.last_name,
          department_id: parseInt(signupForm.department_id),
          role_id: parseInt(signupForm.role_id),
          phone: signupForm.phone
        })
      })
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}))
        throw new Error(errorBody.error || 'Registration failed')
      }
      const data = await res.json()
      localStorage.setItem('authToken', data.token)
      localStorage.setItem('authUser', JSON.stringify(data.user))
      setToken(data.token)
      setUser(data.user)
      setSignupForm({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        first_name: '',
        last_name: '',
        department_id: '',
        role_id: '',
        phone: ''
      })
      setAuthMode('login')
      showToast(`Welcome, ${data.user.first_name}!`)
    } catch (error) {
      showToast(error.message)
    } finally {
      setSignupLoading(false)
    }
  }, [signupForm, showToast])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('authUser')
    setToken(null)
    setUser(null)
    setLoginEmail('')
    setLoginPassword('')
    setAuthMode('login')
    showToast('Logged out successfully')
    setTimeout(() => {
      navigate('/')
    }, 800)
  }, [showToast, navigate])

  const loadCompanies = useCallback(async () => {
    const data = await apiRequest('/companies')
    setCompanies(Array.isArray(data) ? data : [])
  }, [apiRequest])

  const loadSalesOrders = useCallback(async () => {
    setSalesOrdersLoading(true)
    try {
      const data = await apiRequest('/sales-orders')
      setSalesOrders(Array.isArray(data) ? data : [])
    } catch (error) {
      showToast(error.message)
    } finally {
      setSalesOrdersLoading(false)
    }
  }, [apiRequest, showToast])

  const loadCustomerPos = useCallback(async () => {
    setCustomerPosLoading(true)
    try {
      const data = await apiRequest('/customer-pos')
      setCustomerPos(Array.isArray(data) ? data : [])
    } catch (error) {
      showToast(error.message)
    } finally {
      setCustomerPosLoading(false)
    }
  }, [apiRequest, showToast])

  const loadQuotationRequests = useCallback(async () => {
    setQuotationRequestsLoading(true)
    try {
      const data = await apiRequest('/quotation-requests')
      setQuotationRequests(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading quotation requests:', error)
    } finally {
      setQuotationRequestsLoading(false)
    }
  }, [apiRequest])

  const handlePoQuotePriceChange = (itemId, price) => {
    setPoQuotePrices(prev => ({ ...prev, [itemId]: price }))
  }

  const getPoPdfUrl = useCallback(path => {
    if (!path) {
      return null
    }
    const normalized = path.replace(/^\/+/g, '')
    return `${API_HOST}/${normalized}`
  }, [])

  useEffect(() => {
    if (token && user && companies.length === 0) {
      loadCompanies().catch(() => null)
    }
  }, [loadCompanies, token, user, companies])

  useEffect(() => {
    if (token && user && salesOrders.length === 0) {
      loadSalesOrders().catch(() => null)
    }
  }, [loadSalesOrders, token, user, salesOrders])

  useEffect(() => {
    if (token && user && customerPos.length === 0) {
      loadCustomerPos().catch(() => null)
    }
  }, [loadCustomerPos, token, user, customerPos])

  useEffect(() => {
    if (activeModule === 'customer-po') {
      loadQuotationRequests().catch(() => null)
    }
  }, [activeModule, loadQuotationRequests])

  useEffect(() => {
    if (token && user && allowedModules.length > 0) {
      if (!allowedModules.includes(activeModule)) {
        // Special case for detail pages that might not be in the permission list
        if (activeModule === 'sales-report-details' && allowedModules.includes('sales-report')) {
          return;
        }
        if (activeModule === 'work-order-details' && (allowedModules.includes('work-order') || allowedModules.includes('production-report'))) {
          return;
        }
        const prefix = DEPARTMENT_PREFIXES[user.department_code]?.toLowerCase() || '';
        const targetPath = prefix ? `/${prefix}/${allowedModules[0]}` : `/${allowedModules[0]}`;
        navigate(targetPath)
      }
    }
  }, [token, user, allowedModules, activeModule, navigate])

  useEffect(() => {
    if (activeModule !== 'company-master') {
      setShowCreatePanel(false)
      setCompanyForm(createCompanyForm())
    }
  }, [activeModule])



  const updateAddress = (type, field, value) => {
    setCompanyForm(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }))
  }

  const hydrateFormFromCompany = company => {
    const billing = company.addresses?.find(address => address.address_type === 'BILLING') || {}
    const shipping = company.addresses?.find(address => address.address_type === 'SHIPPING') || {}
    return {
      companyName: company.company_name || '',
      customerType: company.customer_type || 'REGULAR',
      gstin: company.gstin || '',
      cin: company.cin || '',
      pan: company.pan || '',
      contactPerson: company.contact_person || '',
      contactMobile: company.contact_mobile || '',
      contactEmail: company.contact_email || '',
      currency: company.currency || 'INR',
      freightTerms: company.freight_terms || '',
      packingForwarding: company.packing_forwarding || '',
      insuranceTerms: company.insurance_terms || '',
      billingAddress: {
        line1: billing.line1 || '',
        line2: billing.line2 || '',
        city: billing.city || '',
        state: billing.state || '',
        pincode: billing.pincode || '',
        country: billing.country || 'India'
      },
      shippingAddress: {
        line1: shipping.line1 || '',
        line2: shipping.line2 || '',
        city: shipping.city || '',
        state: shipping.state || '',
        pincode: shipping.pincode || '',
        country: shipping.country || 'India'
      }
    }
  }

  const openDrawer = (mode, company = null) => {
    setShowCreatePanel(false)
    setDrawerMode(mode)
    setActiveCompany(company)
    if (company) {
      setCompanyForm(hydrateFormFromCompany(company))
    } else {
      setCompanyForm(createCompanyForm())
    }
    setShowDrawer(true)
  }

  const closeDrawer = () => {
    setShowDrawer(false)
    setDrawerMode('create')
    setActiveCompany(null)
    setCompanyForm(createCompanyForm())
  }

  const toggleCreatePanel = () => {
    setShowDrawer(false)
    setDrawerMode('create')
    setActiveCompany(null)
    setCompanyForm(createCompanyForm())
    setShowCreatePanel(prev => !prev)
  }



  const buildPayload = () => ({
    companyName: companyForm.companyName,
    customerType: companyForm.customerType,
    gstin: companyForm.gstin,
    cin: companyForm.cin,
    pan: companyForm.pan,
    contactPerson: companyForm.contactPerson,
    contactMobile: companyForm.contactMobile,
    contactEmail: companyForm.contactEmail,
    currency: companyForm.currency,
    freightTerms: companyForm.freightTerms,
    packingForwarding: companyForm.packingForwarding,
    insuranceTerms: companyForm.insuranceTerms,
    billingAddress: companyForm.billingAddress,
    shippingAddress: companyForm.shippingAddress
  })

  const resetContactForm = () => {
    setContactForm(createContactForm())
    setEditingContactId(null)
    setEditingContactStatus('ACTIVE')
  }

  const loadCompanyContacts = async (companyId, options = {}) => {
    if (!companyId) return
    const { primeDraft = false } = options
    setContactListLoading(true)
    try {
      const data = await apiRequest(`/companies/${companyId}/contacts`)
      const normalized = Array.isArray(data) ? data : []
      setContactList(normalized)
      if (primeDraft) {
        const draftContact = normalized.find(contact => (contact.status || '').toUpperCase() === 'DRAFT')
        if (draftContact) {
          setEditingContactId(draftContact.id)
          setEditingContactStatus(draftContact.status || 'DRAFT')
          setContactForm(mapContactToForm(draftContact))
        } else {
          resetContactForm()
        }
      }
    } catch (error) {
      showToast(error.message)
    } finally {
      setContactListLoading(false)
    }
  }

  const openContactDrawer = company => {
    if (!company) return
    setContactCompany(company)
    setContactDrawerOpen(true)
    resetContactForm()
    setContactList([])
    loadCompanyContacts(company.id, { primeDraft: true })
  }

  const closeContactDrawer = () => {
    setContactDrawerOpen(false)
    setContactCompany(null)
    setContactList([])
    resetContactForm()
  }

  const handleContactFormChange = (field, value) => {
    setContactForm(prev => ({ ...prev, [field]: value }))
  }

  const handleContactSubmit = async event => {
    event.preventDefault()
    if (!contactCompany || !isCompanyActive(contactCompany)) {
      showToast('Activate the company to manage contacts')
      return
    }
    setContactSaving(true)
    try {
      const payload = {
        name: contactForm.name,
        designation: contactForm.designation,
        email: contactForm.email,
        phone: contactForm.phone,
        contactType: contactForm.contactType || 'PRIMARY'
      }
      if (editingContactId) {
        await apiRequest(`/companies/${contactCompany.id}/contacts/${editingContactId}`, { method: 'PUT', body: payload })
        if ((editingContactStatus || '').toUpperCase() === 'DRAFT') {
          await apiRequest(`/companies/${contactCompany.id}/contacts/${editingContactId}/status`, { method: 'PATCH', body: { status: 'ACTIVE' } })
        }
        showToast('Contact updated')
      } else {
        await apiRequest(`/companies/${contactCompany.id}/contacts`, { method: 'POST', body: payload })
        showToast('Contact added')
      }
      await loadCompanyContacts(contactCompany.id)
      resetContactForm()
    } catch (error) {
      showToast(error.message)
    } finally {
      setContactSaving(false)
    }
  }

  const handleEditContact = contact => {
    if (!contact) return
    if (!isCompanyActive(contactCompany)) {
      showToast('Activate the company to edit contacts')
      return
    }
    setEditingContactId(contact.id)
    setEditingContactStatus(contact.status || 'ACTIVE')
    setContactForm(mapContactToForm(contact))
  }

  const handleContactStatusToggle = async contact => {
    if (!contactCompany) return
    if (!isCompanyActive(contactCompany)) {
      showToast('Activate the company to update contacts')
      return
    }
    const currentStatus = (contact.status || 'ACTIVE').toUpperCase()
    const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try {
      await apiRequest(`/companies/${contactCompany.id}/contacts/${contact.id}/status`, { method: 'PATCH', body: { status: nextStatus } })
      await loadCompanyContacts(contactCompany.id)
      showToast(`Contact marked ${nextStatus.toLowerCase()}`)
    } catch (error) {
      showToast(error.message)
    }
  }

  const handleDeleteContact = async contact => {
    if (!contactCompany || !isCompanyActive(contactCompany)) return
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Remove contact?',
      text: 'This contact will be permanently removed from the company.',
      confirmButtonText: 'Remove',
      cancelButtonText: 'Keep',
      showCancelButton: true,
      buttonsStyling: false,
      customClass: {
        confirmButton: 'p-2 rounded  bg-rose-500 text-white  ml-3',
        cancelButton: 'p-2 rounded  border border-slate-200 text-slate-600 '
      }
    })
    if (!result.isConfirmed) return
    try {
      await apiRequest(`/companies/${contactCompany.id}/contacts/${contact.id}`, { method: 'DELETE' })
      if (editingContactId === contact.id) {
        resetContactForm()
      }
      await loadCompanyContacts(contactCompany.id, { primeDraft: true })
      showToast('Contact removed')
    } catch (error) {
      showToast(error.message)
    }
  }

  const handleCompanySubmit = async event => {
    event.preventDefault()
    if (drawerMode === 'view') {
      closeDrawer()
      return
    }
    setLoading(true)
    try {
      const payload = buildPayload()
      if (drawerMode === 'edit' && activeCompany) {
        await apiRequest(`/companies/${activeCompany.id}`, { method: 'PUT', body: payload })
        showToast('Company updated')
      } else {
        await apiRequest('/companies', { method: 'POST', body: payload })
        showToast('Company saved')
      }
      await loadCompanies()
      closeDrawer()
    } catch (error) {
      showToast(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleInlineCreateSubmit = async event => {
    event.preventDefault()
    setLoading(true)
    try {
      const payload = buildPayload()
      await apiRequest('/companies', { method: 'POST', body: payload })
      showToast('Company saved')
      await loadCompanies()
      setCompanyForm(createCompanyForm())
      setShowCreatePanel(false)
    } catch (error) {
      showToast(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCompany = async company => {
    const companyId = typeof company === 'object' ? company.id : company
    if (!companyId) {
      showToast('Invalid company selected')
      return
    }
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Delete company?',
      text: 'This will permanently remove the company.',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      showCancelButton: true,
      buttonsStyling: false,
      customClass: {
        confirmButton: 'p-2 rounded  bg-rose-500 text-white  ml-3',
        cancelButton: 'p-2 rounded  border border-slate-200 text-slate-600 '
      }
    })
    if (!result.isConfirmed) return
    try {
      await apiRequest(`/companies/${companyId}`, { method: 'DELETE' })
      await loadCompanies()
      showToast('Company removed')
    } catch (error) {
      showToast(error.message)
    }
  }

  const handleUpdateQuotationRates = async (items) => {
    try {
      const updatePayload = items.map(item => ({
        id: item.id,
        qty: item.item_qty || 1,
        rate: poQuotePrices[`q-${item.id}`] || 0
      }))

      await apiRequest('/quotation-requests/batch-update-rates', {
        method: 'PUT',
        body: { items: updatePayload }
      })

      showToast('Quotation rates updated successfully')
      loadQuotationRequests() // Refresh the list
    } catch (error) {
      showToast(error.message)
    }
  }

  const handleApproveQuotationGroup = async (quotes) => {
    try {
      const ids = quotes.map(q => q.id)
      await apiRequest('/quotation-requests/batch-approve', {
        method: 'POST',
        body: { ids }
      })
      showToast('Quotations sent for approval')
      loadQuotationRequests()
    } catch (error) {
      showToast(error.message)
    }
  }

  const handleSendToDesignGroup = async (quotes) => {
    try {
      const ids = quotes.map(q => q.id)
      await apiRequest('/quotation-requests/batch-send-to-design', {
        method: 'POST',
        body: { ids }
      })
      showToast('Quotations sent to Design department')
      loadQuotationRequests()
    } catch (error) {
      showToast(error.message)
    }
  }

  const closePoDetailDrawer = () => {
    setPoDetailDrawerOpen(false)
    setPoDetail(null)
    setPoDetailError('')
  }

  const handleViewCompany = company => {
    openDrawer('view', company)
  }

  const handleEditCompany = company => {
    openDrawer('edit', company)
  }

  const isCompanyActive = company => ((company?.status || 'ACTIVE') === 'ACTIVE')

  const contactFormDisabled = !contactCompany || !isCompanyActive(contactCompany)

  const fieldInputClass = 'w-full rounded  border border-slate-200/80 bg-white p-2  text-xs text-slate-900  focus:border-slate-900 focus:ring-2 focus:ring-slate-200 outline-none transition disabled:bg-slate-100 disabled:text-slate-400'

  const formatCurrency = value => currencyFormatter.format(Number(value) || 0)

  const drawerTitle = drawerMode === 'edit' ? 'Edit Company' : drawerMode === 'view' ? 'Company Details' : 'Add New Company'
  const primaryButtonLabel = drawerMode === 'edit' ? 'Update Company' : 'Save Company'
  const isReadOnly = drawerMode === 'view'

  const iconMap = {
    'building': Building2,
    'clipboard': ClipboardList,
    'document': FileText,
    'package': Package,
    'palette': Palette,
    'pencil': PencilLine,
    'factory': Factory,
    'settings': Settings,
    'chart': BarChart3,
    'check': CheckCircle,
    'handshake': Handshake,
    'message': MessageSquare,
    'cart': ShoppingCart,
    'inbox': Inbox,
    'book': Book,
    'scale': Scale,
    'trending': TrendingUp,
    'search': Search,
    'checkmark': Check,
    'close': XCircle,
    'files': Files,
    'refresh': RotateCw,
    'truck': Truck,
    'dashboard': LayoutDashboard,
    'users': Users,
    'file-search': FileSearch,
    'file-check': FileCheck,
    'layers': Layers,
    'box': Box,
    'list-tree': ListTree,
    'settings-2': Settings2,
    'spreadsheet': FileSpreadsheet,
    'package-search': PackageSearch,
    'calendar': Calendar,
    'wrench': Wrench,
    'signature': FileSignature,
    'cpu': Cpu,
    'activity': Activity,
    'file-question': FileQuestion,
    'shopping-bag': ShoppingBag,
    'clipboard-plus': ClipboardPlus,
    'clipboard-check': ClipboardCheck,
    'move': Move,
    'book-open': BookOpen,
    'warehouse': Warehouse,
    'shield-check': ShieldCheck,
    'log-in': LogIn,
    'file-bar-chart': FileBarChart,
    'receipt': Receipt,
    'credit-card': CreditCard,
    'history': History,
    'check-circle': CheckCircle2,
    'contact': Contact2,
    'monitor': Monitor
  }

  const allNavigationItems = [
    { label: 'GENERAL', isGroup: true, groupId: 'general-group' },
    { label: 'Dashboard', moduleId: 'dashboard', icon: 'dashboard', indent: true, prefix: sidebarDept ? `/${DEPARTMENT_PREFIXES[sidebarDept]}` : '' },
    { label: 'Project Analysis', moduleId: 'project-analysis', icon: 'chart', indent: true, prefix: '/admin' },
    { label: 'Material Consumption', moduleId: 'material-consumption', icon: 'layers', indent: true, prefix: '/admin' },
    { label: 'Machine Analysis', moduleId: 'machine-analysis', icon: 'monitor', indent: true, prefix: '/admin' },
    { label: 'OEE Analysis', moduleId: 'oee-analysis', icon: 'activity', indent: true, prefix: '/admin' },
    { label: 'Active Clients', moduleId: 'active-clients', icon: 'users', indent: true, deptCode: 'ADMIN', prefix: '/admin' },
    { label: 'Suppliers', moduleId: 'suppliers', icon: 'truck', indent: true, deptCode: 'ADMIN', prefix: '/admin' },
    { label: 'Company Master', moduleId: 'admin-company-master', icon: 'building', indent: true, deptCode: 'ADMIN', prefix: '/admin' },
    { label: 'Company Master', moduleId: 'company-master', icon: 'building', indent: true, prefix: sidebarDept ? `/${DEPARTMENT_PREFIXES[sidebarDept]}` : '' },
    { label: 'Client Contacts', moduleId: 'client-contacts', icon: 'users', indent: true, prefix: sidebarDept ? `/${DEPARTMENT_PREFIXES[sidebarDept]}` : '' },

    { label: 'SALES', isGroup: true, groupId: 'sales-group' },
    { label: 'Customer Drawings', moduleId: 'customer-drawing', icon: 'file-search', indent: true, prefix: '/sales' },
    { label: 'Sales Quotations', moduleId: 'client-quotations', icon: 'document', indent: true, prefix: '/sales' },
    { label: 'Customer PO', moduleId: 'customer-po', icon: 'file-check', indent: true, prefix: '/sales' },
    { label: 'Sales Order', moduleId: 'sales-order', icon: 'shopping-bag', indent: true, prefix: '/sales' },
    { label: 'Sales Report', moduleId: 'sales-report', icon: 'file-bar-chart', indent: true, deptCode: 'SALES', prefix: '/sales' },

    { label: 'DESIGN & ENG', isGroup: true, groupId: 'design-group' },
    { label: 'Drawing Master', moduleId: 'drawing-master', icon: 'layers', indent: true, prefix: '/design' },
    { label: 'Items Master', moduleId: 'item-master', icon: 'box', indent: true, prefix: '/design' },
    { label: 'Part Details', moduleId: 'bom-creation', icon: 'list-tree', indent: true, prefix: '/design' },
    { label: 'Routing / Operations', moduleId: 'routing-operations', icon: 'settings-2', indent: true, prefix: '/design' },
    { label: 'Process Sheet', moduleId: 'process-sheet', icon: 'spreadsheet', indent: true, prefix: '/design' },

    { label: 'PRODUCTION', isGroup: true, groupId: 'production-group' },
    { label: 'Project Requests', moduleId: 'project-requests', icon: 'clipboard', indent: true, prefix: '/production' },
    { label: 'Material Requirements', moduleId: 'material-requirements', icon: 'package-search', indent: true, prefix: '/production' },
    { label: 'Production Plan', moduleId: 'production-plan', icon: 'calendar', indent: true, prefix: '/production' },
    { label: 'Work Order', moduleId: 'work-order', icon: 'wrench', indent: true, prefix: '/production' },
    { label: 'Job Card', moduleId: 'job-card', icon: 'signature', indent: true, prefix: '/production' },
    { label: 'Subcontract Challans', moduleId: 'sub-contract-challans', icon: 'truck', indent: true, prefix: '/production' },
    { label: 'Workstations', moduleId: 'workstation-master', icon: 'cpu', indent: true, prefix: '/production' },
    { label: 'Operations', moduleId: 'operation-master', icon: 'activity', indent: true, prefix: '/production' },
    { label: 'Production Report', moduleId: 'production-report', icon: 'file-bar-chart', indent: true, deptCode: 'PRODUCTION', prefix: '/production' },

    { label: 'PROCUREMENT', isGroup: true, groupId: 'procurement-group' },
    { label: 'Purchase RFQs', moduleId: 'quotations', icon: 'file-question', indent: true, prefix: '/procurement' },
    { label: 'Purchase Orders', moduleId: 'purchase-orders', icon: 'shopping-bag', indent: true, prefix: '/procurement' },
    { label: 'Goods Receipt (PO)', moduleId: 'po-receipts', icon: 'inbox', indent: true, prefix: '/procurement' },
    { label: 'Suppliers', moduleId: 'suppliers', icon: 'truck', indent: true, deptCode: 'PROCUREMENT', prefix: '/procurement' },
    { label: 'Procurement Report', moduleId: 'procurement-report', icon: 'file-bar-chart', indent: true, deptCode: 'PROCUREMENT', prefix: '/procurement' },

    { label: 'INVENTORY', isGroup: true, groupId: 'inventory-group' },
    { label: 'Material Requests', moduleId: 'po-material-request', icon: 'clipboard-plus', indent: true, prefix: '/inventory' },
    { label: 'GRN Management', moduleId: 'grn', icon: 'clipboard-check', indent: true, prefix: '/inventory' },
    { label: 'Stock Entries', moduleId: 'stock-entries', icon: 'move', indent: true, prefix: '/inventory' },
    { label: 'Stock Balance', moduleId: 'stock-balance', icon: 'scale', indent: true, prefix: '/inventory' },
    { label: 'Stock Ledger', moduleId: 'stock-ledger', icon: 'book-open', indent: true, prefix: '/inventory' },
    { label: 'Warehouses', moduleId: 'warehouses', icon: 'warehouse', indent: true, prefix: '/inventory' },
    { label: 'Suppliers', moduleId: 'suppliers', icon: 'truck', indent: true, deptCode: 'INVENTORY', prefix: '/inventory' },
    { label: 'Inventory Report', moduleId: 'inventory-report', icon: 'file-bar-chart', indent: true, deptCode: 'INVENTORY', prefix: '/inventory' },

    { label: 'QUALITY', isGroup: true, groupId: 'quality-group' },
    { label: 'QC Inspection', moduleId: 'quality-rejection-entry', icon: 'shield-check', indent: true, prefix: '/quality' },
    { label: 'Incoming QC', moduleId: 'incoming-qc', icon: 'log-in', indent: true, prefix: '/quality' },
    { label: 'Rejections', moduleId: 'quality-rejections', icon: 'close', indent: true, prefix: '/quality' },
    { label: 'QC Reports', moduleId: 'quality-reports', icon: 'file-bar-chart', indent: true, prefix: '/quality' },

    { label: 'ACCOUNTS', isGroup: true, groupId: 'accounts-main-group' },
    {
      label: 'Vendor Payables',
      isSubMenu: true,
      icon: 'credit-card',
      children: [
        { label: 'Vendor Invoices', moduleId: 'payment-processing', icon: 'receipt', prefix: '/accounts' },
        { label: 'Payment History', moduleId: 'payment-history', icon: 'history', prefix: '/accounts' }
      ]
    },
    {
      label: 'Customer Receivables',
      isSubMenu: true,
      icon: 'check-circle',
      children: [
        { label: 'Customer Invoices', moduleId: 'payment-received', icon: 'receipt', prefix: '/accounts' },
        { label: 'Payment History', moduleId: 'customer-payment-history', icon: 'contact', prefix: '/accounts' }
      ]
    },
    { label: 'Accounts Report', moduleId: 'accounts-report', icon: 'file-bar-chart', indent: true, deptCode: 'ACCOUNTS', prefix: '/accounts' },

    { label: 'SHIPMENT', isGroup: true, groupId: 'shipment-group' },
    { label: 'Shipment Orders', moduleId: 'shipment-orders', icon: 'package', indent: true, prefix: '/shipment' },
    { label: 'Shipment Planning', moduleId: 'shipment-planning', icon: 'calendar', indent: true, prefix: '/shipment' },
    { label: 'Dispatch Management', moduleId: 'dispatch-management', icon: 'settings', indent: true, prefix: '/shipment' },
    { label: 'Delivery Challan', moduleId: 'delivery-challan', icon: 'document', indent: true, prefix: '/shipment' },
    { label: 'Shipment Tracking', moduleId: 'shipment-tracking', icon: 'search', indent: true, prefix: '/shipment' },
    { label: 'Shipment Returns', moduleId: 'shipment-returns', icon: 'refresh', indent: true, prefix: '/shipment' },
    { label: 'Shipment Reports', moduleId: 'shipment-reports', icon: 'files', indent: true, prefix: '/shipment' }
  ]

  const isGroupAllowedForDept = (groupId, deptCode) => {
    if (groupId === 'general-group') return true
    if (!deptCode) return false
    
    const mapping = {
      SALES: 'sales-group',
      DESIGN_ENG: 'design-group',
      PRODUCTION: 'production-group',
      PROCUREMENT: 'procurement-group',
      INVENTORY: 'inventory-group',
      QUALITY: 'quality-group',
      ACCOUNTS: 'accounts-main-group',
      SHIPMENT: 'shipment-group'
    }
    
    return mapping[deptCode] === groupId
  }

  useEffect(() => {
    if (activeModule) {
      const parentSubMenu = allNavigationItems.find(item => 
        item.isSubMenu && item.children?.some(child => child.moduleId === activeModule)
      );
      if (parentSubMenu) {
        setOpenSubMenus(prev => ({ ...prev, [parentSubMenu.label]: true }));
      }
    }
  }, [activeModule]);

  const navigationItems = useMemo(() => {
    if (!allowedModules) return []

    const isAdmin = user?.department_code === 'ADMIN'

    const processedItems = allNavigationItems.map((item, index) => {
      let parentGroup = null
      if (item.isGroup) {
        parentGroup = item
      } else {
        for (let i = index; i >= 0; i--) {
          if (allNavigationItems[i].isGroup) {
            parentGroup = allNavigationItems[i]
            break
          }
        }
      }

      if (parentGroup) {
        const isGroupAllowed = parentGroup.groupId === 'general-group' || 
                               (sidebarDept && isGroupAllowedForDept(parentGroup.groupId, sidebarDept))
        if (!isGroupAllowed) {
          return null
        }
      }

      if (item.isGroup) {
        return item
      }

      if (item.isSubMenu) {
        const filteredChildren = item.children.filter(child => {
          const isAllowedModule = !child.moduleId || allowedModules.includes(child.moduleId)
          let isCorrectDept = !child.deptCode || isAdmin || user?.department_code === child.deptCode
          
          if (isAdmin) {
            if (
              child.moduleId === 'operation-master' || 
              child.moduleId === 'payment-history' ||
              child.moduleId === 'customer-payment-history'
            ) {
              isCorrectDept = false
            }
            if (child.moduleId === 'suppliers' && child.deptCode !== 'ADMIN') {
              isCorrectDept = false
            }
          }
          return isAllowedModule && isCorrectDept
        })

        if (filteredChildren.length === 0) {
          return null
        }

        return {
          ...item,
          children: filteredChildren
        }
      }

      const isAllowedModule = !item.moduleId || allowedModules.includes(item.moduleId)
      let isCorrectDept = !item.deptCode || isAdmin || user?.department_code === item.deptCode
      
      if (isAdmin) {
        if (
          item.moduleId === 'operation-master' || 
          item.moduleId === 'payment-history' ||
          item.moduleId === 'customer-payment-history'
        ) {
          isCorrectDept = false
        }
        if (item.moduleId === 'suppliers' && item.deptCode !== 'ADMIN') {
          isCorrectDept = false
        }
      }

      return isAllowedModule && isCorrectDept ? item : null
    }).filter(Boolean)

    return processedItems.filter((item, index) => {
      if (item.isGroup) {
        const nextGroupIndex = processedItems.findIndex((it, i) => i > index && it.isGroup)
        const groupItems = processedItems.slice(index + 1, nextGroupIndex === -1 ? undefined : nextGroupIndex)
        return groupItems.length > 0
      }
      return true
    })
  }, [allowedModules, allNavigationItems, user, sidebarDept])

  const poDetailItems = Array.isArray(poDetail?.items) ? poDetail.items : []
  const poDetailPdfUrl = poDetail?.pdf_path ? getPoPdfUrl(poDetail.pdf_path) : null

  if (!token || !user) {
    return (
      <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 items-center justify-center p-2">
        <div className="w-full max-w-md">
          <div className="bg-white rounded  shadow-2xl p-2 space-y-2">
            <div className="text-center space-y-2">
              
              <h1 className="text-xl text-slate-900">SPTECHPIONEER</h1>
              <p className="text-xs text-slate-500">Sales & Operations ERP</p>
            </div>

            <div className="flex gap-2 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`flex-1 pb-3 text-xs  transition ${
                  authMode === 'login'
                    ? 'text-slate-900 border-b-2 border-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('signup'); loadDepartmentsAndRoles() }}
                className={`flex-1 pb-3 text-xs  transition ${
                  authMode === 'signup'
                    ? 'text-slate-900 border-b-2 border-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Sign Up
              </button>
            </div>

            {authMode === 'login' ? (
              <form onSubmit={handleLogin} className="grid my-5 grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs  text-slate-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="your.email@company.com"
                    className="w-full p-2  rounded  border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    disabled={loginLoading}
                  />
                </div>
                <div className=''>
                  <label className="block text-xs  text-slate-700 mb-2">Password</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-2  rounded  border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    disabled={loginLoading}
                  />
                </div>
                <Button
                  type="submit"
                  variant="rosey"
                  loading={loginLoading}
                  className="w-full col-span-2"
                >
                  Sign In
                </Button >
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-3 max-h-96 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs  text-slate-700 mb-1">First Name</label>
                    <input
                      type="text"
                      value={signupForm.first_name}
                      onChange={e => setSignupForm({ ...signupForm, first_name: e.target.value })}
                      placeholder="John"
                      className="w-full p-2 rounded  text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      disabled={signupLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-xs  text-slate-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={signupForm.last_name}
                      onChange={e => setSignupForm({ ...signupForm, last_name: e.target.value })}
                      placeholder="Doe"
                      className="w-full p-2 rounded  text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      disabled={signupLoading}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs  text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={signupForm.email}
                    onChange={e => setSignupForm({ ...signupForm, email: e.target.value })}
                    placeholder="john@company.com"
                    className="w-full p-2 rounded  text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    disabled={signupLoading}
                  />
                </div>
                <div>
                  <label className="block text-xs  text-slate-700 mb-1">Department</label>
                  <select
                    value={signupForm.department_id}
                    onChange={e => {
                      const deptId = e.target.value
                      setSignupForm({ ...signupForm, department_id: deptId, role_id: '' })
                      if (deptId) {
                        fetch(`${API_BASE}/departments/${deptId}/roles`)
                          .then(res => res.ok ? res.json() : [])
                          .then(rolesData => setRoles(Array.isArray(rolesData) ? rolesData : []))
                          .catch(() => setRoles([]))
                      } else {
                        setRoles([])
                      }
                    }}
                    className="w-full p-2 rounded  text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    disabled={signupLoading}
                  >
                    <option value="">Select Department</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs  text-slate-700 mb-1">Role</label>
                  <select
                    value={signupForm.role_id}
                    onChange={e => setSignupForm({ ...signupForm, role_id: e.target.value })}
                    className="w-full p-2 rounded  text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    disabled={signupLoading || !signupForm.department_id}
                  >
                    <option value="">Select Role</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs  text-slate-700 mb-1">Password</label>
                    <input
                      type="password"
                      value={signupForm.password}
                      onChange={e => setSignupForm({ ...signupForm, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full p-2 rounded  text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      disabled={signupLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-xs  text-slate-700 mb-1">Confirm</label>
                    <input
                      type="password"
                      value={signupForm.confirmPassword}
                      onChange={e => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                      placeholder="••••••••"
                      className="w-full p-2 rounded  text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      disabled={signupLoading}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  loading={signupLoading}
                  className="w-full"
                >
                  Sign Up
                </Button>
              </form>
            )}

            {toast && (
              <div className={`p-2 rounded  border text-xs ${
                toast.includes('success') || toast.includes('Welcome')
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {toast}
              </div>
            )}

            {authMode === 'login' && (
              <div className="text-left text-xs text-slate-500 space-y-2 border-t border-slate-200 pt-4 mt-4">
                <p className="">Demo Credentials:</p>
                <div className="grid grid-cols-3 gap-2 text-left bg-slate-50 p-2 rounded  overflow-y-auto max-h-64">
                  <button 
                    onClick={() => performLogin('admin@company.com', 'Admin@123')}
                    className="p-2 border border-slate-200 rounded hover:bg-white hover:border-slate-300 transition group text-left"
                  >
                    <p className=" text-slate-700 group-hover:text-blue-600">Admin</p>
                    <p className="opacity-70">Full Access</p>
                  </button>
                  <button 
                    onClick={() => performLogin('sales@company.com', 'Sales@123')}
                    className="p-2 border border-slate-200 rounded hover:bg-white hover:border-slate-300 transition group text-left"
                  >
                    <p className=" text-slate-700 group-hover:text-blue-600">Sales</p>
                    <p className="opacity-70">Sales Module</p>
                  </button>
                  <button 
                    onClick={() => performLogin('design@company.com', 'Design@123')}
                    className="p-2 border border-slate-200 rounded hover:bg-white hover:border-slate-300 transition group text-left"
                  >
                    <p className=" text-slate-700 group-hover:text-blue-600">Design</p>
                    <p className="opacity-70">Orders & Files</p>
                  </button>
                  <button 
                    onClick={() => performLogin('procurement@company.com', 'Procurement@123')}
                    className="p-2 border border-slate-200 rounded hover:bg-white hover:border-slate-300 transition group text-left"
                  >
                    <p className=" text-slate-700 group-hover:text-blue-600">Procurement</p>
                    <p className="opacity-70">PO & Vendors</p>
                  </button>
                  <button 
                    onClick={() => performLogin('production@company.com', 'Production@123')}
                    className="p-2 border border-slate-200 rounded hover:bg-white hover:border-slate-300 transition group text-left"
                  >
                    <p className=" text-slate-700 group-hover:text-blue-600">Production</p>
                    <p className="opacity-70">Inventory & GRN</p>
                  </button>
                  <button 
                    onClick={() => performLogin('quality@company.com', 'Quality@123')}
                    className="p-2 border border-slate-200 rounded hover:bg-white hover:border-slate-300 transition group text-left"
                  >
                    <p className=" text-slate-700 group-hover:text-blue-600">Quality</p>
                    <p className="opacity-70">QC & Inspection</p>
                  </button>
                  <button 
                    onClick={() => performLogin('shipment@company.com', 'Shipment@123')}
                    className="p-2 border border-slate-200 rounded hover:bg-white hover:border-slate-300 transition group text-left"
                  >
                    <p className=" text-slate-700 group-hover:text-blue-600">Shipment</p>
                    <p className="opacity-70">Dispatch</p>
                  </button>
                  <button 
                    onClick={() => performLogin('accounts@company.com', 'Accounts@123')}
                    className="p-2 border border-slate-200 rounded hover:bg-white hover:border-slate-300 transition group text-left"
                  >
                    <p className=" text-slate-700 group-hover:text-blue-600">Accounts</p>
                    <p className="opacity-70">Billing</p>
                  </button>
                  <button 
                    onClick={() => performLogin('inventory@company.com', 'Inventory@123')}
                    className="p-2 border border-slate-200 rounded hover:bg-white hover:border-slate-300 transition group text-left"
                  >
                    <p className=" text-slate-700 group-hover:text-blue-600">Inventory</p>
                    <p className="opacity-70">Stock</p>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }


  return (
    <>
      <div className="flex h-screen overflow-hidden bg-gray-50 text-slate-900">
        <aside className={`fixed lg:flex inset-y-0 left-0 w-64 bg-white text-slate-600 flex-col transition-all lg:transition-none z-50 border-r border-slate-200/60 shadow-sm ${
          mobileMenuOpen ? 'flex' : 'hidden'
        } lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3.5 flex-1 overflow-hidden">
                <div className="h-9 w-9 rounded bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/20 flex-shrink-0 transition-transform duration-300">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm  text-slate-900  leading-none">ILLUMIUM</p>
                  <p className="text-[9px] text-rose-500   tracking-[0.15em] mt-1.5 truncate">{sidebarDept || 'ERP System'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="lg:hidden p-2 hover:bg-slate-100 rounded transition-colors text-slate-400"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1.5 custom-scrollbar">
              {navigationItems.map((item, index) => {
                if (item.isGroup) {
                  return (
                    <div key={`group-${item.groupId || item.label}-${index}`} className="p-2">
                      <p className="text-xs   text-slate-400  ">{item.label}</p>
                    </div>
                  )
                }

                if (item.isSubMenu) {
                  const isOpen = !!openSubMenus[item.label]
                  const hasActiveChild = item.children?.some(child => {
                    return activeModule === child.moduleId || 
                           (child.moduleId === 'bom-creation' && activeModule === 'bom-form') || 
                           (child.moduleId === 'client-quotations' && activeModule === 'quotation-form') ||
                           (child.moduleId === 'production-report' && activeModule === 'work-order-details')
                  })
                  
                  return (
                    <div key={`submenu-${item.label}-${index}`} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenSubMenus(prev => ({
                            ...prev,
                            [item.label]: !prev[item.label]
                          }))
                        }}
                        className={`flex items-center gap-3 w-full p-2 rounded text-xs transition-all duration-200 group relative ${
                          hasActiveChild 
                            ? 'text-rose-600 bg-rose-50/10 font-medium' 
                            : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50/30'
                        }`}
                      >
                        {iconMap[item.icon] && (() => {
                          const IconComponent = iconMap[item.icon]
                          return (
                            <IconComponent 
                              className={`w-[18px] h-[18px] flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                                hasActiveChild ? 'text-rose-600' : 'text-slate-400 group-hover:text-rose-500'
                              }`} 
                            />
                          )
                        })()}
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        {isOpen ? (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-500" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-500" />
                        )}
                      </button>
                      
                      {isOpen && (
                        <div className="pl-6 space-y-1 border-l border-slate-100 ml-4">
                          {item.children.map((child, childIdx) => {
                            const isChildActive = activeModule === child.moduleId || 
                                                  (child.moduleId === 'bom-creation' && activeModule === 'bom-form') || 
                                                  (child.moduleId === 'client-quotations' && activeModule === 'quotation-form') ||
                                                  (child.moduleId === 'production-report' && activeModule === 'work-order-details')
                            const isChildDisabled = !child.moduleId
                            
                            return (
                              <button
                                key={`subchild-${child.moduleId || 'item'}-${childIdx}`}
                                type="button"
                                onClick={() => {
                                  if (child.moduleId) {
                                    const pathPrefix = child.prefix || ''
                                    navigate(`${pathPrefix}/${child.moduleId}`)
                                    setMobileMenuOpen(false)
                                  }
                                }}
                                className={`flex items-center gap-3 w-full p-2 rounded text-xs transition-all duration-200 group relative ${
                                  isChildActive 
                                    ? 'bg-rose-50 text-rose-600 shadow-sm' 
                                    : isChildDisabled 
                                    ? 'text-slate-300 cursor-not-allowed' 
                                    : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50/30'
                                }`}
                                disabled={isChildDisabled}
                              >
                                {iconMap[child.icon] && (() => {
                                  const IconComponent = iconMap[child.icon]
                                  return (
                                    <IconComponent 
                                      className={`w-[16px] h-[16px] flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                                        isChildActive ? 'text-rose-600' : 'text-slate-400 group-hover:text-rose-500'
                                      }`} 
                                    />
                                  )
                                })()}
                                <span className="flex-1 text-left truncate">{child.label}</span>
                                {isChildActive && (
                                  <div className="absolute right-2 w-1.5 h-1.5 rounded bg-rose-500" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                }

                const isActive = item.moduleId ? (
                  activeModule === item.moduleId || 
                  (item.moduleId === 'bom-creation' && activeModule === 'bom-form') || 
                  (item.moduleId === 'client-quotations' && activeModule === 'quotation-form') ||
                  (item.moduleId === 'production-report' && activeModule === 'work-order-details')
                ) : Boolean(item.active)
                const isDisabled = item.isGroup || !item.moduleId
                
                return (
                  <button
                    key={`${item.moduleId || 'item'}-${item.label}-${index}`}
                    type="button"
                    onClick={() => {
                      if (item.moduleId) {
                        const pathPrefix = item.prefix || ''
                        navigate(`${pathPrefix}/${item.moduleId}`)
                        setMobileMenuOpen(false)
                      }
                    }}
                    className={`flex items-center gap-3 w-full p-2 rounded text-xs  transition-all duration-200 group relative ${
                      isActive 
                        ? 'bg-rose-50 text-rose-600 shadow-sm' 
                        : isDisabled 
                        ? 'text-slate-300 cursor-not-allowed' 
                        : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50/30'
                    }`}
                    disabled={isDisabled}
                  >
                    {iconMap[item.icon] && (() => {
                      const IconComponent = iconMap[item.icon]
                      return (
                        <IconComponent 
                          className={`w-[18px] h-[18px] flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                            isActive ? 'text-rose-600' : 'text-slate-400 group-hover:text-rose-500'
                          }`} 
                        />
                      )
                    })()}
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {isActive && (
                      <div className="absolute right-2 w-1.5 h-1.5 rounded bg-rose-500" />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="p-2 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 w-full p-2.5 rounded border border-slate-200 bg-white text-slate-500 text-xs  hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all duration-300"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </aside>

        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <div className={`flex-1 lg:ml-64 flex flex-col bg-slate-50 min-w-0`}>
          <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 print:hidden no-print">
              <div className="p-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                >
                  <Menu className="w-6 h-6" />
                </button>
                
                <div className="flex items-center gap-4 ml-auto">
                  <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
                    <div className="text-right">
                      <p className="text-xs text-slate-900  leading-none">{user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.first_name || user?.username || 'User'}</p>
                      <p className="text-xs  text-slate-500 mt-0.5">{user?.role_name || user?.department_name || 'User'}</p>
                    </div>
                    <div className="h-6 w-6 rounded bg-rose-500 flex items-center justify-center text-white text-xs  ">
                      {(user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase()}
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all duration-200 group relative"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

          <div className="flex-1 p-4 min-w-0 overflow-y-auto custom-scrollbar">
            {activeModule === 'po-receipt-details' ? (
              <POReceiptDetails />
            ) : activeModule === 'sales-report-details' ? (
              <SalesReportDetails />
            ) : activeModule === 'work-order-details' ? (
              <WorkOrderDetail />
            ) : activeModule === 'grn-po-details' ? (
              <GRNPOdetails />
            ) : activeModule === 'qc-grn-details' ? (
              <QCGrnDetails />
            ) : activeModule === 'transaction-details' ? (
              <TransactionDetails />
            ) : activeModule === 'stock-details' ? (
              <StockDetails />
            ) : (activeModule === 'unauthorized' || (!allowedModules.includes(activeModule) && user.department_code !== 'ADMIN')) ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <XCircle className="w-16 h-16 mb-4 text-rose-500" />
                <h2 className="text-xl font-semibold text-slate-900">Access Denied</h2>
                <p>You don't have permission to access this module.</p>
              </div>
            ) : (
              <>
                {toast && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-2  rounded  text-xs ">
                    {toast}
                  </div>
                )}

                {activeModule === 'dashboard' && (
                  <MainDashboard apiRequest={apiRequest} />
                )}

                {activeModule === 'admin-dashboard' && (
                  <AdminDashboard />
                )}

                {activeModule === 'project-analysis' && (
                  <ProjectAnalysis />
                )}

                {activeModule === 'sales-report' && (
                  <SalesReport />
                )}

                {activeModule === 'approved-quotations' && (
                  <ApprovedQuotations />
                )}

                {activeModule === 'active-clients' && (
                  <ActiveClients />
                )}

                {activeModule === 'procurement-report' && (
                  <ProcurementReport />
                )}

                {activeModule === 'production-report' && (
                  <ProductionReport />
                )}

                {activeModule === 'inventory-report' && (
                  <InventoryReport />
                )}

                {activeModule === 'accounts-report' && (
                  <AccountsReport />
                )}

                {activeModule === 'material-consumption' && (
                  <MaterialConsumption />
                )}

                {activeModule === 'oee-analysis' && (
                  <OEEAnalysis />
                )}

                {activeModule === 'machine-analysis' && (
                  <MachineAnalysis />
                )}

                {activeModule === 'sales-dashboard' && (
                  <SalesDashboard />
                )}

                {activeModule === 'design-dashboard' && (
                  <DesignDashboard />
                )}

                {activeModule === 'production-dashboard' && (
                  <ProductionDashboard />
                )}

                {activeModule === 'procurement-dashboard' && (
                  <ProcurementDashboard />
                )}

                {activeModule === 'item-master' && (
                  <ItemsMaster />
                )}

                {activeModule === 'company-master' && (
                  <CompanyMaster
                    companies={companies}
                    showCreatePanel={showCreatePanel}
                    onToggleCreatePanel={toggleCreatePanel}
                    onInlineSubmit={handleInlineCreateSubmit}
                    loading={loading}
                    companyForm={companyForm}
                    setCompanyForm={setCompanyForm}
                    updateAddress={updateAddress}
                    fieldInputClass={fieldInputClass}
                    onViewCompany={handleViewCompany}
                    onEditCompany={handleEditCompany}
                    onDeleteCompany={handleDeleteCompany}
                  />
                )}

                {activeModule === 'admin-company-master' && (
                  <AdminCompanyMaster />
                )}

                {activeModule === 'client-contacts' && (
                  <ClientContacts companies={companies} onOpenContactDrawer={openContactDrawer} />
                )}

                {activeModule === 'customer-po' && (
                  <CustomerPO
                    formatCurrency={formatCurrency}
                    customerPos={customerPos}
                    customerPosLoading={customerPosLoading}
                    companies={companies}
                    apiRequest={apiRequest}
                    showToast={showToast}
                    onRefresh={loadCustomerPos}
                    quotationRequests={quotationRequests}
                    quotationRequestsLoading={quotationRequestsLoading}
                  />
                )}

                {activeModule === 'sales-order' && (
                  <SalesOrders />
                )}

                {activeModule === 'incoming-orders' && (
                  <IncomingOrders
                    userDepartment={user?.department_code || 'DESIGN_ENG'}
                    loading={false}
                  />
                )}

                {activeModule === 'vendor-management' && (
                  <VendorManagement />
                )}

                {activeModule === 'suppliers' && (
                  <Suppliers />
                )}

                {activeModule === 'quotations' && (
                  <Quotations />
                )}

                {activeModule === 'purchase-orders' && (
                  <PurchaseOrders />
                )}

                {activeModule === 'po-receipts' && (
                  <POReceipts />
                )}

                {activeModule === 'inventory-dashboard' && (
                  <InventoryDashboard />
                )}

                {activeModule === 'quality-dashboard' && (
                  <QualityDashboard />
                )}

                {activeModule === 'incoming-qc' && (
                  <IncomingQC />
                )}

                {activeModule === 'quality-rejections' && (
                  <QualityRejections />
                )}

                {activeModule === 'quality-reports' && (
                  <QualityReports />
                )}

                {activeModule === 'quality-rejection-entry' && (
                  <QualityRejectionEntry />
                )}

                {activeModule === 'accounts-dashboard' && (
                  <AccountsDashboard />
                )}
                {activeModule === 'vendor-inward-challans' && (
                  <VendorInwardChallans />
                )}

                {activeModule === 'invoice-received' && (
                  <VendorInvoices />
                )}

                {activeModule === 'payment-processing' && (
                  <PaymentProcessing />
                )}

                {activeModule === 'payment-received' && (
                  <PaymentReceived />
                )}

                {activeModule === 'payment-history' && (
                  <PaymentHistory />
                )}

                {activeModule === 'customer-payment-history' && (
                  <CustomerPaymentHistory />
                )}

                {activeModule === 'po-material-request' && (
                  <POMaterialRequest />
                )}

                {activeModule === 'grn' && (
                  <GRNProcessing />
                )}

                {activeModule === 'qc-inspections' && (
                  <QCInspections />
                )}

                {activeModule === 'stock-ledger' && (
                  <StockLedger />
                )}

                {activeModule === 'stock-balance' && (
                  <StockBalance />
                )}


                {activeModule === 'warehouses' && (
                  <Warehouses />
                )}

                {activeModule === 'design-orders' && (
                  <DesignOrders />
                )}

                {activeModule === 'client-quotations' && (
                  <ClientQuotations />
                )}

                {activeModule === 'quotation-form' && (
                  <QuotationFormPage />
                )}

                {activeModule === 'drawing-master' && (
                  <DrawingMaster />
                )}

                {activeModule === 'customer-drawing' && (
                  <CustomerDrawing />
                )}

                {activeModule === 'bom-creation' && (
                  <BOMCreation />
                )}

                {activeModule === 'routing-operations' && (
                  <RoutingOperations />
                )}

                {activeModule === 'process-sheet' && (
                  <ProcessSheet />
                )}

                {activeModule === 'bom-approval' && (
                  <BOMApproval />
                )}

                {activeModule === 'bom-form' && (
                  <BOMFormPage />
                )}

                {activeModule === 'workstation-master' && (
                  <WorkstationMaster showForm={showWorkstationForm} setShowForm={setShowWorkstationForm} />
                )}
                {activeModule === 'operation-master' && (
                  <OperationMaster showForm={showOperationForm} setShowForm={setShowOperationForm} />
                )}

                {activeModule === 'project-requests' && (
                  <ProjectRequests />
                )}

                {activeModule === 'material-requirements' && (
                  <MaterialRequirements />
                )}

                {activeModule === 'production-plan' && (
                  <ProductionPlan 
                    salesOrderId={location.state?.salesOrderId}
                  />
                )}

                {activeModule === 'work-order' && (
                  <WorkOrder />
                )}

                {activeModule === 'work-order-form' && (
                  <WorkOrderForm 
                    workOrderId={location.state?.workOrderId} 
                    salesOrderId={location.state?.salesOrderId}
                    salesOrderItemId={location.state?.salesOrderItemId}
                    onBack={() => navigate('/production/work-order')}
                    onSuccess={() => navigate('/production/work-order')}
                  />
                )}

                {activeModule === 'job-card' && (
                  <JobCard />
                )}

                {activeModule === 'sub-contract-challans' && (
                  <Challans />
                )}

                {activeModule === 'stock-entries' && (
                  <StockEntries />
                )}

                {activeModule === 'shipment-dashboard' && (
                  <ShipmentDashboard apiRequest={apiRequest} />
                )}

                {activeModule === 'shipment-orders' && (
                  <ShipmentOrders apiRequest={apiRequest} />
                )}

                {activeModule === 'shipment-planning' && (
                  <ShipmentPlanning apiRequest={apiRequest} />
                )}

                {activeModule === 'dispatch-management' && (
                  <DispatchManagement apiRequest={apiRequest} />
                )}

                {activeModule === 'delivery-challan' && (
                  <DeliveryChallan />
                )}

                {activeModule === 'shipment-tracking' && (
                  <Tracking apiRequest={apiRequest} />
                )}

                {activeModule === 'shipment-returns' && (
                  <ShipmentReturns apiRequest={apiRequest} />
                )}

                {activeModule === 'shipment-reports' && (
                  <ShipmentReports apiRequest={apiRequest} />
                )}

                {activeModule === 'shipment-details' && (
                  <ShipmentDetails />
                )}

                {activeModule === 'unauthorized' && (
                  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-white rounded shadow-sm border border-slate-100">
                    <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-4">
                      <ShieldCheck className="w-8 h-8 text-rose-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
                    <p className="text-slate-500 max-w-md mx-auto mb-6">
                      You do not have permission to access this department. Please contact your administrator if you believe this is an error.
                    </p>
                    <Button 
                      variant="primary" 
                      onClick={() => {
                        const prefix = DEPARTMENT_PREFIXES[user.department_code]?.toLowerCase() || '';
                        navigate(prefix ? `/${prefix}/dashboard` : '/dashboard');
                      }}
                    >
                      Back to My Dashboard
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {showDrawer && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-900/60" onClick={closeDrawer} />
          <div className="absolute inset-y-0 right-0 w-full max-w-3xl bg-white shadow-2xl flex flex-col">
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs  text-slate-400 ">{drawerMode === 'view' ? 'Overview' : 'Workflow'}</p>
                <h3 className="text-xl text-slate-900 text-xs">{drawerTitle}</h3>
              </div>
              <button type="button" onClick={closeDrawer} className="h-10 w-10 rounded  border border-slate-200 text-slate-500 hover:text-slate-900">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <form className="space-y-3" onSubmit={handleCompanySubmit}>
                <div className="grid md:grid-cols-2 gap-2">
                  <FormControl label="Company Name">
                    <input className={fieldInputClass} value={companyForm.companyName} onChange={e => setCompanyForm(prev => ({ ...prev, companyName: e.target.value }))} required disabled={isReadOnly} />
                  </FormControl>
                  <FormControl label="Company Type">
                    <select className={fieldInputClass} value={companyForm.customerType} onChange={e => setCompanyForm(prev => ({ ...prev, customerType: e.target.value }))} disabled={isReadOnly}>
                      <option value="REGULAR">Customer</option>
                      <option value="OEM">Vendor</option>
                      <option value="PROJECT">Both</option>
                    </select>
                  </FormControl>
                  <FormControl label="GSTIN">
                    <input className={`${fieldInputClass} `} value={companyForm.gstin} onChange={e => setCompanyForm(prev => ({ ...prev, gstin: e.target.value }))} required disabled={isReadOnly} />
                  </FormControl>
                  <FormControl label="PAN">
                    <input className={fieldInputClass} value={companyForm.pan} onChange={e => setCompanyForm(prev => ({ ...prev, pan: e.target.value }))} disabled={isReadOnly} />
                  </FormControl>
                  <FormControl label="CIN">
                    <input className={fieldInputClass} value={companyForm.cin} onChange={e => setCompanyForm(prev => ({ ...prev, cin: e.target.value }))} disabled={isReadOnly} />
                  </FormControl>
                  <FormControl label="Currency">
                    <select className={fieldInputClass} value={companyForm.currency} onChange={e => setCompanyForm(prev => ({ ...prev, currency: e.target.value }))} disabled={isReadOnly}>
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </FormControl>
                </div>

                <div className="grid md:grid-cols-3 gap-2">
                  <FormControl label="Payment Terms">
                    <input className={fieldInputClass} value={companyForm.paymentTerms} onChange={e => setCompanyForm(prev => ({ ...prev, paymentTerms: e.target.value }))} disabled={isReadOnly} />
                  </FormControl>
                  <FormControl label="Credit Days">
                    <input type="number" className={fieldInputClass} value={companyForm.creditDays} onChange={e => setCompanyForm(prev => ({ ...prev, creditDays: e.target.value }))} disabled={isReadOnly} />
                  </FormControl>
                  <FormControl label="Freight Terms">
                    <input className={fieldInputClass} value={companyForm.freightTerms} onChange={e => setCompanyForm(prev => ({ ...prev, freightTerms: e.target.value }))} disabled={isReadOnly} />
                  </FormControl>
                  <FormControl label="Packing & Forwarding">
                    <input className={fieldInputClass} value={companyForm.packingForwarding} onChange={e => setCompanyForm(prev => ({ ...prev, packingForwarding: e.target.value }))} disabled={isReadOnly} />
                  </FormControl>
                  <FormControl label="Insurance">
                    <input className={fieldInputClass} value={companyForm.insuranceTerms} onChange={e => setCompanyForm(prev => ({ ...prev, insuranceTerms: e.target.value }))} disabled={isReadOnly} />
                  </FormControl>
                </div>

                <div className="grid md:grid-cols-2 gap-2">
                  <div className="space-y-3">
                    <p className="text-[0.65rem]  tracking-[0.35em] text-slate-500 ">Billing Address</p>
                    {['line1', 'line2', 'city', 'state', 'pincode', 'country'].map(field => (
                      <input
                        key={`billing-${field}`}
                        placeholder={field.replace(/^[a-z]/, char => char.toUpperCase())}
                        className={fieldInputClass}
                        value={companyForm.billingAddress[field]}
                        onChange={e => updateAddress('billingAddress', field, e.target.value)}
                        disabled={isReadOnly}
                      />
                    ))}
                  </div>
                  <div className="space-y-3">
                    <p className="text-[0.65rem]  tracking-[0.35em] text-slate-500 ">Shipping Address</p>
                    {['line1', 'line2', 'city', 'state', 'pincode', 'country'].map(field => (
                      <input
                        key={`shipping-${field}`}
                        placeholder={field.replace(/^[a-z]/, char => char.toUpperCase())}
                        className={fieldInputClass}
                        value={companyForm.shippingAddress[field]}
                        onChange={e => updateAddress('shippingAddress', field, e.target.value)}
                        disabled={isReadOnly}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-6 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={closeDrawer}
                    className="p-2  rounded  border border-slate-200 text-xs  text-slate-600 hover:border-slate-300"
                  >
                    {drawerMode === 'view' ? 'Close' : 'Cancel'}
                  </button>
                  {drawerMode !== 'view' && (
                    <button
                      type="submit"
                      className="p-2 rounded  bg-indigo-500 text-white text-xs   hover:bg-indigo-600 disabled:opacity-60"
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : primaryButtonLabel}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {contactDrawerOpen && contactCompany && (
        <div className="fixed inset-0 z-30">
          <div className="absolute inset-0 bg-slate-900/60" onClick={closeContactDrawer} />
          <div className="absolute inset-y-0 right-0 w-full max-w-4xl bg-white shadow-2xl flex flex-col">
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs  text-slate-400 ">Client Contacts</p>
                <h3 className="text-xl text-slate-900 text-xs">{contactCompany.company_name}</h3>
                <p className="text-xs text-slate-500">{contactCompany.company_code}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={contactCompany.status} />
                <button
                  type="button"
                  onClick={closeContactDrawer}
                  className="h-10 w-10 rounded  border border-slate-200 text-slate-500 hover:text-slate-900"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
              <div className="">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs  text-slate-400 ">Directory</p>
                    <h4 className="text-md text-slate-900 text-xs">Existing Contacts</h4>
                  </div>
                  <button
                    type="button"
                    onClick={resetContactForm}
                    className="p-2  rounded  border border-slate-200 text-xs  text-slate-600 hover:border-slate-300 disabled:opacity-50"
                    disabled={contactFormDisabled}
                  >
                    New Contact
                  </button>
                </div>
                {contactListLoading ? (
                  <div className="p-6 text-left text-xs text-slate-500 border border-dashed border-slate-200 rounded ">Loading contacts...</div>
                ) : contactList.length ? (
                  <div className="space-y-3">
                    {contactList.map(contact => (
                      <div key={contact.id} className="border border-slate-200 rounded  bg-white p-2 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-base text-slate-900 text-xs">{contact.name || 'Untitled Contact'}</p>
                            <p className="text-xs text-slate-500">{contact.designation || '—'}</p>
                            <p className="text-[0.6rem]  tracking-[0.35em]  text-slate-400 mt-2">
                              {contact.contact_type || contact.contactType || 'PRIMARY'}
                            </p>
                          </div>
                          <StatusBadge status={contact.status} />
                        </div>
                        <div className="grid gap-1 text-xs text-slate-600">
                          <p>Email: {contact.email || '—'}</p>
                          <p>Phone: {contact.phone || '—'}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                          <button
                            type="button"
                            className="p-2 .5 rounded  border border-rose-200 text-xs  text-rose-600 hover:border-rose-300 disabled:opacity-50"
                            onClick={() => handleEditContact(contact)}
                            disabled={contactFormDisabled}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="p-2 .5 rounded  border border-amber-200 text-xs  text-amber-600 hover:border-amber-300 disabled:opacity-50"
                            onClick={() => handleContactStatusToggle(contact)}
                            disabled={!isCompanyActive(contactCompany)}
                          >
                            {getContactStatusActionLabel(contact.status)}
                          </button>
                          <button
                            type="button"
                            className="p-2 .5 rounded  border border-rose-200 text-xs  text-rose-600 hover:border-rose-300 disabled:opacity-50"
                            onClick={() => handleDeleteContact(contact)}
                            disabled={!isCompanyActive(contactCompany)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center border border-dashed border-slate-200 rounded  text-xs text-slate-500">
                    No contacts found. Use the form to create one.
                  </div>
                )}
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-5 space-y-5">
                <div>
                  <p className="text-xs  text-slate-400 ">{editingContactId ? 'Update Contact' : 'Add Contact'}</p>
                  <h4 className="text-xl text-slate-900 text-xs">{editingContactId ? 'Edit Existing Contact' : 'Create New Contact'}</h4>
                </div>
                {!isCompanyActive(contactCompany) && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 p-2  rounded  text-xs">
                    Activate this company to manage contacts.
                  </div>
                )}
                <form className="" onSubmit={handleContactSubmit}>
                  <div className="space-y-2">
                    <label className="text-[0.65rem]  tracking-[0.35em] text-slate-500 ">Name</label>
                    <input
                      className={fieldInputClass}
                      value={contactForm.name}
                      onChange={e => handleContactFormChange('name', e.target.value)}
                      placeholder="Contact name"
                      disabled={contactFormDisabled}
                      required
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-2">
                    <label className="flex flex-col gap-2 text-[0.65rem]  tracking-[0.35em] text-slate-500 ">
                      <span>Designation</span>
                      <input
                        className={fieldInputClass}
                        value={contactForm.designation}
                        onChange={e => handleContactFormChange('designation', e.target.value)}
                        placeholder="Designation"
                        disabled={contactFormDisabled}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[0.65rem]  tracking-[0.35em] text-slate-500 ">
                      <span>Contact Type</span>
                      <select
                        className={fieldInputClass}
                        value={contactForm.contactType}
                        onChange={e => handleContactFormChange('contactType', e.target.value)}
                        disabled={contactFormDisabled}
                      >
                        {contactTypeOptions.map(option => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid md:grid-cols-2 gap-2">
                    <label className="flex flex-col gap-2 text-[0.65rem]  tracking-[0.35em] text-slate-500 ">
                      <span>Email</span>
                      <input
                        type="email"
                        className={fieldInputClass}
                        value={contactForm.email}
                        onChange={e => handleContactFormChange('email', e.target.value)}
                        placeholder="email@company.com"
                        disabled={contactFormDisabled}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[0.65rem]  tracking-[0.35em] text-slate-500 ">
                      <span>Phone</span>
                      <input
                        className={fieldInputClass}
                        value={contactForm.phone}
                        onChange={e => handleContactFormChange('phone', e.target.value)}
                        placeholder="Phone number"
                        disabled={contactFormDisabled}
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      loading={contactSaving}
                      disabled={contactFormDisabled}
                    >
                      {editingContactId ? 'Update Contact' : 'Add Contact'}
                    </Button>
                    {editingContactId && (
                      <Button
                        variant="default"
                        onClick={resetContactForm}
                        disabled={contactFormDisabled}
                      >
                        Clear Form
                      </Button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {poDetailDrawerOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/60" onClick={closePoDetailDrawer} />
          <div className="absolute inset-y-0 right-0 w-full max-w-4xl bg-white shadow-2xl flex flex-col">
            <div className="p-2  border-b border-slate-200">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs  text-slate-400 ">Purchase Order</p>
                  <h2 className="text-xl text-slate-900 mt-1">{poDetail?.po_number || 'PO'}</h2>
                </div>
                <div className="flex items-center gap-2">
                  {poDetailPdfUrl && (
                    <a href={poDetailPdfUrl} target="_blank" rel="noreferrer" className="p-2  rounded  bg-rose-100 text-xs  text-rose-700 hover:bg-rose-200">
                      Download PDF
                    </a>
                  )}
                  <button type="button" onClick={closePoDetailDrawer} className="h-10 w-10 rounded  border border-slate-200 text-slate-500 hover:text-slate-900">✕</button>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-md p-2">
                <p className="text-xs text-slate-500  mb-2">Bill To</p>
                <p className="text-md text-slate-900 text-xs">{poDetail?.company_name || '—'}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {poDetailLoading && <p className="p-8 text-xs text-slate-500">Loading PO details…</p>}
              {!poDetailLoading && poDetailError && (
                <div className="m-6 bg-rose-50 border border-rose-200 text-rose-600 p-2  rounded  text-xs">{poDetailError}</div>
              )}
              {!poDetailLoading && !poDetailError && poDetail && (
                <div className="p-2 space-y-2">
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="rounded  border border-slate-200 p-2">
                      <p className="text-xs text-slate-500  mb-2">PO Date</p>
                      <p className="text-md text-slate-900 text-xs">{formatDisplayDate(poDetail.po_date)}</p>
                    </div>
                    <div className="rounded  border border-slate-200 p-2">
                      <p className="text-xs text-slate-500  mb-2">Status</p>
                      <p className="text-md text-slate-900 text-xs">{(poDetail.status || 'DRAFT').split('_').map(chunk => chunk.charAt(0) + chunk.slice(1).toLowerCase()).join(' ')}</p>
                    </div>
                    <div className="rounded  border border-slate-200 p-2">
                      <p className="text-xs text-slate-500  mb-2">Currency</p>
                      <p className="text-md text-slate-900 text-xs">{poDetail.currency || 'INR'}</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-8">
                    <div className="grid md:grid-cols-2 gap-8 text-xs">
                      <div>
                        <p className="text-[0.65rem]  tracking-[0.35em] text-slate-500  mb-3">Terms & Conditions</p>
                        <div className="space-y-2">
                          <div><span className="text-slate-600">Payment Terms:</span><p className=" text-slate-900 mt-1">{poDetail.payment_terms || '—'}</p></div>
                          <div><span className="text-slate-600">Credit Days:</span><p className=" text-slate-900 mt-1">{poDetail.credit_days ?? '—'}</p></div>
                          <div><span className="text-slate-600">Delivery Terms:</span><p className=" text-slate-900 mt-1">{poDetail.delivery_terms || '—'}</p></div>
                        </div>
                      </div>
                      <div>
                        <p className="text-[0.65rem]  tracking-[0.35em] text-slate-500  mb-3">Shipping & Charges</p>
                        <div className="space-y-2">
                          <div><span className="text-slate-600">Freight Terms:</span><p className=" text-slate-900 mt-1">{poDetail.freight_terms || '—'}</p></div>
                          <div><span className="text-slate-600">Packing & Fwd:</span><p className=" text-slate-900 mt-1">{poDetail.packing_forwarding || '—'}</p></div>
                          <div><span className="text-slate-600">Insurance:</span><p className=" text-slate-900 mt-1">{poDetail.insurance_terms || '—'}</p></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-8">
                    <p className="text-base text-slate-900 mb-4">Line Items</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-y border-slate-200">
                          <tr>
                            <th className="p-2 text-left  text-slate-700">#</th>
                            <th className="p-2 text-left  text-slate-700">Description</th>
                            <th className="p-2  text-right  text-slate-700">Qty</th>
                            <th className="p-2 text-left  text-slate-700">Unit</th>
                            <th className="p-2  text-right  text-slate-700">Rate</th>
                            <th className="p-2  text-right  text-slate-700">Amount</th>
                            <th className="p-2  text-right  text-slate-700">Tax %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {poDetailItems.length === 0 ? (
                            <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">No line items</td></tr>
                          ) : (
                            poDetailItems.map((item, index) => (
                              <tr key={`po-detail-item-${item.id ?? index}`} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="p-2  text-slate-900 text-xs">{index + 1}</td>
                                <td className="p-2 "><div className="text-slate-900 text-xs">{item.description}</div><div className="text-xs text-slate-500">Drw No: {item.drawing_no || item.item_code || 'N/A'}</div></td>
                                <td className="p-2  text-right  text-slate-900">{item.quantity ?? '—'}</td>
                                <td className="p-2  text-slate-600">{item.unit || '—'}</td>
                                <td className="p-2  text-right text-slate-600">{formatCurrencyByCode(item.rate, poDetail.currency)}</td>
                                <td className="p-2  text-right text-slate-900 text-xs">{formatCurrencyByCode(item.basic_amount, poDetail.currency)}</td>
                                <td className="p-2  text-right text-slate-600">{formatPercent(item.cgst_percent || item.sgst_percent || item.igst_percent)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-8">
                    <div className="flex justify-end">
                      <div className="w-full md:w-80 space-y-3">
                        <div className="flex justify-between text-xs"><span className="text-slate-600">Subtotal:</span><span className=" text-slate-900">{formatCurrencyByCode(poDetail.subtotal, poDetail.currency)}</span></div>
                        <div className="flex justify-between text-xs border-t border-slate-200 pt-3"><span className="text-slate-600">Taxes:</span><span className=" text-slate-900">{formatCurrencyByCode(poDetail.tax_total, poDetail.currency)}</span></div>
                        <div className="flex justify-between bg-slate-900 text-white rounded  p-2 "><span>Total Amount:</span><span className="text-xl">{formatCurrencyByCode(poDetail.net_total, poDetail.currency)}</span></div>
                      </div>
                    </div>
                  </div>

                  {poDetail.remarks && (
                    <div className="border-t border-slate-200 pt-8">
                      <p className="text-[0.65rem]  tracking-[0.35em] text-slate-500  mb-3">Remarks</p>
                      <p className="text-xs text-slate-600 whitespace-pre-wrap">{poDetail.remarks}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </>
  )
}

export default App
