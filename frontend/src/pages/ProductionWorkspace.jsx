import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  RefreshCw, ArrowRight, CheckCircle2, AlertTriangle, AlertOctagon, Info, Zap,
  ClipboardList, Package, Factory, CalendarClock, HardHat, ShieldCheck, Truck, ChevronDown, ChevronUp, BarChart3
} from 'lucide-react';
import { errorToast } from '../utils/toast.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const STEP_ICONS = {
  plan: ClipboardList, material: Package, workorders: Factory, schedule: CalendarClock,
  shopfloor: HardHat, quality: ShieldCheck, shipment: Truck
};

const SEVERITY = {
  critical: { icon: AlertOctagon, row: 'border-rose-200 bg-rose-50', iconCls: 'text-rose-600', btn: 'bg-rose-600 hover:bg-rose-700', label: 'Urgent' },
  warning: { icon: AlertTriangle, row: 'border-amber-200 bg-amber-50', iconCls: 'text-amber-600', btn: 'bg-amber-600 hover:bg-amber-700', label: 'Attention' },
  action: { icon: Zap, row: 'border-indigo-200 bg-indigo-50', iconCls: 'text-indigo-600', btn: 'bg-indigo-600 hover:bg-indigo-700', label: 'Next step' },
  info: { icon: Info, row: 'border-slate-200 bg-slate-50', iconCls: 'text-slate-500', btn: 'bg-slate-600 hover:bg-slate-700', label: 'For your info' }
};

const GUIDE = [
  ['1. Plan', 'Pick an approved sales order and create a production plan. Parts, sub-assemblies and the assembly are laid out for you.'],
  ['2. Material', 'Send the material request. Stores release it. Production cannot start until it is released.'],
  ['3. Work Orders', 'Create work orders from the plan, then release them. Each operation becomes a job card.'],
  ['4. Schedule', 'Give each job card a machine, operator and time. If the machine is busy you get the next free slot, or you can pre-empt with a reason for urgent jobs.'],
  ['5. Shop Floor', 'Operators start jobs and log output. Output is limited to what the previous operation has passed on, so partial runs work.'],
  ['6. Quality & Rework', 'QC approves inspections. Rejected pieces that are not scrap automatically become a rework job card.'],
  ['7. Shipment', 'The last operation is always Shipment. Ship what is accepted so far (partial) or everything (full). Final QC closes the order.']
];

const ProductionWorkspace = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(() => {
    try { return localStorage.getItem('productionGuideHidden') !== '1'; } catch (e) { return true; }
  });

  const deptPrefix = (() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const prefixes = ['sales', 'design', 'production', 'procurement', 'inventory', 'quality', 'shipment', 'accounts', 'hr', 'admin'];
    return prefixes.includes(segments[0]) ? `/${segments[0]}` : '/production';
  })();
  const go = (module) => navigate(`${deptPrefix}/${module}`);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/production-reports/workspace`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Failed to load workspace');
      setData(body);
    } catch (error) {
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  const toggleGuide = () => {
    const next = !showGuide;
    setShowGuide(next);
    try { localStorage.setItem('productionGuideHidden', next ? '0' : '1'); } catch (e) { /* storage unavailable */ }
  };

  // The first step that still has work in it is where the team should look first
  const currentStepId = data?.steps.find(s => s.count > 0)?.id;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg text-slate-900">Production Workspace</h1>
          <p className="text-xs text-slate-500">Follow the steps from left to right. The list below tells you what to do next.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => go('shop-floor')} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded">
            <HardHat className="w-4 h-4" /> Open Shop Floor
          </button>
          <button onClick={() => go('production-report')} className="flex items-center gap-1 px-3 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50">
            <BarChart3 className="w-4 h-4" /> Reports
          </button>
          <button onClick={load} className="p-1.5 border border-slate-200 rounded hover:bg-slate-50" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Workflow steps */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
        {(data?.steps || Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, number: i + 1, title: '...', count: 0, hint: '' }))).map(step => {
          const Icon = STEP_ICONS[step.id] || ClipboardList;
          const isCurrent = step.id === currentStepId;
          const hasWork = step.count > 0;
          return (
            <button
              key={step.id}
              onClick={() => step.module && go(step.module)}
              className={`text-left rounded border p-3 transition-all hover:shadow-md ${isCurrent ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200' : hasWork ? 'border-amber-200 bg-white' : 'border-slate-200 bg-white opacity-90'}`}
            >
              <div className="flex items-center justify-between">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${isCurrent ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{step.number}</span>
                <Icon className={`w-4 h-4 ${isCurrent ? 'text-indigo-600' : 'text-slate-400'}`} />
              </div>
              <div className="mt-2 text-sm text-slate-900">{step.title}</div>
              <div className="text-[11px] text-slate-500 min-h-[2.2rem]">{step.hint}</div>
              <div className="mt-1 flex items-center gap-1 text-xs">
                {hasWork ? (
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">{step.count} {step.countLabel}</span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3 h-3" /> Nothing waiting</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* What needs action */}
      <div className="border border-slate-200 rounded bg-white">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
          <div className="text-sm text-slate-900">What needs your action</div>
          {data && <div className="text-[11px] text-slate-400">Updated {new Date(data.generatedAt).toLocaleTimeString()}</div>}
        </div>
        {!data ? (
          <div className="p-6 text-center text-xs text-slate-500">{loading ? 'Loading...' : 'No data'}</div>
        ) : data.actions.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <div className="mt-2 text-sm text-slate-900">You are all caught up</div>
            <div className="text-xs text-slate-500">Nothing is waiting on production right now.</div>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.actions.map(action => {
              const style = SEVERITY[action.severity] || SEVERITY.info;
              const Icon = style.icon;
              return (
                <li key={action.id} className={`flex flex-wrap items-center gap-3 px-3 py-2.5 border-l-4 ${style.row}`}>
                  <Icon className={`w-5 h-5 shrink-0 ${style.iconCls}`} />
                  <div className="flex-1 min-w-[12rem]">
                    <div className="text-sm text-slate-900">{action.title}</div>
                    {action.detail && <div className="text-xs text-slate-500">{action.detail}</div>}
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">{style.label}</span>
                  <button onClick={() => go(action.module)} className={`flex items-center gap-1 px-3 py-1.5 text-xs text-white rounded ${style.btn}`}>
                    {action.actionLabel} <ArrowRight className="w-3 h-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Guide */}
      <div className="border border-slate-200 rounded bg-white">
        <button onClick={toggleGuide} className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-900">
          How the production workflow works
          {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showGuide && (
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-2 px-3 pb-3 border-t border-slate-100 pt-2">
            {GUIDE.map(([title, text]) => (
              <div key={title} className="text-xs">
                <span className="text-indigo-700">{title}</span>
                <span className="text-slate-600"> — {text}</span>
              </div>
            ))}
            <div className="md:col-span-2 text-xs text-slate-500 border-t border-slate-100 pt-2">
              Parts and sub-assemblies with no parent run independently, in parallel. An assembly starts as soon as enough components have been accepted, so it does not have to wait for all of them.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductionWorkspace;
