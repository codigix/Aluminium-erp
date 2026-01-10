import { Card, StatusBadge } from '../components/ui.jsx'

const ClientContacts = ({ companies, onOpenContactDrawer }) => (
  <Card id="client-contacts" title="Client Contacts" subtitle="Contact Hub">
    {companies.length ? (
      <div className="space-y-6">
        <p className="text-sm text-slate-500">Choose a company below to review its contact directory or add new customer touchpoints.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.2em] text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Company</th>
                <th className="px-4 py-3 text-left font-semibold">Primary Contact</th>
                <th className="px-4 py-3 text-left font-semibold">Contact No</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(company => {
                const primaryContact = Array.isArray(company.contacts) 
                  ? company.contacts.find(c => (c.contact_type || c.contactType) === 'PRIMARY') || company.contacts[0]
                  : null;
                
                return (
                  <tr key={`contact-row-${company.id}`} className="border-t border-slate-100">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">{company.company_name}</p>
                      <p className="text-xs text-slate-400">{company.company_code}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-900 font-medium">
                      {primaryContact?.name || '—'}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {primaryContact?.phone || '—'}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={company.status} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end">
                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:border-slate-300"
                        onClick={() => onOpenContactDrawer(company)}
                      >
                        Manage Contacts
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    ) : (
      <div className="p-10 text-center space-y-2">
        <p className="text-base font-semibold text-slate-900">No companies available</p>
        <p className="text-sm text-slate-500">Create a company first to begin adding client contacts.</p>
      </div>
    )}
  </Card>
)

export default ClientContacts
