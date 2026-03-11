import React, { useState } from 'react'
import { 
  Plus, 
  RotateCcw, 
  Edit, 
  Trash2, 
  Eye,
  Building2,
  User,
  MapPin,
} from 'lucide-react'
import { FormControl, StatusBadge, Modal, DataTable, Card } from '../components/ui.jsx'

const formatCustomerType = value => {
  if (!value) return '—'
  return value.toLowerCase().split(' ').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

const getCompanyCity = company => {
  const billing = company.addresses?.find(address => address.address_type === 'BILLING')
  return billing?.city || '—'
}

const CompanyMaster = ({
  companies = [],
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
  
  const columns = [
    {
      label: 'Company Name',
      key: 'company_name',
      sortable: true,
      className: 'font-bold text-slate-900'
    },
    {
      label: 'Type',
      key: 'customer_type',
      sortable: true,
      render: (val) => formatCustomerType(val)
    },
    {
      label: 'City',
      key: 'city',
      sortable: true,
      render: (_, row) => getCompanyCity(row)
    },
    {
      label: 'GSTIN',
      key: 'gstin',
      sortable: true,
      className: 'font-medium text-slate-500'
    },
    {
      label: 'Status',
      key: 'status',
      sortable: true,
      render: (val) => <StatusBadge status={val} />
    },
    {
      label: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end gap-1">
          <button
            onClick={() => onViewCompany(row)}
            title="View"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEditCompany(row)}
            title="Edit"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-amber-600 transition-colors"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDeleteCompany(row)}
            title="Delete"
            className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 space-y-8 bg-slate-50/50 min-h-screen">
      <Modal
        isOpen={showCreatePanel}
        onClose={onToggleCreatePanel}
        title={companyForm.id ? "Edit Company" : "Register Company"}
        size="3xl"
      >
        <form onSubmit={onInlineSubmit} className="space-y-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Company Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Tax Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <MapPin className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Billing Address</h3>
            </div>
            <div className="space-y-4">
              <FormControl label="Address Line 1">
                <input
                  type="text"
                  value={companyForm.billingAddress.line1}
                  onChange={e => updateAddress('billingAddress', 'line1', e.target.value)}
                  className={fieldInputClass}
                  placeholder="Street name, Building number"
                />
              </FormControl>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          {/* Contact Person */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <User className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Contact Person</h3>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-10 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 flex items-center gap-2"
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

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100">
              <Building2 className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Company Master</h2>
          </div>
          <p className="text-sm font-medium text-slate-500 ml-14">Manage customers, vendors, and partner organizations</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
            title="Refresh Data"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          
          <button
            type="button"
            onClick={onToggleCreatePanel}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>New Company</span>
          </button>
        </div>
      </div>

      <Card className="bg-white border border-slate-100 rounded-[32px] shadow-sm overflow-hidden">
        <div className="p-6">
          <DataTable 
            columns={columns}
            data={companies}
            loading={loading}
            pageSize={5}
            searchPlaceholder="Search by name, type, gstin..."
            emptyMessage="No companies found. Create one to get started."
          />
        </div>
      </Card>
    </div>
  )
}

export default CompanyMaster