import { apiGet } from './client'

export const getWarehouses = () => apiGet('/api/stock/warehouses')
export const getStockBalance = params => apiGet('/api/stock/stock-balance', { params })
export const getStockEntries = params => apiGet('/api/stock/entries', { params })
export const getStockLedger = params => apiGet('/api/stock/ledger', { params })
export const getTransfers = () => apiGet('/api/stock/transfers')
export const getBatches = () => apiGet('/api/stock/batches')
export const getReconciliations = () => apiGet('/api/stock/reconciliations')
