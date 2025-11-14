import api from './api'

// Work Orders
export const getWorkOrders = async (filters = {}) => {
  const params = new URLSearchParams(filters)
  const response = await api.get(`/production/work-orders?${params}`)
  return response.data
}

export const createWorkOrder = async (data) => {
  const response = await api.post('/production/work-orders', data)
  return response.data
}

export const updateWorkOrder = async (wo_id, data) => {
  const response = await api.put(`/production/work-orders/${wo_id}`, data)
  return response.data
}

// Production Plans
export const getProductionPlans = async (filters = {}) => {
  const params = new URLSearchParams(filters)
  const response = await api.get(`/production/plans?${params}`)
  return response.data
}

export const createProductionPlan = async (data) => {
  const response = await api.post('/production/plans', data)
  return response.data
}

// Production Entries (Daily Production)
export const getProductionEntries = async (filters = {}) => {
  const params = new URLSearchParams(filters)
  const response = await api.get(`/production/entries?${params}`)
  return response.data
}

export const createProductionEntry = async (data) => {
  const response = await api.post('/production/entries', data)
  return response.data
}

// Rejections
export const recordRejection = async (data) => {
  const response = await api.post('/production/rejections', data)
  return response.data
}

export const getRejectionAnalysis = async (filters = {}) => {
  const params = new URLSearchParams(filters)
  const response = await api.get(`/production/rejections/analysis?${params}`)
  return response.data
}

// Machines
export const getMachines = async (filters = {}) => {
  const params = new URLSearchParams(filters)
  const response = await api.get(`/production/machines?${params}`)
  return response.data
}

export const createMachine = async (data) => {
  const response = await api.post('/production/machines', data)
  return response.data
}

// Operators
export const getOperators = async (filters = {}) => {
  const params = new URLSearchParams(filters)
  const response = await api.get(`/production/operators?${params}`)
  return response.data
}

export const createOperator = async (data) => {
  const response = await api.post('/production/operators', data)
  return response.data
}

// Analytics
export const getProductionDashboard = async (date) => {
  const response = await api.get(`/production/analytics/dashboard?date=${date}`)
  return response.data
}

export const getMachineUtilization = async (date_from, date_to) => {
  const response = await api.get(
    `/production/analytics/machine-utilization?date_from=${date_from}&date_to=${date_to}`
  )
  return response.data
}

export const getOperatorEfficiency = async (date_from, date_to) => {
  const response = await api.get(
    `/production/analytics/operator-efficiency?date_from=${date_from}&date_to=${date_to}`
  )
  return response.data
}