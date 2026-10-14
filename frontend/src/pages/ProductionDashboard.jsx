import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SkeletonCard } from '../components/ui.jsx';
import {
  RefreshCw, HardHat, ClipboardCheck, ArrowRight, CheckCircle2, AlertOctagon, AlertTriangle, Zap, Info,
  Play, Cpu, PackageCheck, ShieldCheck, Clock, Truck, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { errorToast } from '../utils/toast.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const SEVERITY = {
  critical: { icon: AlertOctagon, cls: 'border-rose-200 bg-rose-50', iconCls: 'text-rose-600' },
  warning: { icon: AlertTriangle, cls: 'border-amber-200 bg-amber-50', iconCls: 'text-amber-600' },
  action: { icon: Zap, cls: 'border-indigo-200 bg-indigo-50', iconCls: 'text-indigo-600' },
  info: { icon: Info, cls: 'border-slate-200 bg-slate-50', iconCls: 'text-slate-500' }
};
const PRIORITY_CLS = { URGENT: 'bg-rose-100 text-rose-700', HIGH: 'bg-amber-100 text-amber-700', NORMAL: 'bg-slate-100 text-slate-600', LOW: 'bg-slate-50 text-slate-400' };
const STATUS_CLS = { RELEASED: 'text-sky-700', IN_PROGRESS: 'text-indigo-700', ON_HOLD: 'text-amber-700' };
const formatDate = v => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—');

const Trend = ({ value }) => {
  if (value === null || value === undefined) return null;
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return <span className={`inline-flex items-center text-xs ${up ? 'text-emerald-600' : 'text-rose-600'}`}><Icon className="w-3 h-3" />{Math.abs(value)}% vs yesterday</span>;
};

