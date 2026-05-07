import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Search, Filter, Download, ChevronRight, 
  ArrowLeft, Calendar, Building2, 
  User, Phone, Mail, MapPin, Briefcase,
  FileText, CheckCircle2, TrendingUp, Layers
} from 'lucide-react';
import { Button, Card, DataTable } from '../components/ui.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const ActiveClients = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    start: '2026-04-01',
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchActiveClientsData();
  }, []);

  const fetchActiveClientsData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      // Using the logic from CustomerDrawing.jsx to get detailed client/project info
      const response = await fetch(`${API_BASE}/sales-orders?includeWithoutPo=true`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch clients data');
      const rawData = await response.json();
      
      const filtered = rawData.filter(so =>
        so.project_name?.includes('Design Review') ||
        so.current_department === 'DESIGN_ENG' ||
        so.current_department === 'SALES' ||
        so.status === 'ACTIVE'
      );

      // Group by client to avoid duplicate entries
      const grouped = filtered.reduce((acc, so) => {
        const clientName = so.client_name || so.company_name || 'Unassigned';
        const key = clientName;
        
        if (!acc[key]) {
          const firstDrawingWithContact = so.items?.find(item => item.contact_person || item.phone || item.email);
          
          acc[key] = {
            ...so,
            client_name: clientName,
            project_name: so.project_name || 'General',
            drawing_count: 0,
            contact_person: so.contact_person || firstDrawingWithContact?.contact_person || '—',
            contact_phone: so.contact_phone || firstDrawingWithContact?.phone || '—',
            email_address: so.email_address || firstDrawingWithContact?.email || '—',
            customer_type: so.customer_type || firstDrawingWithContact?.customer_type || 'Regular',
            gstin: so.gstin || firstDrawingWithContact?.gstin || '—',
            city: so.city || firstDrawingWithContact?.city || '—',
            state: so.state || firstDrawingWithContact?.state || '—',
            status: so.status || 'Active'
          };
        }

        const items = so.items?.filter(item => !item.item_code) || [];
        acc[key].drawing_count += items.length;

        // If this entry has a cleaner project name (not a design review snippet), use it
        if (so.project_name && !so.project_name.includes('Design Review') && acc[key].project_name.includes('Design Review')) {
          acc[key].project_name = so.project_name;
        }

        return acc;
      }, {});

      setData(Object.values(grouped));
    } catch (error) {
      console.error('Error fetching active clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    return data.filter(c => {
      const search = searchTerm.toLowerCase();
      return (
        (c.project_name || '').toLowerCase().includes(search) ||
        (c.client_name || '').toLowerCase().includes(search) ||
        (c.contact_person || '').toLowerCase().includes(search) ||
        (c.email_address || '').toLowerCase().includes(search) ||
        (c.gstin || '').toLowerCase().includes(search)
      );
    });
  }, [data, searchTerm]);

  const stats = useMemo(() => {
    const uniqueClients = new Set(data.map(d => d.client_name)).size;
    const activeClients = new Set(data.filter(d => d.status?.toUpperCase() === 'ACTIVE').map(d => d.client_name)).size;
    const totalDrawings = data.reduce((sum, d) => sum + (d.drawing_count || 0), 0);
    
    // Count new clients added this month
    const now = new Date();
    const thisMonthAdded = new Set(data.filter(d => {
      const date = new Date(d.created_at);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).map(d => d.client_name)).size;

    return {
      totalClients: uniqueClients,
      activeClients: activeClients || uniqueClients, // fallback if status not present
      thisMonthAdded: thisMonthAdded,
      totalDrawings: totalDrawings
    };
  }, [data]);

  const columns = [
    {
      label: 'Project Name',
      key: 'project_name',
      sortable: true,
      render: (val) => <span className="font-bold text-slate-900 text-[11px]">{val}</span>
    },
    {
      label: 'Client Name',
      key: 'client_name',
      sortable: true,
      render: (val) => <span className="text-slate-600 text-[11px]">{val}</span>
    },
    {
      label: 'Contact Person',
      key: 'contact_person',
      render: (val) => <span className="text-slate-600 text-[11px]">{val}</span>
    },
    {
      label: 'Phone',
      key: 'contact_phone',
      render: (val) => <span className="text-slate-600 text-[11px] font-medium">{val}</span>
    },
    {
      label: 'Email',
      key: 'email_address',
      render: (val) => <span className="text-slate-500 text-[10px] truncate max-w-[150px]" title={val}>{val}</span>
    },
    {
      label: 'Type',
      key: 'customer_type',
      render: (val) => <span className="text-slate-600 text-[11px]">{val}</span>
    },
    {
      label: 'GSTIN',
      key: 'gstin',
      render: (val) => <span className="text-slate-500 text-[10px] font-medium tracking-tight">{val}</span>
    },
    {
      label: 'City',
      key: 'city',
      render: (val) => <span className="text-slate-600 text-[11px]">{val}</span>
    },
    {
      label: 'State',
      key: 'state',
      render: (val) => <span className="text-slate-600 text-[11px]">{val}</span>
    },
    {
      label: 'Drawings',
      key: 'drawing_count',
      className: 'text-center',
      render: (val) => <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold border border-indigo-100">{val}</span>
    }
  ];

  return (
    <div className="space-y-4 pb-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-[0.12em] mb-1.5">
            <span>Dashboard</span>
            <ChevronRight className="w-3 h-3" />
            <span>Customer Drawings</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-rose-600">Clients</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Clients</h1>
          <p className="text-slate-500 text-xs font-medium">Manage all clients and their details</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/sales-report')} className="flex items-center gap-1.5 font-bold text-xs h-10 px-4">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Clients" value={stats.totalClients} subValue="All Clients" color="indigo" />
        <StatCard icon={CheckCircle2} label="Active Clients" value={stats.activeClients} subValue="Currently Active" color="emerald" />
        <StatCard icon={Calendar} label="This Month Added" value={stats.thisMonthAdded} subValue="New Clients" color="amber" />
        <StatCard icon={Layers} label="Total Drawings" value={stats.totalDrawings} subValue="Across All Clients" color="blue" />
      </div>

      {/* Main Table Card */}
      <Card className="bg-white border border-slate-200 shadow-sm overflow-hidden rounded-xl">
        <div className="p-0">
          <DataTable 
            columns={columns}
            data={filteredData}
            loading={loading}
            pageSize={10}
            searchPlaceholder="Search by project name, client name, email or contact..."
            emptyMessage="No clients found matching your search."
          />
        </div>
      </Card>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, subValue, color }) => {
  const colorMap = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100'
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-5 group hover:border-rose-100 transition-all duration-300">
      <div className={`p-4 rounded-xl border ${colorMap[color] || colorMap.indigo} transition-transform group-hover:scale-110 duration-300 shadow-sm`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">{label}</p>
        <h3 className="text-2xl font-black text-slate-900 leading-none">{value}</h3>
        <p className="text-xs text-slate-500 mt-2 font-medium leading-none">{subValue}</p>
      </div>
    </div>
  );
};

export default ActiveClients;
