import { Card, StatusBadge, DataTable } from '../components/ui.jsx'

const ClientContacts = ({ companies, onOpenContactDrawer }) => {
  const columns = [
    {
      label: 'Company',
      key: 'company_name',
      render: (val, row) => (
        <div>
          <p className="text-slate-900 text-xs">{val}</p>
          <p className="text-xs text-slate-400">{row.company_code}</p>
        </div>
      )
    },
    {
      label: 'Primary Contact',
      key: 'id',
      render: (_, row) => {
        const primaryContact = Array.isArray(row.contacts) 
          ? row.contacts.find(c => (c.contact_type || c.contactType) === 'PRIMARY') || row.contacts[0]
          : null;
        return primaryContact?.name || '—';
      }
    },
    {
      label: 'Contact No',
      key: 'id',
      render: (_, row) => {
        const primaryContact = Array.isArray(row.contacts) 
          ? row.contacts.find(c => (c.contact_type || c.contactType) === 'PRIMARY') || row.contacts[0]
          : null;
        return primaryContact?.phone || '—';
      }
    },
    {
      label: 'Status',
      key: 'status',
      render: (val) => <StatusBadge status={val} />
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end">
          <button
            type="button"
            className="p-2 rounded border border-slate-200 text-xs text-slate-600 hover:border-slate-300"
            onClick={() => onOpenContactDrawer(row)}
          >
            Manage Contacts
          </button>
        </div>
      )
    }
  ];

  return (
    <Card id="client-contacts" title="Client Contacts" subtitle="Contact Hub">
      <div className="space-y-3">
        <p className="text-xs text-slate-500">Choose a company below to review its contact directory or add new customer touchpoints.</p>
        <DataTable 
          columns={columns} 
          data={companies || []} 
          emptyMessage="No companies available. Create a company first to begin adding client contacts."
        />
      </div>
    </Card>
  )
}

export default ClientContacts
