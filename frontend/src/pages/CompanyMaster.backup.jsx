import { Card, FormControl, StatusBadge } from '../components/ui.jsx'

const formatCustomerType = value => {
  if (!value) return '—'
  return value
    .toLowerCase()
    .split(' ')
    .map(part => part.replace(/^[a-z]/, char => char.toUpperCase()))
    .join(' ')
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
}) => (
  <>
    {showCreatePanel && (
      <form onSubmit={onInlineSubmit} className="bg-white border border-slate-200/80 rounded-[32px] shadow-xl overflow-hidden">
        <div className="px-8 py-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100/80">
          <div>
            <p className="text-[0.6rem] font-semibold tracking-[0.35em] text-slate-400 uppercase">New Entry</p>
            <h2 className="text-2xl font-semibold text-slate-900">Register Company</h2>
            <p className="text-sm text-slate-500">Create a reusable master for downstream ERP flows.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onToggleCreatePanel} className="px-5 py-2 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-600 hover:border-slate-300">
              Discard
            </button>
            <button type="submit" className="px-6 py-2.5 rounded-2xl bg-slate-900 text-white text-sm font-semibold shadow-sm hover:bg-slate-800 disabled:opacity-60" disabled={loading}>
              {loading ? 'Saving...' : 'Save Company'}
            </button>
          </div>
        </div>
        <div className="px-8 pb-8 pt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/70 p-5 space-y-5">
              <div>
                <p className="text-[0.6rem] font-semibold tracking-[0.35em] text-slate-400 uppercase">General</p>
                <h3 className="text-lg font-semibold text-slate-900">Company Profile</h3>
              </div>
              <div className="space-y-4">
                <FormControl label="Company Name">
                  <input className={fieldInputClass} value={companyForm.companyName} onChange={e => setCompanyForm(prev => ({ ...prev, companyName: e.target.value }))} required />
                </FormControl>
                <div className="grid sm:grid-cols-2 gap-4">
                  <FormControl label="Company Type">
                    <select className={fieldInputClass} value={companyForm.customerType} onChange={e => setCompanyForm(prev => ({ ...prev, customerType: e.target.value }))}>
                      <option value="REGULAR">Customer</option>
                      <option value="OEM">Vendor</option>
                      <option value="PROJECT">Both</option>
                    </select>
                  </FormControl>
                  <FormControl label="Currency">
                    <select className={fieldInputClass} value={companyForm.currency} onChange={e => setCompanyForm(prev => ({ ...prev, currency: e.target.value }))}>
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </FormControl>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/70 p-5 space-y-5">
              <div>
                <p className="text-[0.6rem] font-semibold tracking-[0.35em] text-slate-400 uppercase">Compliance</p>
                <h3 className="text-lg font-semibold text-slate-900">Registration Numbers</h3>
              </div>
              <div className="space-y-4">
                <FormControl label="GSTIN">
                  <input className={`${fieldInputClass} uppercase`} value={companyForm.gstin} onChange={e => setCompanyForm(prev => ({ ...prev, gstin: e.target.value }))} required />
                </FormControl>
                <div className="grid sm:grid-cols-2 gap-4">
                  <FormControl label="PAN">
                    <input className={fieldInputClass} value={companyForm.pan} onChange={e => setCompanyForm(prev => ({ ...prev, pan: e.target.value }))} />
                  </FormControl>
                  <FormControl label="CIN">
                    <input className={fieldInputClass} value={companyForm.cin} onChange={e => setCompanyForm(prev => ({ ...prev, cin: e.target.value }))} />
                  </FormControl>
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 p-5 space-y-5">
            <div>
              <p className="text-[0.6rem] font-semibold tracking-[0.35em] text-slate-400 uppercase">Commercial</p>
              <h3 className="text-lg font-semibold text-slate-900">Terms & Policies</h3>
            </div>
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <FormControl label="Payment Terms">
                  <input className={fieldInputClass} value={companyForm.paymentTerms} onChange={e => setCompanyForm(prev => ({ ...prev, paymentTerms: e.target.value }))} />
                </FormControl>
              </div>
              <FormControl label="Credit Days">
                <input type="number" className={fieldInputClass} value={companyForm.creditDays} onChange={e => setCompanyForm(prev => ({ ...prev, creditDays: e.target.value }))} />
              </FormControl>
              <FormControl label="Freight Terms">
                <input className={fieldInputClass} value={companyForm.freightTerms} onChange={e => setCompanyForm(prev => ({ ...prev, freightTerms: e.target.value }))} />
              </FormControl>
              <FormControl label="Packing & Forwarding">
                <input className={fieldInputClass} value={companyForm.packingForwarding} onChange={e => setCompanyForm(prev => ({ ...prev, packingForwarding: e.target.value }))} />
              </FormControl>
              <FormControl label="Insurance">
                <input className={fieldInputClass} value={companyForm.insuranceTerms} onChange={e => setCompanyForm(prev => ({ ...prev, insuranceTerms: e.target.value }))} />
              </FormControl>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 p-5">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <p className="text-[0.6rem] font-semibold tracking-[0.35em] text-slate-400 uppercase">Billing Address</p>
                {['line1', 'line2', 'city', 'state', 'pincode', 'country'].map(field => (
                  <input
                    key={`billing-inline-${field}`}
                    placeholder={field.replace(/^[a-z]/, char => char.toUpperCase())}
                    className={fieldInputClass}
                    value={companyForm.billingAddress[field]}
                    onChange={e => updateAddress('billingAddress', field, e.target.value)}
                  />
                ))}
              </div>
              <div className="space-y-3">
                <p className="text-[0.6rem] font-semibold tracking-[0.35em] text-slate-400 uppercase">Shipping Address</p>
                {['line1', 'line2', 'city', 'state', 'pincode', 'country'].map(field => (
                  <input
                    key={`shipping-inline-${field}`}
                    placeholder={field.replace(/^[a-z]/, char => char.toUpperCase())}
                    className={fieldInputClass}
                    value={companyForm.shippingAddress[field]}
                    onChange={e => updateAddress('shippingAddress', field, e.target.value)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </form>
    )}

    <Card id="company-master" title="Company Directory" subtitle="Master List">
      {companies.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-500 uppercase tracking-[0.2em] text-[0.65rem]">
              <tr>
                <th className="px-5 py-4 text-left font-semibold">Company</th>
                <th className="px-5 py-4 text-left font-semibold">GSTIN</th>
                <th className="px-5 py-4 text-left font-semibold">Type</th>
                <th className="px-5 py-4 text-left font-semibold">City</th>
                <th className="px-5 py-4 text-left font-semibold">Status</th>
                <th className="px-5 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map(company => (
                <tr key={company.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-5 align-middle">
                    <p className="font-semibold text-slate-900">{company.company_name}</p>
                    <p className="text-xs text-slate-400">{company.company_code}</p>
                  </td>
                  <td className="px-5 py-5 text-slate-600 uppercase align-middle">{company.gstin || '—'}</td>
                  <td className="px-5 py-5 text-slate-600 align-middle">{formatCustomerType(company.customer_type)}</td>
                  <td className="px-5 py-5 text-slate-600 align-middle">{getCompanyCity(company)}</td>
                  <td className="px-5 py-5 align-middle"><StatusBadge status={company.status} /></td>
                  <td className="px-5 py-5 align-middle">
                    <div className="flex justify-end gap-2 flex-wrap">
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-600 hover:border-slate-300"
                        onClick={() => onOpenContactDrawer(company)}
                      >
                        Contacts
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-600 hover:border-slate-300"
                        onClick={() => onViewCompany(company)}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-2xl border border-indigo-200 text-xs font-semibold text-indigo-600 hover:border-indigo-300"
                        onClick={() => onEditCompany(company)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-2xl border border-amber-200 text-xs font-semibold text-amber-600 hover:border-amber-300"
                        onClick={() => onToggleStatus(company)}
                      >
                        {(company.status || 'ACTIVE') === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-2xl border border-rose-200 text-xs font-semibold text-rose-600 hover:border-rose-300"
                        onClick={() => onDeleteCompany(company)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-12 text-center space-y-3">
          <p className="text-base font-semibold text-slate-900">No companies found</p>
          <p className="text-sm text-slate-500">Use “+ New Company” to create your first company master record.</p>
        </div>
      )}
    </Card>
  </>
)

export default CompanyMaster
