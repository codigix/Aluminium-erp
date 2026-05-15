import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Plus, Trash2, Save, X, Send, 
  FileText, Calendar, User, Hash, 
  ChevronLeft, Loader2, Calculator, RefreshCw,
  Building2, Mail, Phone, MapPin,
  GitBranch, Clock, AlertCircle, ArrowUpRight,
  Check, XCircle
} from 'lucide-react';
import { Card, StatusBadge, SearchableSelect } from '../components/ui.jsx';
import { successToast, errorToast } from '../utils/toast';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(value || 0);
};

const QuotationFormPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { initialData } = location.state || {};

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quotationNo, setQuotationNo] = useState('Generating...');
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [clients, setClients] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [version, setVersion] = useState(1);
  const [parentId, setParentId] = useState(null);
  const [batchId, setBatchId] = useState(null);
  const [versionHistory, setVersionHistory] = useState([]);
  const [mode, setMode] = useState('create'); // 'create', 'revise', or 'received'
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshingDrawings, setRefreshingDrawings] = useState(false);
  const hasInitialized = useRef(false);

  // Locking logic: Only the latest version can be edited, and only if it's NOT approved.
  const maxVersion = Math.max(
    version,
    ...(versionHistory.map(vh => vh.version) || [0])
  );
  const isLatest = version >= maxVersion;
  
  // STRICT GUARD: Determine if the current view is a historical snapshot that must be frozen
  // A version is historical if a specific ID is selected that is NOT the absolute latest in history
  const latestInHistory = versionHistory.length > 0 ? versionHistory[versionHistory.length - 1] : null;
  const isLatestApproved = versionHistory.some(vh => vh.status?.toUpperCase() === 'APPROVED');
  const isHistoricalView = !!selectedVersionId && latestInHistory && selectedVersionId !== latestInHistory.id;

  const currentVersionData = versionHistory.find(v => v.version === version);
  const currentStatus = (currentVersionData?.status || 'Draft').toUpperCase();
  const isSnapshotStatus = ['APPROVED', 'REVISED', 'SENT', 'COMPLETED', 'REJECTED'].includes(currentStatus);
  const isCurrentApproved = currentStatus === 'APPROVED';

  // Old versions are always read-only. The latest is locked if it has a snapshot status (Sent, Approved, etc.),
  // EXCEPT when in 'received' mode where we need to see action buttons for a 'SENT' quotation.
  // ALSO: If the chain already has an APPROVED version, the whole UI should be locked for editing.
  const isLocked = isHistoricalView || isLatestApproved || (isSnapshotStatus && (mode !== 'received' || currentStatus !== 'SENT'));

  useEffect(() => {
    if (selectedClient?.company_name) {
      fetchDrawings(selectedClient.company_name);
    } else {
      setDrawings([]);
    }
  }, [selectedClient?.company_name]);

  useEffect(() => {
    fetchClients();
    
    if (initialData && !hasInitialized.current) {
      hasInitialized.current = true;
      generateQuotationNo();
      setVersion(initialData.version || 1);
      setParentId(initialData.parentId || null);
      setBatchId(initialData.batchId || null);
      setMode(initialData.mode || 'create');
      if (initialData.parentId || initialData.id) {
        fetchVersionHistory(initialData.parentId || initialData.id);
      }
      setSelectedClient({
        id: initialData.clientId,
        company_name: initialData.clientName,
        email: initialData.clientEmail,
        contact_person: initialData.contact_person,
        phone: initialData.phone,
        address: initialData.address
      });
      setProjectName(initialData.projectName || '');
      
      const allSourceItems = initialData.items || [];
      const nestedIdentities = new Set();
      
      // Build set of nested identities
      allSourceItems.forEach(item => {
        if (item.sub_assemblies && item.sub_assemblies.length > 0) {
          item.sub_assemblies.forEach(sa => {
            const code = (sa.component_code || sa.componentCode || '').trim().toUpperCase();
            const drawing = (sa.drawing_no || '').trim().toUpperCase();
            const desc = (sa.description || sa.item_description || '').trim().toUpperCase();
            
            if (code) {
              nestedIdentities.add(`${drawing}_${code}`);
              nestedIdentities.add(`_ANY_DRAWING_${code}`);
            }
            if (desc) {
              nestedIdentities.add(`${drawing}_DESC_${desc}`);
              nestedIdentities.add(`_ANY_DRAWING_DESC_${desc}`);
            }
          });
        }
      });

      const mappedItems = allSourceItems
        .filter(item => {
          // 1. Basic filter for identifying info
          if (!(item.drawing_no || item.description || item.item_code)) return false;

          // 2. Duplicate filter (Hide if it's already a nested child of another item)
          const g = (item.item_group || '').toUpperCase();
          const t = (item.item_type || '').trim().toUpperCase();
          const isFG = (g.includes('FG') || t.includes('FG') || g.includes('FINISHED')) && !g.includes('SA') && !g.includes('SUB');
          
          if (!isFG) {
            const code = (item.item_code || '').trim().toUpperCase();
            const drawing = (item.drawing_no || '').trim().toUpperCase();
            const desc = (item.description || '').trim().toUpperCase();
            
            const identity = `${drawing}_${code}`;
            const identityDesc = `${drawing}_DESC_${desc}`;
            
            if (nestedIdentities.has(identity) || 
                nestedIdentities.has(`_ANY_DRAWING_${code}`) ||
                nestedIdentities.has(identityDesc) ||
                nestedIdentities.has(`_ANY_DRAWING_DESC_${desc}`)) {
              return false;
            }
          }
          return true;
        })
        .map(item => {
          let bomCost = parseFloat(item.bom_cost || 0);
          let drwRate = parseFloat(item.quotedPrice || item.rate || bomCost || 0);

          // Force sync for revisions and new quotes to ensure Rate == BOM Cost
          if (bomCost > 0) {
            drwRate = bomCost;
          }

          // Recalculate based on sub-assemblies if they exist - helps catch stale FG costs
          if (item.sub_assemblies && item.sub_assemblies.length > 0) {
            const saSum = item.sub_assemblies.reduce((sum, sa) => {
              const saCost = parseFloat(sa.bom_cost || sa.rate || 0);
              const saQty = parseFloat(sa.quantity || 0);
              return sum + (saCost * saQty);
            }, 0);
            
            // If the sum of known sub-assemblies is higher than the stored FG cost, trust the sum
            if (saSum > (bomCost || drwRate)) {
              bomCost = saSum;
              drwRate = saSum;
            }
          }

          return {
            ...item,
            id: item.id || Date.now() + Math.random(),
            rate: drwRate,
            bom_cost: bomCost || drwRate,
            total: (parseFloat(item.quantity) || 0) * drwRate,
            gst_percentage: item.gst_percentage || 18,
            isManual: !item.drawing_id && !!item.drawing_no,
            sub_assemblies: item.sub_assemblies || []
          };
        });
      
      setItems(mappedItems);
      setNotes(initialData.notes || '');
    } else if (!hasInitialized.current) {
      generateQuotationNo();
      hasInitialized.current = true;
    }
  }, [initialData]);

  useEffect(() => {
    // STRICT GUARD: ONLY sync if:
    // 1. We have drawings and items
    // 2. We are NOT viewing a historical snapshot
    // 3. The current status is NOT a snapshot status (must be Draft or new Revision)
    // 4. We are NOT in 'received' mode
    const canSync = items.length > 0 && 
                    drawings.length > 0 && 
                    !isHistoricalView &&
                    !isSnapshotStatus && 
                    mode !== 'received' &&
                    !isLocked;

    if (canSync) {
      const updatedItems = items.map(item => {
        const itemG = (item.item_group || '').toUpperCase();
        const itemIsSA = (itemG.includes('SA') || itemG.includes('SUB') || itemG.includes('ASSEMBLY')) && !itemG.includes('FG');
        
        const matchedDrawing = drawings.find(d => {
          const drwG = (d.item_group || '').toUpperCase();
          const drwIsSA = (drwG.includes('SA') || drwG.includes('SUB') || drwG.includes('ASSEMBLY')) && !drwG.includes('FG');

          // 1. Match by drawing_id (Absolute Priority - Direct link)
          if (item.drawing_id && String(d.drawing_master_id) === String(item.drawing_id)) return true;

          // 2. Match by item_code (High Priority - Unique identity)
          if (item.item_code && d.item_code && String(d.item_code).trim().toLowerCase() === String(item.item_code).trim().toLowerCase()) return true;

          // 3. Match by drawing_no AND item_group AND Description (Fallback)
          if (item.drawing_no && String(d.drawing_no).trim().toLowerCase() === String(item.drawing_no).trim().toLowerCase()) {
            const itemDesc = String(item.description || '').trim().toLowerCase();
            const drwDesc = String(d.description || '').trim().toLowerCase();
            
            // Group must match (SA vs FG)
            if (itemIsSA === drwIsSA) {
              // Description match is critical when multiple items share a drawing number
              const descMatch = !itemDesc || !drwDesc || drwDesc === itemDesc || drwDesc.includes(itemDesc) || itemDesc.includes(drwDesc);
              if (descMatch) return true;
            }
          }

          return false;
        });

        if (matchedDrawing) {
          let drwRate = parseFloat(matchedDrawing.bom_cost || matchedDrawing.rate || matchedDrawing.quotedPrice || 0);
          
          // Recalculate based on sub-assemblies if they exist - helps catch stale FG costs
          if (matchedDrawing.sub_assemblies && matchedDrawing.sub_assemblies.length > 0) {
            const saSum = matchedDrawing.sub_assemblies.reduce((sum, sa) => {
              const saCost = parseFloat(sa.bom_cost || sa.rate || 0);
              const saQty = parseFloat(sa.quantity || 0);
              return sum + (saCost * saQty);
            }, 0);
            
            // If the sum of known sub-assemblies is higher than the stored FG cost, trust the sum.
            // BUT: if drwRate (from Master) is higher, it likely includes materials/operations, so we trust it.
            if (saSum > drwRate) {
              drwRate = saSum;
            }
          }

          const g = (item.item_group || matchedDrawing.item_group || '').toUpperCase();
          const isSA = (g.includes('SA') || g.includes('SUB') || g.includes('ASSEMBLY')) && !g.includes('FG');
          const isFG = !isSA;
          
          let newItem = { ...item };
          let changed = false;

          // Sync drawing_id if missing (using drawing_master_id for the link)
          if (!item.drawing_id && matchedDrawing.drawing_master_id) {
            newItem.drawing_id = matchedDrawing.drawing_master_id;
            changed = true;
          }

          // Sync item_code if missing
          if (!item.item_code && matchedDrawing.item_code) {
            newItem.item_code = matchedDrawing.item_code;
            changed = true;
          }

          // Sync sub_assemblies if missing or if the master has different data
          const hasSAs = item.sub_assemblies && item.sub_assemblies.length > 0;
          const saChanged = matchedDrawing.sub_assemblies && JSON.stringify(item.sub_assemblies) !== JSON.stringify(matchedDrawing.sub_assemblies);
          
          if (matchedDrawing.sub_assemblies && (!hasSAs || saChanged)) {
            newItem.sub_assemblies = matchedDrawing.sub_assemblies;
            changed = true;
          }

          // Sync BOM Cost logic
          const currentBOMCost = parseFloat(item.bom_cost || 0);
          const currentRate = parseFloat(item.rate || 0);
          const rateMatchesCost = Math.abs(currentRate - currentBOMCost) < 0.01;
          
          // SYNC LOGIC: 
          // 1. Always sync if current cost is 0 and we found a rate in Master
          // 2. Sync if the Master cost is different and we have a solid link (item_code OR drawing_no)
          //    (This ensures revisions pick up the latest Master costs)
          const isItemCodeMatch = item.item_code && matchedDrawing.item_code && String(matchedDrawing.item_code).trim().toLowerCase() === String(item.item_code).trim().toLowerCase();
          const isDrawingNoMatch = item.drawing_no && matchedDrawing.drawing_no && String(matchedDrawing.drawing_no).trim().toLowerCase() === String(item.drawing_no).trim().toLowerCase();
          const shouldSync = (currentBOMCost === 0) || isItemCodeMatch || isDrawingNoMatch;

          const costChanged = drwRate > 0 && Math.abs(currentBOMCost - drwRate) > 0.01;
          
          if (costChanged && (shouldSync || saChanged)) {
            newItem.bom_cost = drwRate;
            changed = true;
            
            // Update rate to new BOM cost if it was 0, matched old cost, OR we are in a mode that allows auto-update
            if (currentRate === 0 || rateMatchesCost || mode === 'revise' || mode === 'create') {
              newItem.rate = drwRate;
              newItem.total = (parseFloat(item.quantity) || 0) * drwRate;
            }
          }

          return changed ? newItem : item;
        }
        return item;
      });
      
      const hasChanges = updatedItems.some((it, idx) => 
        it.drawing_id !== items[idx].drawing_id || 
        Math.abs(parseFloat(it.rate || 0) - parseFloat(items[idx].rate || 0)) > 0.01 ||
        Math.abs(parseFloat(it.bom_cost || 0) - parseFloat(items[idx].bom_cost || 0)) > 0.01 ||
        JSON.stringify(it.sub_assemblies || []) !== JSON.stringify(items[idx].sub_assemblies || [])
      );

      if (hasChanges) {
        setItems(updatedItems);
      }
    }
  }, [
    drawings, 
    isLocked, 
    items.map(i => `${i.id}-${i.drawing_id}-${i.drawing_no}-${i.item_code}`).join('|'), 
    mode, 
    version, 
    selectedVersionId
  ]);

  useEffect(() => {
    if (items.length > 0) {
      const drawingNumbers = [...new Set(items.map(item => item.drawing_no).filter(no => !!no))];
      if (drawingNumbers.length > 0) {
        const drwNotes = `Drawing Numbers: ${drawingNumbers.join(', ')}`;
        // Only auto-update if notes is empty or already contains only drawing numbers
        if (!notes || notes.startsWith('Drawing Numbers:')) {
          setNotes(drwNotes);
        }
      }
    }
  }, [items]);

  const fetchClients = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/companies`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchDrawings = async (clientName = null) => {
    try {
      setRefreshingDrawings(true);
      const token = localStorage.getItem('authToken');
      const url = clientName 
        ? `${API_BASE}/drawings?clientName=${encodeURIComponent(clientName)}`
        : `${API_BASE}/drawings`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDrawings(data);
      }
    } catch (error) {
      console.error('Error fetching drawings:', error);
    } finally {
      setRefreshingDrawings(false);
    }
  };

  const fetchVersionHistory = async (id) => {
    try {
      setLoadingHistory(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotation-requests/versions/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Sort history ASC (V1 at top) as per standard ERP audit trail
        const sortedHistory = [...data].sort((a, b) => a.version - b.version);
        setVersionHistory(sortedHistory);
        
        // Default to loading the latest version if we're not in a fresh creation mode
        const currentMode = initialData?.mode || mode;
        if (sortedHistory.length > 0 && currentMode !== 'create') {
          // Newest is the last item in ASC sort
          const latest = sortedHistory[sortedHistory.length - 1];
          await loadVersionData(latest, currentMode === 'revise');
        }
      }
    } catch (error) {
      console.error('Error fetching version history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadVersionData = async (v, forceNextVersion = false) => {
    try {
      setLoading(true);
      let versionData = v;
      
      // If we're loading an existing version (not preparing a new revision), 
      // fetch full details from the new API to ensure sub-assemblies are correct
      if (!forceNextVersion && v.id) {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/quotation-requests/version-details/${v.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          versionData = await response.json();
        }
      }

      // This allows switching between versions dynamically in the form
      // If forceNextVersion is true (usually on initial load in revise mode), 
      // we want to show the NEXT version number we are about to create.
      const targetVersion = forceNextVersion ? (initialData?.version || versionData.version + 1) : versionData.version;
      setVersion(targetVersion);
      setSelectedVersionId(forceNextVersion ? null : versionData.id);
      setBatchId(versionData.batch_id || null);
      setQuotationNo(`QRT-${String(versionData.id).padStart(4, '0')}`);
      setQuotationDate(versionData.created_at.split('T')[0]);
      setProjectName(versionData.project_name || '');
      setNotes(versionData.notes || '');
      
      const maxHistoryVersion = versionHistory.length > 0 
        ? Math.max(...versionHistory.map(vh => vh.version)) 
        : version;
      
      // RULE: Any existing saved version with these statuses is considered "historical" (frozen)
      const s = (versionData.status || '').toUpperCase();
      const isSnapshot = versionData.version < maxHistoryVersion || ['APPROVED', 'REVISED', 'SENT', 'COMPLETED', 'REJECTED'].includes(s);
      
      // If we are preparing a NEW version (forceNextVersion), the items are NOT historical (they are editable templates)
      const isHistorical = isSnapshot && !forceNextVersion;
      
      // Map items from the version
      if (versionData.items && versionData.items.length > 0) {
        // Deep clone to ensure no shared references with historical state
        const itemsSnapshot = JSON.parse(JSON.stringify(versionData.items));
        
        setItems(itemsSnapshot.map(item => {
          // Map saved sub-assemblies first to ensure they are available for cost logic
          const savedSubAssemblies = (item.sub_assemblies || []).map(sa => ({
            ...sa,
            bom_cost: parseFloat(sa.bom_cost || sa.rate || 0),
            rate: parseFloat(sa.rate || sa.bom_cost || 0)
          }));

          // Apply overrides ONLY if we are preparing a NEW version (forceNextVersion)
          const override = forceNextVersion ? initialData?.items?.find(oi => 
            (oi.salesOrderItemId && String(oi.salesOrderItemId) === String(item.sales_order_item_id)) ||
            (oi.item_code && oi.item_code === item.item_code && oi.drawing_no === item.drawing_no)
          ) : null;

          // For NEW revisions or DRAFTS, we prefer latest master cost if available, otherwise trust the base record
          const latestBOMCost = parseFloat(item.latest_bom_cost || 0);
          const storedBOMCost = parseFloat(item.bom_cost || 0);
          
          // If it's a draft/new version and master has a newer/different cost, consider it for sync
          let bomCost = (forceNextVersion || s === 'DRAFT') && latestBOMCost > 0 
            ? latestBOMCost 
            : storedBOMCost;

          let drwRate = parseFloat(override?.quotedPrice || item.quotedPrice || item.rate || bomCost || 0);

          // If we synced to latest BOM cost, we should also update the rate if they were previously matching
          if (bomCost !== storedBOMCost && Math.abs(parseFloat(item.rate || 0) - storedBOMCost) < 0.01) {
            drwRate = bomCost;
          }

          // For NEW revisions, we might want to recalculate based on updated sub-assemblies, materials and operations
          // For HISTORICAL versions (Sent, Approved, etc.), we MUST NOT recalculate - we trust the snapshot exactly
          if (!isHistorical) {
            const saSum = savedSubAssemblies.reduce((sum, sa) => {
              const saCost = parseFloat(sa.bom_cost || sa.rate || 0);
              const saQty = parseFloat(sa.quantity || 0);
              return sum + (saCost * saQty);
            }, 0);

            const materialSum = (item.materials || []).reduce((sum, m) => {
              const mCost = parseFloat(m.rate || 0);
              const mQty = parseFloat(m.qty_per_pc || m.quantity || 0);
              const weight = parseFloat(m.weight_per_unit || 0);
              return sum + (mQty * weight * mCost);
            }, 0);

            const operationSum = (item.operations || []).reduce((sum, o) => {
              const rate = parseFloat(o.hourly_rate || 0);
              const time = (parseFloat(o.cycle_time_min || 0) + (parseFloat(o.setup_time_min || 0) / (parseFloat(item.quantity) || 1)));
              return sum + (time / 60 * rate);
            }, 0);

            const calculatedTotal = saSum + materialSum + operationSum;
            
            if (calculatedTotal > (drwRate || bomCost)) {
              drwRate = calculatedTotal;
              bomCost = calculatedTotal;
            }
          }

          return {
            ...item,
            id: item.id || Date.now() + Math.random(),
            salesOrderItemId: item.sales_order_item_id || item.salesOrderItemId,
            drawing_id: item.drawing_id,
            rate: drwRate,
            bom_cost: bomCost || item.bom_cost || drwRate,
            total: (parseFloat(item.quantity) || 0) * drwRate,
            gst_percentage: item.gst_percentage || 18,
            drawing_no: item.drawing_no,
            description: item.description,
            bom_id: item.bom_id,
            revision_no: item.revision_no,
            sub_assemblies: savedSubAssemblies
          };
        }));
      }
    } catch (err) {
      console.error('Error loading version data:', err);
      errorToast('Failed to load version details');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveVersion = async (v) => {
    try {
      const result = await Swal.fire({
        title: `Approve Version ${v.version}?`,
        text: "This will set this version as Approved.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        confirmButtonText: 'Yes, Approve'
      });

      if (result.isConfirmed) {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/quotation-requests/${v.id}/approve`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          successToast(`Version ${v.version} approved`);
          fetchVersionHistory(parentId || initialData?.id || v.id);
        } else {
          throw new Error('Failed to approve version');
        }
      }
    } catch (error) {
      errorToast(error.message);
    }
  };

  const handleRejectVersion = async (v) => {
    try {
      const { value: reason } = await Swal.fire({
        title: `Reject Version ${v.version}?`,
        input: 'textarea',
        inputLabel: 'Rejection Reason',
        inputPlaceholder: 'Enter reason for rejection...',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Reject'
      });

      if (reason !== undefined) {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/quotation-requests/${v.id}/reject`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({ reason })
        });

        if (response.ok) {
          successToast(`Version ${v.version} rejected`);
          fetchVersionHistory(parentId || initialData?.id || v.id);
        } else {
          throw new Error('Failed to reject version');
        }
      }
    } catch (error) {
      errorToast(error.message);
    }
  };

  const handleDeleteVersion = async (v) => {
    try {
      const result = await Swal.fire({
        title: `Delete Version ${v.version}?`,
        text: "This action cannot be undone.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Yes, Delete'
      });

      if (result.isConfirmed) {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/quotation-requests/${v.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          successToast(`Version ${v.version} deleted`);
          const newHistory = versionHistory.filter(item => item.id !== v.id);
          setVersionHistory(newHistory);
          if (newHistory.length === 0) {
            navigate('/sales/client-quotations');
          } else if (selectedVersionId === v.id) {
            await loadVersionData(newHistory[0]);
          }
        } else {
          throw new Error('Failed to delete version');
        }
      }
    } catch (error) {
      errorToast(error.message);
    }
  };

  const generateQuotationNo = async () => {
    // In a real app, this would come from the backend
    // For now, we'll simulate it
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setQuotationNo(`QRT-${randomNum}`);
  };

  const handleAddItem = () => {
    const newItem = {
      id: Date.now(),
      drawing_no: '',
      description: '',
      quantity: 1,
      unit: 'Nos',
      rate: 0,
      total: 0,
      gst_percentage: 18,
      isManual: false,
      sub_assemblies: []
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleItemChange = (id, field, value) => {
    const updatedItems = items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantity' || field === 'rate') {
          updatedItem.total = (parseFloat(updatedItem.quantity) || 0) * (parseFloat(updatedItem.rate) || 0);
        }
        return updatedItem;
      }
      return item;
    });
    setItems(updatedItems);
  };

  const handleDownloadPDF = async () => {
    const idToDownload = selectedVersionId || initialData?.id;
    if (!idToDownload) {
      errorToast('Please save the quotation first to download PDF');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotation-requests/download-pdf/${idToDownload}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to download PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Quotation_${quotationNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      successToast('PDF download started');
    } catch (error) {
      console.error(error);
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewPDF = async (versionId) => {
    if (!versionId) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotation-requests/download-pdf/${versionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      // We don't revoke immediately as the new tab needs it
    } catch (error) {
      console.error(error);
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = () => {
    // Include all items in summary if they have a rate
    const billableItems = items.filter(item => {
      return (parseFloat(item.rate) || 0) > 0 || (item.item_group || '').toUpperCase().includes('FG');
    });

    const baseAmount = billableItems.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
    const gstAmount = billableItems.reduce((sum, item) => {
      const itemTotal = parseFloat(item.total) || 0;
      const gstPercent = parseFloat(item.gst_percentage) || 18;
      return sum + (itemTotal * gstPercent / 100);
    }, 0);
    return {
      baseAmount,
      gstAmount,
      totalAmount: baseAmount + gstAmount
    };
  };

  const summary = calculateSummary();

  const handleSave = async (status = 'Draft', sendEmail = null) => {
    if (!selectedClient) {
      errorToast('Please select a client');
      return;
    }
    
    // Determine if email should be sent
    // If sendEmail is provided (true/false), use it. 
    // Otherwise fallback to legacy logic: status 'Sent' or 'Revised' usually implied email
    const finalSendEmail = sendEmail !== null ? sendEmail : (status === 'Sent' || status === 'Revised');

    if (finalSendEmail && !selectedClient?.email) {
      errorToast('Client email is required to send quotation');
      return;
    }
    if (items.length === 0) {
      errorToast('Please add at least one item');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('authToken');
      
      const isNewCreation = mode === 'create' && !initialData?.id && !initialData?.parentId;
      
      // If it's a revision or update to an existing quote, we always increment version
      const maxHistoryVersion = versionHistory.length > 0 
        ? Math.max(...versionHistory.map(vh => vh.version)) 
        : (initialData?.mode === 'revise' ? Math.max(1, (initialData.version || 2) - 1) : (initialData?.version || 0));
        
      const finalVersion = isNewCreation ? 1 : (maxHistoryVersion + 1);
      
      // Root parent ID should be the first version's ID
      const finalParentId = isNewCreation ? null : (initialData?.parentId || initialData?.id || parentId);

      // Each saved version MUST have its own unique batch_id for component snapshots
      // If we are creating a NEW version, reset batchId to null so backend generates a new one
      const finalBatchId = (finalVersion > (initialData?.version || 0)) ? null : batchId;

      const quotationData = {
        clientId: selectedClient.id,
        clientName: selectedClient.company_name,
        clientEmail: selectedClient.email,
        projectName: projectName,
        items: items.map(item => ({
          salesOrderItemId: item.salesOrderItemId || null,
          bom_id: item.bom_id || null,
          revision_no: item.revision_no || null,
          item_code: item.item_code || null,
          bom_cost: parseFloat(item.bom_cost) || 0,
          orderId: item.orderId || null,
          drawing_id: item.drawing_id || null,
          drawing_no: item.drawing_no,
          description: item.description,
          quantity: parseFloat(item.quantity) || 0,
          unit: item.unit || 'Nos',
          quotedPrice: parseFloat(item.rate) || 0,
          gst_percentage: parseFloat(item.gst_percentage) || 18,
          item_group: item.item_group || null,
          status: status.toUpperCase() === 'REVISED' ? 'REVISED' : (item.status || 'SENT'),
          profit_percentage: 0,
          sub_assemblies: (item.sub_assemblies || []).map(sa => ({
            item_code: sa.item_code || sa.component_code,
            drawing_no: sa.drawing_no,
            description: sa.description,
            quantity: sa.quantity,
            bom_cost: parseFloat(sa.bom_cost) || 0,
            rate: parseFloat(sa.rate || sa.bom_cost) || 0,
            unit: sa.unit || 'Nos'
          }))
        })),
        totalAmount: summary.totalAmount,
        notes: notes,
        status: status.toUpperCase(),
        emailRequired: finalSendEmail,
        quotation_no: quotationNo,
        date: quotationDate,
        version: finalVersion,
        parentId: finalParentId,
        clearPendingBomId: initialData?.id || null,
        batch_id: finalBatchId
      };

      const response = await fetch(`${API_BASE}/quotation-requests/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(quotationData)
      });

      const responseData = await response.json();
      const newQuotationId = responseData.quotationIds?.[0];

      const message = status === 'Draft' 
        ? 'Quotation saved as draft' 
        : finalSendEmail 
          ? 'Quotation sent to client successfully' 
          : 'Quotation created successfully';
      successToast(message);

      if (finalSendEmail || status === 'Draft') {
        navigate('/sales/client-quotations');
      } else if (newQuotationId) {
        // If we stay on the page, update to reflect the newly created quotation
        setQuotationNo(`QRT-${String(newQuotationId).padStart(4, '0')}`);
        setSelectedVersionId(newQuotationId);
        
        // Refresh history to lock the view if it was Sent/Approved
        fetchVersionHistory(finalParentId || newQuotationId);
        
        // If it was a create mode, switch to "revision view" or similar state if needed
        // but fetchVersionHistory will update versionHistory which handles isLocked
      }
    } catch (error) {
      errorToast(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-2 space-y-4 bg-slate-50 min-h-screen pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 ">
        <div>
          <div className="flex items-center gap-2 text-slate-500 mb-0.5">
            <button 
              onClick={() => navigate('/sales/client-quotations')}
              className="p-1 hover:bg-slate-100 rounded transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs   ">Sales / Quotations</span>
          </div>
          <h1 className="text-lg  text-slate-900 flex items-center gap-2">
            {mode === 'received' ? 'Received Quotation' : (version > 1 ? 'Revise Quotation' : 'Create Quotation')}
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs  border border-indigo-200">
              V{version}
            </span>
          </h1>
          <p className="text-slate-500 text-[11px]">
            {mode === 'received' ? 'Review and manage incoming customer response' : (version > 1 ? `Revising from previous version history` : 'Professional Quotation Management')}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/sales/client-quotations')}
            className="px-3 py-1.5 text-xs  text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <X size={14} />
            {isLocked ? 'Close' : 'Cancel'}
          </button>

          {!isLocked && (
            <>
              {mode === 'received' ? (
                <>
                  <button
                    onClick={() => handleSave('Rejected', false)}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs  text-rose-600 bg-rose-50 border border-rose-100 rounded hover:bg-rose-100 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                    Reject
                  </button>
                  <button
                    onClick={() => handleSave('Approved', false)}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs  text-emerald-600 bg-emerald-50 border border-emerald-100 rounded hover:bg-emerald-100 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Approve
                  </button>
                  <button
                    onClick={() => handleSave('Revised', false)}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs  text-amber-600 bg-amber-50 border border-amber-100 rounded hover:bg-amber-100 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />}
                    Create Revision
                  </button>
                  <button
                    onClick={() => handleSave('Revised', true)}
                    disabled={saving}
                    className="px-4 py-1.5 text-xs  text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Send to Client
                  </button>
                </>
              ) : mode === 'revise' ? (
                <>
                  <button
                    onClick={() => handleSave('Draft', false)}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs  text-indigo-600 bg-indigo-50 border border-indigo-100 rounded hover:bg-indigo-100 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save as Draft
                  </button>
                  <button
                    onClick={() => handleSave('Revised', false)}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs  text-amber-600 bg-amber-50 border border-amber-100 rounded hover:bg-amber-100 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />}
                    Create Revision
                  </button>
                  <button
                    onClick={() => handleSave('Revised', true)}
                    disabled={saving}
                    className="px-4 py-1.5 text-xs  text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Send to Client
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleSave('Draft')}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs  text-indigo-600 bg-indigo-50 border border-indigo-100 rounded hover:bg-indigo-100 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save as Draft
                  </button>
                  <button
                    onClick={() => handleSave('Sent', false)}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs  text-emerald-600 bg-emerald-50 border border-emerald-100 rounded hover:bg-emerald-100 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Create Quotation
                  </button>
                  <button
                    onClick={() => handleSave('Sent', true)}
                    disabled={saving}
                    className="px-4 py-1.5 text-xs  text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Send to Client
                  </button>
                </>
              )}
            </>
          )}

          {(selectedVersionId || initialData?.id) && (
            <button
              onClick={handleDownloadPDF}
              disabled={loading}
              className="px-3 py-1.5 text-xs  text-blue-600 bg-blue-50 border border-blue-100 rounded hover:bg-blue-100 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              Download PDF
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {/* Section 1: Quotation Details */}
        <div className="lg:col-span-2 space-y-4 bg-white ">
          <Card className="p-2">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
                <FileText size={16} />
              </div>
              <h2 className="text-sm  text-slate-900">Quotation Details</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs  text-slate-400   flex items-center gap-1.5">
                  <Hash size={12} /> Quotation No
                </label>
                <input 
                  type="text" 
                  value={quotationNo}
                  readOnly
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-slate-600 focus:outline-none"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-xs  text-slate-400   flex items-center gap-1.5">
                  <Calendar size={12} /> Quotation Date
                </label>
                <input 
                  type="date" 
                  value={quotationDate}
                  onChange={(e) => setQuotationDate(e.target.value)}
                  readOnly={isLocked}
                  className={`w-full px-3 py-2 border rounded text-xs outline-none transition-all ${isLocked ? 'bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-white border-slate-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'}`}
                />
              </div>

              <div className="space-y-1 md:col-span-1">
                <label className="text-xs  text-slate-400   flex items-center gap-1.5">
                  <User size={12} /> Client Name
                </label>
                <SearchableSelect
                  options={clients}
                  value={selectedClient?.id || ''}
                  disabled={isLocked}
                  onChange={(val) => {
                    const client = clients.find(c => String(c.id) === String(val));
                    setSelectedClient(client ? {
                      id: client.id,
                      company_name: client.company_name,
                      email: client.email,
                      contact_person: client.contact_person,
                      phone: client.phone,
                      address: client.address
                    } : null);
                  }}
                  placeholder="Select Client"
                  labelField="company_name"
                  valueField="id"
                  subLabelField="email"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1 md:col-span-1">
                <label className="text-xs  text-slate-400   flex items-center gap-1.5">
                  <FileText size={12} /> Project Name
                </label>
                <input 
                  type="text" 
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  readOnly={isLocked}
                  placeholder={isLocked ? "" : "Enter project name..."}
                  className={`w-full px-3 py-2 border rounded text-xs outline-none transition-all ${isLocked ? 'bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-white border-slate-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'}`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs  text-slate-400  ">
                  Status
                </label>
                <div className="flex items-center">
                  <StatusBadge status={currentVersionData?.status || 'Draft'} />
                </div>
              </div>
            </div>

            {selectedClient && (
              <div className="mt-2 p-2 bg-slate-50 rounded border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-start gap-2">
                  <div className="p-1 bg-white rounded text-slate-400">
                    <Mail size={14} />
                  </div>
                  <div>
                    <p className="text-[9px]  text-slate-400 ">Email</p>
                    <p className="text-xs text-slate-600">{selectedClient.email || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="p-1 bg-white rounded text-slate-400">
                    <Phone size={14} />
                  </div>
                  <div>
                    <p className="text-[9px]  text-slate-400 ">Phone</p>
                    <p className="text-xs text-slate-600">{selectedClient.phone || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="p-1 bg-white rounded text-slate-400">
                    <MapPin size={14} />
                  </div>
                  <div>
                    <p className="text-[9px]  text-slate-400 ">Address</p>
                    <p className="text-xs text-slate-600 line-clamp-1">{selectedClient.address || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Section 2: Quotation Items */}
          <Card className="overflow-hidden">
            <div className="p-2 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded">
                  <Calculator size={16} />
                </div>
                <h2 className="text-sm  text-slate-900">Quotation Items</h2>
                <button 
                  onClick={() => fetchDrawings(selectedClient?.company_name)}
                  disabled={refreshingDrawings || !selectedClient}
                  className="p-1 text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-30"
                  title="Refresh costs from Master"
                >
                  <RefreshCw size={14} className={refreshingDrawings ? 'animate-spin' : ''} />
                </button>
              </div>
              {!isLocked && (
                <button
                  onClick={handleAddItem}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded text-xs  hover:bg-indigo-700 transition-all shadow-sm"
                >
                  <Plus size={14} />
                  Add Item
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="w-12 p-2 text-xs  text-slate-400   border-b border-slate-100">No.</th>
                    <th className="w-72 p-2 text-xs  text-slate-400   border-b border-slate-100">Drawing & Description</th>
                    <th className="w-32 p-2 text-xs  text-slate-400   border-b border-slate-100">Qty</th>
                    <th className="w-32 p-2 text-xs  text-slate-400   border-b border-slate-100">BOM Cost (₹)</th>
                    <th className="w-32 p-2 text-xs  text-slate-400   border-b border-slate-100">Rate (₹)</th>
                    <th className="w-40 p-2 text-xs  text-slate-400   border-b border-slate-100">Total (₹)</th>
                    {!isLocked && <th className="w-20 p-2 text-xs  text-slate-400   border-b border-slate-100 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={isLocked ? "5" : "6"} className="p-2 text-center text-slate-400 text-xs italic">
                        {isLocked ? "No items in this version." : "No items added yet. Click \"Add Item\" to begin."}
                      </td>
                    </tr>
                  ) : (
                    items.flatMap((item, index) => {
                      const rows = [];
                      
                      // Parent Item Row
                      rows.push(
                        <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                          <td className="p-2 text-xs  text-slate-400">{index + 1}</td>
                          <td className="p-2 align-top">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 group">
                                <div className="flex-1">
                                  {(mode === 'received' || isLocked) ? (
                                    <div className="flex flex-col">
                                      <span className="text-sm  text-slate-900 ">{item.description || 'No Description'}</span>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs   text-slate-500">{item.drawing_no || 'Manual Item'}</span>
                                        {item.item_group && (
                                          <span className={`px-1.5 py-0.5 rounded text-xs   border  ${
                                            (item.item_group.toUpperCase().includes('SA') || item.item_group.toUpperCase().includes('SUB') || item.item_group.toUpperCase().includes('ASSEMBLY')) && !item.item_group.toUpperCase().includes('FG')
                                              ? 'bg-amber-50 text-amber-600 border-amber-100'
                                              : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                          }`}>
                                            {(item.item_group.toUpperCase().includes('SA') || item.item_group.toUpperCase().includes('SUB') || item.item_group.toUpperCase().includes('ASSEMBLY')) && !item.item_group.toUpperCase().includes('FG') 
                                              ? (item.item_group.toUpperCase().includes('SA') || item.item_group.toUpperCase().includes('SUB') ? 'SA' : 'ASSY')
                                              : 'FG'}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ) : (item.isManual || mode === 'revise') ? (
                                    <div className="flex flex-col">
                                      <textarea 
                                        placeholder="Add item description..."
                                        value={item.description}
                                        onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                                        rows="1"
                                        className="w-full px-0 py-0 text-xs  text-slate-900 border-none focus:ring-0 resize-none bg-transparent placeholder:text-slate-300 "
                                      />
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <input 
                                          type="text"
                                          placeholder="Drawing No..."
                                          value={item.drawing_no}
                                          onChange={(e) => handleItemChange(item.id, 'drawing_no', e.target.value)}
                                          className="flex-1 px-0 py-0 text-xs   text-slate-500 border-none focus:ring-0 placeholder:text-slate-300 bg-transparent"
                                        />
                                        {item.item_group && (
                                          <span className={`px-1.5 py-0.5 rounded text-xs   border  ${
                                            (item.item_group.toUpperCase().includes('SA') || item.item_group.toUpperCase().includes('SUB') || item.item_group.toUpperCase().includes('ASSEMBLY')) && !item.item_group.toUpperCase().includes('FG')
                                              ? 'bg-amber-50 text-amber-600 border-amber-100'
                                              : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                          }`}>
                                            {(item.item_group.toUpperCase().includes('SA') || item.item_group.toUpperCase().includes('SUB') || item.item_group.toUpperCase().includes('ASSEMBLY')) && !item.item_group.toUpperCase().includes('FG') 
                                              ? (item.item_group.toUpperCase().includes('SA') || item.item_group.toUpperCase().includes('SUB') ? 'SA' : 'ASSY')
                                              : 'FG'}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col">
                                      <textarea 
                                        placeholder="Add item description..."
                                        value={item.description}
                                        onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                                        rows="1"
                                        className="w-full px-0 py-0 text-xs  text-slate-900 border-none focus:ring-0 resize-none bg-transparent placeholder:text-slate-300 "
                                      />
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <div className="flex-1">
                                          <SearchableSelect
                                            options={drawings}
                                            value={item.drawing_id}
                                            disabled={isLocked}
                                            onChange={(val) => {
                                              const drw = drawings.find(d => String(d.id) === String(val));
                                              const updatedItems = items.map(it => {
                                                if (it.id === item.id) {
                                                  const g = (drw?.item_group || it.item_group || '').toUpperCase();
                                                  const isSA = (g.includes('SA') || g.includes('SUB') || g.includes('ASSEMBLY')) && !g.includes('FG');
                                                  const drwRate = parseFloat(drw?.rate || drw?.quotedPrice || drw?.bom_cost || it.rate || 0);
                                                  
                                                  return {
                                                    ...it,
                                                    drawing_id: val,
                                                    drawing_no: drw?.drawing_no || '',
                                                    description: drw?.description || '',
                                                    rate: drwRate,
                                                    bom_cost: drwRate,
                                                    item_group: drw?.item_group || it.item_group,
                                                    total: (parseFloat(it.quantity) || 0) * drwRate,
                                                    sub_assemblies: drw?.sub_assemblies || []
                                                  };
                                                }
                                                return it;
                                              });
                                              setItems(updatedItems);
                                            }}
                                            placeholder="Select Drawing..."
                                            labelField="drawing_no"
                                            valueField="id"
                                            subLabelField="description"
                                            className="border-none p-0 focus-within:ring-0 shadow-none bg-transparent text-xs   text-slate-500 hide-arrow"
                                          />
                                        </div>
                                        {item.item_group && (
                                          <span className={`px-1.5 py-0.5 rounded text-xs   border  ${
                                            (item.item_group.toUpperCase().includes('SA') || item.item_group.toUpperCase().includes('SUB') || item.item_group.toUpperCase().includes('ASSEMBLY')) && !item.item_group.toUpperCase().includes('FG')
                                              ? 'bg-amber-50 text-amber-600 border-amber-100'
                                              : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                          }`}>
                                            {(item.item_group.toUpperCase().includes('SA') || item.item_group.toUpperCase().includes('SUB') || item.item_group.toUpperCase().includes('ASSEMBLY')) && !item.item_group.toUpperCase().includes('FG') 
                                              ? (item.item_group.toUpperCase().includes('SA') || item.item_group.toUpperCase().includes('SUB') ? 'SA' : 'ASSY')
                                              : 'FG'}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-1.5">
                              <input 
                                type="number"
                                value={item.quantity}
                                readOnly={isLocked}
                                onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                                className={`w-full px-2 py-1 text-xs border rounded outline-none transition-all ${isLocked ? 'bg-transparent border-transparent text-slate-700 ' : 'bg-white border-slate-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'}`}
                              />
                              <span className="text-xs text-slate-400 ">{item.unit || 'Nos'}</span>
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="px-2 py-1 text-xs  text-emerald-600 bg-emerald-50 rounded border border-emerald-100/50">
                              {formatCurrency(item.bom_cost || 0)}
                            </div>
                          </td>
                          <td className="p-2">
                            <input 
                              type="number"
                              value={item.rate}
                              readOnly={isLocked}
                              onChange={(e) => handleItemChange(item.id, 'rate', e.target.value)}
                              className={`w-full px-2 py-1 text-xs font-semibold border rounded outline-none transition-all ${isLocked ? 'bg-transparent border-transparent text-slate-700' : 'bg-white border-slate-200 text-indigo-600 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'}`}
                            />
                          </td>
                          <td className="p-2 text-xs text-slate-900">
                            <div className="flex flex-col items-start">
                              <span className="font-semibold">{formatCurrency(item.total)}</span>
                              <span className="text-xs  text-slate-400 font-normal">Base Amount</span>
                            </div>
                          </td>
                          {!isLocked && (
                            <td className="p-2 text-center">
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );

                      // Sub-Assembly Rows
                      if (item.sub_assemblies && item.sub_assemblies.length > 0) {
                        item.sub_assemblies.forEach((sa, saIdx) => {
                          rows.push(
                            <tr key={`${item.id}-sa-${sa.id || saIdx}`} className="bg-slate-50/40">
                              <td className="p-2 border-b border-slate-100"></td>
                              <td className="p-2 border-b border-slate-100">
                                <div className="flex items-center gap-2 pl-3">
                                  <GitBranch size={12} className="text-blue-400 rotate-180" />
                                  <div className="flex flex-col">
                                    <span className="text-[11px] text-slate-700 font-semibold">{sa.description}</span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[9px] text-slate-500 font-mono ">{sa.drawing_no}</span>
                                      <span className="px-1 py-0.5 rounded-[3px] text-[8px]  bg-blue-50 text-blue-600 border border-blue-100/50">SA</span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-2 border-b border-slate-100 text-[11px] text-slate-600 ">
                                {(parseFloat(sa.quantity || 0) * (parseFloat(item.quantity) || 0)).toFixed(3)} {sa.unit || 'Nos'}
                              </td>
                              <td className="p-2 border-b border-slate-100 text-[11px] text-indigo-600  bg-indigo-50/30">
                                {formatCurrency(sa.bom_cost)}
                              </td>
                              <td className="p-2 border-b border-slate-100 text-[11px] text-slate-700 ">
                                {formatCurrency(sa.rate || sa.bom_cost)}
                              </td>
                              <td className="p-2 border-b border-slate-100 text-[11px] text-slate-900 ">
                                {formatCurrency((parseFloat(sa.rate || sa.bom_cost) || 0) * (parseFloat(sa.quantity || 0) * (parseFloat(item.quantity) || 0)))}
                              </td>
                              {!isLocked && <td className="p-2 border-b border-slate-100"></td>}
                            </tr>
                          );
                        });
                      }

                      return rows;
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Section 3: Summary / Calculation */}
        <div className="space-y-4 bg-white">
          <Card className="p-2 sticky top-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded">
                <Calculator size={16} />
              </div>
              <h2 className="text-sm  text-slate-900">Summary</h2>
            </div>

            <div className="space-y-3">
              {version > 1 && versionHistory.length > 0 && (
                <div className="mb-4 p-3 bg-indigo-50/50 rounded border border-indigo-100/50 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs  text-indigo-600  ">
                    <AlertCircle size={12} /> Revision Comparison
                  </div>
                  {(() => {
                    const prevVersion = versionHistory.find(v => v.version === version - 1);
                    if (!prevVersion) return null;
                    const diff = summary.totalAmount - (parseFloat(prevVersion.received_amount) || parseFloat(prevVersion.total_amount) * 1.18);
                    return (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Previous (V{version-1})</span>
                          <span className="text-slate-700 ">{formatCurrency(parseFloat(prevVersion.received_amount) || parseFloat(prevVersion.total_amount) * 1.18)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Net Change</span>
                          <span className={` ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 ">Base Amount</span>
                <span className="text-slate-900 ">{formatCurrency(summary.baseAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 ">GST (18%)</span>
                <span className="text-slate-900 ">{formatCurrency(summary.gstAmount)}</span>
              </div>
              
              <div className="pt-3 mt-3 border-t border-slate-100">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[9px]  text-slate-400   mb-0.5">Total Amount</p>
                    <p className="text-xl  text-indigo-600 ">{formatCurrency(summary.totalAmount)}</p>
                  </div>
                </div>
              </div>
            </div>

            {versionHistory.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} className="text-slate-400" />
                  <h3 className="text-xs  text-slate-400  ">Version History</h3>
                </div>
                <div className="space-y-2">
                  {versionHistory.map((v) => {
                    const isSnapshot = ['APPROVED', 'REVISED', 'SENT', 'COMPLETED', 'REJECTED'].includes(v.status?.toUpperCase());
                    const isViewable = isSnapshot || v.version < (currentVersionData?.version || version);
                    return (
                      <div 
                        key={v.id} 
                        onClick={async () => {
                          if (isViewable) {
                            await loadVersionData(v, false);
                          }
                        }}
                        className={`w-full p-2 rounded border transition-all group ${
                          isViewable ? 'cursor-pointer hover:shadow-md hover:border-indigo-300 active:scale-[0.98]' : 'cursor-default opacity-80'
                        } ${
                          v.id === selectedVersionId ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-100' : 'bg-white border-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded ${v.id === selectedVersionId ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'}`} />
                            <span className={`text-[11px]  ${v.id === selectedVersionId ? 'text-indigo-700' : 'text-slate-700'}`}>
                              Version {v.version}
                            </span>
                            <StatusBadge status={v.status} size="xs" />
                          </div>
                          <span className="text-xs   text-slate-900">{formatCurrency(parseFloat(v.received_amount) || parseFloat(v.total_amount) * 1.18)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
                            <Calendar size={10} />
                            {new Date(v.created_at).toLocaleDateString('en-GB')}
                          </div>
                          {isViewable && (
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewPDF(v.id);
                                }}
                                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                                title="View PDF"
                              >
                                <FileText size={10} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Actions for Selected Version */}
                {(() => {
                  const selectedV = versionHistory.find(v => v.id === selectedVersionId || (selectedVersionId === null && v.version === version));
                  const sStatus = selectedV?.status?.toUpperCase();
                  // Hide actions if selected is approved/rejected, OR if the latest version is already approved
                  if (!selectedV || sStatus === 'APPROVED' || sStatus === 'REJECTED' || isLatestApproved) return null;
                  
                  return (
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100">
                      <button
                        onClick={() => handleRejectVersion(selectedV)}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-rose-50 text-rose-600 rounded text-xs  border border-rose-100 hover:bg-rose-100 transition-all shadow-sm shadow-rose-50"
                      >
                        <XCircle size={14} />
                        Reject V{selectedV.version}
                      </button>
                      <button
                        onClick={() => handleApproveVersion(selectedV)}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-600 rounded text-xs  border border-emerald-100 hover:bg-emerald-100 transition-all shadow-sm shadow-emerald-50"
                      >
                        <Check size={14} />
                        Approve V{selectedV.version}
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px]  text-slate-400   block">Notes</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  readOnly={isLocked}
                  placeholder={isLocked ? "" : "Additional terms..."}
                  className={`w-full px-3 py-2 border rounded text-xs outline-none transition-all resize-none h-24 ${isLocked ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-50/50 border-slate-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'}`}
                />
              </div>

              <div className="p-3 bg-amber-50 rounded border border-amber-100">
                <div className="flex gap-2">
                  <div className="text-amber-600 mt-0.5">
                    <FileText size={14} />
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed ">
                    PDF can be downloaded at any time after saving.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default QuotationFormPage;
