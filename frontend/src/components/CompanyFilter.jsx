import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2 } from 'lucide-react';

// Company (Company Master) list filter shared by Material Requests, RFQs / Quotations, Purchase Orders,
// Goods Receipts and Incoming QC. The company of each document is the company of its Sales Order
// (MR → production plan → Sales Order, incl. Admin-approved changes); documents without a Sales Order
// fall back to their own stored company.
//
//   const cf = useCompanyFilter();
//   rows.filter(r => cf.matches(cf.companyOf({ po: r.id, fallback: r.host_company_id })))
//   <CompanyFilterSelect cf={cf} rows={rows} getCompanyId={r => cf.companyOf({ po: r.id })} />
const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

export const useCompanyFilter = () => {
  const [companyFilter, setCompanyFilter] = useState('ALL'); // 'ALL' | 'NONE' | company_master.id
  const [companies, setCompanies] = useState([]);
  const [map, setMap] = useState({ mr: {}, quotation: {}, po: {}, receipt: {}, grn: {} });

  const reload = useCallback(() => {
    const token = localStorage.getItem('authToken');
    const headers = { 'Authorization': `Bearer ${token}` };
    fetch(`${API_BASE}/admin-company-master`, { headers })
      .then(r => (r.ok ? r.json() : []))
      .then(d => setCompanies(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch(`${API_BASE}/company-change-requests/company-map`, { headers })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setMap({ mr: d.mr || {}, quotation: d.quotation || {}, po: d.po || {}, receipt: d.receipt || {}, grn: d.grn || {} }); })
      .catch(() => {});
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // First known company among the given document keys, else the fallback id, else a company matched by name
  const companyOf = useCallback(({ mr, quotation, po, receipt, grn, fallback, fallbackName } = {}) => {
    const id = (quotation && map.quotation[quotation]) || (po && map.po[po]) || (receipt && map.receipt[receipt])
      || (grn && map.grn[grn]) || (mr && map.mr[mr]) || fallback;
    if (id) return String(id);
    if (fallbackName) {
      const byName = companies.find(c => String(c.company_name || '').trim().toLowerCase() === String(fallbackName).trim().toLowerCase());
      if (byName) return String(byName.id);
    }
    return '';
  }, [map, companies]);

  const matches = useCallback((companyId) => {
    if (companyFilter === 'ALL') return true;
    if (companyFilter === 'NONE') return !companyId;
    return String(companyId || '') === String(companyFilter);
  }, [companyFilter]);

  return useMemo(() => ({ companyFilter, setCompanyFilter, companies, companyOf, matches, reload }), [companyFilter, companies, companyOf, matches, reload]);
};

export const CompanyFilterSelect = ({ cf, rows = [], getCompanyId, className = '', accent = 'text-indigo-600' }) => {
  const ids = useMemo(() => rows.map(r => getCompanyId(r) || ''), [rows, getCompanyId]);
  const count = (id) => ids.filter(x => String(x) === String(id)).length;
  const noneCount = ids.filter(x => !x).length;
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg ${className}`}>
      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span className="text-xs text-slate-400">Company:</span>
      <select
        value={cf.companyFilter}
        onChange={(e) => cf.setCompanyFilter(e.target.value)}
        className={`text-xs font-medium outline-none bg-transparent cursor-pointer min-w-[150px] max-w-[260px] ${accent}`}
        title="Filter by issuing company (Company Master)"
      >
        <option value="ALL">All Companies</option>
        {cf.companies.map(c => (
          <option key={c.id} value={c.id}>
            {c.company_name}{c.status === 'ACTIVE' ? ' (Active)' : ''} ({count(c.id)})
          </option>
        ))}
        {noneCount > 0 && <option value="NONE">No company ({noneCount})</option>}
      </select>
    </div>
  );
};

export default CompanyFilterSelect;
