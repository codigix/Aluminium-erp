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
import { FormControl, StatusBadge, Modal } from '../components/ui.jsx'

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
      <Modal
        isOpen={showCreatePanel}
        onClose={onToggleCreatePanel}
        title="Register Company"
      >
        <form onSubmit={onInlineSubmit} className="space-y-8 max-h-[70vh] overflow-y-auto px-1">
          {/* Company Info */}
          <div className="">
            <div className="flex items-center gap-2  pb-2 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm  text-slate-800  ">Company Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
          <div className="">
            <div className="flex items-center gap-2  pb-2 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm  text-slate-800  ">Tax Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormControl label="GSTIN">
                <input
                  type="text"
                  value={companyForm.gstin}
                  onChange={e => setCompanyForm({ ...companyForm, gstin: e.target.value })}
                  placeholder="XXXXXXXXXXXX"
                  className={`${fieldInputClass}  `}
                  required
                />
              </FormControl>
              <FormControl label="CIN">
                <input
                  type="text"
                  value={companyForm.cin}
                  onChange={e => setCompanyForm({ ...companyForm, cin: e.target.value })}
                  placeholder="CIN number"
                  className={`${fieldInputClass}  `}
                />
              </FormControl>
              <FormControl label="PAN">
                <input
                  type="text"
                  value={companyForm.pan}
                  onChange={e => setCompanyForm({ ...companyForm, pan: e.target.value })}
                  placeholder="PAN number"
                  className={`${fieldInputClass}  `}
                />
              </FormControl>
            </div>
          </div>

          {/* Billing Address */}
          <div className="">
            <div className="flex items-center gap-2  pb-2 border-b border-slate-100">
              <MapPin className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm  text-slate-800  ">Billing Address</h3>
            </div>
            <div className="space-y-3">
              <FormControl label="Address Line 1">
                <input
                  type="text"
                  value={companyForm.billingAddress.line1}
                  onChange={e => updateAddress('billingAddress', 'line1', e.target.value)}
                  className={fieldInputClass}
                  placeholder="Street name, Building number"
                />
              </FormControl>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <FormControl label="Pincode">
                  <input
                    type="text"
                    value={companyForm.billingAddress.pincode}
                    onChange={e => updateAddress('billingAddress', 'pincode', e.target.value)}
                    className={`${fieldInputClass}  `}
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
          </div>

          {/* Contact Person */}
          <div className="">
            <div className="flex items-center gap-2  pb-2 border-b border-slate-100">
              <User className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm  text-slate-800  ">Contact Person</h3>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <FormControl label="Mobile No.">
                <input
                  type="tel"
                  value={companyForm.contactMobile || ''}
                  onChange={e => setCompanyForm({ ...companyForm, contactMobile: e.target.value })}
                  placeholder="e.g., 9823714674"
                  className={`${fieldInputClass}  `}
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

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={onToggleCreatePanel}
              className="p-2.5 rounded  border border-slate-200 text-slate-600 text-xs  hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-10 py-2.5 rounded  bg-indigo-600 text-white text-xs  hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 flex items-center gap-2 "
            >
              {loading ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Save Company
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Action Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-indigo-50 rounded ">
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
            className="p-2.5 rounded  border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all "
            title="Refresh Data"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          
          <button
            type="button"
            onClick={onToggleCreatePanel}
            className="flex items-center gap-2  px-5 py-2.5 rounded  bg-indigo-600 text-white text-sm  hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>New Company</span>
          </button>
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedRows.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded  p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-blue-600 text-white flex items-center justify-center text-sm ">
                {selectedRows.size}
              </div>
              <span className="text-sm  text-slate-700">{selectedRows.size} selected</span>
            </div>
            <div className="flex gap-2">
              <button className="p-2  rounded  bg-white border border-slate-200 text-sm  text-slate-700 hover:bg-slate-50">
                Deactivate
              </button>
              <button className="p-2  rounded  bg-white border border-red-200 text-sm  text-red-600 hover:bg-red-50">
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded  border border-slate-200 overflow-hidden">
          {/* Table Header */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-2 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === companies.length && companies.length > 0}
                      onChange={toggleAllRows}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                  </th>
                  <th className="p-2 text-left text-xs  text-slate-700  tracking-wide">Company Name</th>
                  <th className="p-2 text-left text-xs  text-slate-700  tracking-wide">Type</th>
                  <th className="p-2 text-left text-xs  text-slate-700  tracking-wide">City</th>
                  <th className="p-2 text-left text-xs  text-slate-700  tracking-wide">GSTIN</th>
                  <th className="p-2 text-left text-xs  text-slate-700  tracking-wide">Status</th>
                  <th className="p-2  text-right text-xs  text-slate-700  tracking-wide">Actions</th>
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
                      <td className="p-2 ">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(company.id)}
                          onChange={() => toggleRowSelection(company.id)}
                          className="w-4 h-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="p-2   text-slate-900">{company.company_name}</td>
                      <td className="p-2  text-sm text-slate-600">{formatCustomerType(company.customer_type)}</td>
                      <td className="p-2  text-sm text-slate-600">{getCompanyCity(company)}</td>
                      <td className="p-2  text-sm text-slate-600  ">{company.gstin || '—'}</td>
                      <td className="p-2 ">
                        <StatusBadge status={company.status} />
                      </td>
                      <td className="p-2  text-right">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => onViewCompany(company)}
                            title="View"
                            className="p-1.5 rounded  hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onEditCompany(company)}
                            title="Edit"
                            className="p-1.5 rounded  hover:bg-slate-100 text-slate-400 hover:text-amber-600 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteCompany(company)}
                            title="Delete"
                            className="p-1.5 rounded  hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
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

