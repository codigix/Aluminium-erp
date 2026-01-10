import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Swal from 'sweetalert2'
import sptechLogo from './assets/sptechpioneer logo.png'
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
import { FormControl, StatusBadge } from './components/ui.jsx'
import './index.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
const API_HOST = API_BASE.replace(/\/api$/, '')
const MODULE_IDS = ['company-master', 'client-contacts', 'customer-po', 'sales-order', 'incoming-orders', 'vendor-management', 'vendors', 'quotations', 'purchase-orders', 'po-receipts', 'inventory-dashboard', 'grn', 'qc-inspections', 'stock-ledger', 'stock-balance']
const DEFAULT_MODULE = 'company-master'
const HOME_PLANT_STATE = (import.meta.env.VITE_PLANT_STATE || 'maharashtra').toLowerCase()
const COMPANY_HINTS = {
  SIDEL: ['sidel'],
  PHOENIX: ['phoenix'],
  BOSSAR: ['bossar']
}

const normalizeKey = value => (value || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '')
const parseIndianNumber = value => {
  if (value === undefined || value === null) return 0
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  const normalized = String(value).replace(/,/g, '').replace(/[^0-9.-]/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}
const normalizeTaxPercents = (cgstPercent, sgstPercent, igstPercent, isIntrastate) => {
  if (isIntrastate) {
    const safeCgst = cgstPercent || (igstPercent ? igstPercent / 2 : 0)
    const safeSgst = sgstPercent || safeCgst
    return { cgstPercent: safeCgst, sgstPercent: safeSgst, igstPercent: 0 }
  }
  const safeIgst = igstPercent || cgstPercent + sgstPercent
  return { cgstPercent: 0, sgstPercent: 0, igstPercent: safeIgst }
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

const createCustomerPoForm = () => ({
  companyId: '',
  poNumber: '',
  poDate: '',
  paymentTerms: '',
  creditDays: '',
  freightTerms: '',
  packingForwarding: '',
  insuranceTerms: '',
  currency: 'INR',
  deliveryTerms: '',
  remarks: ''
})

const createSalesOrderForm = () => ({
  companyId: '',
  customerPoId: '',
  projectName: '',
  drawingRequired: false,
  productionPriority: 'NORMAL',
  targetDispatchDate: ''
})

const createCustomerPoItem = () => ({
  drawingNo: '',
  description: '',
  quantity: 1,
  unit: 'NOS',
  rate: '',
  cgstPercent: '',
  sgstPercent: '',
  igstPercent: '',
  hsnCode: '',
  discount: ''
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
  SALES: ['company-master', 'client-contacts', 'customer-po', 'sales-order'],
  DESIGN_ENG: ['incoming-orders'],
  PRODUCTION: ['incoming-orders'],
  QUALITY: ['incoming-orders'],
  SHIPMENT: ['incoming-orders'],
  ACCOUNTS: [],
  INVENTORY: ['inventory-dashboard', 'incoming-orders', 'grn', 'qc-inspections', 'stock-ledger', 'stock-balance'],
  PROCUREMENT: ['vendors', 'quotations', 'purchase-orders', 'po-receipts', 'incoming-orders'],
  ADMIN: ['company-master', 'client-contacts', 'customer-po', 'sales-order', 'incoming-orders']
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
  const poUploadInputRef = useRef(null)
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
  const [poForm, setPoForm] = useState(createCustomerPoForm)
  const [poItems, setPoItems] = useState([createCustomerPoItem()])
  const [poPdfFile, setPoPdfFile] = useState(null)
  const [poParseResult, setPoParseResult] = useState(null)
  const [poParseLoading, setPoParseLoading] = useState(false)
  const [poCompanyLocked, setPoCompanyLocked] = useState(false)
  const [poSaving, setPoSaving] = useState(false)
  const [showPoForm, setShowPoForm] = useState(false)
  const [showSalesOrderForm, setShowSalesOrderForm] = useState(false)
  const [editingPoId, setEditingPoId] = useState(null)
  const [customerPos, setCustomerPos] = useState([])
  const [customerPosLoading, setCustomerPosLoading] = useState(false)
  const [salesOrders, setSalesOrders] = useState([])
  const [salesOrdersLoading, setSalesOrdersLoading] = useState(false)
  const [poDetailDrawerOpen, setPoDetailDrawerOpen] = useState(false)
  const [poDetailLoading, setPoDetailLoading] = useState(false)
  const [poDetail, setPoDetail] = useState(null)
  const [poDetailError, setPoDetailError] = useState('')
  const [selectedPoId, setSelectedPoId] = useState(null)

  const [salesOrderForm, setSalesOrderForm] = useState(createSalesOrderForm)
  const [selectedPoForSo, setSelectedPoForSo] = useState(null)
  const [soItems, setSoItems] = useState([])
  const [poItemsLoading, setPoItemsLoading] = useState(false)

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

  const handleLogin = useCallback(async e => {
    e.preventDefault()
    if (!loginEmail || !loginPassword) {
      showToast('Email and password required')
      return
    }
    setLoginLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
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
    } catch (error) {
      showToast(error.message)
    } finally {
      setLoginLoading(false)
    }
  }, [loginEmail, loginPassword, showToast])

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

  const getPoPdfUrl = useCallback(path => {
    if (!path) {
      return null
    }
    const normalized = path.replace(/^\/+/g, '')
    return `${API_HOST}/${normalized}`
  }, [])

  useEffect(() => {
    loadCompanies().catch(() => null)
  }, [loadCompanies])

  useEffect(() => {
    loadSalesOrders().catch(() => null)
  }, [loadSalesOrders])

  useEffect(() => {
    loadCustomerPos().catch(() => null)
  }, [loadCustomerPos])

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

  useEffect(() => {
    setPoForm(prev => {
      const match = (prev.paymentTerms || '').match(/(\d+)/)
      const derived = match ? match[1] : ''
      if ((prev.creditDays || '') === (derived || '')) {
        return prev
      }
      return { ...prev, creditDays: derived }
    })
  }, [poForm.paymentTerms])

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

  const resetPoWorkflow = useCallback(() => {
    setPoForm(createCustomerPoForm())
    setPoItems([createCustomerPoItem()])
    setPoPdfFile(null)
    setPoParseResult(null)
    setPoParseLoading(false)
    setPoCompanyLocked(false)
    setEditingPoId(null)
    setShowPoForm(false)
  }, [])

  const handlePoFieldChange = (field, value) => {
    setPoForm(prev => ({ ...prev, [field]: value }))
  }

  const handleCompanyUnlock = () => {
    setPoCompanyLocked(false)
  }

  const handlePoItemChange = (index, field, value) => {
    setPoItems(prev => prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)))
  }

  const addPoItem = () => {
    setPoItems(prev => [...prev, createCustomerPoItem()])
  }

  const removePoItem = index => {
    setPoItems(prev => {
      if (prev.length === 1) {
        return [createCustomerPoItem()]
      }
      return prev.filter((_, idx) => idx !== index)
    })
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
        confirmButton: 'px-5 py-2 rounded-xl bg-rose-500 text-white font-semibold ml-3',
        cancelButton: 'px-5 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold'
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

  const handleStatusToggle = async company => {
    const nextStatus = (company.status || 'ACTIVE') === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try {
      await apiRequest(`/companies/${company.id}/status`, { method: 'PATCH', body: { status: nextStatus } })
      await loadCompanies()
      showToast(`Company marked ${nextStatus.toLowerCase()}`)
    } catch (error) {
      showToast(error.message)
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
        confirmButton: 'px-5 py-2 rounded-xl bg-rose-500 text-white font-semibold ml-3',
        cancelButton: 'px-5 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold'
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

  const findCompanyMatch = useCallback(header => {
    if (!header) return null
    const headerCode = (header.companyCode || '').toString().toUpperCase()
    if (headerCode) {
      const codeMatch = companies.find(company => (company.company_code || '').toUpperCase() === headerCode)
      if (codeMatch) {
        return codeMatch
      }
      const hints = COMPANY_HINTS[headerCode] || []
      if (hints.length) {
        const hintMatch = companies.find(company => {
          const name = (company.company_name || '').toLowerCase()
          return hints.some(hint => name.includes(hint))
        })
        if (hintMatch) {
          return hintMatch
        }
      }
    }
    const normalizedName = normalizeKey(header.companyName)
    if (normalizedName) {
      const exactMatch = companies.find(company => normalizeKey(company.company_name) === normalizedName)
      if (exactMatch) {
        return exactMatch
      }
      const partialMatch = companies.find(company => normalizeKey(company.company_name).includes(normalizedName))
      if (partialMatch) {
        return partialMatch
      }
    }
    return null
  }, [companies])

  const selectedCompany = useMemo(() => {
    if (!poForm.companyId) return null
    return companies.find(company => String(company.id) === String(poForm.companyId)) || null
  }, [companies, poForm.companyId])

  const companyState = useMemo(() => {
    if (!selectedCompany?.addresses?.length) return ''
    const billing = selectedCompany.addresses.find(address => (address.address_type || '').toUpperCase() === 'BILLING')
    return (billing?.state || '').toLowerCase()
  }, [selectedCompany])

  const isIntrastate = companyState ? companyState === HOME_PLANT_STATE : true

  const handlePoPdfUpload = async event => {
    const file = event.target?.files?.[0]
    if (!file) return
    setPoPdfFile(file)
    setPoParseLoading(true)
    setPoParseResult(null)
    try {
      const formData = new FormData()
      formData.append('poPdf', file)
      const response = await fetch(`${API_BASE}/customer-pos/parse`, { 
        method: 'POST', 
        body: formData,
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.message || 'Unable to read PO PDF')
      }
      const data = await response.json()
      const header = data.header || {}
      const matchedCompany = findCompanyMatch(header)
      setPoCompanyLocked(Boolean(matchedCompany))
      setPoParseResult(header)
      setPoForm(prev => {
        const nextCompanyId = matchedCompany?.id ? matchedCompany.id.toString() : prev.companyId
        return {
          ...prev,
          companyId: nextCompanyId || '',
          poNumber: header.poNumber || prev.poNumber,
          poDate: header.poDate ? header.poDate.slice(0, 10) : prev.poDate,
          paymentTerms: header.paymentTerms || prev.paymentTerms,
          creditDays: header.creditDays || prev.creditDays,
          freightTerms: header.freightTerms || prev.freightTerms,
          packingForwarding: header.packingForwarding || prev.packingForwarding,
          insuranceTerms: header.insuranceTerms || prev.insuranceTerms,
          currency: header.currency || prev.currency,
          deliveryTerms: header.deliveryTerms || prev.deliveryTerms,
          remarks: header.remarks || prev.remarks
        }
      })
      if (Array.isArray(data.items) && data.items.length) {
        setPoItems(
          data.items.map(item => ({
            drawingNo: item.drawingNo || item.itemCode || '',
            description: item.description || '',
            quantity: parseIndianNumber(item.quantity) || 1,
            unit: item.unit || 'NOS',
            rate: parseIndianNumber(item.rate),
            cgstPercent: parseIndianNumber(item.cgstPercent ?? item.cgst),
            sgstPercent: parseIndianNumber(item.sgstPercent ?? item.sgst),
            igstPercent: parseIndianNumber(item.igstPercent ?? item.igst),
            hsnCode: item.hsnCode || '',
            discount: parseIndianNumber(item.discount)
          }))
        )
      } else {
        setPoItems([createCustomerPoItem()])
      }
      showToast('PO PDF parsed')
    } catch (error) {
      showToast(error.message)
    } finally {
      setPoParseLoading(false)
      if (event.target) {
        event.target.value = ''
      }
    }
  }

  const handlePushToSalesOrder = async () => {
    if (!poForm.companyId) {
      showToast('Select a company for the PO')
      return
    }
    if (!poForm.poNumber || !poForm.poDate) {
      showToast('PO number and date are required')
      return
    }
    const preparedItems = poItems
      .map(item => {
        const taxes = normalizeTaxPercents(
          parseIndianNumber(item.cgstPercent),
          parseIndianNumber(item.sgstPercent),
          parseIndianNumber(item.igstPercent),
          isIntrastate
        )
        return {
          drawingNo: item.drawingNo || '',
          description: item.description || '',
          quantity: parseIndianNumber(item.quantity),
          unit: item.unit || 'NOS',
          rate: parseIndianNumber(item.rate),
          cgstPercent: taxes.cgstPercent,
          sgstPercent: taxes.sgstPercent,
          igstPercent: taxes.igstPercent,
          hsnCode: item.hsnCode || '',
          discount: parseIndianNumber(item.discount)
        }
      })
      .filter(item => item.description)

    if (!preparedItems.length) {
      showToast('Add at least one line item')
      return
    }

    if (preparedItems.some(item => item.quantity <= 0)) {
      showToast('Enter quantity for each line item')
      return
    }

    setPoSaving(true)
    try {
      const formData = new FormData()
      formData.append('companyId', poForm.companyId)
      formData.append('poNumber', poForm.poNumber)
      formData.append('poDate', poForm.poDate)
      formData.append('paymentTerms', poForm.paymentTerms)
      formData.append('creditDays', poForm.creditDays)
      formData.append('freightTerms', poForm.freightTerms)
      formData.append('packingForwarding', poForm.packingForwarding)
      formData.append('insuranceTerms', poForm.insuranceTerms)
      formData.append('currency', poForm.currency)
      formData.append('deliveryTerms', poForm.deliveryTerms)
      formData.append('remarks', poForm.remarks)
      formData.append('items', JSON.stringify(preparedItems))
      if (poPdfFile) {
        formData.append('poPdf', poPdfFile)
      }
      const url = editingPoId ? `${API_BASE}/customer-pos/${editingPoId}` : `${API_BASE}/customer-pos`
      const method = editingPoId ? 'PUT' : 'POST'

      const response = await fetch(url, { 
        method, 
        body: formData,
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.message || 'Unable to save Customer PO')
      }
      await response.json()
      showToast(editingPoId ? 'Customer PO updated' : 'Customer PO captured & Sales Order created')
      await loadCustomerPos()
      if (!editingPoId) {
        await loadSalesOrders()
        navigate('/sales-order')
      }
      resetPoWorkflow()
    } catch (error) {
      showToast(error.message)
    } finally {
      setPoSaving(false)
    }
  }

  const handleEditCustomerPo = async (po) => {
    setEditingPoId(po.id)
    setShowPoForm(true)
    setPoForm({
      companyId: po.company_id || '',
      poNumber: po.po_number || '',
      poDate: po.po_date ? po.po_date.split('T')[0] : '',
      paymentTerms: po.payment_terms || '',
      creditDays: po.credit_days || '',
      freightTerms: po.freight_terms || '',
      packingForwarding: po.packing_forwarding || '',
      insuranceTerms: po.insurance_terms || '',
      currency: po.currency || 'INR',
      deliveryTerms: po.delivery_terms || '',
      remarks: po.remarks || ''
    })
    
    try {
      const data = await apiRequest(`/customer-pos/${po.id}`)
      if (data && data.items) {
        setPoItems(data.items.map(item => ({
          drawingNo: item.drawing_no || '',
          description: item.description || '',
          quantity: item.quantity || 0,
          unit: item.unit || 'NOS',
          rate: item.rate || 0,
          cgstPercent: item.cgst_percent || 0,
          sgstPercent: item.sgst_percent || 0,
          igstPercent: item.igst_percent || 0,
          hsnCode: item.hsn_code || '',
          discount: item.discount || 0
        })))
      }
    } catch (error) {
      showToast('Failed to load PO items')
    }
    
    // Scroll to form
    const formElement = document.getElementById('customer-po-upload')
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleDeleteCustomerPo = async (poId) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Delete Customer PO?',
      text: 'This will also delete the linked Sales Order. This action cannot be undone.',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      showCancelButton: true,
      buttonsStyling: false,
      customClass: {
        confirmButton: 'px-5 py-2 rounded-xl bg-rose-500 text-white font-semibold ml-3',
        cancelButton: 'px-5 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold'
      }
    })

    if (!result.isConfirmed) return

    try {
      await apiRequest(`/customer-pos/${poId}`, { method: 'DELETE' })
      showToast('Customer PO deleted')
      await loadCustomerPos()
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

  const closePoDetailDrawer = () => {
    setPoDetailDrawerOpen(false)
    setPoDetail(null)
    setPoDetailError('')
    setSelectedPoId(null)
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

  const currencyFormatter = useMemo(() => {
    const currencyCode = (poForm.currency || 'INR').toUpperCase()
    try {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currencyCode, minimumFractionDigits: 2 })
    } catch {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })
    }
  }, [poForm.currency])

  const formatCurrency = value => currencyFormatter.format(Number(value) || 0)

  const poSummary = useMemo(() => {
    return poItems.reduce(
      (acc, item) => {
        const qty = parseIndianNumber(item.quantity)
        const rate = parseIndianNumber(item.rate)
        const line = qty * rate
        if (!line) {
          return acc
        }
        const taxes = normalizeTaxPercents(
          parseIndianNumber(item.cgstPercent),
          parseIndianNumber(item.sgstPercent),
          parseIndianNumber(item.igstPercent),
          isIntrastate
        )
        const cgst = line * (taxes.cgstPercent / 100)
        const sgst = line * (taxes.sgstPercent / 100)
        const igst = line * (taxes.igstPercent / 100)
        acc.subtotal += line
        acc.cgst += cgst
        acc.sgst += sgst
        acc.igst += igst
        acc.net += line + cgst + sgst + igst
        return acc
      },
      { subtotal: 0, cgst: 0, sgst: 0, igst: 0, net: 0 }
    )
  }, [poItems, isIntrastate])

  const triggerPoUpload = useCallback(() => {
    if (poUploadInputRef.current) {
      poUploadInputRef.current.value = ''
      poUploadInputRef.current.click()
    }
  }, [])

  const drawerTitle = drawerMode === 'edit' ? 'Edit Company' : drawerMode === 'view' ? 'Company Details' : 'Add New Company'
  const primaryButtonLabel = drawerMode === 'edit' ? 'Update Company' : 'Save Company'
  const isReadOnly = drawerMode === 'view'

  const allNavigationItems = [
    { label: 'Company / Customer Master', moduleId: 'company-master' },
    { label: 'Client Contacts', moduleId: 'client-contacts' },
    { label: 'Customer PO', moduleId: 'customer-po' },
    { label: 'Sales Order', moduleId: 'sales-order' },
    { label: 'Incoming Orders', moduleId: 'incoming-orders' },
    { label: 'Vendor Management', isGroup: true, isDisabled: true, groupId: 'vendor-group' },
    { label: 'Vendors', moduleId: 'vendors', indent: true },
    { label: 'Quotations (RFQ)', moduleId: 'quotations', indent: true },
    { label: 'Purchase Orders', moduleId: 'purchase-orders', indent: true },
    { label: 'PO Receipts', moduleId: 'po-receipts', indent: true },
    { label: 'Inventory Management', isGroup: true, isDisabled: true, groupId: 'inventory-group' },
    { label: 'Inventory Dashboard', moduleId: 'inventory-dashboard', indent: true },
    { label: 'GRN Processing', moduleId: 'grn', indent: true },
    { label: 'QC Inspections', moduleId: 'qc-inspections', indent: true },
    { label: 'Stock Ledger', moduleId: 'stock-ledger', indent: true },
    { label: 'Stock Balance', moduleId: 'stock-balance', indent: true }
  ]

  const getUserDepartmentCode = () => {
    if (user?.department_code) return user.department_code
    
    const deptMap = {
      'Sales': 'SALES',
      'Design Engineering': 'DESIGN_ENG',
      'Production': 'PRODUCTION',
      'Quality': 'QUALITY',
      'Procurement': 'PROCUREMENT',
      'Shipment': 'SHIPMENT',
      'Accounts': 'ACCOUNTS',
      'Inventory': 'INVENTORY',
      'Admin': 'ADMIN'
    }
    
    if (user?.department_name && deptMap[user.department_name]) {
      return deptMap[user.department_name]
    }
    
    return user?.department_name?.toUpperCase().replace(/\s+/g, '_') || 'SALES'
  }
  
  const userDepartmentCode = getUserDepartmentCode()
  const allowedModules = DEPARTMENT_MODULES[userDepartmentCode] || DEPARTMENT_MODULES.SALES

  const navigationItems = allNavigationItems.filter(item => 
    !item.isGroup && (!item.moduleId || allowedModules.includes(item.moduleId))
  )

  useEffect(() => {
    if (user && navigationItems.length > 0 && navigationItems[0].moduleId) {
      const firstAllowedModule = navigationItems[0].moduleId
      
      // Redirect if trying to access unauthorized module or on root path
      if (!allowedModules.includes(activeModule)) {
        navigate(`/${firstAllowedModule}`)
      }
    }
  }, [user, navigationItems, allowedModules, activeModule, navigate])

  const moduleMeta = {
    'company-master': {
      badge: 'Master Data',
      title: 'Company / Customer Master',
      description: 'Manage all companies used across ERP',
      actions: (
        <>
          <button
            type="button"
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
            onClick={loadCompanies}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={toggleCreatePanel}
            className="px-5 py-2 rounded-2xl bg-slate-900 text-white text-sm font-semibold shadow-sm hover:bg-slate-800"
          >
            {showCreatePanel ? 'Close Form' : '+ New Company'}
          </button>
        </>
      )
    },
    'client-contacts': {
      badge: 'Client Contacts',
      title: 'Client Contacts',
      description: 'Manage customer touchpoints per company',
      actions: (
        <button
          type="button"
          className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
          onClick={loadCompanies}
        >
          Refresh
        </button>
      )
    },
    'customer-po': {
      badge: 'Order Intake',
      title: 'Customer PO',
      description: 'Capture purchase orders, parse PDFs, and push to Sales Orders',
      actions: (
        <>
          <button
            type="button"
            className="px-5 py-2 rounded-2xl bg-slate-900 text-white text-sm font-semibold shadow-sm hover:bg-slate-800 disabled:opacity-60"
            onClick={() => {
              if (showPoForm) {
                setShowPoForm(false)
                resetPoWorkflow()
              } else {
                setShowPoForm(true)
              }
            }}
          >
            {showPoForm ? 'View PO List' : '+ Add New PO'}
          </button>
          {showPoForm && (
            <button
              type="button"
              className="px-5 py-2 rounded-2xl bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-60"
              onClick={triggerPoUpload}
              disabled={poParseLoading}
            >
              {poParseLoading ? 'Reading…' : 'Upload PO PDF'}
            </button>
          )}
        </>
      )
    },
    'sales-order': {
      badge: 'Sales Flow',
      title: 'Sales Orders',
      description: 'Review Customer POs pushed into downstream Sales Orders',
      actions: (
        <>
          <button
            type="button"
            className="px-5 py-2 rounded-2xl bg-slate-900 text-white text-sm font-semibold shadow-sm hover:bg-slate-800 disabled:opacity-60"
            onClick={() => {
              if (showSalesOrderForm) {
                resetSalesOrderForm()
              } else {
                setShowSalesOrderForm(true)
              }
            }}
          >
            {showSalesOrderForm ? 'View SO Board' : '+ Add New SO'}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
            onClick={loadSalesOrders}
            disabled={salesOrdersLoading}
          >
            {salesOrdersLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </>
      )
    },
    'incoming-orders': {
      badge: 'Department Workflow',
      title: 'Incoming Orders',
      description: 'Accept or reject incoming sales orders from upstream departments',
      actions: null
    },
    'vendor-management': {
      badge: 'Procurement',
      title: 'Vendor Management',
      description: 'Manage vendors, send RFQs, and create purchase orders',
      actions: null
    },
    'vendors': {
      badge: 'Procurement',
      title: 'Vendors',
      description: 'Manage supplier and vendor information',
      actions: null
    },
    'quotations': {
      badge: 'Procurement',
      title: 'Quotations (RFQ)',
      description: 'Request quotations and manage vendor responses',
      actions: null
    },
    'purchase-orders': {
      badge: 'Procurement',
      title: 'Purchase Orders',
      description: 'Create and manage vendor purchase orders',
      actions: null
    },
    'grn': {
      badge: 'Quality Control',
      title: 'GRN Processing',
      description: 'Manage Goods Received Notes',
      actions: null
    },
    'qc-inspections': {
      badge: 'Quality Control',
      title: 'QC Inspections',
      description: 'Manage Quality Control Inspections',
      actions: null
    },
    'inventory-dashboard': {
      badge: 'Inventory Management',
      title: 'Inventory Dashboard',
      description: 'Overview of incoming orders, stock levels, and pending activities',
      actions: null
    },
    'po-receipts': {
      badge: 'Procurement',
      title: 'PO Receipts',
      description: 'Track purchase order receipts and deliveries',
      actions: null
    },
    'stock-ledger': {
      badge: 'Inventory Management',
      title: 'Stock Ledger',
      description: 'Detailed transaction history for all stock items',
      actions: null
    },
    'stock-balance': {
      badge: 'Inventory Management',
      title: 'Stock Balance',
      description: 'Current stock levels and inventory status',
      actions: null
    }
  }

  const activeModuleMeta = moduleMeta[activeModule] || moduleMeta[DEFAULT_MODULE]
  const poDetailItems = Array.isArray(poDetail?.items) ? poDetail.items : []
  const poDetailPdfUrl = poDetail?.pdf_path ? getPoPdfUrl(poDetail.pdf_path) : null

  if (!token || !user) {
    return (
      <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="h-16 w-16 rounded-2xl bg-slate-900 flex items-center justify-center mx-auto p-2">
                <img src={sptechLogo} alt="SPTECHPIONEER Logo" className="h-full w-full object-contain" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">SPTECHPIONEER</h1>
              <p className="text-sm text-slate-500">Sales & Operations ERP</p>
            </div>

            <div className="flex gap-2 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`flex-1 pb-3 text-sm font-semibold transition ${
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
                className={`flex-1 pb-3 text-sm font-semibold transition ${
                  authMode === 'signup'
                    ? 'text-slate-900 border-b-2 border-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Sign Up
              </button>
            </div>

            {authMode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
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
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
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
                  className="w-full px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60 transition"
                >
                  {loginLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-3 max-h-96 overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">First Name</label>
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm</label>
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
                  className="w-full px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60 transition text-sm"
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
                <p className="font-semibold">Demo Credentials:</p>
                <div className="space-y-1 text-left bg-slate-50 p-3 rounded-lg">
                  <p><strong>Admin:</strong> admin@company.com / Admin@123</p>
                  <p><strong>Sales:</strong> sales@company.com / Sales@123</p>
                  <p><strong>Design:</strong> design@company.com / Design@123</p>
                  <p><strong>Production:</strong> production@company.com / Production@123</p>
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
      <input ref={poUploadInputRef} type="file" accept=".pdf,.xls,.xlsx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={handlePoPdfUpload} />
      <div className="flex min-h-screen bg-slate-100 text-slate-900">
        <aside className={`fixed lg:flex inset-y-0 left-0 w-72 bg-slate-900 text-white flex-col transition-transform lg:transition-none z-50 ${
          mobileMenuOpen ? 'flex' : 'hidden'
        } lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="px-6 py-8 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center p-1.5">
                <img src={sptechLogo} alt="SPTECHPIONEER Logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="text-lg font-semibold leading-tight">SPTECHPIONEER PVT LTD</p>
                <p className="text-sm text-white/70">{user?.department_name || 'Department'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1 hover:bg-white/10 rounded transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-white/50">{user?.department_name || 'Department'}</p>
            <div className="space-y-1">
              {navigationItems.map((item, index) => {
                const isActive = item.moduleId ? activeModule === item.moduleId : Boolean(item.active)
                const isDisabled = item.isGroup || !item.moduleId
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
                    className={`flex items-center gap-3 w-full px-4 py-2 rounded-xl text-sm font-medium transition ${item.indent ? 'ml-4' : ''} ${
                      isActive ? 'bg-white/15 text-white shadow-inner' : isDisabled ? 'text-white/40 cursor-not-allowed' : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`}
                    disabled={isDisabled}
                  >
                    {!item.indent && <span className="text-[0.65rem] font-semibold tracking-[0.35em] text-white/50">{String(index + 1).padStart(2, '0')}</span>}
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="px-6 py-6 border-t border-white/10 space-y-3">
            <div className="bg-white/10 rounded-2xl px-5 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white font-semibold">
                  {(user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{user?.first_name || user?.username || 'User'}</p>
                  <p className="text-xs text-white/70">{user?.department_name || user?.role_name || 'User'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition"
              >
                Logout
              </button>
            </div>
          </div>
        </aside>

        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <div className="flex-1 lg:ml-72 flex flex-col bg-slate-50">
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
            <div className="px-4 sm:px-6 lg:px-10 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                  </svg>
                </button>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search modules"
                    className="pl-10 pr-4 py-2.5 rounded-2xl bg-slate-100 border border-slate-200 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                    disabled
                  />
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
                </div>
                <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
                  <span>EN</span>
                  <span className="text-slate-300">|</span>
                  <span>Admin</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.first_name || user?.username || 'User'}</p>
                  <p className="text-xs text-slate-500">{user?.role_name || user?.department_name || 'User'}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-semibold text-lg">
                  {(user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 px-4 sm:px-6 lg:px-10 py-10 space-y-8">
            {location.pathname.startsWith('/receipt-details/') ? (
              <POReceiptDetails />
            ) : (
              <>
                {toast && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-2xl text-sm shadow-sm">
                    {toast}
                  </div>
                )}

                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.35em] text-slate-400 uppercase">{activeModuleMeta.badge}</p>
                    <h1 className="text-3xl font-semibold text-slate-900 mt-2">{activeModuleMeta.title}</h1>
                    <p className="text-sm text-slate-500 mt-1">{activeModuleMeta.description}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap justify-end">
                    {activeModuleMeta.actions}
                  </div>
                </div>

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
                    onOpenContactDrawer={openContactDrawer}
                    onViewCompany={handleViewCompany}
                    onEditCompany={handleEditCompany}
                    onToggleStatus={handleStatusToggle}
                    onDeleteCompany={handleDeleteCompany}
                  />
                )}

                {activeModule === 'client-contacts' && (
                  <ClientContacts companies={companies} onOpenContactDrawer={openContactDrawer} />
                )}

                {activeModule === 'customer-po' && (
                  <CustomerPO
                    companies={companies}
                    poForm={poForm}
                    fieldInputClass={fieldInputClass}
                    onFieldChange={handlePoFieldChange}
                    poCompanyLocked={poCompanyLocked}
                    onUnlockCompany={handleCompanyUnlock}
                    poPdfFile={poPdfFile}
                    poParseLoading={poParseLoading}
                    poParseResult={poParseResult}
                    onTriggerUpload={triggerPoUpload}
                    poItems={poItems}
                    onItemChange={handlePoItemChange}
                    onRemoveItem={removePoItem}
                    onAddItem={addPoItem}
                    poSummary={poSummary}
                    formatCurrency={formatCurrency}
                    parseIndianNumber={parseIndianNumber}
                    onPushToSalesOrder={handlePushToSalesOrder}
                    poSaving={poSaving}
                    customerPos={customerPos}
                    customerPosLoading={customerPosLoading}
                    onEditPo={handleEditCustomerPo}
                    onDeletePo={handleDeleteCustomerPo}
                    onViewPo={handleViewPoDetail}
                    editingPoId={editingPoId}
                    onResetForm={resetPoWorkflow}
                    showPoForm={showPoForm}
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
                    salesOrderForm={salesOrderForm}
                    onFieldChange={handleSalesOrderFieldChange}
                    onSubmit={handleCreateSalesOrder}
                    onResetForm={resetSalesOrderForm}
                    companies={companies}
                    customerPos={customerPos}
                    selectedPoForSo={selectedPoForSo}
                    soItems={soItems}
                    setSoItems={setSoItems}
                    poItemsLoading={poItemsLoading}
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
                <p className="text-xs font-semibold tracking-[0.35em] text-slate-400 uppercase">{drawerMode === 'view' ? 'Overview' : 'Workflow'}</p>
                <h3 className="text-2xl font-semibold text-slate-900">{drawerTitle}</h3>
              </div>
              <button type="button" onClick={closeDrawer} className="h-10 w-10 rounded-full border border-slate-200 text-slate-500 hover:text-slate-900">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <form className="space-y-6" onSubmit={handleCompanySubmit}>
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
                    <input className={`${fieldInputClass} uppercase`} value={companyForm.gstin} onChange={e => setCompanyForm(prev => ({ ...prev, gstin: e.target.value }))} required disabled={isReadOnly} />
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
                    <p className="text-[0.65rem] font-semibold tracking-[0.35em] text-slate-500 uppercase">Billing Address</p>
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
                    <p className="text-[0.65rem] font-semibold tracking-[0.35em] text-slate-500 uppercase">Shipping Address</p>
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
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:border-slate-300"
                  >
                    {drawerMode === 'view' ? 'Close' : 'Cancel'}
                  </button>
                  {drawerMode !== 'view' && (
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-indigo-500 text-white text-sm font-semibold shadow-sm hover:bg-indigo-600 disabled:opacity-60"
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
                <p className="text-xs font-semibold tracking-[0.35em] text-slate-400 uppercase">Client Contacts</p>
                <h3 className="text-2xl font-semibold text-slate-900">{contactCompany.company_name}</h3>
                <p className="text-sm text-slate-500">{contactCompany.company_code}</p>
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
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.35em] text-slate-400 uppercase">Directory</p>
                    <h4 className="text-lg font-semibold text-slate-900">Existing Contacts</h4>
                  </div>
                  <button
                    type="button"
                    onClick={resetContactForm}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-50"
                    disabled={contactFormDisabled}
                  >
                    New Contact
                  </button>
                </div>
                {contactListLoading ? (
                  <div className="p-6 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-2xl">Loading contacts...</div>
                ) : contactList.length ? (
                  <div className="space-y-3">
                    {contactList.map(contact => (
                      <div key={contact.id} className="border border-slate-200 rounded-2xl bg-white p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-slate-900">{contact.name || 'Untitled Contact'}</p>
                            <p className="text-sm text-slate-500">{contact.designation || '—'}</p>
                            <p className="text-[0.6rem] font-semibold tracking-[0.35em] uppercase text-slate-400 mt-2">
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
                            className="px-3 py-1.5 rounded-lg border border-indigo-200 text-xs font-semibold text-indigo-600 hover:border-indigo-300 disabled:opacity-50"
                            onClick={() => handleEditContact(contact)}
                            disabled={contactFormDisabled}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-lg border border-amber-200 text-xs font-semibold text-amber-600 hover:border-amber-300 disabled:opacity-50"
                            onClick={() => handleContactStatusToggle(contact)}
                            disabled={!isCompanyActive(contactCompany)}
                          >
                            {getContactStatusActionLabel(contact.status)}
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-lg border border-rose-200 text-xs font-semibold text-rose-600 hover:border-rose-300 disabled:opacity-50"
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
                  <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl text-sm text-slate-500">
                    No contacts found. Use the form to create one.
                  </div>
                )}
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-5">
                <div>
                  <p className="text-xs font-semibold tracking-[0.35em] text-slate-400 uppercase">{editingContactId ? 'Update Contact' : 'Add Contact'}</p>
                  <h4 className="text-xl font-semibold text-slate-900">{editingContactId ? 'Edit Existing Contact' : 'Create New Contact'}</h4>
                </div>
                {!isCompanyActive(contactCompany) && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-2xl text-sm">
                    Activate this company to manage contacts.
                  </div>
                )}
                <form className="space-y-4" onSubmit={handleContactSubmit}>
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-semibold tracking-[0.35em] text-slate-500 uppercase">Name</label>
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
                    <label className="flex flex-col gap-2 text-[0.65rem] font-semibold tracking-[0.35em] text-slate-500 uppercase">
                      <span>Designation</span>
                      <input
                        className={fieldInputClass}
                        value={contactForm.designation}
                        onChange={e => handleContactFormChange('designation', e.target.value)}
                        placeholder="Designation"
                        disabled={contactFormDisabled}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[0.65rem] font-semibold tracking-[0.35em] text-slate-500 uppercase">
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
                    <label className="flex flex-col gap-2 text-[0.65rem] font-semibold tracking-[0.35em] text-slate-500 uppercase">
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
                    <label className="flex flex-col gap-2 text-[0.65rem] font-semibold tracking-[0.35em] text-slate-500 uppercase">
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
                      className="px-5 py-2 rounded-xl bg-indigo-500 text-white text-sm font-semibold shadow-sm hover:bg-indigo-600 disabled:opacity-60"
                      disabled={contactFormDisabled || contactSaving}
                    >
                      {contactSaving ? 'Saving...' : editingContactId ? 'Update Contact' : 'Add Contact'}
                    </button>
                    {editingContactId && (
                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:border-slate-300"
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
                  <p className="text-xs font-semibold tracking-[0.35em] text-slate-400 uppercase">Purchase Order</p>
                  <h2 className="text-3xl font-bold text-slate-900 mt-1">{poDetail?.po_number || 'PO'}</h2>
                </div>
                <div className="flex items-center gap-3">
                  {poDetailPdfUrl && (
                    <a href={poDetailPdfUrl} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-xl bg-indigo-100 text-sm font-semibold text-indigo-700 hover:bg-indigo-200">
                      Download PDF
                    </a>
                  )}
                  <button type="button" onClick={closePoDetailDrawer} className="h-10 w-10 rounded-full border border-slate-200 text-slate-500 hover:text-slate-900">✕</button>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4">
                <p className="text-[0.65rem] font-bold tracking-[0.35em] text-slate-500 uppercase mb-2">Bill To</p>
                <p className="text-lg font-semibold text-slate-900">{poDetail?.company_name || '—'}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {poDetailLoading && <p className="p-8 text-sm text-slate-500">Loading PO details…</p>}
              {!poDetailLoading && poDetailError && (
                <div className="m-6 bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-2xl text-sm">{poDetailError}</div>
              )}
              {!poDetailLoading && !poDetailError && poDetail && (
                <div className="p-8 space-y-8">
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-[0.65rem] font-bold tracking-[0.35em] text-slate-500 uppercase mb-2">PO Date</p>
                      <p className="text-lg font-semibold text-slate-900">{formatDisplayDate(poDetail.po_date)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-[0.65rem] font-bold tracking-[0.35em] text-slate-500 uppercase mb-2">Status</p>
                      <p className="text-lg font-semibold text-slate-900">{(poDetail.status || 'DRAFT').split('_').map(chunk => chunk.charAt(0) + chunk.slice(1).toLowerCase()).join(' ')}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-[0.65rem] font-bold tracking-[0.35em] text-slate-500 uppercase mb-2">Currency</p>
                      <p className="text-lg font-semibold text-slate-900">{poDetail.currency || 'INR'}</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-8">
                    <div className="grid md:grid-cols-2 gap-8 text-sm">
                      <div>
                        <p className="text-[0.65rem] font-bold tracking-[0.35em] text-slate-500 uppercase mb-3">Terms & Conditions</p>
                        <div className="space-y-2">
                          <div><span className="text-slate-600">Payment Terms:</span><p className="font-medium text-slate-900 mt-1">{poDetail.payment_terms || '—'}</p></div>
                          <div><span className="text-slate-600">Credit Days:</span><p className="font-medium text-slate-900 mt-1">{poDetail.credit_days ?? '—'}</p></div>
                          <div><span className="text-slate-600">Delivery Terms:</span><p className="font-medium text-slate-900 mt-1">{poDetail.delivery_terms || '—'}</p></div>
                        </div>
                      </div>
                      <div>
                        <p className="text-[0.65rem] font-bold tracking-[0.35em] text-slate-500 uppercase mb-3">Shipping & Charges</p>
                        <div className="space-y-2">
                          <div><span className="text-slate-600">Freight Terms:</span><p className="font-medium text-slate-900 mt-1">{poDetail.freight_terms || '—'}</p></div>
                          <div><span className="text-slate-600">Packing & Fwd:</span><p className="font-medium text-slate-900 mt-1">{poDetail.packing_forwarding || '—'}</p></div>
                          <div><span className="text-slate-600">Insurance:</span><p className="font-medium text-slate-900 mt-1">{poDetail.insurance_terms || '—'}</p></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-8">
                    <p className="text-base font-bold text-slate-900 mb-4">Line Items</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-y border-slate-200">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">#</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Description</th>
                            <th className="px-4 py-3 text-right font-semibold text-slate-700">Qty</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Unit</th>
                            <th className="px-4 py-3 text-right font-semibold text-slate-700">Rate</th>
                            <th className="px-4 py-3 text-right font-semibold text-slate-700">Amount</th>
                            <th className="px-4 py-3 text-right font-semibold text-slate-700">Tax %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {poDetailItems.length === 0 ? (
                            <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">No line items</td></tr>
                          ) : (
                            poDetailItems.map((item, index) => (
                              <tr key={`po-detail-item-${item.id ?? index}`} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-4 py-3 font-semibold text-slate-900">{index + 1}</td>
                                <td className="px-4 py-3"><div className="font-semibold text-slate-900">{item.description}</div><div className="text-xs text-slate-500">Drw No: {item.drawing_no || item.item_code || 'N/A'}</div></td>
                                <td className="px-4 py-3 text-right font-medium text-slate-900">{item.quantity ?? '—'}</td>
                                <td className="px-4 py-3 text-slate-600">{item.unit || '—'}</td>
                                <td className="px-4 py-3 text-right text-slate-600">{formatCurrencyByCode(item.rate, poDetail.currency)}</td>
                                <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrencyByCode(item.basic_amount, poDetail.currency)}</td>
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
                        <div className="flex justify-between bg-slate-900 text-white rounded-2xl px-6 py-4 font-bold"><span>Total Amount:</span><span className="text-xl">{formatCurrencyByCode(poDetail.net_total, poDetail.currency)}</span></div>
                      </div>
                    </div>
                  </div>

                  {poDetail.remarks && (
                    <div className="border-t border-slate-200 pt-8">
                      <p className="text-[0.65rem] font-bold tracking-[0.35em] text-slate-500 uppercase mb-3">Remarks</p>
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
