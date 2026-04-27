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
import { FormControl, StatusBadge, Modal, DataTable, Card, Button } from '../components/ui.jsx'

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
      className: ' text-slate-900'
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
      className: 'text-slate-500'
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
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-rose-500 transition-colors"
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
    <div className="p-2 space-y-2 bg-slate-50/50 min-h-screen">
      <Modal
        isOpen={showCreatePanel}
        onClose={onToggleCreatePanel}
        title={companyForm.id ? "Edit Company" : "Register Company"}
        size="3xl"
      >
        <form onSubmit={onInlineSubmit} className="space-y-2">
          {/* Company Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-rose-500" />
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
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm  text-slate-800  ">Tax Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <MapPin className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm  text-slate-800  ">Billing Address</h3>
            </div>
            <div className="space-y-2">
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
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <User className="w-4 h-4 text-rose-500" />
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

          <div className="flex items-center justify-end gap-2 pt-6 border-t border-slate-100">
            <Button
              variant="default"
              onClick={onToggleCreatePanel}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              icon={Plus}
            >
              Save Company
            </Button>
          </div>
        </form>
      </Modal>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-rose-500 text-white rounded shadow-lg shadow-rose-100">
              <Building2 className="w-3 h-3" />
            </div>
            <h2 className="text-xl  text-slate-900 ">Company Master</h2>
          </div>
          <p className="text-sm text-slate-500 ml-14">Manage customers, vendors, and partner organizations</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            onClick={() => window.location.reload()}
            title="Refresh Data"
            icon={RotateCcw}
          />
          
          <Button
            variant="primary"
            onClick={onToggleCreatePanel}
            icon={Plus}
          >
            New Company
          </Button>
        </div>
      </div>

      <Card className="bg-white border border-slate-100 rounded  shadow-sm overflow-hidden">
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