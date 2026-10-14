import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { RefreshCw, Search, ChevronDown, ChevronRight, AlertTriangle, Info, CheckCircle2, Cpu, ArrowRight } from 'lucide-react';
import { errorToast } from '../utils/toast.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');
const PAGE = 30;

const RoutingOperations = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const deptPrefix = (() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const prefixes = ['sales', 'design', 'production', 'procurement', 'inventory', 'quality', 'shipment', 'accounts', 'hr', 'admin'];
    return prefixes.includes(segments[0]) ? `/${segments[0]}` : '/production';
  })();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PROBLEMS');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState({});
  const [shown, setShown] = useState(PAGE);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/operations/routing-check`, { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || body.message || 'Could not load routings');
      setData(body);
    } catch (error) {
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setShown(PAGE); }, [filter, search]);

  const visible = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.routings
      .filter(r => (filter === 'ALL' || r.problemCount > 0) && (!q || [r.itemCode, r.drawingNo, r.description, r.orderNo, r.project].some(v => String(v || '').toLowerCase().includes(q))))
      .sort((a, b) => b.problemCount - a.problemCount);
  }, [data, filter, search]);

  const s = data?.summary;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl text-slate-900">Routing check</h1>
          <p className="text-xs text-slate-500">The operation sequence of every product, and whether each step will get a machine and a time when its job card is created. Routings are edited on the item's BOM (Design → Part Details).</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`${deptPrefix}/operation-master`)} className="px-3 py-2 text-xs border border-slate-200 rounded hover:bg-slate-50">Operation Master</button>
          <button onClick={() => navigate(`${deptPrefix}/workstation-master`)} className="px-3 py-2 text-xs border border-slate-200 rounded hover:bg-slate-50">Workstation Master</button>
          <button onClick={load} className="p-2 border border-slate-200 rounded hover:bg-slate-50" title="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {s && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded p-3"><div className="text-xs text-slate-500">Routings</div><div className="text-2xl text-slate-900">{s.routings}</div></div>
          <div className={`bg-white border rounded p-3 ${s.withProblems ? 'border-amber-200' : 'border-emerald-200'}`}><div className="text-xs text-slate-500">With a problem</div><div className={`text-2xl ${s.withProblems ? 'text-amber-700' : 'text-emerald-700'}`}>{s.withProblems}</div></div>
          <div className="bg-white border border-slate-200 rounded p-3"><div className="text-xs text-slate-500">Steps without a machine</div><div className="text-2xl text-slate-900">{s.noWorkstation + s.unknownWorkstations}</div><div className="text-[11px] text-slate-500">{s.noWorkstation} none chosen · {s.unknownWorkstations} not in the master</div></div>
          <div className="bg-white border border-slate-200 rounded p-3"><div className="text-xs text-slate-500">Steps without a cycle time</div><div className="text-2xl text-slate-900">{s.noTime}</div></div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {[['PROBLEMS', 'Needs attention', s?.withProblems], ['ALL', 'All routings', s?.routings]].map(([id, label, n]) => (
            <button key={id} onClick={() => setFilter(id)} className={`px-3 py-1.5 text-xs rounded-full border ${filter === id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{label} <span className={filter === id ? 'opacity-80' : 'text-slate-400'}>{n ?? ''}</span></button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="w-3 h-3 absolute left-2 top-2.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item, drawing, order, project..." className="pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded w-72" />
        </div>
      </div>

      {loading && !data ? <div className="p-10 text-center text-sm text-slate-500">Loading routings...</div> : visible.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded p-10 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <div className="text-sm text-slate-700 mt-2">{filter === 'PROBLEMS' ? 'No routing has a problem' : 'No routings match'}</div>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.slice(0, shown).map(r => {
            const isOpen = open[r.key] ?? false;
            return (
              <div key={r.key} className="bg-white border border-slate-200 rounded">
                <button onClick={() => setOpen(o => ({ ...o, [r.key]: !isOpen }))} className="w-full flex flex-wrap items-center gap-3 px-3 py-2.5 text-left">
                  {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <div className="min-w-[14rem] flex-1">
                    <div className="text-sm text-slate-900">{r.itemCode || r.drawingNo || 'Unnamed item'}</div>
                    <div className="text-[11px] text-slate-500">{[r.description, r.orderNo, r.project].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className="hidden md:flex items-center gap-1 text-[11px] text-slate-500 flex-wrap max-w-md">
                    {r.steps.map((st, i) => (<React.Fragment key={st.id}>{i > 0 && <ArrowRight className="w-3 h-3 text-slate-300" />}<span className={st.issues.some(x => x.level === 'problem') ? 'text-amber-700' : ''}>{st.operation}</span></React.Fragment>))}
                  </div>
                  <div className="text-[11px] text-slate-500">{r.steps.length} step(s) · {r.minutesPerPiece} min/piece</div>
                  {r.problemCount > 0 ? <span className="text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{r.problemCount} problem(s)</span> : <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">OK</span>}
                </button>
                {isOpen && (
                  <ol className="border-t border-slate-100 divide-y divide-slate-100">
                    {r.steps.map((st, i) => (
                      <li key={st.id} className="px-3 py-2 flex flex-wrap items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs flex items-center justify-center shrink-0">{i + 1}</span>
                        <div className="min-w-[12rem] flex-1">
                          <div className="text-sm text-slate-900">{st.operation} <span className="text-[10px] text-slate-400">{st.type}</span></div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1"><Cpu className="w-3 h-3" />{st.workstation || 'No workstation'} · {st.cycleMin} min/piece{st.setupMin ? ` + ${st.setupMin} min setup` : ''}{st.rate ? ` · ₹${st.rate}/hr` : ''}</div>
                          {st.issues.map(issue => (
                            <div key={issue.code} className={`mt-1 text-[11px] flex items-start gap-1 ${issue.level === 'problem' ? 'text-amber-800' : 'text-slate-500'}`}>
                              {issue.level === 'problem' ? <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> : <Info className="w-3 h-3 mt-0.5 shrink-0" />}{issue.text}
                            </div>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
          {visible.length > shown && <button onClick={() => setShown(n => n + PAGE)} className="w-full py-2 text-xs border border-slate-200 rounded hover:bg-slate-50 text-slate-600">Show {Math.min(PAGE, visible.length - shown)} more ({visible.length - shown} left)</button>}
        </div>
      )}
    </div>
  );
};

export default RoutingOperations;
