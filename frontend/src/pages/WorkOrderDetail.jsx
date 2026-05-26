import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Clock, CheckCircle2, Target, Play, Activity, 
  Settings, User, Monitor, Calendar, AlertTriangle, 
  ChevronRight, ArrowRight, ClipboardList, Info, ShieldCheck,
  TrendingUp, Zap, MapPin, Package, MoreVertical, Layers,
  IndianRupee, Users
} from 'lucide-react';
import { Card, StatusBadge, Button } from '../components/ui.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const WorkOrderDetail = () => {
  const { id: paramId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract ID from URL if not available in params (for manual routing)
  const id = paramId || location.pathname.split('/').pop();
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('Operational Timeline');

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/job-cards/${id}/details`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.error || 'Failed to fetch job card details');
      }
    } catch (error) {
      console.error('Error fetching job card details:', error);
      setError('An error occurred while connecting to the server');
    } finally {
      setLoading(false);
    }
  };

  const formatLocalTime = (isoString) => {
    if (!isoString) return 'N/A';
    const date = new Date(String(isoString).replace(' ', 'T'));
    if (isNaN(date.getTime())) return isoString;

    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-22 space-y-4">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-rose-600 rounded animate-spin" />
        <h3 className="text-slate-900">Loading Work Order Details...</h3>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center p-22 space-y-6">
        <div className="p-4 bg-rose-50 rounded-full">
           <AlertTriangle size={48} className="text-rose-500" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-xl font-semibold text-slate-900">{error || 'Job Card Not Found'}</h3>
          <p className="text-slate-500 max-w-md mx-auto">
            {error ? 'There was an error retrieving the details. Please try again later or contact support if the issue persists.' : 
                     'The job card you are looking for might have been deleted or the ID is incorrect.'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
          <Button onClick={fetchDetails}>Try Again</Button>
        </div>
      </div>
    );
  }

  const { jobCard, logs, timeline, metrics } = data;

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-500 min-h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-50 text-slate-400 rounded border border-slate-100">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl text-slate-900 font-semibold">Work Order Details</h1>
              <span className="text-xs text-slate-400 font-normal ml-2">{jobCard.job_card_no} • {jobCard.wo_number}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right mr-4">
             <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Production</p>
             <p className="text-xs text-slate-600 font-medium">Production Manager</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-600 flex items-center justify-center text-white font-bold shadow-lg shadow-rose-100">P</div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <div className="bg-white p-4 border border-slate-100 rounded shadow-sm">
          <p className="text-[10px] text-slate-400 uppercase mb-1">Operation</p>
          <div className="flex items-center justify-between">
            <h3 className="text-sm text-slate-900 font-semibold">{jobCard.op_name}</h3>
            <StatusBadge status={jobCard.status} />
          </div>
          <p className="text-[10px] text-slate-500 mt-1">PART • {jobCard.item_name}</p>
        </div>
        <div className="bg-white p-4 border border-slate-100 rounded shadow-sm">
          <p className="text-[10px] text-slate-400 uppercase mb-1">Work Center</p>
          <h3 className="text-sm text-slate-900 font-semibold">{jobCard.workstation_name || 'N/A'}</h3>
          <p className="text-[10px] text-slate-500 mt-1">In-house</p>
        </div>
        <div className="bg-white p-4 border border-slate-100 rounded shadow-sm col-span-1">
          <p className="text-[10px] text-slate-400 uppercase mb-1">Primary Operator</p>
          <div className="flex items-center gap-2">
            <User size={14} className="text-slate-400" />
            <h3 className="text-sm text-slate-900 font-semibold">{jobCard.operator_name || 'Unassigned'}</h3>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">11:00 AM - 12:00 PM</p>
        </div>
        <div className="bg-white p-4 border border-slate-100 rounded shadow-sm">
          <p className="text-[10px] text-slate-400 uppercase mb-1">Job Card</p>
          <h3 className="text-sm text-indigo-600 font-semibold">{jobCard.job_card_no}</h3>
        </div>
        <div className="bg-white p-4 border border-slate-100 rounded shadow-sm">
          <p className="text-[10px] text-slate-400 uppercase mb-1">Planned Qty</p>
          <h3 className="text-sm text-slate-900 font-semibold">{parseFloat(jobCard.planned_qty).toFixed(3)} Units</h3>
        </div>
        <div className="bg-white p-4 border border-slate-100 rounded shadow-sm">
          <p className="text-[10px] text-slate-400 uppercase mb-1">Produced</p>
          <h3 className="text-sm text-slate-900 font-semibold">{parseFloat(jobCard.produced_qty).toFixed(3)} Units</h3>
        </div>
        <div className="bg-white p-4 border border-slate-100 rounded shadow-sm">
          <p className="text-[10px] text-slate-400 uppercase mb-1">Accepted</p>
          <h3 className="text-sm text-emerald-600 font-semibold">{parseFloat(jobCard.accepted_qty || 0).toFixed(3)} Units</h3>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-100 pt-2">
        {['Operational Timeline', 'Costing Details', 'Assignment Data'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 ${
              activeTab === tab ? 'border-rose-500 text-rose-500' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab === 'Operational Timeline' && <Activity size={14} className="inline mr-2" />}
            {tab === 'Costing Details' && <IndianRupee size={14} className="inline mr-2" />}
            {tab === 'Assignment Data' && <Users size={14} className="inline mr-2" />}
            {tab}
          </button>
        ))}
      </div>

      <div className={`grid grid-cols-1 ${activeTab === 'Operational Timeline' ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-6`}>
        {/* Left Column - Dynamic Content */}
        <div className={`${activeTab === 'Operational Timeline' ? 'lg:col-span-2' : ''} space-y-6`}>
          {activeTab === 'Operational Timeline' && (
            <>
              <div className="bg-white rounded border border-slate-100 p-6 shadow-sm">
                <h3 className="text-sm text-slate-900 font-semibold mb-6">Workflow / Operational Timeline</h3>
                <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                  {timeline.map((event, idx) => (
                    <div key={idx} className="flex gap-6 relative">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${
                        event.completed ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 
                        event.current ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-white text-slate-300 border border-slate-200'
                      }`}>
                        {event.completed ? <CheckCircle2 size={12} /> : <div className="w-2 h-2 rounded-full bg-current" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-bold text-slate-900 mb-1">{event.title}</p>
                            <p className="text-xs text-slate-500">{event.desc}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400">{formatDate(event.time)}</p>
                            <p className="text-[10px] text-slate-900 font-semibold">{formatLocalTime(event.time)}</p>
                          </div>
                        </div>
                        {event.current && (
                          <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px] font-bold border border-amber-100">
                            Current Stage
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Operation Execution Summary */}
              <div className="bg-white rounded border border-slate-100 p-6 shadow-sm">
                <h3 className="text-sm text-slate-900 font-semibold mb-6">Operation Execution Summary</h3>
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="p-3 bg-slate-50 rounded border border-slate-100">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Scheduled Start</p>
                      <p className="text-xs text-slate-900 font-bold">{formatDate(jobCard.start_time)} {formatLocalTime(jobCard.start_time)}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded border border-slate-100">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Actual Start</p>
                      <p className="text-xs text-slate-900 font-bold">{formatDate(jobCard.actual_start_date)} {formatLocalTime(logs.time[0]?.start_time)}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded border border-slate-100">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Actual End</p>
                      <p className="text-xs text-slate-900 font-bold">{formatDate(jobCard.end_time)} {formatLocalTime(logs.time[logs.time.length-1]?.end_time)}</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">Planned Duration</p>
                      <p className="text-sm text-slate-900 font-bold">{Math.floor(metrics.standardTime / 60)} Hrs {Math.round(metrics.standardTime % 60)} Min</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">Actual Duration</p>
                      <p className="text-sm text-slate-900 font-bold">{Math.floor(metrics.actualTime / 60)} Hrs {Math.round(metrics.actualTime % 60)} Min</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">Performance</p>
                      <p className="text-sm text-emerald-600 font-bold">{metrics.efficiency}%</p>
                    </div>
                </div>

                <div className="p-4 bg-indigo-50/50 rounded-lg border border-indigo-100 flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded text-indigo-600">
                          <Monitor size={16} />
                      </div>
                      <div>
                          <p className="text-xs font-bold text-slate-900">Machine Engagement</p>
                          <p className="text-[10px] text-slate-500">{(parseFloat(jobCard.cycle_time || 0)).toFixed(2)} min/unit × {parseFloat(jobCard.planned_qty || 0).toFixed(3)} units</p>
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-white rounded border border-indigo-100 text-indigo-600 text-xs font-bold">
                      {Math.floor(metrics.standardTime / 60)} Hrs {Math.round(metrics.standardTime % 60)} Min
                    </div>
                </div>

                <div className="bg-emerald-50/30 rounded-lg p-4 border border-emerald-100">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-emerald-700">Output Summary</span>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                          <p className="text-[9px] text-slate-400 uppercase mb-1">Planned Qty</p>
                          <p className="text-xs text-slate-900 font-bold">{parseFloat(jobCard.planned_qty).toFixed(3)} Units</p>
                      </div>
                      <div>
                          <p className="text-[9px] text-slate-400 uppercase mb-1">Produced Qty</p>
                          <p className="text-xs text-slate-900 font-bold">{parseFloat(jobCard.produced_qty).toFixed(3)} Units</p>
                      </div>
                      <div>
                          <p className="text-[9px] text-slate-400 uppercase mb-1">Accepted Qty</p>
                          <p className="text-xs text-emerald-600 font-bold">{parseFloat(jobCard.accepted_qty || 0).toFixed(3)} Units</p>
                      </div>
                      <div>
                          <p className="text-[9px] text-slate-400 uppercase mb-1">Rejected Qty</p>
                          <p className="text-xs text-rose-600 font-bold">{parseFloat(jobCard.rejected_qty || 0).toFixed(3)} Units</p>
                      </div>
                    </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'Costing Details' && (
             <div className="space-y-6">
                <div className="bg-white rounded border border-slate-100 p-6 shadow-sm">
                  <h3 className="text-sm text-slate-900 font-semibold mb-6">Execution Cost Intelligence</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                     <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                           <Clock size={48} />
                        </div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Standard Rate</p>
                        <p className="text-2xl text-slate-900 font-bold">₹{parseFloat(jobCard.hourly_rate || 0).toFixed(2)}<span className="text-xs text-slate-400 font-normal ml-1">/hr</span></p>
                        <div className="mt-4 flex items-center gap-2">
                           <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                           <p className="text-[10px] text-slate-500 font-medium">Workstation: {jobCard.workstation_name || 'Standard'}</p>
                        </div>
                     </div>
                     <div className="p-5 bg-emerald-50 rounded-xl border border-emerald-100 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform text-emerald-600">
                           <IndianRupee size={48} />
                        </div>
                        <p className="text-[10px] text-emerald-600 uppercase font-bold tracking-wider mb-1">Total Budgeted Cost</p>
                        <p className="text-2xl text-emerald-700 font-bold">₹{((metrics.standardTime / 60) * parseFloat(jobCard.hourly_rate || 0)).toFixed(2)}</p>
                        <div className="mt-4 flex items-center gap-2">
                           <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                           <p className="text-[10px] text-emerald-600 font-medium">Std Time: {metrics.standardTime.toFixed(1)} Min</p>
                        </div>
                     </div>
                     <div className="p-5 bg-rose-50 rounded-xl border border-rose-100 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform text-rose-600">
                           <Activity size={48} />
                        </div>
                        <p className="text-[10px] text-rose-600 uppercase font-bold tracking-wider mb-1">Actual Execution Cost</p>
                        <p className="text-2xl text-rose-700 font-bold">₹{((metrics.actualTime / 60) * parseFloat(jobCard.hourly_rate || 0)).toFixed(2)}</p>
                        <div className="mt-4 flex items-center gap-2">
                           <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                           <p className="text-[10px] text-rose-600 font-medium">Act Time: {metrics.actualTime.toFixed(1)} Min</p>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                         <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Resource Utilization Breakdown</h4>
                         <span className="text-[10px] text-slate-400 font-semibold">ESTIMATED</span>
                      </div>
                      <div className="space-y-4">
                        {[
                          { label: 'Material Cost', percent: 60, value: '₹450.00', color: 'bg-indigo-500' },
                          { label: 'Labor Cost', percent: 25, value: '₹187.50', color: 'bg-rose-500' },
                          { label: 'Overheads', percent: 10, value: '₹75.00', color: 'bg-amber-500' },
                          { label: 'Markup/Profit', percent: 5, value: '₹37.50', color: 'bg-emerald-500' }
                        ].map((item, idx) => (
                          <div key={idx} className="space-y-1.5">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-slate-500 font-bold uppercase">{item.label}</span>
                              <span className="text-slate-900 font-bold">{item.value} ({item.percent}%)</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                              <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.percent}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-50/50 rounded-xl border border-slate-100 p-6 flex flex-col justify-center">
                       <div className="text-center space-y-2 mb-6">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Execution Variance</p>
                          <p className={`text-3xl font-black ${metrics.variance <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                             {metrics.variance > 0 ? '+' : ''}{metrics.variance.toFixed(1)} <span className="text-sm font-bold">MIN</span>
                          </p>
                          <p className="text-xs text-slate-500 font-medium">Difference between standard and actual time</p>
                       </div>
                       <div className="flex items-center justify-center gap-8">
                          <div className="text-center">
                             <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Efficiency</p>
                             <div className="inline-flex items-center justify-center p-3 rounded-full bg-white border border-slate-100 text-rose-600 font-bold shadow-sm">
                                {metrics.efficiency}%
                             </div>
                          </div>
                          <div className="text-center">
                             <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">OEE Impact</p>
                             <div className="inline-flex items-center justify-center p-3 rounded-full bg-white border border-slate-100 text-emerald-600 font-bold shadow-sm">
                                POSITIVE
                             </div>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
             </div>
          )}

          {activeTab === 'Assignment Data' && (
            <div className="space-y-6">
              <div className="bg-white rounded border border-slate-100 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-sm text-slate-900 font-semibold">Production Progress Intelligence</h3>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">Real-time tracking of production completion against targets</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-slate-900">{Math.round((parseFloat(jobCard.produced_qty) / parseFloat(jobCard.planned_qty)) * 100)}%</span>
                    <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Completed</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                  {[
                    { label: 'Planned Target', value: jobCard.planned_qty, icon: Target, color: 'text-slate-400' },
                    { label: 'Actual Produced', value: jobCard.produced_qty, icon: Play, color: 'text-indigo-600' },
                    { label: 'QC Accepted', value: jobCard.accepted_qty || 0, icon: CheckCircle2, color: 'text-emerald-600' },
                    { label: 'QC Rejected', value: jobCard.rejected_qty || 0, icon: AlertTriangle, color: 'text-rose-600' }
                  ].map((stat, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-100 group hover:border-indigo-100 transition-colors">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`p-1.5 bg-white rounded shadow-sm ${stat.color}`}>
                           <stat.icon size={12} />
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{stat.label}</p>
                      </div>
                      <p className={`text-lg font-bold ${stat.color}`}>{parseFloat(stat.value).toFixed(3)}</p>
                    </div>
                  ))}
                </div>

                <div className="relative h-3 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:40px_100%] animate-shimmer" />
                  <div className="h-full bg-emerald-500 transition-all duration-1000 relative" style={{ width: `${(parseFloat(jobCard.produced_qty) / parseFloat(jobCard.planned_qty)) * 100}%` }}>
                     <div className="absolute top-0 right-0 h-full w-4 bg-white/20 blur-sm" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded border border-slate-100 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-sm text-slate-900 font-semibold">Time & Performance Matrix</h3>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">Detailed analysis of operation timing and efficiency</p>
                  </div>
                  <StatusBadge status={jobCard.status} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    {[
                      { label: 'Standard Time', value: metrics.standardTime, color: 'text-slate-900' },
                      { label: 'Actual Time', value: metrics.actualTime, color: 'text-indigo-600' },
                      { label: 'Time Variance', value: metrics.variance, color: metrics.variance > 0 ? 'text-rose-600' : 'text-emerald-600' }
                    ].map((row, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-50">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{row.label}</span>
                        <span className={`text-xs font-bold ${row.color}`}>{row.value.toFixed(2)} MIN</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl border border-slate-100">
                     <p className="text-[10px] text-slate-400 font-bold uppercase mb-4 tracking-widest">Efficiency Rating</p>
                     <div className="relative flex items-center justify-center">
                        <svg className="w-24 h-24 transform -rotate-90">
                           <circle className="text-slate-200" strokeWidth="6" stroke="currentColor" fill="transparent" r="40" cx="48" cy="48" />
                           <circle className="text-rose-500" strokeWidth="6" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * metrics.efficiency) / 100} strokeLinecap="round" stroke="currentColor" fill="transparent" r="40" cx="48" cy="48" />
                        </svg>
                        <span className="absolute text-lg font-black text-rose-600">{metrics.efficiency}%</span>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                      <p className="text-[9px] text-emerald-600 font-bold uppercase mb-1">Cycle Time Performance</p>
                      <p className="text-sm text-emerald-700 font-black">
                        {parseFloat(jobCard.produced_qty) > 0 ? (metrics.actualTime / parseFloat(jobCard.produced_qty)).toFixed(3) : 0} 
                        <span className="text-[10px] font-normal ml-1 text-emerald-600 uppercase">Min / Unit</span>
                      </p>
                    </div>
                    <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                      <p className="text-[9px] text-indigo-600 font-bold uppercase mb-1">OEE Production Impact</p>
                      <div className="flex items-center gap-2">
                        <Zap size={12} className="text-indigo-500" />
                        <span className="text-sm text-indigo-700 font-black uppercase">Positive Impact</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Info Sidebar (Only for Timeline) */}
        {activeTab === 'Operational Timeline' && (
          <div className="space-y-6">
            <div className="bg-white rounded border border-slate-100 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm text-slate-900 font-semibold">Current Status</h3>
                <StatusBadge status={jobCard.status} />
              </div>
              <div className="space-y-6">
                {[
                  { icon: Layers, label: 'Workflow Stage', value: jobCard.status, color: 'text-amber-500', bg: 'bg-amber-50' },
                  { icon: ShieldCheck, label: 'Quality Status', value: 'Pending', color: 'text-slate-400', bg: 'bg-slate-50' },
                  { icon: Zap, label: 'Next Action', value: 'Quality Inspection', color: 'text-indigo-500', bg: 'bg-indigo-50' },
                  { icon: CheckCircle2, label: 'Ready For Dispatch', value: 'No', color: 'text-slate-400', bg: 'bg-slate-50' }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={`p-2 rounded ${item.bg} ${item.color}`}>
                      <item.icon size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium uppercase leading-none mb-1">{item.label}</p>
                      <p className="text-xs text-slate-900 font-bold">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded border border-slate-100 p-6 shadow-sm sticky top-4">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded">
                  <Info size={14} />
                </div>
                <h3 className="text-sm text-slate-900 font-semibold">Work Order Information</h3>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Work Order', value: jobCard.wo_number, icon: ClipboardList },
                  { label: 'Operation', value: jobCard.op_name, icon: Settings },
                  { label: 'Job Card', value: jobCard.job_card_no, isLink: true, icon: Activity },
                  { label: 'Specification', value: jobCard.item_code, subValue: jobCard.item_name, icon: Package },
                  { label: 'Target Qty', value: `${parseFloat(jobCard.planned_qty).toFixed(3)} Units`, icon: Target },
                  { label: 'Work Center', value: jobCard.workstation_name || 'N/A', subValue: '(In-house)', icon: Monitor },
                  { label: 'Execution', value: jobCard.execution_mode || 'In-house', icon: Zap },
                  { label: 'Priority', value: jobCard.priority, isBadge: true, icon: AlertTriangle },
                  { label: 'Timeline', value: formatDate(jobCard.created_at), time: formatLocalTime(jobCard.created_at), icon: Calendar }
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-3 py-3 border-b border-slate-50 last:border-0 group">
                    <div className="mt-0.5 text-slate-300 group-hover:text-indigo-400 transition-colors">
                      <item.icon size={14} />
                    </div>
                    <div className="flex-1 flex justify-between items-start">
                      <span className="text-xs text-slate-400 font-medium">{item.label}</span>
                      <div className="text-right">
                        {item.isBadge ? (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.value === 'High' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                          }`}>
                            {item.value}
                          </span>
                        ) : (
                          <>
                            <p className={`text-xs font-bold ${item.isLink ? 'text-indigo-600' : 'text-slate-900'}`}>{item.value}</p>
                            {item.subValue && <p className="text-[9px] text-slate-500 font-medium max-w-[120px] truncate" title={item.subValue}>{item.subValue}</p>}
                            {item.time && <p className="text-[9px] text-slate-400 mt-0.5">{item.time}</p>}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
};

export default WorkOrderDetail;