const Tile = ({ icon: Icon, label, value, unit, lines = [], tone = 'default', onClick }) => {
  const toneCls = tone === 'bad' ? 'border-rose-200' : tone === 'good' ? 'border-emerald-200' : 'border-slate-200';
  const iconCls = tone === 'bad' ? 'bg-rose-50 text-rose-600' : tone === 'good' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600';
  return (
    <button onClick={onClick} className={`text-left bg-white rounded border ${toneCls} p-3 hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">{label}</span>
        <span className={`p-1.5 rounded ${iconCls}`}><Icon className="w-4 h-4" /></span>
      </div>
      <div className="mt-1 text-2xl text-slate-900">{value}{unit ? <span className="text-sm text-slate-400 ml-1">{unit}</span> : null}</div>
      <div className="mt-1 space-y-0.5 min-h-[2rem]">
        {lines.filter(Boolean).map((line, i) => <div key={i} className="text-xs text-slate-500">{line}</div>)}
      </div>
    </button>
  );
};

const ProductionDashboard = ({ apiRequest }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const deptPrefix = (() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const prefixes = ['sales', 'design', 'production', 'procurement', 'inventory', 'quality', 'shipment', 'accounts', 'hr', 'admin'];
    return prefixes.includes(segments[0]) ? `/${segments[0]}` : '/production';
  })();
  const go = module => navigate(`${deptPrefix === '/admin' ? '/production' : deptPrefix}/${module}`);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      if (apiRequest) {
        setStats(await apiRequest('/dashboard/production'));
      } else {
        const response = await fetch(`${API_BASE}/dashboard/production`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}`, 'Content-Type': 'application/json', 'X-ERP-Request': 'true' }
        });
        if (!response.ok) throw new Error('Could not load production data');
        setStats(await response.json());
      }
    } catch (error) {
      errorToast(error.message || 'Could not load production data');
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  const k = stats?.kpis;
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const topActions = (stats?.actions || []).slice(0, 4);
  const currentStep = stats?.steps?.find(s => s.count > 0)?.id;

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl text-slate-900">Production</h1>
          <p className="text-xs text-slate-500">{today}{stats ? ` · updated ${new Date(stats.generatedAt).toLocaleTimeString()}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => go('shop-floor')} className="flex items-center gap-1 px-3 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded"><HardHat className="w-4 h-4" /> Shop Floor</button>
          <button onClick={() => go('production-workspace')} className="flex items-center gap-1 px-3 py-2 text-xs border border-slate-200 rounded hover:bg-slate-50"><ClipboardCheck className="w-4 h-4" /> Workspace</button>
          <button onClick={load} className="p-2 border border-slate-200 rounded hover:bg-slate-50" title="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {/* Do this next */}
      <section>
        <div className="text-sm text-slate-900 mb-2">Do this next</div>
        {!stats ? (
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
        ) : topActions.length === 0 ? (
          <div className="flex items-center gap-3 border border-emerald-200 bg-emerald-50 rounded p-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <div><div className="text-sm text-emerald-900">You are all caught up</div><div className="text-xs text-emerald-700">Nothing is waiting on production right now.</div></div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
            {topActions.map(action => {
              const style = SEVERITY[action.severity] || SEVERITY.info;
              const Icon = style.icon;
              return (
                <button key={action.id} onClick={() => go(action.module)} className={`text-left rounded border p-3 hover:shadow-md transition-shadow flex flex-col gap-1 ${style.cls}`}>
                  <div className="flex items-start gap-2"><Icon className={`w-5 h-5 shrink-0 ${style.iconCls}`} /><span className="text-sm text-slate-900 leading-snug">{action.title}</span></div>
                  {action.detail && <div className="text-xs text-slate-500 line-clamp-2">{action.detail}</div>}
                  <div className="mt-auto pt-1 text-xs text-indigo-700 flex items-center gap-1">{action.actionLabel} <ArrowRight className="w-3 h-3" /></div>
                </button>
              );
            })}
          </div>
        )}
        {stats && (stats.actions || []).length > 4 && (
          <button onClick={() => go('production-workspace')} className="mt-2 text-xs text-indigo-700 hover:underline">See all {stats.actions.length} items in the Workspace →</button>
        )}
      </section>

      {/* Workflow strip */}
      {stats && (
        <section className="flex flex-wrap items-stretch gap-1.5">
          {stats.steps.map((step, i) => (
            <React.Fragment key={step.id}>
              <button onClick={() => go(step.module)} title={step.hint}
                className={`flex items-center gap-2 px-3 py-2 rounded border text-xs hover:shadow ${step.id === currentStep ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step.id === currentStep ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{step.number}</span>
                <span className="text-slate-800">{step.title}</span>
                {step.count > 0 ? <span className="px-1.5 rounded bg-amber-100 text-amber-800">{step.count}</span> : <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
              </button>
              {i < stats.steps.length - 1 && <span className="self-center text-slate-300 hidden md:block">›</span>}
            </React.Fragment>
          ))}
        </section>
      )}

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {!k ? Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />) : (
          <>
            <Tile icon={Play} label="Running now" value={k.runningJobs} unit="jobs"
              lines={[`${k.waitingJobs} waiting to start`, k.onHoldJobs ? `${k.onHoldJobs} on hold` : null]} onClick={() => go('shop-floor')} />
            <Tile icon={Cpu} label="Machines busy" value={`${k.machinesBusy}/${k.machinesTotal}`}
              lines={[`Average load last 7 days: ${k.avgUtilisationPercent}%`]} onClick={() => go('workstation-master')} />
            <Tile icon={PackageCheck} label="Output today" value={k.outputToday} unit="pcs"
              lines={[<Trend key="t" value={k.outputChangePercent} />, `${k.shippedThisWeek} pcs shipped in 7 days`]} onClick={() => go('production-report')} />
            <Tile icon={ShieldCheck} label="First-pass yield (7 days)" value={k.yieldPercent === null ? '—' : `${k.yieldPercent}%`}
              tone={k.rejectionPercent !== null && k.rejectionPercent > 5 ? 'bad' : 'default'}
              lines={[k.rejectionPercent === null ? 'Nothing inspected yet' : `${k.rejectionPercent}% rejected · ${k.scrapQty} scrapped`, k.openRework ? `${k.openRework} rework job card(s) open` : null]}
              onClick={() => go('job-card')} />
            <Tile icon={Clock} label="Late work orders" value={k.lateWorkOrders} tone={k.lateWorkOrders > 0 ? 'bad' : 'good'}
              lines={[k.onTimePercent === null ? 'No deliveries to measure yet' : `On-time delivery (30 days): ${k.onTimePercent}%`]} onClick={() => go('production-report')} />
            <Tile icon={Truck} label="Shipped this week" value={k.shippedThisWeek} unit="pcs"
              lines={['Full and partial shipments']} onClick={() => go('job-card')} />
          </>
        )}
      </section>

      {/* Charts */}
      <section className="grid xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2 bg-white rounded border border-slate-200 p-3">
          <div className="text-sm text-slate-900">Output, last 7 days</div>
          <div className="text-xs text-slate-500 mb-2">Pieces made, and how many QC accepted or rejected</div>
          <div className="h-64">
            {!stats ? <div className="h-full bg-slate-50 rounded animate-pulse" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.series.map(s => ({ ...s, produced: Number(s.produced), accepted: Number(s.accepted), rejected: Number(s.rejected) }))} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="produced" name="Made" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="accepted" name="Accepted" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="rejected" name="Rejected" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white rounded border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-900">Machine load, 7 days</div>
            <button onClick={() => go('workstation-master')} className="text-xs text-indigo-700 hover:underline">All machines</button>
          </div>
          <div className="text-xs text-slate-500 mb-3">Run time against available hours. The tick marks each machine's target.</div>
          {!stats ? <div className="h-48 bg-slate-50 rounded animate-pulse" /> : stats.machineLoad.length === 0 ? (
            <div className="text-xs text-slate-500 border border-dashed border-slate-200 rounded p-6 text-center">No production time has been logged in the last 7 days.</div>
          ) : (
            <div className="space-y-2.5">
              {stats.machineLoad.map(m => {
                const below = m.utilisation < m.target;
                return (
                  <div key={m.name}>
                    <div className="flex justify-between text-xs mb-0.5"><span className="text-slate-700 truncate pr-2">{m.name}</span><span className={below ? 'text-amber-600' : 'text-emerald-600'}>{m.utilisation}%</span></div>
                    <div className="relative h-2.5 bg-slate-100 rounded overflow-hidden">
                      <div className={`h-full ${below ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, m.utilisation)}%` }} />
                      <span className="absolute top-0 bottom-0 w-0.5 bg-slate-700" style={{ left: `${Math.min(100, m.target)}%` }} title={`Target ${m.target}%`} />
                    </div>
                    {m.downtimeMinutes > 0 && <div className="text-[10px] text-slate-400">{Math.round(m.downtimeMinutes / 60 * 10) / 10} h downtime</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Priority work orders */}
      <section className="bg-white rounded border border-slate-200">
        <div className="flex items-center justify-between p-3 border-b border-slate-100">
          <div>
            <div className="text-sm text-slate-900">Work orders to watch</div>
            <div className="text-xs text-slate-500">Sorted by priority, then due date</div>
          </div>
          <button onClick={() => go('work-order')} className="text-xs text-indigo-700 hover:underline">All work orders →</button>
        </div>
        {!stats ? <div className="p-6 text-center text-xs text-slate-500">Loading...</div> : stats.priorityOrders.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No work orders are in progress.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr><th className="p-2">Priority</th><th className="p-2">Work order</th><th className="p-2">Item</th><th className="p-2 text-right">Qty</th><th className="p-2 w-48">Progress</th><th className="p-2">Due</th><th className="p-2">Status</th></tr>
              </thead>
              <tbody>
                {stats.priorityOrders.map(o => (
                  <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => go('work-order')}>
                    <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${PRIORITY_CLS[o.priority] || PRIORITY_CLS.NORMAL}`}>{o.priority || 'NORMAL'}</span></td>
                    <td className="p-2 text-indigo-700">{o.wo_number}</td>
                    <td className="p-2 text-slate-700">{o.item_name || o.item_code}</td>
                    <td className="p-2 text-right">{parseFloat(o.quantity)}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, o.progress_percent)}%` }} /></div>
                        <span className="w-9 text-right text-slate-500">{o.progress_percent}%</span>
                      </div>
                    </td>
                    <td className={`p-2 whitespace-nowrap ${o.days_late > 0 ? 'text-rose-600' : 'text-slate-600'}`}>{formatDate(o.end_date)}{o.days_late > 0 ? ` (${o.days_late}d late)` : ''}</td>
                    <td className={`p-2 ${STATUS_CLS[o.status] || ''}`}>{String(o.status).replace('_', ' ')}{o.held > 0 ? ` · ${o.held} held` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default ProductionDashboard;
