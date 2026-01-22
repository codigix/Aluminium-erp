import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Swal from 'sweetalert2'
import { 
  Building2, ClipboardList, FileText, Package, Palette, PencilLine, Factory, 
  Settings, BarChart3, CheckCircle, Handshake, MessageSquare, ShoppingCart, 
  Inbox, Book, Scale, TrendingUp, Search, Check, XCircle, Files, RotateCw 
} from 'lucide-react'
import CompanyMaster from './pages/CompanyMaster'
import ClientContacts from './pages/ClientContacts'
import CustomerPO from './pages/CustomerPO'
import SalesOrders from './pages/SalesOrders'
import IncomingOrders from './pages/IncomingOrders'
import VendorManagement from './pages/VendorManagement'
import Vendors from './pages/Vendors'
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
import POMaterialRequest from './pages/POMaterialRequest'
import QualityDashboard from './pages/QualityDashboard'
import IncomingQC from './pages/IncomingQC'
import InProcessQC from './pages/InProcessQC'
import FinalQC from './pages/FinalQC'
import QualityRejections from './pages/QualityRejections'
import QualityReports from './pages/QualityReports'
import WarehouseAllocation from './pages/WarehouseAllocation'
import DrawingMaster from './pages/DrawingMaster'
import CustomerDrawing from './pages/CustomerDrawing'
import DesignOrders from './pages/DesignOrders'
import ClientQuotations from './pages/ClientQuotations'
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
import JobCard from './pages/JobCard'
import { FormControl, StatusBadge } from './components/ui.jsx'
import './index.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
const API_HOST = API_BASE.replace(/\/api$/, '')
const MODULE_IDS = ['customer-po', 'sales-order', 'customer-drawing', 'client-quotations', 'vendor-management', 'vendors', 'quotations', 'purchase-orders', 'po-receipts', 'inventory-dashboard', 'quality-dashboard', 'po-material-request', 'grn', 'qc-inspections', 'stock-ledger', 'stock-balance', 'incoming-qc', 'in-process-qc', 'final-qc', 'quality-rejections', 'quality-reports', 'warehouse-allocation', 'design-orders', 'drawing-master', 'bom-creation', 'routing-operations', 'process-sheet', 'bom-approval', 'bom-form', 'workstation-master', 'operation-master', 'project-requests', 'material-requirements', 'production-plan', 'work-order', 'job-card']
const DEFAULT_MODULE = 'customer-drawing'
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

