import React, { useState, useEffect } from 'react';
import { Card, DataTable, StatusBadge, SkeletonCard, SkeletonTable } from '../components/ui.jsx';
import { 
  ShoppingCart, Users, Clock, RefreshCw, FileText, Factory, Palette, Package, Truck,
  IndianRupee, CheckCircle, TrendingUp, TrendingDown, ShieldCheck, BarChart3, Monitor, 
  Activity, Bell, Settings, Search, ChevronRight, AlertTriangle, PlayCircle, ClipboardList, Plus
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const generateSparkline = () => Array.from({ length: 15 }, (_, i) => ({ name: i, value: Math.floor(Math.random() * 40) + 10 }));

const AdminDashboard = () => {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    const storedUser = localStorage.getItem('authUser');
    if (storedUser) setUser(JSON.parse(storedUser));
    
    // Simulate loading data since we are focusing on UI
    setTimeout(() => {
      setStats({
        totalRevenue: 760000,
        fulfillmentRate: 2,
        productionOrders: 0,
        totalUsers: 9,
        totalProcurementSpend: 4248000,
        pendingPurchaseOrders: 131,
        openRfqs: 95,
        pendingMaterialRequests: 21,
        approvedPos: 0,
        designOrders: 0,
        pendingDispatch: 5,
        velocityData: [
          { name: 'Fri', val: 0 }, { name: 'Sat', val: 1.2 }, { name: 'Sun', val: 1.1 },
          { name: 'Mon', val: 2.1 }, { name: 'Tue', val: 1.4 }, { name: 'Wed', val: 2.5 },
          { name: 'Thu', val: 3.5 }
        ],
        health: [
          { label: 'Sales Fulfillment', value: 2, color: 'bg-indigo-600' },
          { label: 'Production Accuracy', value: 68, color: 'bg-emerald-500' },
          { label: 'Inventory Turnover', value: 65, color: 'bg-amber-500' },
          { label: 'Quality Acceptance', value: 78, color: 'bg-blue-600' }
        ]
      });
      setLoading(false);
      setLastUpdated(new Date());
    }, 800);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const StatCard = ({ title, count, trend, sparklineColor, icon: Icon, iconBg, iconColor, noTrend }) => (
    <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2.5 rounded-lg ${iconBg} ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
          <span className="text-sm font-semibold text-slate-500">{title}</span>
        </div>
        <div className="text-3xl font-bold text-slate-800 tracking-tight">{count}</div>
      </div>
      
      <div className="mt-2">
        {!noTrend ? (
          <div className={`flex items-center text-xs font-bold ${trend > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {trend > 0 ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
            {Math.abs(trend)}% <span className="text-slate-400 font-medium ml-1">vs last month</span>
          </div>
        ) : (
          <div className="flex items-center text-xs font-medium text-slate-400">
             <span className="w-3 h-0.5 bg-slate-300 mr-2 rounded-full"></span> No change
          </div>
        )}
      </div>

      <div className="h-12 mt-4 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={generateSparkline()}>
            <Line type="monotone" dataKey="value" stroke={sparklineColor} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const MiniStatCard = ({ title, count, trend, icon: Icon, iconBg, iconColor }) => (
    <div className="bg-white rounded-xl p-4 border border-slate-100 flex items-center justify-between hover:shadow-sm transition-shadow">
       <div>
         <p className="text-xs text-slate-500 font-semibold mb-1">{title}</p>
         <div className="text-xl font-bold text-slate-800">{count}</div>
         <div className={`flex items-center text-xs font-bold mt-1 ${trend > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {trend > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
            {Math.abs(trend)}%
          </div>
       </div>
       <div className={`p-3 rounded-lg ${iconBg} ${iconColor}`}>
          <Icon className="w-5 h-5" />
       </div>
    </div>
  );

  const QuickActionButton = ({ icon: Icon, title, iconBg, iconColor }) => (
    <button className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/50 transition-colors group">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${iconBg} ${iconColor} group-hover:scale-110 transition-transform`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm font-semibold text-slate-700">{title}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-400" />
    </button>
  );

  if (loading || !stats) {
    return (
      <div className="space-y-6 pb-12">
        <div className="h-20 bg-slate-100 animate-pulse rounded-xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl text-slate-900 font-bold tracking-tight">{getGreeting()}, {user?.first_name || 'Admin'} 👋</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-bold border border-indigo-100">
              System Administrator
            </span>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              Updated {lastUpdated.toLocaleTimeString()}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-[#6366f1] text-white rounded-lg text-sm font-semibold hover:bg-indigo-600 transition-all shadow-sm">
            <BarChart3 className="w-4 h-4" />
            Project Analysis
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-all shadow-sm">
            <Activity className="w-4 h-4" />
            OEE Analysis
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#0d9488] text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-all shadow-sm">
            <Monitor className="w-4 h-4" />
            Machine Analysis
          </button>
          <button onClick={() => window.location.reload()} className="p-2 bg-white text-slate-600 rounded-lg hover:bg-slate-50 transition-all border border-slate-200 shadow-sm">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Grid 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Revenue" count={`₹${(stats.totalRevenue / 100000).toFixed(1)}L`} trend={12.5} icon={IndianRupee} iconBg="bg-purple-100" iconColor="text-purple-600" sparklineColor="#8b5cf6" />
        <StatCard title="Fulfillment Rate" count={`${stats.fulfillmentRate}%`} trend={-1.2} icon={CheckCircle} iconBg="bg-emerald-100" iconColor="text-emerald-600" sparklineColor="#10b981" />
        <StatCard title="Active Jobs" count={stats.productionOrders} noTrend icon={Factory} iconBg="bg-amber-100" iconColor="text-amber-600" sparklineColor="#f59e0b" />
        <StatCard title="Total Users" count={stats.totalUsers} trend={3.0} icon={Users} iconBg="bg-blue-100" iconColor="text-blue-600" sparklineColor="#3b82f6" />
      </div>

      {/* KPI Grid 2 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Procurement Spend" count={`₹${(stats.totalProcurementSpend / 100000).toFixed(1)}L`} trend={8.4} icon={IndianRupee} iconBg="bg-rose-100" iconColor="text-rose-600" sparklineColor="#f43f5e" />
        <StatCard title="Pending Purchase Orders" count={stats.pendingPurchaseOrders} trend={15.2} icon={ShoppingCart} iconBg="bg-rose-100" iconColor="text-rose-600" sparklineColor="#f43f5e" />
        <StatCard title="Open RFQs" count={stats.openRfqs} trend={-5.1} icon={FileText} iconBg="bg-blue-100" iconColor="text-blue-600" sparklineColor="#3b82f6" />
        <StatCard title="Material Requests" count={stats.pendingMaterialRequests} trend={7.7} icon={Package} iconBg="bg-purple-100" iconColor="text-purple-600" sparklineColor="#8b5cf6" />
      </div>

      {/* Enterprise Velocity & Ecosystem Health */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-xl p-6 border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-lg text-slate-900 font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                Enterprise Velocity
              </h3>
              <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">REAL-TIME PRODUCTION & SALES THROUGHPUT</p>
            </div>
            <select className="text-sm border border-slate-200 rounded-lg text-slate-600 font-medium py-1.5 pl-3 pr-8 focus:ring-indigo-500 focus:border-indigo-500 bg-white">
              <option>This Week</option>
              <option>Last Week</option>
              <option>This Month</option>
            </select>
          </div>
          
          <div className="h-72 w-full mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.velocityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} dx={-10} domain={[0, 4]} />
                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                <Area type="monotone" dataKey="val" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" dot={{r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-auto">
             <MiniStatCard title="Total Orders" count={156} trend={18.2} icon={ClipboardList} iconBg="bg-purple-50" iconColor="text-purple-600" />
             <MiniStatCard title="Completed" count={89} trend={22.4} icon={CheckCircle} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
             <MiniStatCard title="In Progress" count={42} trend={-6.3} icon={Clock} iconBg="bg-amber-50" iconColor="text-amber-600" />
             <MiniStatCard title="Pending" count={25} trend={-2.1} icon={AlertTriangle} iconBg="bg-rose-50" iconColor="text-rose-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-lg text-slate-900 font-bold mb-1">Ecosystem Health</h3>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-8">OPERATIONAL PERFORMANCE</p>
          
          <div className="space-y-8 flex-1">
            {stats.health.map((item, idx) => (
              <div key={idx} className="space-y-2.5">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-semibold text-slate-700">{item.label}</span>
                  <span className="text-base font-bold text-slate-900">{item.value}%</span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 bg-slate-50/50 rounded-xl p-5 flex items-center gap-4 border border-slate-100">
             <div className="p-3.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                <ShieldCheck className="w-7 h-7" />
             </div>
             <div className="flex-1">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overall Health Score</p>
                <div className="flex items-center gap-3 mt-1">
                   <span className="text-3xl font-bold text-slate-900">68%</span>
                   <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-md text-xs font-bold">Good</span>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Table Section: Departmental Operational Status */}
      <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg text-slate-900 font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Departmental Operational Status
            </h3>
            <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">REAL-TIME WORKLOAD & ACCURACY BREAKDOWN</p>
          </div>
        </div>

        <DataTable
          columns={[
            { 
              header: 'Department', 
              key: 'department', 
              render: (val, row) => (
                <div className="flex items-center gap-3 font-semibold text-slate-800">
                  <div className={`p-2 rounded-lg ${row.badgeBg} ${row.badgeText}`}>{row.icon}</div>
                  {val}
                </div>
              )
            },
            { header: 'Key Activity', key: 'metric', render: (val) => <span className="text-slate-600 font-medium">{val}</span> },
            { header: 'Count', key: 'count', render: (val) => <span className="font-bold text-slate-900">{val}</span> },
            { 
              header: 'Status', 
              key: 'status', 
              render: (val) => (
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                  val === 'Active' ? 'bg-emerald-50 text-emerald-600' :
                  val === 'In Progress' ? 'bg-blue-50 text-blue-600' :
                  val === 'Running' ? 'bg-amber-50 text-amber-600' :
                  val === 'Pending' ? 'bg-orange-50 text-orange-600' :
                  'bg-teal-50 text-teal-600'
                }`}>
                  {val} ▾
                </span>
              )
            },
            { 
              header: 'Trend', 
              key: 'trend',
              render: (val) => (
                <span className="flex items-center text-sm font-bold text-emerald-500">
                   <TrendingUp className="w-4 h-4 mr-1" /> {val}
                </span>
              )
            }
          ]}
          data={[
            { department: 'Sales & Orders', icon: <ShoppingCart className="w-4 h-4" />, badgeBg: 'bg-indigo-50', badgeText: 'text-indigo-600', metric: 'Approved Customer POs', count: 0, status: 'Active', trend: '8.2%' },
            { department: 'Design & Engineering', icon: <Palette className="w-4 h-4" />, badgeBg: 'bg-purple-50', badgeText: 'text-purple-600', metric: 'Orders in Design Stage', count: 0, status: 'In Progress', trend: '12.4%' },
            { department: 'Production Floor', icon: <Factory className="w-4 h-4" />, badgeBg: 'bg-amber-50', badgeText: 'text-amber-600', metric: 'Active Work Orders', count: 0, status: 'Running', trend: '15.6%' },
            { department: 'Procurement', icon: <Package className="w-4 h-4" />, badgeBg: 'bg-rose-50', badgeText: 'text-rose-600', metric: 'Pending Purchase Orders', count: 131, status: 'Pending', trend: '8.4%' },
            { department: 'Dispatch & Logistics', icon: <Truck className="w-4 h-4" />, badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-600', metric: 'Orders Ready for Shipment', count: 5, status: 'Ready', trend: '3.1%' },
          ]}
          showSearch={true}
          showPagination={true}
        />
      </div>

      {/* Bottom Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Quick Actions */}
         <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <h3 className="text-md font-bold text-slate-900 mb-5 flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-500" /> Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-3">
               <QuickActionButton icon={ShoppingCart} title="New Sales Order" iconBg="bg-purple-50" iconColor="text-purple-600" />
               <QuickActionButton icon={Package} title="Create PO" iconBg="bg-orange-50" iconColor="text-orange-600" />
               <QuickActionButton icon={FileText} title="New Work Order" iconBg="bg-emerald-50" iconColor="text-emerald-600" />
               <QuickActionButton icon={Plus} title="Add Item" iconBg="bg-amber-50" iconColor="text-amber-600" />
               <QuickActionButton icon={ClipboardList} title="Production Plan" iconBg="bg-blue-50" iconColor="text-blue-600" />
               <QuickActionButton icon={BarChart3} title="View Reports" iconBg="bg-indigo-50" iconColor="text-indigo-600" />
            </div>
         </div>

         {/* Critical Alerts */}
         <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-md font-bold text-slate-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-rose-500" /> Critical Alerts
                <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full text-xs font-bold border border-rose-100">3</span>
              </h3>
            </div>
            
            <div className="space-y-5 flex-1">
               <div className="flex gap-3">
                 <div className="p-2.5 bg-rose-50 text-rose-500 rounded-lg h-fit"><AlertTriangle className="w-4 h-4" /></div>
                 <div>
                    <h4 className="text-sm font-bold text-slate-800">Low Stock Alert</h4>
                    <p className="text-xs text-slate-500 mt-1">8 items are below minimum stock level.</p>
                    <p className="text-xs text-slate-400 mt-1.5 font-medium">10 min ago</p>
                 </div>
               </div>
               <div className="flex gap-3">
                 <div className="p-2.5 bg-amber-50 text-amber-500 rounded-lg h-fit"><AlertTriangle className="w-4 h-4" /></div>
                 <div>
                    <h4 className="text-sm font-bold text-slate-800">Machine Downtime</h4>
                    <p className="text-xs text-slate-500 mt-1">CNC-02 is down for 45 minutes.</p>
                    <p className="text-xs text-slate-400 mt-1.5 font-medium">25 min ago</p>
                 </div>
               </div>
               <div className="flex gap-3">
                 <div className="p-2.5 bg-rose-50 text-rose-500 rounded-lg h-fit"><FileText className="w-4 h-4" /></div>
                 <div>
                    <h4 className="text-sm font-bold text-slate-800">Overdue Purchase Orders</h4>
                    <p className="text-xs text-slate-500 mt-1">12 POs are past due date.</p>
                    <p className="text-xs text-slate-400 mt-1.5 font-medium">1 hr ago</p>
                 </div>
               </div>
            </div>
            <button className="mt-5 text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
               View all alerts <ChevronRight className="w-4 h-4" />
            </button>
         </div>

         {/* Recent Activities */}
         <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm flex flex-col">
            <h3 className="text-md font-bold text-slate-900 mb-5 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" /> Recent Activities
            </h3>
            
            <div className="space-y-5 flex-1">
               <div className="flex gap-3">
                 <div className="p-2 bg-emerald-50 text-emerald-500 rounded-full h-fit"><CheckCircle className="w-4 h-4" /></div>
                 <div>
                    <h4 className="text-sm font-bold text-slate-800">PO #PO-2024-0156 approved</h4>
                    <p className="text-xs text-slate-500 mt-1 font-medium">By Admin • 10:15 AM</p>
                 </div>
               </div>
               <div className="flex gap-3">
                 <div className="p-2 bg-blue-50 text-blue-500 rounded-full h-fit"><FileText className="w-4 h-4" /></div>
                 <div>
                    <h4 className="text-sm font-bold text-slate-800">New Work Order #WO-2458 created</h4>
                    <p className="text-xs text-slate-500 mt-1 font-medium">By Production • 09:45 AM</p>
                 </div>
               </div>
               <div className="flex gap-3">
                 <div className="p-2 bg-emerald-50 text-emerald-500 rounded-full h-fit"><Package className="w-4 h-4" /></div>
                 <div>
                    <h4 className="text-sm font-bold text-slate-800">GRN #GRN-1045 received</h4>
                    <p className="text-xs text-slate-500 mt-1 font-medium">By Store • 09:30 AM</p>
                 </div>
               </div>
               <div className="flex gap-3">
                 <div className="p-2 bg-purple-50 text-purple-500 rounded-full h-fit"><ShieldCheck className="w-4 h-4" /></div>
                 <div>
                    <h4 className="text-sm font-bold text-slate-800">Quality Inspection completed</h4>
                    <p className="text-xs text-slate-500 mt-1 font-medium">By Quality • 09:10 AM</p>
                 </div>
               </div>
            </div>
            <button className="mt-5 text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
               View all activities <ChevronRight className="w-4 h-4" />
            </button>
         </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
