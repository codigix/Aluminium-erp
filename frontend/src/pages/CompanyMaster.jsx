import { useState } from 'react'
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
  onOpenContactDrawer,
  onViewCompany,
  onEditCompany,
  onToggleStatus,
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-slate-50 to-slate-100 px-8 py-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase" style={{ fontFamily: 'var(--font-display)' }}>New Entry</p>
                <h2 className="text-3xl font-bold text-slate-900 mt-2" style={{ fontFamily: 'var(--font-display)' }}>Register Company</h2>
              </div>
              <button
                onClick={onToggleCreatePanel}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={onInlineSubmit} className="p-8 space-y-6">
              {/* Company Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Company Information</h3>
                <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Tax Information</h3>
                <div className="grid grid-cols-3 gap-4">
                  <FormControl label="GSTIN">
                    <input
                      type="text"
                      value={companyForm.gstin}
                      onChange={e => setCompanyForm({ ...companyForm, gstin: e.target.value })}
                      placeholder="XXXXXXXXXXXX"
                      className={fieldInputClass}
                      required
                    />
                  </FormControl>
                  <FormControl label="CIN">
                    <input
                      type="text"
                      value={companyForm.cin}
                      onChange={e => setCompanyForm({ ...companyForm, cin: e.target.value })}
                      placeholder="CIN number"
                      className={fieldInputClass}
                    />
                  </FormControl>
                  <FormControl label="PAN">
                    <input
                      type="text"
                      value={companyForm.pan}
                      onChange={e => setCompanyForm({ ...companyForm, pan: e.target.value })}
                      placeholder="PAN number"
                      className={fieldInputClass}
                    />
                  </FormControl>
                </div>
              </div>

              {/* Billing Address */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Billing Address</h3>
                <FormControl label="Address Line 1">
                  <input
                    type="text"
                    value={companyForm.billingAddress.line1}
                    onChange={e => updateAddress('billingAddress', 'line1', e.target.value)}
                    className={fieldInputClass}
                  />
                </FormControl>
                <div className="grid grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 gap-4">
                  <FormControl label="Pincode">
                    <input
                      type="text"
                      value={companyForm.billingAddress.pincode}
                      onChange={e => updateAddress('billingAddress', 'pincode', e.target.value)}
                      className={fieldInputClass}
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
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Contact Person</h3>
                <FormControl label="Contact Person Name">
                  <input
                    type="text"
                    value={companyForm.contactPerson || ''}
                    onChange={e => setCompanyForm({ ...companyForm, contactPerson: e.target.value })}
                    placeholder="e.g., Mr. Milind Potdar"
                    className={fieldInputClass}
                  />
                </FormControl>
                <div className="grid grid-cols-2 gap-4">
                  <FormControl label="Mobile No.">
                    <input
                      type="tel"
                      value={companyForm.contactMobile || ''}
                      onChange={e => setCompanyForm({ ...companyForm, contactMobile: e.target.value })}
                      placeholder="e.g., 9823714674"
                      className={fieldInputClass}
                    />
                  </FormControl>
                  <FormControl label="Email">
                    <input
                      type="email"
                      value={companyForm.contactEmail || ''}
                      onChange={e => setCompanyForm({ ...companyForm, contactEmail: e.target.value })}
                      placeholder="e.g., milindpotdar@gmail.com"
                      className={fieldInputClass}
                    />
                  </FormControl>
                </div>
              </div>

              {/* Actions */}
              <div className="sticky bottom-0 bg-slate-50 -mx-8 -mb-8 px-8 py-4 border-t border-slate-200 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={onToggleCreatePanel}
                  className="px-6 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : 'Save Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="space-y-4">
        {/* Action Toolbar */}
        {selectedRows.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
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
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wide">Company Name</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wide">City</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wide">GSTIN</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase tracking-wide">Actions</th>
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
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => onViewCompany(company)}
                            title="View"
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
                          >
                            👁️
                          </button>
                          <button
                            onClick={() => onEditCompany(company)}
                            title="Edit"
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => onDeleteCompany(company)}
                            title="Delete"
                            className="p-2 rounded-lg hover:bg-red-100 text-red-600 hover:text-red-900 transition"
                          >
                            🗑️
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
      </div>
    </>
  )
}

export default CompanyMaster
