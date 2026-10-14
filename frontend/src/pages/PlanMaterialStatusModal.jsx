import React, { useState, useEffect } from 'react';
import { Modal } from '../components/ui.jsx';
import { Send } from 'lucide-react';
import { errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');
const fmt = v => (Math.round((parseFloat(v) || 0) * 1000) / 1000).toString();

const STATE = {
  NOT_REQUESTED: { label: 'Not requested', cls: 'bg-rose-50 text-rose-700' },
  WAITING: { label: 'Waiting for Stores', cls: 'bg-amber-50 text-amber-700' },
  PARTIAL: { label: 'Partly released', cls: 'bg-sky-50 text-sky-700' },
  RELEASED: { label: 'Released', cls: 'bg-emerald-50 text-emerald-700' }
};
const REQUEST_CLS = { FULFILLED: 'bg-emerald-50 text-emerald-700', COMPLETED: 'bg-emerald-50 text-emerald-700', PARTIALLY_RELEASED: 'bg-sky-50 text-sky-700' };

// The real material picture of one plan: requests, and per material what is needed, requested, released and issued.
// Used both in the "Track material" window and in the plan's "Materials & operations" window.
export const PlanMaterialStatusPanel = ({ planId, onLoaded }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const response = await fetch(`${API_BASE}/production-plans/${planId}/material-status`, { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || body.message || 'Could not load material status');
        if (!cancelled) { setData(body); if (onLoaded) onLoaded(body); }
      } catch (error) {
        errorToast(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [planId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="p-8 text-center text-sm text-slate-500">Loading material status...</div>;
  if (!data) return <div className="p-8 text-center text-sm text-slate-500">Material status is not available.</div>;
  const s = data.summary;

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500">Material requests:</span>
        {data.requests.length === 0 ? <span className="text-rose-600">none yet</span> : data.requests.map(r => (
          <span key={r.id} className={`px-2 py-0.5 rounded ${REQUEST_CLS[String(r.status).toUpperCase()] || 'bg-amber-50 text-amber-700'}`}>{r.mr_number} · {String(r.status).replace(/_/g, ' ')}</span>
        ))}
        <span className="ml-auto text-slate-500">{s.released} of {s.total} materials fully released</span>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="p-2">Material</th><th className="p-2 text-right">Needed</th><th className="p-2 text-right">Requested</th>
              <th className="p-2 text-right">Released by Stores</th><th className="p-2 text-right">Still to release</th>
              <th className="p-2 text-right">Issued to work orders</th><th className="p-2 text-right">Ready to issue</th><th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.materials.length === 0 ? (
              <tr><td colSpan={8} className="p-6 text-center text-slate-500">No materials are listed for this plan.</td></tr>
            ) : data.materials.map(m => {
              const st = STATE[m.state];
              return (
                <tr key={`${m.item_code}-${m.material_name}`} className="border-t border-slate-100">
                  <td className="p-2 text-slate-800">{m.material_name}<div className="text-[10px] text-slate-400">{m.item_code}</div></td>
                  <td className="p-2 text-right">{fmt(m.required)} {m.uom}</td>
                  <td className="p-2 text-right">{fmt(m.requested)} {m.uom}</td>
                  <td className="p-2 text-right">{fmt(m.released)} {m.uom}</td>
                  <td className={`p-2 text-right ${m.to_release > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{fmt(m.to_release)}</td>
                  <td className="p-2 text-right">{fmt(m.issued)} {m.uom}</td>
                  <td className={`p-2 text-right ${m.to_issue > 0 ? 'text-indigo-700' : 'text-slate-400'}`}>{fmt(m.to_issue)}</td>
                  <td className="p-2"><span className={`px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-slate-500">
        Weight materials (kg) are counted in kilograms. "Ready to issue" is what Stores released that has not yet been handed to a work order — issue it from the work order's Inventory tab.
      </div>
    </div>
  );
};

const PlanMaterialStatusModal = ({ plan, onClose, onRequestMore }) => (
  <Modal isOpen onClose={onClose} title={`Material status — ${plan.plan_code}`} size="5xl">
    <div className="space-y-3 p-1">
      <PlanMaterialStatusPanel planId={plan.id} />
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded">Close</button>
        <button onClick={onRequestMore} className="flex items-center gap-1 px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"><Send className="w-4 h-4" /> Request more material</button>
      </div>
    </div>
  </Modal>
);

export default PlanMaterialStatusModal;