const createSalesOrderForm = () => ({
  companyId: '',
  customerPoId: '',
  projectName: '',
  drawingRequired: false,
  productionPriority: 'NORMAL',
  targetDispatchDate: ''
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
  SALES: ['customer-po', 'sales-order', 'customer-drawing', 'client-quotations'],
  DESIGN_ENG: ['design-orders', 'drawing-master', 'bom-creation', 'bom-approval', 'bom-form', 'operation-master', 'workstation-master'],
  PRODUCTION: ['incoming-orders', 'operation-master', 'workstation-master', 'project-requests', 'material-requirements', 'production-plan', 'work-order', 'job-card'],
  QUALITY: ['quality-dashboard', 'incoming-qc', 'in-process-qc', 'final-qc', 'quality-rejections', 'quality-reports', 'qc-inspections'],
  SHIPMENT: ['incoming-orders'],
  ACCOUNTS: [],
  INVENTORY: ['inventory-dashboard', 'po-material-request', 'grn', 'stock-ledger', 'stock-balance', 'warehouse-allocation'],
  PROCUREMENT: ['vendors', 'quotations', 'purchase-orders', 'po-receipts', 'incoming-orders'],
  ADMIN: ['customer-po', 'sales-order', 'customer-drawing', 'po-material-request', 'design-orders', 'drawing-master', 'bom-creation', 'bom-approval', 'client-quotations', 'bom-form', 'operation-master', 'workstation-master', 'project-requests', 'material-requirements', 'production-plan', 'work-order', 'job-card']
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const getActiveModuleFromPath = () => {
    const path = location.pathname.replace(/\/$/, '') || '/'
    const modulePath = path.split('/')[1] || DEFAULT_MODULE
    return MODULE_IDS.includes(modulePath) ? modulePath : DEFAULT_MODULE
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

  const allowedModules = useMemo(() => {
    return user?.department_code ? DEPARTMENT_MODULES[user.department_code] : []
  }, [user?.department_code])

  const [authMode, setAuthMode] = useState('login')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
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
  const [showSalesOrderForm, setShowSalesOrderForm] = useState(false)
  const [customerPos, setCustomerPos] = useState([])
  const [customerPosLoading, setCustomerPosLoading] = useState(false)
  const [quotationRequests, setQuotationRequests] = useState([])
  const [quotationRequestsLoading, setQuotationRequestsLoading] = useState(false)
  const [poQuotePrices, setPoQuotePrices] = useState({})
  const [salesOrders, setSalesOrders] = useState([])
  const [salesOrdersLoading, setSalesOrdersLoading] = useState(false)
  const [poDetailDrawerOpen, setPoDetailDrawerOpen] = useState(false)
  const [poDetailLoading, setPoDetailLoading] = useState(false)
  const [poItemsLoading, setPoItemsLoading] = useState(false)
  const [poDetail, setPoDetail] = useState(null)
  const [poDetailError, setPoDetailError] = useState('')
  const [, setSelectedPoId] = useState(null)

  const [salesOrderForm, setSalesOrderForm] = useState(createSalesOrderForm)
  const [selectedPoForSo, setSelectedPoForSo] = useState(null)
  const [soItems, setSoItems] = useState([])

  const handleSalesOrderFieldChange = (field, value) => {
    setSalesOrderForm(prev => ({ ...prev, [field]: value }))
  }

  const resetSalesOrderForm = useCallback(() => {
    setSalesOrderForm(createSalesOrderForm())
    setSelectedPoForSo(null)
    setSoItems([])
    setShowSalesOrderForm(false)
  }, [])

  const handleCreateSalesOrder = async () => {
    if (!salesOrderForm.companyId || !salesOrderForm.customerPoId) {
      showToast('Company and Customer PO are required')
      return
    }
    setSalesOrdersLoading(true)
    try {
      await apiRequest('/sales-orders', {
        method: 'POST',
        body: {
          customerPoId: salesOrderForm.customerPoId,
          companyId: salesOrderForm.companyId,
          projectName: salesOrderForm.projectName,
          drawingRequired: salesOrderForm.drawingRequired,
          productionPriority: salesOrderForm.productionPriority,
          targetDispatchDate: salesOrderForm.targetDispatchDate,
          items: soItems
        }
      })
      showToast('Sales Order created successfully')
      resetSalesOrderForm()
      await loadSalesOrders()
    } catch (error) {
      showToast(error.message)
    } finally {
      setSalesOrdersLoading(false)
    }
  }

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

  useEffect(() => {
    const fetchPoDetails = async () => {
      if (!salesOrderForm.customerPoId) {
        setSelectedPoForSo(null)
        return
      }
      setPoItemsLoading(true)
      try {
        const data = await apiRequest(`/customer-pos/${salesOrderForm.customerPoId}`)
        setSelectedPoForSo(data)
        setSoItems((data.items || []).map(item => ({
          ...item,
          drawing_no: item.item_code || '',
          materials: []
        })))
        
        // Autofill fields based on PO data
        setSalesOrderForm(prev => {
          const formatDateForInput = (dateInput) => {
            if (!dateInput) return ''
            const d = new Date(dateInput)
            if (Number.isNaN(d.getTime())) return ''
            const year = d.getFullYear()
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const day = String(d.getDate()).padStart(2, '0')
            return `${year}-${month}-${day}`
          }

          let targetDate = ''
          if (data.items && data.items.length > 0) {
            // Find the earliest delivery date among items
            const dates = data.items
              .map(item => item.delivery_date)
              .filter(Boolean)
              .sort()
            if (dates.length > 0) {
              targetDate = formatDateForInput(dates[0])
            }
          }
          
          // Fallback to PO Date if items don't have dates
          if (!targetDate && data.po_date) {
            targetDate = formatDateForInput(data.po_date)
          }

          // Try to extract project name from remarks if available, otherwise use PO Number
          let extractedProject = data.project_name || ''
          if (!extractedProject && data.remarks) {
            const projectMatch = data.remarks.match(/Project[:\s]+([^,\n.]+)/i)
            if (projectMatch) {
              extractedProject = projectMatch[1].trim()
            }
          }
          
          // Fallback to PO Number if still empty
          if (!extractedProject) {
            extractedProject = data.po_number || ''
          }

          return {
            ...prev,
            projectName: extractedProject,
            targetDispatchDate: targetDate || prev.targetDispatchDate || ''
          }
        })
      } catch (error) {
        showToast('Failed to fetch PO details: ' + error.message)
        setSelectedPoForSo(null)
      } finally {
        setPoItemsLoading(false)
      }
    }
    fetchPoDetails()
  }, [salesOrderForm.customerPoId, apiRequest, showToast])

  const performLogin = useCallback(async (email, password) => {
    setLoginLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      
      // Redirect to first allowed module based on department
      const userAllowed = DEPARTMENT_MODULES[data.user.department_code] || []
      if (userAllowed.length > 0) {
        navigate(`/${userAllowed[0]}`)
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
      const deptRes = await fetch(`${API_BASE}/departments`)
      if (deptRes.ok) {
        const depts = await deptRes.json()
        setDepartments(Array.isArray(depts) ? depts : [])
      }
    } catch (error) {
      console.error('Error loading departments:', error)
    }
  }, [])



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
        headers: { 'Content-Type': 'application/json' },
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
    if (token && user) {
      loadCompanies().catch(() => null)
    }
  }, [loadCompanies, token, user])

  useEffect(() => {
    if (token && user) {
      loadSalesOrders().catch(() => null)
    }
  }, [loadSalesOrders, token, user])

  useEffect(() => {
    if (token && user) {
      loadCustomerPos().catch(() => null)
    }
  }, [loadCustomerPos, token, user])

  useEffect(() => {
    if (activeModule === 'customer-po') {
      loadQuotationRequests().catch(() => null)
    }
  }, [activeModule, loadQuotationRequests])

  useEffect(() => {
    if (token && user && allowedModules.length > 0) {
      if (!allowedModules.includes(activeModule)) {
        navigate(`/${allowedModules[0]}`)
      }
    }
  }, [token, user, allowedModules, activeModule, navigate])

  const handleSendOrderToDesign = useCallback(async (orderId) => {
    try {
      setSalesOrdersLoading(true)
      await apiRequest(`/sales-orders/${orderId}/send-to-design`, {
        method: 'POST'
      })
      showToast('Order sent to Design Engineering')
      await loadSalesOrders()
    } catch (error) {
      showToast(error.message)
    } finally {
      setSalesOrdersLoading(false)
    }
  }, [apiRequest, loadSalesOrders, showToast])

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
        confirmButton: 'px-5 py-2 rounded-xl bg-rose-500 text-white  ml-3',
        cancelButton: 'px-5 py-2 rounded-xl border border-slate-200 text-slate-600 '
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
        confirmButton: 'px-5 py-2 rounded-xl bg-rose-500 text-white  ml-3',
        cancelButton: 'px-5 py-2 rounded-xl border border-slate-200 text-slate-600 '
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



  const handleViewPoDetail = useCallback(async customerPoId => {
    if (!customerPoId) {
      return
    }
    setPoDetailDrawerOpen(true)
    setPoDetail(null)
    setPoDetailError('')
    setPoDetailLoading(true)
    setSelectedPoId(customerPoId)
    try {
      const data = await apiRequest(`/customer-pos/${customerPoId}`)
      setPoDetail(data)
    } catch (error) {
      setPoDetailError(error.message)
      showToast(error.message)
    } finally {
      setPoDetailLoading(false)
    }
  }, [apiRequest, showToast])

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

  const fieldInputClass = 'w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-2 focus:ring-slate-200 outline-none transition disabled:bg-slate-100 disabled:text-slate-400'

  const formatCurrency = value => currencyFormatter.format(Number(value) || 0)

  const drawerTitle = drawerMode === 'edit' ? 'Edit Company' : drawerMode === 'view' ? 'Company Details' : 'Add New Company'
  const primaryButtonLabel = drawerMode === 'edit' ? 'Update Company' : 'Save Company'
  const isReadOnly = drawerMode === 'view'

  const iconMap = {
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
    'refresh': RotateCw
  }

  const allNavigationItems = [
    { label: 'Client Requirements ', moduleId: 'customer-drawing', icon: 'clipboard' },
    { label: 'Client Quotations', moduleId: 'client-quotations', icon: 'clipboard' },
    { label: 'Customer PO', moduleId: 'customer-po', icon: 'document' },
    { label: 'Sales Order', moduleId: 'sales-order', icon: 'package' },
    { label: 'Design Orders', moduleId: 'design-orders', icon: 'palette' },
    
    { label: 'Drawing Master', moduleId: 'drawing-master', icon: 'pencil', indent: true },
    { label: 'BOM Creation', moduleId: 'bom-creation', icon: 'clipboard', indent: true },
    { label: 'Routing / Operations', moduleId: 'routing-operations', icon: 'settings', indent: true },
    { label: 'Process Sheet', moduleId: 'process-sheet', icon: 'chart', indent: true },
    { label: 'BOM Approval', moduleId: 'bom-approval', icon: 'check', indent: true },
    { label: 'Production Control', isGroup: true, isDisabled: true, groupId: 'production-group' },
    { label: 'Project Requests', moduleId: 'project-requests', icon: 'clipboard', indent: true },
    { label: 'Material Requirements', moduleId: 'material-requirements', icon: 'package', indent: true },
    { label: 'Production Plan', moduleId: 'production-plan', icon: 'chart', indent: true },
    { label: 'Work Order', moduleId: 'work-order', icon: 'document', indent: true },
    { label: 'Job Card', moduleId: 'job-card', icon: 'clipboard', indent: true },
    { label: 'Workstations', moduleId: 'workstation-master', icon: 'factory', indent: true },
    { label: 'Operations', moduleId: 'operation-master', icon: 'settings', indent: true },
    { label: 'Vendor Management', isGroup: true, isDisabled: true, groupId: 'vendor-group' },
    { label: 'Vendors', moduleId: 'vendors', icon: 'handshake', indent: true },
    { label: 'Quotations (RFQ)', moduleId: 'quotations', icon: 'message', indent: true },
    { label: 'Purchase Orders', moduleId: 'purchase-orders', icon: 'cart', indent: true },
    { label: 'PO Receipts', moduleId: 'po-receipts', icon: 'inbox', indent: true },
    { label: 'Inventory Management', isGroup: true, isDisabled: true, groupId: 'inventory-group' },
    { label: 'Inventory Dashboard', moduleId: 'inventory-dashboard', icon: 'chart', indent: true },
    { label: 'PO Material Request', moduleId: 'po-material-request', icon: 'clipboard', indent: true },
    { label: 'GRN Processing', moduleId: 'grn', icon: 'refresh', indent: true },
    { label: 'Stock Ledger', moduleId: 'stock-ledger', icon: 'book', indent: true },
    { label: 'Stock Balance', moduleId: 'stock-balance', icon: 'scale', indent: true },
    { label: 'Warehouse Allocation', moduleId: 'warehouse-allocation', icon: 'factory', indent: true },
    { label: 'Quality Assurance', isGroup: true, isDisabled: true, groupId: 'quality-group' },
    { label: 'Quality Dashboard', moduleId: 'quality-dashboard', icon: 'trending', indent: true },
    { label: 'Incoming QC', moduleId: 'incoming-qc', icon: 'inbox', indent: true },
    { label: 'In-Process QC', moduleId: 'in-process-qc', icon: 'search', indent: true },
    { label: 'Final QC', moduleId: 'final-qc', icon: 'checkmark', indent: true },
    { label: 'QC Inspections', moduleId: 'qc-inspections', icon: 'search', indent: true },
    { label: 'Rejections', moduleId: 'quality-rejections', icon: 'close', indent: true },
    { label: 'Quality Reports', moduleId: 'quality-reports', icon: 'files', indent: true }
  ]

  const navigationItems = allowedModules ? allNavigationItems.filter((item, index) => {
    if (item.isGroup) {
      const nextGroupIndex = allNavigationItems.findIndex((it, i) => i > index && it.isGroup)
      const groupItems = allNavigationItems.slice(index + 1, nextGroupIndex === -1 ? undefined : nextGroupIndex)
      return groupItems.some(child => child.moduleId && allowedModules.includes(child.moduleId))
    }
    return !item.moduleId || allowedModules.includes(item.moduleId)
  }) : []

  const poDetailItems = Array.isArray(poDetail?.items) ? poDetail.items : []
  const poDetailPdfUrl = poDetail?.pdf_path ? getPoPdfUrl(poDetail.pdf_path) : null

  if (!token || !user) {
    return (
      <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-2 space-y-2">
            <div className="text-center space-y-2">
              <div className="h-16 w-16 rounded-2xl bg-slate-900 flex items-center justify-center mx-auto p-2">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-xl text-slate-900">SPTECHPIONEER</h1>
              <p className="text-xs text-slate-500">Sales & Operations ERP</p>
            </div>

            <div className="flex gap-2 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`flex-1 pb-3 text-sm  transition ${
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
                className={`flex-1 pb-3 text-sm  transition ${
                  authMode === 'signup'
                    ? 'text-slate-900 border-b-2 border-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Sign Up
              </button>
            </div>

            {authMode === 'login' ? (
              <form onSubmit={handleLogin} className="">
                <div>
                  <label className="block text-sm  text-slate-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="your.email@company.com"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    disabled={loginLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm  text-slate-700 mb-2">Password</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    disabled={loginLoading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full px-5 py-2.5 rounded-xl bg-slate-900 text-white  hover:bg-slate-800 disabled:opacity-60 transition"
                >
                  {loginLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-3 max-h-96 overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs  text-slate-700 mb-1">First Name</label>
                    <input
                      type="text"
                      value={signupForm.first_name}
                      onChange={e => setSignupForm({ ...signupForm, first_name: e.target.value })}
                      placeholder="John"
                      className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
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
                      className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
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
                    className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
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
                    className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
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
                    className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    disabled={signupLoading || !signupForm.department_id}
                  >
                    <option value="">Select Role</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs  text-slate-700 mb-1">Password</label>
                    <input
                      type="password"
                      value={signupForm.password}
                      onChange={e => setSignupForm({ ...signupForm, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
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
                      className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      disabled={signupLoading}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={signupLoading}
                  className="w-full px-5 py-2.5 rounded-xl bg-slate-900 text-white  hover:bg-slate-800 disabled:opacity-60 transition text-sm"
                >
                  {signupLoading ? 'Creating account...' : 'Sign Up'}
                </button>
              </form>
            )}

            {toast && (
              <div className={`p-3 rounded-xl border text-sm ${
                toast.includes('success') || toast.includes('Welcome')
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {toast}
              </div>
            )}

            {authMode === 'login' && (
              <div className="text-center text-xs text-slate-500 space-y-2 border-t border-slate-200 pt-4 mt-4">
                <p className="">Demo Credentials:</p>
                <div className="grid grid-cols-2 gap-2 text-left bg-slate-50 p-3 rounded-lg overflow-y-auto max-h-64">
                  <button 
                    onClick={() => performLogin('admin@company.com', 'Admin@123')}
                    className="p-2 border border-slate-200 rounded hover:bg-white hover:border-slate-300 transition group text-left col-span-2"
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
      <div className="flex min-h-screen bg-gray-50 text-slate-900">
        <aside className={`fixed lg:flex inset-y-0 left-0 w-64 bg-white text-slate-900 flex-col transition-transform lg:transition-none z-50 border-r border-slate-200 ${
          mobileMenuOpen ? 'flex' : 'hidden'
        } lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-2 border-b flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="h-8 w-8 rounded-lg bg-white/95 flex items-center justify-center p-1 flex-shrink-0">
                <Building2 className="h-4 w-4 text-slate-900" />
              </div>
              <div className="min-w-0">
                <p className="text-xs  leading-tight">SPTECHPIONEER</p>
                <p className="text-xs text-indigo-600 truncate">{user?.department_code || 'ERP'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1 hover:bg-white/20 rounded transition text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-2">
            {navigationItems.map((item) => {
              const isActive = item.moduleId ? (activeModule === item.moduleId || (item.moduleId === 'bom-creation' && activeModule === 'bom-form')) : Boolean(item.active)
              const isDisabled = item.isGroup || !item.moduleId
              
              if (item.isGroup) {
                return (
                  <div key={item.label} className="pt-1">
                    <div
                      className="w-full flex items-center justify-between px-3 py-2 text-xs  text-slate-500  tracking-wider hover:text-slate-700 transition-colors"
                    >
                      <span>{item.label}</span>
                    </div>
                  </div>
                )
              }
              
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    if (item.moduleId) {
                      navigate(`/${item.moduleId}`)
                      setMobileMenuOpen(false)
                    }
                  }}
                  className={`flex items-center gap-3 w-full p-2  text-sm font-medium transition-all duration-150 group ${item.indent ? 'ml-2' : ''} ${
                    isActive 
                      ? 'bg-indigo-50 text-indigo-700 ' 
                      : isDisabled 
                      ? 'text-slate-400 cursor-not-allowed' 
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  disabled={isDisabled}
                >
                  {iconMap[item.icon] && (() => {
                    const IconComponent = iconMap[item.icon]
                    return <IconComponent className="w-4 h-4 flex-shrink-0" />
                  })()}
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {isActive && <span className="text-indigo-600 text-xs ">●</span>}
                </button>
              )
            })}
          </div>
          <div className="px-3 py-4 border-t border-slate-200 space-y-3">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs  hover:bg-slate-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </aside>

        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <div className="flex-1 lg:ml-64 flex flex-col bg-slate-50">
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
            <div className="p-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-end">
              
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm text-slate-900 text-xs">{user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.first_name || user?.username || 'User'}</p>
                  <p className="text-xs text-slate-500">{user?.role_name || user?.department_name || 'User'}</p>
                </div>
                <div className="h-5 w-5 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex text-xs items-center justify-center text-white  text-lg">
                  {(user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 p-3">
            {location.pathname.startsWith('/receipt-details/') ? (
              <POReceiptDetails />
            ) : (
              <>
                {toast && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-2xl text-sm shadow-sm">
                    {toast}
                  </div>
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

                {activeModule === 'client-contacts' && (
                  <ClientContacts companies={companies} onOpenContactDrawer={openContactDrawer} />
                )}

                {activeModule === 'customer-po' && (
                  <CustomerPO
                    formatCurrency={formatCurrency}
                    onQuotePriceChange={handlePoQuotePriceChange}
                    onApproveQuotation={handleApproveQuotationGroup}
                    onSendToDesign={handleSendToDesignGroup}
                    onUpdateQuotationRates={handleUpdateQuotationRates}
                    quotationRequests={quotationRequests}
                    quotationRequestsLoading={quotationRequestsLoading}
                    poQuotePrices={poQuotePrices}
                  />
                )}

                {activeModule === 'sales-order' && (
                  <SalesOrders
                    orders={salesOrders}
                    loading={salesOrdersLoading}
                    onRefresh={loadSalesOrders}
                    onViewPo={handleViewPoDetail}
                    getPoPdfUrl={getPoPdfUrl}
                    onSendOrder={handleSendOrderToDesign}
                    showSalesOrderForm={showSalesOrderForm}
                    onCreate={setShowSalesOrderForm}
                    salesOrderForm={salesOrderForm}
                    onFieldChange={handleSalesOrderFieldChange}
                    onSubmit={handleCreateSalesOrder}
                    onResetForm={resetSalesOrderForm}
                    companies={companies}
                    customerPos={customerPos}
                    selectedPoForSo={selectedPoForSo}
                    soItems={soItems}
                    setSoItems={setSoItems}
                    customerPosLoading={customerPosLoading}
                    fieldInputClass={fieldInputClass}
                  />
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

                {activeModule === 'vendors' && (
                  <Vendors />
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

                {activeModule === 'in-process-qc' && (
                  <InProcessQC />
                )}

                {activeModule === 'final-qc' && (
                  <FinalQC />
                )}

                {activeModule === 'quality-rejections' && (
                  <QualityRejections />
                )}

                {activeModule === 'quality-reports' && (
                  <QualityReports />
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

                {activeModule === 'warehouse-allocation' && (
                  <WarehouseAllocation />
                )}

                {activeModule === 'design-orders' && (
                  <DesignOrders />
                )}

                {activeModule === 'client-quotations' && (
                  <ClientQuotations />
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
                  <ProductionPlan />
                )}

                {activeModule === 'work-order' && (
                  <WorkOrder />
                )}

                {activeModule === 'job-card' && (
                  <JobCard />
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
              <button type="button" onClick={closeDrawer} className="h-10 w-10 rounded-full border border-slate-200 text-slate-500 hover:text-slate-900">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <form className="space-y-3" onSubmit={handleCompanySubmit}>
                <div className="grid md:grid-cols-2 gap-5">
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

                <div className="grid md:grid-cols-3 gap-5">
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

                <div className="grid md:grid-cols-2 gap-5">
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

                <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={closeDrawer}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm  text-slate-600 hover:border-slate-300"
                  >
                    {drawerMode === 'view' ? 'Close' : 'Cancel'}
                  </button>
                  {drawerMode !== 'view' && (
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-indigo-500 text-white text-sm  shadow-sm hover:bg-indigo-600 disabled:opacity-60"
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
              <div className="flex items-center gap-3">
                <StatusBadge status={contactCompany.status} />
                <button
                  type="button"
                  onClick={closeContactDrawer}
                  className="h-10 w-10 rounded-full border border-slate-200 text-slate-500 hover:text-slate-900"
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
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm  text-slate-600 hover:border-slate-300 disabled:opacity-50"
                    disabled={contactFormDisabled}
                  >
                    New Contact
                  </button>
                </div>
                {contactListLoading ? (
                  <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-2xl">Loading contacts...</div>
                ) : contactList.length ? (
                  <div className="space-y-3">
                    {contactList.map(contact => (
                      <div key={contact.id} className="border border-slate-200 rounded-2xl bg-white p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base text-slate-900 text-xs">{contact.name || 'Untitled Contact'}</p>
                            <p className="text-xs text-slate-500">{contact.designation || '—'}</p>
                            <p className="text-[0.6rem]  tracking-[0.35em]  text-slate-400 mt-2">
                              {contact.contact_type || contact.contactType || 'PRIMARY'}
                            </p>
                          </div>
                          <StatusBadge status={contact.status} />
                        </div>
                        <div className="grid gap-1 text-sm text-slate-600">
                          <p>Email: {contact.email || '—'}</p>
                          <p>Phone: {contact.phone || '—'}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-lg border border-indigo-200 text-xs  text-indigo-600 hover:border-indigo-300 disabled:opacity-50"
                            onClick={() => handleEditContact(contact)}
                            disabled={contactFormDisabled}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-lg border border-amber-200 text-xs  text-amber-600 hover:border-amber-300 disabled:opacity-50"
                            onClick={() => handleContactStatusToggle(contact)}
                            disabled={!isCompanyActive(contactCompany)}
                          >
                            {getContactStatusActionLabel(contact.status)}
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-lg border border-rose-200 text-xs  text-rose-600 hover:border-rose-300 disabled:opacity-50"
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
                  <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl text-xs text-slate-500">
                    No contacts found. Use the form to create one.
                  </div>
                )}
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-5">
                <div>
                  <p className="text-xs  text-slate-400 ">{editingContactId ? 'Update Contact' : 'Add Contact'}</p>
                  <h4 className="text-xl text-slate-900 text-xs">{editingContactId ? 'Edit Existing Contact' : 'Create New Contact'}</h4>
                </div>
                {!isCompanyActive(contactCompany) && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-2xl text-sm">
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
                  <div className="grid md:grid-cols-2 gap-4">
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
                  <div className="grid md:grid-cols-2 gap-4">
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
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-indigo-500 text-white text-sm  shadow-sm hover:bg-indigo-600 disabled:opacity-60"
                      disabled={contactFormDisabled || contactSaving}
                    >
                      {contactSaving ? 'Saving...' : editingContactId ? 'Update Contact' : 'Add Contact'}
                    </button>
                    {editingContactId && (
                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl border border-slate-200 text-sm  text-slate-600 hover:border-slate-300"
                        onClick={resetContactForm}
                        disabled={contactFormDisabled}
                      >
                        Clear Form
                      </button>
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
            <div className="px-8 py-6 border-b border-slate-200">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs  text-slate-400 ">Purchase Order</p>
                  <h2 className="text-xl text-slate-900 mt-1">{poDetail?.po_number || 'PO'}</h2>
                </div>
                <div className="flex items-center gap-3">
                  {poDetailPdfUrl && (
                    <a href={poDetailPdfUrl} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-xl bg-indigo-100 text-sm  text-indigo-700 hover:bg-indigo-200">
                      Download PDF
                    </a>
                  )}
                  <button type="button" onClick={closePoDetailDrawer} className="h-10 w-10 rounded-full border border-slate-200 text-slate-500 hover:text-slate-900">✕</button>
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
                <div className="m-6 bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-2xl text-sm">{poDetailError}</div>
              )}
              {!poDetailLoading && !poDetailError && poDetail && (
                <div className="p-8 space-y-8">
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-xs text-slate-500  mb-2">PO Date</p>
                      <p className="text-md text-slate-900 text-xs">{formatDisplayDate(poDetail.po_date)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-xs text-slate-500  mb-2">Status</p>
                      <p className="text-md text-slate-900 text-xs">{(poDetail.status || 'DRAFT').split('_').map(chunk => chunk.charAt(0) + chunk.slice(1).toLowerCase()).join(' ')}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-xs text-slate-500  mb-2">Currency</p>
                      <p className="text-md text-slate-900 text-xs">{poDetail.currency || 'INR'}</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-8">
                    <div className="grid md:grid-cols-2 gap-8 text-sm">
                      <div>
                        <p className="text-[0.65rem]  tracking-[0.35em] text-slate-500  mb-3">Terms & Conditions</p>
                        <div className="space-y-2">
                          <div><span className="text-slate-600">Payment Terms:</span><p className="font-medium text-slate-900 mt-1">{poDetail.payment_terms || '—'}</p></div>
                          <div><span className="text-slate-600">Credit Days:</span><p className="font-medium text-slate-900 mt-1">{poDetail.credit_days ?? '—'}</p></div>
                          <div><span className="text-slate-600">Delivery Terms:</span><p className="font-medium text-slate-900 mt-1">{poDetail.delivery_terms || '—'}</p></div>
                        </div>
                      </div>
                      <div>
                        <p className="text-[0.65rem]  tracking-[0.35em] text-slate-500  mb-3">Shipping & Charges</p>
                        <div className="space-y-2">
                          <div><span className="text-slate-600">Freight Terms:</span><p className="font-medium text-slate-900 mt-1">{poDetail.freight_terms || '—'}</p></div>
                          <div><span className="text-slate-600">Packing & Fwd:</span><p className="font-medium text-slate-900 mt-1">{poDetail.packing_forwarding || '—'}</p></div>
                          <div><span className="text-slate-600">Insurance:</span><p className="font-medium text-slate-900 mt-1">{poDetail.insurance_terms || '—'}</p></div>
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
                            <th className="px-4 py-3 text-right  text-slate-700">Qty</th>
                            <th className="p-2 text-left  text-slate-700">Unit</th>
                            <th className="px-4 py-3 text-right  text-slate-700">Rate</th>
                            <th className="px-4 py-3 text-right  text-slate-700">Amount</th>
                            <th className="px-4 py-3 text-right  text-slate-700">Tax %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {poDetailItems.length === 0 ? (
                            <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">No line items</td></tr>
                          ) : (
                            poDetailItems.map((item, index) => (
                              <tr key={`po-detail-item-${item.id ?? index}`} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-4 py-3 text-slate-900 text-xs">{index + 1}</td>
                                <td className="px-4 py-3"><div className="text-slate-900 text-xs">{item.description}</div><div className="text-xs text-slate-500">Drw No: {item.drawing_no || item.item_code || 'N/A'}</div></td>
                                <td className="px-4 py-3 text-right font-medium text-slate-900">{item.quantity ?? '—'}</td>
                                <td className="px-4 py-3 text-slate-600">{item.unit || '—'}</td>
                                <td className="px-4 py-3 text-right text-slate-600">{formatCurrencyByCode(item.rate, poDetail.currency)}</td>
                                <td className="px-4 py-3 text-right text-slate-900 text-xs">{formatCurrencyByCode(item.basic_amount, poDetail.currency)}</td>
                                <td className="px-4 py-3 text-right text-slate-600">{formatPercent(item.cgst_percent || item.sgst_percent || item.igst_percent)}</td>
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
                        <div className="flex justify-between text-sm"><span className="text-slate-600">Subtotal:</span><span className="font-medium text-slate-900">{formatCurrencyByCode(poDetail.subtotal, poDetail.currency)}</span></div>
                        <div className="flex justify-between text-sm border-t border-slate-200 pt-3"><span className="text-slate-600">Taxes:</span><span className="font-medium text-slate-900">{formatCurrencyByCode(poDetail.tax_total, poDetail.currency)}</span></div>
                        <div className="flex justify-between bg-slate-900 text-white rounded-2xl p-2 "><span>Total Amount:</span><span className="text-xl">{formatCurrencyByCode(poDetail.net_total, poDetail.currency)}</span></div>
                      </div>
                    </div>
                  </div>

                  {poDetail.remarks && (
                    <div className="border-t border-slate-200 pt-8">
                      <p className="text-[0.65rem]  tracking-[0.35em] text-slate-500  mb-3">Remarks</p>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{poDetail.remarks}</p>
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
