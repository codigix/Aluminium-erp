import { useState } from 'react'
import { 
  Plus, 
  RotateCcw, 
  Edit, 
  Trash2, 
  Eye,
  X,
  Building2,
  User,
  MapPin,
  Search
} from 'lucide-react'
import { FormControl, StatusBadge } from '../components/ui.jsx'

const formatCustomerType = value => {
  if (!value) return '—'
  return value.toLowerCase().split(' ').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

const getCompanyCity = company => {
  const billing = company.addresses?.find(address => address.address_type === 'BILLING')
  return billing?.city || '—'
}

const CompanyMaster = ({
  companies,
  showCreatePanel,
  onToggleCreatePanel,
  onInlineSubmit,
  loading,
  companyForm,
  setCompanyForm,
  updateAddress,
  fieldInputClass,
  onViewCompany,
  onEditCompany,
  onDeleteCompany
}) => {
  const [selectedRows, setSelectedRows] = useState(new Set())
  
  const toggleRowSelection = (id) => {
    const newSelection = new Set(selectedRows)
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }
    setSelectedRows(newSelection)
  }

  const toggleAllRows = () => {
    if (selectedRows.size === companies.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(companies.map(c => c.id)))
    }
  }

  return (
    <>
      {/* Modal Form */}
      {showCreatePanel && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-[0.2em] text-indigo-600 ">Master Data</p>
                  <h2 className="text-2xl font-semibold text-slate-900">Register Company</h2>
                </div>
              </div>
              <button
                onClick={onToggleCreatePanel}
                className="p-2 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={onInlineSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Company Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Building2 className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-slate-800  tracking-wider">Company Information</h3>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <FormControl label="Company Name">
                    <input
                      type="text"
                      value={companyForm.companyName}
                      onChange={e => setCompanyForm({ ...companyForm, companyName: e.target.value })}
                      placeholder="Enter company name"
                      className={fieldInputClass}
                      required
                    />
                  </FormControl>
                  <FormControl label="Customer Type">
                    <select
                      value={companyForm.customerType}
                      onChange={e => setCompanyForm({ ...companyForm, customerType: e.target.value })}
                      className={fieldInputClass}
                    >
                      <option value="REGULAR">Regular</option>
                      <option value="PREMIUM">Premium</option>
                      <option value="DISTRIBUTOR">Distributor</option>
                    </select>
                  </FormControl>
                </div>
              </div>

              {/* Tax Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <User className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-slate-800  tracking-wider">Tax Information</h3>
                </div>
                <div className="grid grid-cols-3 gap-6">
                  <FormControl label="GSTIN">
                    <input
                      type="text"
                      value={companyForm.gstin}
                      onChange={e => setCompanyForm({ ...companyForm, gstin: e.target.value })}
                      placeholder="XXXXXXXXXXXX"
                      className={`${fieldInputClass} font-mono `}
                      required
                    />
                  </FormControl>
                  <FormControl label="CIN">
                    <input
                      type="text"
                      value={companyForm.cin}
                      onChange={e => setCompanyForm({ ...companyForm, cin: e.target.value })}
                      placeholder="CIN number"
                      className={`${fieldInputClass} font-mono `}
                    />
                  </FormControl>
                  <FormControl label="PAN">
                    <input
                      type="text"
                      value={companyForm.pan}
                      onChange={e => setCompanyForm({ ...companyForm, pan: e.target.value })}
                      placeholder="PAN number"
                      className={`${fieldInputClass} font-mono `}
                    />
                  </FormControl>
                </div>
              </div>

              {/* Billing Address */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <MapPin className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-slate-800  tracking-wider">Billing Address</h3>
                </div>
                <FormControl label="Address Line 1">
                  <input
                    type="text"
                    value={companyForm.billingAddress.line1}
                    onChange={e => updateAddress('billingAddress', 'line1', e.target.value)}
                    className={fieldInputClass}
                    placeholder="Street name, Building number"
                  />
                </FormControl>
                <div className="grid grid-cols-2 gap-6">
                  <FormControl label="City">
                    <input
                      type="text"
                      value={companyForm.billingAddress.city}
                      onChange={e => updateAddress('billingAddress', 'city', e.target.value)}
                      className={fieldInputClass}
                    />
                  </FormControl>
                  <FormControl label="State">
                    <input
                      type="text"
                      value={companyForm.billingAddress.state}
                      onChange={e => updateAddress('billingAddress', 'state', e.target.value)}
                      className={fieldInputClass}
                    />
                  </FormControl>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <FormControl label="Pincode">
                    <input
                      type="text"
                      value={companyForm.billingAddress.pincode}
                      onChange={e => updateAddress('billingAddress', 'pincode', e.target.value)}
                      className={`${fieldInputClass} font-mono`}
                    />
                  </FormControl>
                  <FormControl label="Country">
                    <input
                      type="text"
                      value={companyForm.billingAddress.country}
                      onChange={e => updateAddress('billingAddress', 'country', e.target.value)}
                      className={fieldInputClass}
                    />
                  </FormControl>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <User className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-slate-800  tracking-wider">Contact Person</h3>
                </div>
                <FormControl label="Contact Person Name">
                  <input
                    type="text"
                    value={companyForm.contactPerson || ''}
                    onChange={e => setCompanyForm({ ...companyForm, contactPerson: e.target.value })}
                    placeholder="e.g., Mr. Milind Potdar"
                    className={fieldInputClass}
                  />
                </FormControl>
                <div className="grid grid-cols-2 gap-6">
                  <FormControl label="Mobile No.">
                    <input
                      type="tel"
                      value={companyForm.contactMobile || ''}
                      onChange={e => setCompanyForm({ ...companyForm, contactMobile: e.target.value })}
                      placeholder="e.g., 9823714674"
                      className={`${fieldInputClass} font-mono`}
                    />
                  </FormControl>
                  <FormControl label="Email">
                    <input
                      type="email"
                      value={companyForm.contactEmail || ''}
                      onChange={e => setCompanyForm({ ...companyForm, contactEmail: e.target.value })}
                      placeholder="e.g., contact@company.com"
                      className={fieldInputClass}
                    />
                  </FormControl>
                </div>
              </div>
            </form>

            {/* Actions */}
            <div className="px-8 py-6 border-t border-slate-100 flex gap-3 justify-end bg-slate-50/50">
              <button
                type="button"
                onClick={onToggleCreatePanel}
                className="px-6 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-white hover:shadow-sm transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
              >
                {loading ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Save Company</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Building2 className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-xl text-slate-900">Company Master</h2>
          </div>
          <p className="text-sm text-slate-500 ml-10">Manage customers, vendors, and partner organizations</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            title="Refresh Data"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          
          <button
            type="button"
            onClick={onToggleCreatePanel}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>New Company</span>
          </button>
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedRows.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-blue-600 text-white flex items-center justify-center text-sm ">
                {selectedRows.size}
              </div>
              <span className="text-sm font-medium text-slate-700">{selectedRows.size} selected</span>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Deactivate
              </button>
              <button className="px-4 py-2 rounded-lg bg-white border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50">
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Table Header */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === companies.length && companies.length > 0}
                      onChange={toggleAllRows}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs  text-slate-700  tracking-wide">Company Name</th>
                  <th className="px-4 py-3 text-left text-xs  text-slate-700  tracking-wide">Type</th>
                  <th className="px-4 py-3 text-left text-xs  text-slate-700  tracking-wide">City</th>
                  <th className="px-4 py-3 text-left text-xs  text-slate-700  tracking-wide">GSTIN</th>
                  <th className="px-4 py-3 text-left text-xs  text-slate-700  tracking-wide">Status</th>
                  <th className="px-4 py-3 text-right text-xs  text-slate-700  tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
                      No companies found. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  companies.map(company => (
                    <tr key={company.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(company.id)}
                          onChange={() => toggleRowSelection(company.id)}
                          className="w-4 h-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{company.company_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatCustomerType(company.customer_type)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{getCompanyCity(company)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 font-mono">{company.gstin || '—'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={company.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => onViewCompany(company)}
                            title="View"
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => onEditCompany(company)}
                            title="Edit"
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-600 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => onDeleteCompany(company)}
                            title="Delete"
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
    </>
  )
}

export default CompanyMaster
