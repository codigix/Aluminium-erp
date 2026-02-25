import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import { 
  Activity, 
  Truck, 
  Box, 
  CheckCircle2, 
  Clock, 
  Phone, 
  Navigation, 
  MapPin, 
  AlertTriangle,
  Search,
  User,
  Info,
  ExternalLink,
  Filter,
  Download
} from 'lucide-react';

// Fix for Leaflet default icon issue
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const truckIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/1995/1995470.png',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
});

const warehouseIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2891/2891460.png',
    iconSize: [35, 35],
    iconAnchor: [17, 35],
});

const destinationIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/149/149060.png',
    iconSize: [35, 35],
    iconAnchor: [17, 35],
});

const MapRecenter = ({ center, zoom, shipmentId }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom);
    }
  }, [shipmentId, map]); // Only recenter when the selected shipment ID changes
  return null;
};

const MapCard = ({ children, className = '' }) => (
  <div className={`bg-white border border-slate-100 shadow-sm rounded-[40px] overflow-hidden relative ${className}`}>
    {children}
  </div>
);

const Tracking = ({ apiRequest }) => {
  const orsKey = import.meta.env.VITE_ORS_API_KEY;
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [routeData, setRouteData] = useState({ coords: [], distance: 'N/A', duration: 'N/A' });
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [shipments, setShipments] = useState([]);
  const [stats, setStats] = useState({ ready: 0, dispatched: 0, in_transit: 0, out_for_delivery: 0, delivered_today: 0, delayed: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const data = await apiRequest('/shipments/tracking/dashboard');
      if (!data || !data.activeShipments) {
        setShipments([]);
        return;
      }
      const mapped = data.activeShipments.map(s => ({
        ...s,
        id: s.id,
        code: s.shipment_code,
        customer: s.snapshot_customer_name || s.customer_name || s.shipment_code,
        driver: s.driver_name || 'NOT ASSIGNED',
        driverPhone: s.driver_contact || 'N/A',
        vehicle: s.vehicle_number || 'N/A',
        status: s.status.replace(/_/g, ' '),
        statusColor: s.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-700' : 
                     s.status === 'OUT_FOR_DELIVERY' ? 'bg-purple-100 text-purple-700' : 
                     s.status === 'READY_TO_DISPATCH' ? 'bg-emerald-100 text-emerald-700' :
                     'bg-slate-100 text-slate-700',
        speed: '45 km/h',
        origin: [73.7997, 18.6298],
        current: s.current_lat && s.current_lng ? [parseFloat(s.current_lat), parseFloat(s.current_lng)] : [18.6298, 73.7997],
        destination: [73.8567, 18.5204]
      }));
      setShipments(mapped);
      setStats(data.stats);
      
      // Update selected shipment details without triggering the fetchData dependency loop
      setSelectedShipment(prev => {
        if (!prev && mapped.length > 0) return mapped[0];
        if (prev) {
          const updated = mapped.find(m => m.id === prev.id);
          // Only update if we found it and it's actually different (optional optimization)
          return updated || prev;
        }
        return prev;
      });
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  }, [apiRequest]); // Removed selectedShipment from dependencies

  const fetchRoute = useCallback(async (shipment) => {
    if (!orsKey || !shipment) return;
    setLoadingRoute(true);
    try {
      const response = await axios.post(
        "https://api.openrouteservice.org/v2/directions/driving-car",
        { coordinates: [shipment.origin, shipment.destination] },
        { headers: { Authorization: orsKey, "Content-Type": "application/json" } }
      );
      const feature = response.data.features[0];
      const dist = (feature.properties.summary.distance / 1000).toFixed(1);
      const dur = (feature.properties.summary.duration / 60).toFixed(0);
      setRouteData({
        coords: feature.geometry.coordinates.map(c => [c[1], c[0]]),
        distance: `${dist} km`,
        duration: dur > 60 ? `${Math.floor(dur/60)}h ${dur%60}m` : `${dur}m`
      });
    } catch (error) {
      setRouteData({ coords: [], distance: 'N/A', duration: 'N/A' });
    } finally {
      setLoadingRoute(false);
    }
  }, [orsKey]);

  const handleInitiateReturn = async (shipment) => {
    if (!shipment) return;
    
    const { value: reason } = await Swal.fire({
      title: 'Initiate Return',
      input: 'textarea',
      inputLabel: 'Reason for Return',
      inputPlaceholder: 'Type your reason here...',
      inputAttributes: {
        'aria-label': 'Type your reason here'
      },
      showCancelButton: true,
      confirmButtonText: 'Initiate Return',
      confirmButtonColor: '#ef4444'
    });

    if (reason) {
      try {
        await apiRequest('/shipments/returns', {
          method: 'POST',
          body: {
            shipment_id: shipment.id,
            reason: reason
          }
        });
        Swal.fire('Success', 'Return process initiated successfully', 'success');
        fetchData();
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (selectedShipment?.id) fetchRoute(selectedShipment);
  }, [selectedShipment?.id, fetchRoute]);

  const kpis = [
    { label: 'Active', value: (stats.ready || 0) + (stats.dispatched || 0) + (stats.in_transit || 0) + (stats.out_for_delivery || 0), icon: Activity, color: 'bg-blue-50 text-blue-600' },
    { label: 'In Transit', value: stats.in_transit || 0, icon: Truck, color: 'bg-orange-50 text-orange-600' },
    { label: 'Out for Delivery', value: stats.out_for_delivery || 0, icon: Box, color: 'bg-purple-50 text-purple-600' },
    { label: 'Delivered Today', value: stats.delivered_today || 0, icon: CheckCircle2, color: 'bg-green-50 text-green-600' },
    { label: 'Delayed', value: stats.delayed || 0, icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
  ];

  const filteredShipments = shipments.filter(s => 
    s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.customer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen flex flex-col h-screen overflow-hidden">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shipment Tracking</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time location and status monitoring.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <Filter className="w-4 h-4 text-slate-400" />
            Filter
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4 text-slate-400" />
            Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className="p-4 bg-white border border-slate-100 shadow-sm rounded-3xl flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${kpi.color}`}>
              <kpi.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{kpi.label}</p>
              <p className="text-xl font-black text-slate-900">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6 flex-1 overflow-hidden min-h-0 pb-4">
        {/* Left Sidebar */}
        <MapCard className="col-span-3 flex flex-col h-full overflow-hidden">
          <div className="p-6 border-b border-slate-50">
            <h3 className="font-black text-slate-900 mb-4 tracking-tighter uppercase text-sm">Active Shipments</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-100 bg-slate-50/50 text-xs font-bold outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredShipments.map((s) => (
              <div 
                key={s.id}
                onClick={() => setSelectedShipment(s)}
                className={`p-4 rounded-2xl cursor-pointer transition-all border-2 ${
                  selectedShipment?.id === s.id 
                    ? 'bg-indigo-50/50 border-indigo-100 shadow-sm' 
                    : 'bg-white border-transparent hover:bg-slate-50'
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">{s.code}</p>
                    {selectedShipment?.id === s.id && (
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                    )}
                  </div>
                  <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${s.statusColor}`}>
                    {s.status}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400 uppercase">
                    {s.customer.charAt(0)}
                  </div>
                  <p className="text-[10px] font-black text-slate-700 truncate uppercase tracking-tighter">{s.customer}</p>
                </div>
              </div>
            ))}
          </div>
        </MapCard>

        {/* Center - Map */}
        <MapCard className="col-span-6 h-full relative overflow-hidden">
          <MapContainer 
            center={selectedShipment ? selectedShipment.current : [18.6, 73.8]} 
            zoom={11} 
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {selectedShipment && (
              <>
                <MapRecenter 
                  center={selectedShipment.current} 
                  zoom={12} 
                  shipmentId={selectedShipment.id} 
                />
                <Marker position={[selectedShipment.origin[1], selectedShipment.origin[0]]} icon={warehouseIcon} />
                <Marker position={[selectedShipment.destination[1], selectedShipment.destination[0]]} icon={destinationIcon} />
                <Marker position={selectedShipment.current} icon={truckIcon} />
                {routeData.coords.length > 0 && <Polyline positions={routeData.coords} color="#6366f1" weight={4} dashArray="8, 8" />}
              </>
            )}
          </MapContainer>
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-2 rounded-xl border border-slate-100 shadow-sm z-[1000] flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
            <span className="text-[10px] font-black text-slate-900 uppercase">Live Tracking Active</span>
          </div>
        </MapCard>

        {/* Right Sidebar - Full Data Binding */}
        <MapCard className="col-span-3 flex flex-col h-full overflow-hidden p-6">
          {selectedShipment ? (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar">
                <div>
                  <h3 className="text-lg font-black text-slate-900 mb-6 tracking-tight">{selectedShipment.code}</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-slate-900 uppercase leading-none mb-1">{selectedShipment.customer}</p>
                        <p className="text-[9px] font-bold text-slate-400 tracking-wider">Verified Client</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-slate-900 uppercase leading-none mb-1">{selectedShipment.vehicle}</p>
                        <p className="text-[9px] font-bold text-slate-400 tracking-wider">{selectedShipment.driver}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                        <Phone className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-slate-900 leading-none mb-1">{selectedShipment.driverPhone}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Driver Contact</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-50 text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-50">Avg Speed</p>
                    <p className="text-lg font-black text-slate-900">{selectedShipment.speed}</p>
                  </div>
                  <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-50 text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-50">ETA (Time)</p>
                    <p className="text-lg font-black text-indigo-600 animate-pulse">{routeData.duration}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-6 border-t border-slate-50 flex-shrink-0 mt-4">
                <a 
                  href={selectedShipment.driverPhone !== 'N/A' ? `tel:${selectedShipment.driverPhone}` : '#'}
                  className={`w-full py-4 rounded-[24px] font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${
                    selectedShipment.driverPhone !== 'N/A' 
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-100' 
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Phone className="w-4 h-4" />
                  Call Driver
                </a>
                {selectedShipment.status === 'DELIVERED' && (
                  <button 
                    onClick={() => handleInitiateReturn(selectedShipment)}
                    className="w-full py-3.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    Initiate Return
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
              <Info className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-black text-[10px] uppercase tracking-widest opacity-20">Select Shipment</p>
            </div>
          )}
        </MapCard>
      </div>
    </div>
  );
};

export default Tracking;
