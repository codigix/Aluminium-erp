import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { getFileUrl } from '../utils/url';
import SendEmailModal from '../components/SendEmailModal.jsx';

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

  const sortedItems = useMemo(() => {
    const existingItems = items.filter(item => !item.isNew);
    const newItems = items.filter(item => item.isNew);

    existingItems.sort((a, b) => {
      const dwgA = (a.drawing_no || '').trim().toUpperCase();
      const dwgB = (b.drawing_no || '').trim().toUpperCase();

      if (!dwgA && !dwgB) return 0;
      if (!dwgA) return 1;
      if (!dwgB) return -1;

      return dwgA.localeCompare(dwgB, undefined, { numeric: true, sensitivity: 'base' });
    });

    return [...existingItems, ...newItems];
  }, [items]);
  const [notes, setNotes] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState(0);
  const [clients, setClients] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [hostCompanies, setHostCompanies] = useState([]);
  const [selectedHostId, setSelectedHostId] = useState('');
  const [selectedHostCompany, setSelectedHostCompany] = useState(null);
  const [version, setVersion] = useState(1);
  const [parentId, setParentId] = useState(null);
  const [batchId, setBatchId] = useState(null);
  const [versionHistory, setVersionHistory] = useState([]);
  const [mode, setMode] = useState('create'); // 'create', 'revise', or 'received'
  const [isBOMUpdateRequest, setIsBOMUpdateRequest] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshingDrawings, setRefreshingDrawings] = useState(false);
  const hasInitialized = useRef(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailModalData, setEmailModalData] = useState(null);
  const [pendingSaveParams, setPendingSaveParams] = useState(null);

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
      fetchDrawings();
    } else {
      setDrawings([]);
    }
  }, [selectedClient?.company_name]);

  // Resolve client contact and address details dynamically when clients array, selectedClient, projectName, or drawings changes
  useEffect(() => {
    if (isLocked) return;
    if ((selectedClient?.id || selectedClient?.company_name) && clients.length > 0) {
      const client = clients.find(c =>
        (selectedClient.id && String(c.id) === String(selectedClient.id)) ||
        (c.company_name && selectedClient.company_name &&
          c.company_name.toLowerCase().trim() === selectedClient.company_name.toLowerCase().trim())
      );
      if (client) {
        // Determine if this is the client initialized from parent (Client Requirement or Quotation data)
        const isSameClientAsParent = selectedClient && (
          (initialData && (
            (initialData.clientId && String(selectedClient.id) === String(initialData.clientId || initialData.company_id || initialData.companyId)) ||
            (initialData.clientName && selectedClient.company_name &&
              String(selectedClient.company_name).toLowerCase().trim() === String(initialData.clientName).toLowerCase().trim())
          )) ||
          (selectedVersionId && versionHistory.some(vh =>
            String(vh.company_id || vh.clientId) === String(selectedClient.id)
          ))
        );

        // Highest Priority: Client Requirement Data / Quotation Data already in state
        let nextEmail = isSameClientAsParent && selectedClient.email ? selectedClient.email : '';
        let nextPhone = isSameClientAsParent && selectedClient.phone ? selectedClient.phone : '';
        let nextName = isSameClientAsParent && selectedClient.contact_person ? selectedClient.contact_person : '';
        let nextAddr = isSameClientAsParent && selectedClient.address && selectedClient.address !== 'N/A' ? selectedClient.address : '';

        // Medium Priority: Match by Project Name drawing (Drawing Master / Client Master project data) for remaining empty fields
        if (!nextEmail || !nextPhone || !nextName || !nextAddr || nextAddr === 'N/A') {
          const matchedDrawing = (drawings || []).find(d =>
            d.project_name && projectName &&
            d.project_name.toLowerCase().trim() === projectName.toLowerCase().trim()
          );

          if (matchedDrawing) {
            if (!nextEmail) nextEmail = matchedDrawing.email || '';
            if (!nextPhone) nextPhone = matchedDrawing.phone || '';
            if (!nextName) nextName = matchedDrawing.contact_person || '';
            if (!nextAddr || nextAddr === 'N/A') nextAddr = matchedDrawing.billing_address || matchedDrawing.address || '';
          }
        }

        // Lowest Priority: Fall back to client primary contact (Client Master general data) for any remaining empty fields
        if (!nextEmail || !nextPhone || !nextName || !nextAddr || nextAddr === 'N/A') {
          const primaryContact = client.contacts?.find(c => c.contact_type === 'PRIMARY') || client.contacts?.[0] || {};
          const billing = client.addresses?.find(address => address.address_type === 'BILLING') || client.addresses?.[0] || {};
          const addressStr = [billing.line1, billing.line2, billing.city, billing.state, billing.pincode].filter(Boolean).join(', ');

          if (!nextEmail) nextEmail = primaryContact.email || '';
          if (!nextPhone) nextPhone = primaryContact.phone || '';
          if (!nextName) nextName = primaryContact.name || '';
          if (!nextAddr || nextAddr === 'N/A') nextAddr = addressStr || 'N/A';
        }

        const emailNeedsUpdate = selectedClient.email !== nextEmail;
        const phoneNeedsUpdate = selectedClient.phone !== nextPhone;
        const contactNeedsUpdate = selectedClient.contact_person !== nextName;
        const addressNeedsUpdate = selectedClient.address !== nextAddr;
        const nameNeedsUpdate = !selectedClient.company_name || selectedClient.company_name !== client.company_name;

        if (emailNeedsUpdate || phoneNeedsUpdate || contactNeedsUpdate || addressNeedsUpdate || nameNeedsUpdate) {
          setSelectedClient(prev => ({
            ...prev,
            id: client.id,
            company_name: client.company_name,
            email: nextEmail,
            phone: nextPhone,
            contact_person: nextName,
            address: nextAddr
          }));
        }
      }
    }
  }, [
    selectedClient?.id,
    selectedClient?.company_name,
    selectedClient?.email,
    selectedClient?.phone,
    selectedClient?.address,
    selectedClient?.contact_person,
    clients,
    drawings,
    projectName,
    isLocked,
    selectedVersionId,
    versionHistory
  ]);

  // Sync selected host company details when ID changes or when hostCompanies is loaded
  useEffect(() => {
    if (selectedHostId && hostCompanies.length > 0) {
      const matched = hostCompanies.find(h => String(h.id) === String(selectedHostId));
      setSelectedHostCompany(matched || null);
    } else if (!selectedHostId && hostCompanies.length > 0) {
      const active = hostCompanies.find(c => c.status === 'ACTIVE');
      if (active) {
        setSelectedHostId(String(active.id));
        setSelectedHostCompany(active);
      } else {
        setSelectedHostId(String(hostCompanies[0].id));
        setSelectedHostCompany(hostCompanies[0]);
      }
    }
  }, [selectedHostId, hostCompanies]);

  useEffect(() => {
    fetchClients();
    fetchHostCompanies();

    if (initialData && !hasInitialized.current) {
      hasInitialized.current = true;
      generateQuotationNo();
      setVersion(initialData.version || 1);
      setParentId(initialData.parentId || null);
      setBatchId(initialData.batchId || null);
      setMode(initialData.mode || 'create');
      if (initialData.isBOMUpdateRequest) {
        setIsBOMUpdateRequest(true);
      }
      if (initialData.parentId || initialData.id) {
        fetchVersionHistory(initialData.parentId || initialData.id);
      }
      if (initialData.host_company_id || initialData.hostCompanyId) {
        setSelectedHostId(String(initialData.host_company_id || initialData.hostCompanyId));
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
      const nestedPartCodes = new Set();

      (allSourceItems || []).forEach(item => {
        (item.sub_assemblies || []).forEach(sa => {
          nestedPartCodes.add(
            String(sa.component_code || sa.item_code || '')
              .trim()
              .toUpperCase()
          );
        });
      });

      const mappedItems = allSourceItems
        .filter(item => {
          const group = (item.item_group || '').toUpperCase();
          const code = String(item.item_code || '').trim().toUpperCase();
          const isPart = group.includes('PART');

          // Remove PART rows already nested inside assembly
          if (isPart && nestedPartCodes.has(code)) {
            return false;
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

          if (item.sub_assemblies && item.sub_assemblies.length > 0) {
            // NEVER recalculate FG/Assembly from child parts
            drwRate = parseFloat(item.bom_cost || drwRate || 0);
            bomCost = drwRate;
          }

          return {
            ...item,
            id: item.id || Date.now() + Math.random(),
            quantity: parseFloat(item.quantity) || 0,
            rate: drwRate,
            bom_cost: bomCost || drwRate,
            profit_percentage: parseFloat(item.profit_percentage) || 0,
            override_percentage: parseFloat(item.override_percentage) || 0,
            total: (parseFloat(item.quantity) || 0) * drwRate,
            gst_percentage: item.gst_percentage || 18,
            isManual: !item.drawing_id && !!item.drawing_no,
            sub_assemblies: (() => {
              const g = (item.item_group || '').toUpperCase();
              if (!g.includes('ASSEMBLY')) {
                return [];
              }
              return (item.sub_assemblies || []).filter(sa =>
                (sa.item_group || '').toUpperCase().includes('PART')
              ).map(sa => {
                let actualCost = parseFloat(sa.component_bom_cost || sa.child_bom_cost || sa.part_bom_cost || sa.component_cost || sa.bom_cost || sa.rate || 0);
                const parentBOMCost = parseFloat(item.bom_cost || item.rate || 0);
                if (Math.abs(actualCost - parentBOMCost) < 0.01) {
                  actualCost = parseFloat(sa.component_bom_cost || sa.child_bom_cost || sa.part_bom_cost || sa.component_cost || 0);
                }
                if (!isLocked && sa.pending_bom_cost > 0) {
                  actualCost = parseFloat(sa.pending_bom_cost);
                }
                return {
                  ...sa,
                  drawing_no: (sa.drawing_no || sa.drawingNo || '').toUpperCase(),
                  bom_cost: actualCost,
                  rate: actualCost
                };
              });
            })()
          };
        });

      setItems(mappedItems);
      const initialNotes = initialData.notes || '';
      setNotes(initialNotes.startsWith('Drawing Numbers:') ? '' : initialNotes);
      setDiscountType(initialData.discount_type || initialData.discountType || 'percentage');
      setDiscountValue(parseFloat(initialData.discount_value || initialData.discountValue) || 0);
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
    // 5. This is NOT a BOM Update Request (preventing drawings sync override)
    const canSync = items.length > 0 &&
      drawings.length > 0 &&
      !isHistoricalView &&
      !isSnapshotStatus &&
      mode !== 'received' &&
      !isLocked &&
      !isBOMUpdateRequest;

    if (canSync) {
      const updatedItems = items.map(item => {
        const itemG = (item.item_group || '').toUpperCase();
        const itemIsPart = itemG.includes('PART');

        const matchedDrawing = drawings.find(d => {
          const drwG = (d.item_group || '').toUpperCase();
          const drwIsPart = drwG.includes('PART');

          // 1. Match by drawing_id (Absolute Priority - Direct link)
          if (item.drawing_id && String(d.drawing_master_id) === String(item.drawing_id)) return true;

          // 2. Match by item_code (High Priority - Unique identity)
          if (item.item_code && d.item_code && String(d.item_code).trim().toLowerCase() === String(item.item_code).trim().toLowerCase()) return true;

          // 3. Match by drawing_no AND item_group AND Description (Fallback)
          if (item.drawing_no && String(d.drawing_no).trim().toLowerCase() === String(item.drawing_no).trim().toLowerCase()) {
            const itemDesc = String(item.description || '').trim().toLowerCase();
            const drwDesc = String(d.description || '').trim().toLowerCase();

            // Group must match (PART vs ASSEMBLY)
            if (itemIsPart === drwIsPart) {
              // Description match is critical when multiple items share a drawing number
              const descMatch = !itemDesc || !drwDesc || drwDesc === itemDesc || drwDesc.includes(itemDesc) || itemDesc.includes(drwDesc);
              if (descMatch) return true;
            }
          }

          return false;
        });

        if (matchedDrawing) {
          let drwRate = parseFloat(matchedDrawing.bom_cost || matchedDrawing.rate || matchedDrawing.quotedPrice || 0);



          const g = (item.item_group || matchedDrawing.item_group || '').toUpperCase();
          const isPart = g.includes('PART');


          let newItem = { ...item };
          let changed = false;

          // Sync drawing_id if missing (using drawing_master_id for the link)
          if (!item.drawing_id && matchedDrawing.drawing_master_id) {
            newItem.drawing_id = matchedDrawing.drawing_master_id;
            changed = true;
          }

          // Sync drawing_no if it is an ID or mismatching
          const drwNo = (matchedDrawing.drawing_no || '').toUpperCase();
          if (drwNo && item.drawing_no !== drwNo) {
            newItem.drawing_no = drwNo;
            changed = true;
          }

          // Sync item_code if missing
          if (!item.item_code && matchedDrawing.item_code) {
            newItem.item_code = matchedDrawing.item_code;
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

          // NEVER downgrade an Assembly's BOM cost if the Quotation data already has a higher, finalized cost from the BOM module.
          // Master drawings might have stale base costs if they haven't been dynamically synced with full BOM materials/operations.
          const isDowngradeForAssembly = g.includes('ASSEMBLY') && currentBOMCost > drwRate;

          if (costChanged && shouldSync && !item.has_pending_bom_applied && !isDowngradeForAssembly && !item.isBOMCostManuallyEdited) {
            newItem.bom_cost = drwRate;
            changed = true;

            // Update rate to new BOM cost if it was 0, matched old cost, OR we are in a mode that allows auto-update
            if (currentRate === 0 || rateMatchesCost || mode === 'revise' || mode === 'create') {
              const profit = parseFloat(newItem.profit_percentage) || 0;
              const override = parseFloat(newItem.override_percentage) || 0;
              const calculatedRate = drwRate * (1 + profit / 100) * (1 + override / 100);
              newItem.rate = calculatedRate;
              newItem.total = (parseFloat(item.quantity) || 0) * calculatedRate;
            }
          }

          // Sync sub-assemblies if it is an ASSEMBLY item to pick up latest correct child PART costs
          const gUpper = (item.item_group || '').toUpperCase();
          if (gUpper.includes('ASSEMBLY') && matchedDrawing.sub_assemblies && matchedDrawing.sub_assemblies.length > 0) {
            const currentSAs = item.sub_assemblies || [];
            let saChanged = false;

            const updatedSAs = currentSAs.map(sa => {
              const cleanSaCode = String(sa.component_code || sa.item_code || sa.component_code || '').trim().toLowerCase();
              const cleanSaDwg = String(sa.drawing_no || '').trim().toLowerCase();

              // Find matching sa component in matchedDrawing
              const matchedSA = matchedDrawing.sub_assemblies.find(msa => {
                const cleanMsaCode = String(msa.component_code || msa.item_code || msa.component_code || '').trim().toLowerCase();
                const cleanMsaDwg = String(msa.drawing_no || '').trim().toLowerCase();

                if (cleanSaCode && cleanMsaCode && cleanSaCode === cleanMsaCode) return true;
                if (cleanSaDwg && cleanMsaDwg && cleanSaDwg === cleanMsaDwg) {
                  const saDesc = String(sa.description || '').trim().toLowerCase();
                  const msaDesc = String(msa.description || '').trim().toLowerCase();
                  return !saDesc || !msaDesc || saDesc === msaDesc || saDesc.includes(msaDesc) || msaDesc.includes(saDesc);
                }
                return false;
              });

              if (matchedSA) {
                const correctCost = parseFloat(matchedSA.component_bom_cost || matchedSA.child_bom_cost || matchedSA.part_bom_cost || matchedSA.component_cost || matchedSA.bom_cost || matchedSA.rate || 0);
                const parentBOMCost = parseFloat(drwRate || item.bom_cost || 0);

                // Block inheritance
                let finalCost = correctCost;
                if (Math.abs(finalCost - parentBOMCost) < 0.01) {
                  finalCost = parseFloat(matchedSA.component_bom_cost || matchedSA.child_bom_cost || matchedSA.part_bom_cost || matchedSA.component_cost || 0);
                }

                if (Math.abs(parseFloat(sa.bom_cost || 0) - finalCost) > 0.01 || Math.abs(parseFloat(sa.rate || 0) - finalCost) > 0.01 || sa.drawing_no !== matchedSA.drawing_no) {
                  saChanged = true;
                  return {
                    ...sa,
                    drawing_no: matchedSA.drawing_no || sa.drawing_no,
                    bom_cost: finalCost,
                    rate: finalCost
                  };
                }
              }
              return sa;
            });

            if (currentSAs.length === 0) {
              newItem.sub_assemblies = matchedDrawing.sub_assemblies.map(sa => {
                let actualPartCost = parseFloat(sa.component_bom_cost || sa.child_bom_cost || sa.part_bom_cost || sa.component_cost || sa.bom_cost || sa.rate || 0);
                const parentBOMCost = parseFloat(drwRate || item.bom_cost || 0);
                if (Math.abs(actualPartCost - parentBOMCost) < 0.01) {
                  actualPartCost = parseFloat(sa.component_bom_cost || sa.child_bom_cost || sa.part_bom_cost || sa.component_cost || 0);
                }
                return {
                  ...sa,
                  bom_cost: actualPartCost,
                  rate: actualPartCost
                };
              });
              changed = true;
            } else if (saChanged) {
              newItem.sub_assemblies = updatedSAs;
              changed = true;
            }
          }

          return changed ? newItem : item;
        }
        return item;
      });

      const currentJson = JSON.stringify(items);
      const updatedJson = JSON.stringify(updatedItems);

      if (currentJson === updatedJson) {
        return;
      }

      setItems(updatedItems);
    }
  }, [
    drawings,
    isLocked,
    mode,
    version,
    selectedVersionId,
    isBOMUpdateRequest
  ]);

  // Disabled auto-population of Drawing Numbers into Terms & Conditions field

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

  const fetchHostCompanies = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/admin-company-master`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setHostCompanies(data);
      }
    } catch (err) {
      console.error('Error fetching host companies:', err);
    }
  };

  const handleActivateHostGlobally = async () => {
    if (!selectedHostCompany) return;

    const result = await Swal.fire({
      title: 'Activate Billing Profile?',
      text: `Do you want to make "${selectedHostCompany.company_name}" the active host company globally?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      confirmButtonText: 'Yes, Activate'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/admin-company-master/${selectedHostCompany.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'ACTIVE' })
        });
        if (response.ok) {
          successToast('Billing profile activated globally');
          fetchHostCompanies();
        } else {
          errorToast('Failed to activate profile');
        }
      } catch (err) {
        console.error('Error activating host globally:', err);
        errorToast(err.message || 'Failed to activate profile');
      }
    }
  };

  const fetchDrawings = async () => {
    try {
      setRefreshingDrawings(true);
      const token = localStorage.getItem('authToken');
      const url = `${API_BASE}/drawings/approved`;
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
          // If we have selectedVersionId, load that specific version.
          // Otherwise load the latest.
          const target = selectedVersionId
            ? (sortedHistory.find(vh => vh.id === selectedVersionId) || sortedHistory[sortedHistory.length - 1])
            : sortedHistory[sortedHistory.length - 1];

          // We only force next version if we are initially in revise mode AND we have NOT selected a saved version yet
          const shouldForce = currentMode === 'revise' && !selectedVersionId;
          await loadVersionData(target, shouldForce);
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
      setNotes(versionData.notes && versionData.notes.startsWith('Drawing Numbers:') ? '' : (versionData.notes || ''));
      setDiscountType(versionData.discount_type || versionData.discountType || 'percentage');
      setDiscountValue(parseFloat(versionData.discount_value || versionData.discountValue) || 0);

      setSelectedClient({
        id: versionData.company_id || versionData.clientId,
        company_name: versionData.company_name || versionData.clientName,
        email: versionData.client_email || versionData.clientEmail || '',
        contact_person: versionData.contact_person || '',
        phone: versionData.phone || versionData.client_phone || '',
        address: versionData.address || versionData.client_address || ''
      });

      if (versionData.host_company_id) {
        setSelectedHostId(String(versionData.host_company_id));
      } else {
        if (forceNextVersion || !versionData.id) {
          const active = hostCompanies.find(c => c.status === 'ACTIVE');
          if (active) {
            setSelectedHostId(String(active.id));
          }
        } else {
          setSelectedHostId('');
        }
      }

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
          // Apply overrides ONLY if we are preparing a NEW version (forceNextVersion)
          const override = forceNextVersion ? initialData?.items?.find(oi =>
            (oi.salesOrderItemId && String(oi.salesOrderItemId) === String(item.sales_order_item_id)) ||
            (oi.item_code && oi.item_code === item.item_code && oi.drawing_no === item.drawing_no)
          ) : null;

          // Map saved sub-assemblies first to ensure they are available for cost logic.
          // Prioritize override sub_assemblies if they exist.
          const savedSubAssemblies = ((override?.sub_assemblies || item.sub_assemblies) || []).map(sa => {
            let actualPartCost =
              parseFloat(sa.component_bom_cost || sa.child_bom_cost || sa.part_bom_cost || sa.component_cost || sa.bom_cost || sa.rate || 0);

            // COMPLETELY BLOCK parent/assembly bom_cost inheritance!
            const parentBOMCost = parseFloat(item.bom_cost || item.rate || 0);
            if (Math.abs(actualPartCost - parentBOMCost) < 0.01) {
              actualPartCost = parseFloat(sa.component_bom_cost || sa.child_bom_cost || sa.part_bom_cost || sa.component_cost || 0);
            }

            // Apply pending BOM cost if available and we are editing/revising
            if (!isLocked && sa.pending_bom_cost > 0) {
              actualPartCost = parseFloat(sa.pending_bom_cost);
            }

            return {
              ...sa,
              bom_cost: actualPartCost,
              rate: actualPartCost
            };
          });

          // Use ONLY backend BOM cost snapshot
          let bomCost = parseFloat(item.bom_cost || 0);
          let drwRate = parseFloat(item.rate || bomCost || 0);

          // If override for next version (revisions) has values, use them
          if (forceNextVersion) {
            if (override?.bom_cost > 0) bomCost = parseFloat(override.bom_cost);
            if (override?.rate > 0) drwRate = parseFloat(override.rate);
            if (item.pending_bom_cost > 0) {
              bomCost = parseFloat(item.pending_bom_cost);
              drwRate = parseFloat(item.pending_bom_cost);
            }
          }

          return {
            ...item,
            has_pending_bom_applied: override?.has_pending_bom_applied || item.has_pending_bom_applied,
            id: item.id || Date.now() + Math.random(),
            quantity: parseFloat(item.quantity) || 0,
            salesOrderItemId: item.sales_order_item_id || item.salesOrderItemId,
            orderId: item.orderId || item.sales_order_id || item.salesOrderId,
            sales_order_id: item.orderId || item.sales_order_id || item.salesOrderId,
            drawing_id: item.drawing_id,
            rate: drwRate,
            bom_cost: bomCost || item.bom_cost || drwRate,
            profit_percentage: parseFloat(item.profit_percentage) || 0,
            override_percentage: parseFloat(item.override_percentage) || 0,
            total: (parseFloat(item.quantity) || 0) * drwRate,
            gst_percentage: item.gst_percentage || 18,
            drawing_no: item.drawing_no,
            description: item.description,
            bom_id: item.bom_id,
            revision_no: item.revision_no,
            sub_assemblies: savedSubAssemblies.map(sa => ({
              ...sa,
              bom_cost: parseFloat(sa.bom_cost || sa.rate || 0),
              rate: parseFloat(sa.rate || sa.bom_cost || 0)
            }))
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
      sub_assemblies: [],
      isNew: true
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
        if (field === 'bom_cost') {
          updatedItem.isBOMCostManuallyEdited = true;
        }

        // Recalculate rate based on BOM cost, profit percentage, and override percentage
        const cost = parseFloat(updatedItem.bom_cost) || 0;
        const profit = parseFloat(updatedItem.profit_percentage) || 0;
        const override = parseFloat(updatedItem.override_percentage) || 0;
        updatedItem.rate = cost * (1 + profit / 100) * (1 + override / 100);

        // Recalculate total
        updatedItem.total = (parseFloat(updatedItem.quantity) || 0) * (parseFloat(updatedItem.rate) || 0);
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

  const handleOpenSendEmailModal = (status) => {
    if (!selectedClient) {
      errorToast('Please select a client');
      return;
    }
    if (!selectedClient?.email) {
      errorToast('Client email is required to send quotation');
      return;
    }
    if (items.length === 0) {
      errorToast('Please add at least one item');
      return;
    }

    const hostName = selectedHostCompany?.company_name || 'SP TECHPIONEER';
    const finalQuoteNo = quotationNo === 'Generating...' ? 'New' : quotationNo;
    const clientName = selectedClient.company_name;

    // Prefill default email fields
    const defaultSubject = `Quotation Request [${finalQuoteNo}] from ${hostName} - ${clientName}`;
    const defaultMessage = `Dear ${clientName},\n\nPlease find the attached quotation [${finalQuoteNo}] for your approved drawings from ${hostName}.\n\nTotal Quotation Value (Incl. GST): ${formatCurrency(summary.totalAmount)}\n\nThe detailed breakdown of items, quantities, and pricing is provided in the attached PDF.\n\nWe look forward to your feedback and approval.\n\nBest regards,\nSales Team\n${hostName}`;

    setEmailModalData({
      to: selectedClient.email,
      subject: defaultSubject,
      message: defaultMessage,
      attachmentName: `Quotation_${clientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
    });
    setPendingSaveParams({ status });
    setShowEmailModal(true);
  };

  const handleOpenSendExistingEmailModal = () => {
    const idToSend = selectedVersionId || initialData?.id;
    if (!idToSend) {
      errorToast('No quotation ID found to send');
      return;
    }

    if (!selectedClient?.email) {
      errorToast('Client email is required to send quotation');
      return;
    }

    const hostName = selectedHostCompany?.company_name || 'SP TECHPIONEER';
    const finalQuoteNo = quotationNo || 'New';
    const clientName = selectedClient.company_name;

    // Prefill default email fields
    const defaultSubject = `Quotation Request [${finalQuoteNo}] from ${hostName} - ${clientName}`;
    const defaultMessage = `Dear ${clientName},\n\nPlease find the attached quotation [${finalQuoteNo}] for your approved drawings from ${hostName}.\n\nTotal Quotation Value (Incl. GST): ${formatCurrency(summary.totalAmount)}\n\nThe detailed breakdown of items, quantities, and pricing is provided in the attached PDF.\n\nWe look forward to your feedback and approval.\n\nBest regards,\nSales Team\n${hostName}`;

    setEmailModalData({
      to: selectedClient.email,
      subject: defaultSubject,
      message: defaultMessage,
      attachmentName: `Quotation_${clientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
    });
    setPendingSaveParams({ status: 'EXISTING', id: idToSend });
    setShowEmailModal(true);
  };

  const handleModalSend = async (emailData) => {
    if (pendingSaveParams?.status === 'EXISTING') {
      const idToSend = pendingSaveParams.id;
      try {
        setSaving(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/quotation-requests/${idToSend}/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            to: emailData.to,
            subject: emailData.subject,
            message: emailData.message,
            attachPDF: emailData.attachPDF,
            customAttachments: emailData.customAttachments
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || errorData.message || 'Failed to send email');
        }

        successToast('Quotation sent to client successfully');
        navigate('/sales/client-quotations');
      } catch (error) {
        console.error(error);
        errorToast(error.message);
      } finally {
        setSaving(false);
      }
    } else {
      await handleSave(pendingSaveParams.status, true, emailData);
    }
  };

  const calculateSummary = () => {
    // Include all items in summary if they have a rate
    const billableItems = sortedItems.filter(item => {
      const g = (item.item_group || '').toUpperCase();
      return (
        (parseFloat(item.rate) || 0) > 0 ||
        g.includes('ASSEMBLY') ||
        g.includes('PART')
      );
    });

    const bomBaseAmount = billableItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const bomCost = parseFloat(item.bom_cost) || 0;
      return sum + (qty * bomCost);
    }, 0);

    const profitAdded = billableItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const bomCost = parseFloat(item.bom_cost) || 0;
      const profitP = parseFloat(item.profit_percentage) || 0;
      return sum + (qty * bomCost * profitP / 100);
    }, 0);

    const overrideAdded = billableItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const bomCost = parseFloat(item.bom_cost) || 0;
      const profitP = parseFloat(item.profit_percentage) || 0;
      const overrideP = parseFloat(item.override_percentage) || 0;
      const profitAmt = bomCost * (profitP / 100);
      const overrideAmt = (bomCost + profitAmt) * (overrideP / 100);
      return sum + (qty * overrideAmt);
    }, 0);

    const preDiscountSum = bomBaseAmount + profitAdded + overrideAdded;
    let discountAmt = 0;
    if (discountType === 'percentage') {
      discountAmt = preDiscountSum * (parseFloat(discountValue) || 0) / 100;
    } else {
      discountAmt = parseFloat(discountValue) || 0;
    }
    if (discountAmt > preDiscountSum) {
      discountAmt = preDiscountSum;
    }

    const discountRatio = preDiscountSum > 0 ? (preDiscountSum - discountAmt) / preDiscountSum : 1;
    const baseAmount = preDiscountSum - discountAmt;
    const gstAmount = billableItems.reduce((sum, item) => {
      const itemTotal = parseFloat(item.total) || 0;
      const gstPercent = parseFloat(item.gst_percentage) || 18;
      return sum + (itemTotal * gstPercent / 100);
    }, 0) * discountRatio;

    const roundedBaseAmount = Number(baseAmount.toFixed(2));
    const cgstRounded = Number((gstAmount / 2).toFixed(2));
    const sgstRounded = Number((gstAmount / 2).toFixed(2));
    const totalAmount = Number((roundedBaseAmount + cgstRounded + sgstRounded).toFixed(2));

    return {
      bomBaseAmount,
      profitAdded,
      overrideAdded,
      preDiscountSum,
      discountAmount: discountAmt,
      baseAmount,
      gstAmount,
      totalAmount
    };
  };

  const summary = calculateSummary();
  console.log('Quotation Items for UI:', sortedItems);

  const handleSave = async (status = 'Draft', sendEmail = null, emailData = null) => {
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
        clientEmail: emailData ? emailData.to : selectedClient.email,
        clientPhone: selectedClient.phone,
        contactPerson: selectedClient.contact_person,
        clientAddress: selectedClient.address,
        projectName: projectName,
        hostCompanyId: selectedHostId ? Number(selectedHostId) : null,
        discount_type: discountType,
        discount_value: parseFloat(discountValue) || 0,
        items: sortedItems.map(item => ({
          salesOrderItemId: item.salesOrderItemId || null,
          bom_id: item.bom_id || null,
          revision_no: item.revision_no || null,
          item_code: item.item_code || null,
          bom_cost: parseFloat(item.bom_cost) || 0,
          orderId: item.orderId || null,
          drawing_id: item.drawing_id || null,
          drawing_no: (item.drawing_no || '').toUpperCase(),
          description: item.description,
          quantity: parseFloat(item.quantity) || 0,
          unit: item.unit || 'Nos',
          quotedPrice: parseFloat(item.rate) || 0,
          gst_percentage: parseFloat(item.gst_percentage) || 18,
          item_group: item.item_group || null,
          status: status.toUpperCase() === 'REVISED' ? 'REVISED' : (item.status || 'SENT'),
          profit_percentage: parseFloat(item.profit_percentage) || 0,
          override_percentage: parseFloat(item.override_percentage) || 0,
          sub_assemblies: (() => {
            const seen = new Set();
            return (item.sub_assemblies || []).filter(sa => {
              const code = String(sa.component_code || sa.item_code || sa.drawing_no || sa.drawingNo || sa.description || '').trim().toLowerCase();
              if (seen.has(code)) return false;
              seen.add(code);
              return true;
            }).map(sa => ({
              item_code: sa.component_code || sa.item_code,
              drawing_no: (sa.drawing_no || sa.drawingNo || '').toUpperCase(),
              description: sa.description,
              quantity: sa.quantity,
              bom_cost: parseFloat(sa.bom_cost) || 0,
              rate: parseFloat(sa.rate || sa.bom_cost) || 0,
              unit: sa.unit || 'Nos',
              item_group: sa.item_group || 'PART'
            }));
          })()
        })),
        totalAmount: summary.totalAmount,
        notes: notes,
        status: status.toUpperCase(),
        emailRequired: finalSendEmail,
        ...(finalSendEmail && emailData ? {
          customSubject: emailData.subject,
          customMessage: emailData.message,
          attachPDF: emailData.attachPDF,
          customAttachments: emailData.customAttachments
        } : {}),
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
                    onClick={() => handleOpenSendEmailModal('Revised')}
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
                    onClick={() => handleOpenSendEmailModal('Revised')}
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
                    onClick={() => handleOpenSendEmailModal('Sent')}
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

          {(selectedVersionId || initialData?.id) && isLocked && (
            <button
              onClick={handleOpenSendExistingEmailModal}
              disabled={saving}
              className="px-4 py-1.5 text-xs  text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Send to Client
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Section 1: Quotation Details */}
        <div className="lg:col-span-3 space-y-4 bg-white ">
          {/* Host Company Profile Details */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <div className="p-1.5 bg-rose-50 text-rose-600 rounded ">
                <Building2 className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-semibold text-slate-800">Host Billing Entity Details</h3>
            </div>

            <div className="bg-white border border-slate-200 rounded p-4 space-y-4">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b border-slate-100 pb-3">
                <div className="w-full md:max-w-md space-y-2">
                  <label className="text-xs text-slate-400 ml-1">Select Issuing Billing Profile *</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all text-slate-700 appearance-none font-medium"
                    value={selectedHostId}
                    onChange={(e) => {
                      const host = hostCompanies.find(h => String(h.id) === String(e.target.value));
                      setSelectedHostId(e.target.value);
                      setSelectedHostCompany(host || null);
                    }}
                    disabled={isLocked}
                  >
                    <option value="">Select billing profile...</option>
                    {hostCompanies.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.company_name} {h.status === 'ACTIVE' ? '(ACTIVE)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedHostCompany && selectedHostCompany.status !== 'ACTIVE' && !isLocked && (
                  <button
                    type="button"
                    className="border border-rose-200 text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded text-xs transition-all font-medium"
                    onClick={handleActivateHostGlobally}
                  >
                    Activate Globally
                  </button>
                )}
              </div>

              {selectedHostCompany ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-300">
                  <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded border border-slate-100 text-center">
                    {selectedHostCompany.company_logo ? (
                      <img
                        src={getFileUrl(selectedHostCompany.company_logo)}
                        alt="Logo"
                        className="h-16 max-w-full object-contain mb-2 bg-white border border-slate-200 p-1.5 rounded shadow-sm"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-500 font-bold text-lg mb-2">
                        {selectedHostCompany.company_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-bold text-slate-800 leading-tight truncate w-full">{selectedHostCompany.company_name}</span>
                    <span className={`text-[9px] mt-1.5 px-2 py-0.5 rounded-full font-semibold border ${selectedHostCompany.status === 'ACTIVE'
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                        : 'bg-slate-100 border-slate-200 text-slate-500'
                      }`}>
                      {selectedHostCompany.status === 'ACTIVE' ? 'Active Global Billing' : 'Inactive'}
                    </span>
                  </div>

                  <div className="space-y-2 p-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Office & Contact Details</p>
                    <div className="space-y-1.5 text-slate-600 text-xs">
                      <div className="flex gap-1.5 items-start">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                        <span className="leading-relaxed whitespace-pre-line">{selectedHostCompany.company_address || '—'}</span>
                      </div>
                      {selectedHostCompany.contact_person && (
                        <div className="text-[11px] text-slate-500">
                          Contact Person: <span className="font-semibold text-slate-700">{selectedHostCompany.contact_person}</span>
                        </div>
                      )}
                      {(selectedHostCompany.email || selectedHostCompany.phone) && (
                        <div className="text-[10px] text-slate-500 space-y-0.5">
                          {selectedHostCompany.email && <p>Email: <span className="text-slate-700">{selectedHostCompany.email}</span></p>}
                          {selectedHostCompany.phone && <p>Mobile: <span className="text-slate-700">{selectedHostCompany.phone}</span></p>}
                        </div>
                      )}
                      <div className="pt-1 flex flex-col gap-1 border-t border-slate-100/60 mt-1">
                        <p className="font-mono text-[10px]">GSTIN: <span className="font-bold text-slate-700">{selectedHostCompany.gstin || '—'}</span></p>
                        <p className="font-mono text-[10px]">PAN: <span className="font-bold text-slate-700">{selectedHostCompany.pan || '—'}</span></p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 p-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bank Credentials</p>
                    <div className="space-y-1.5 text-slate-600 text-xs font-mono">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-sans">Bank Name</p>
                        <p className="font-bold text-slate-700 font-sans text-xs truncate">{selectedHostCompany.bank_name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-sans">Account & IFSC</p>
                        <p className="font-semibold text-slate-800 text-xs">{selectedHostCompany.account_number || '—'}</p>
                        {selectedHostCompany.ifsc_code && (
                          <p className="text-[10px] text-slate-400">IFSC: {selectedHostCompany.ifsc_code.toUpperCase()}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center border border-dashed border-slate-200 rounded text-xs text-slate-500">
                  Select a host company profile above to preview its billing and banking credentials
                </div>
              )}
            </div>
          </div>

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
                    const actualVal = val && typeof val === 'object' && val.target ? val.target.value : val;
                    const client = clients.find(c => String(c.id) === String(actualVal));
                    if (client) {
                      const primaryContact = client.contacts?.find(c => c.contact_type === 'PRIMARY') || client.contacts?.[0] || {};
                      const billing = client.addresses?.find(address => address.address_type === 'BILLING') || client.addresses?.[0] || {};
                      const addressStr = [billing.line1, billing.line2, billing.city, billing.state, billing.pincode].filter(Boolean).join(', ');

                      setSelectedClient({
                        id: client.id,
                        company_name: client.company_name,
                        email: primaryContact.email || '',
                        contact_person: primaryContact.name || '',
                        phone: primaryContact.phone || '',
                        address: addressStr || 'N/A'
                      });
                    } else {
                      setSelectedClient(null);
                    }
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
                  onClick={() => fetchDrawings()}
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
                    <th className="w-12 p-2 text-xs text-slate-400 border-b border-slate-100">No.</th>
                    <th className="w-64 p-2 text-xs text-slate-400 border-b border-slate-100">Drawing & Description</th>
                    <th className="w-16 p-2 text-xs text-slate-400 border-b border-slate-100">Type</th>
                    <th className="w-24 p-2 text-xs text-slate-400 border-b border-slate-100">Qty</th>
                    <th className="w-28 p-2 text-xs text-slate-400 border-b border-slate-100">BOM Cost (₹)</th>
                    <th className="w-24 p-2 text-xs text-slate-400 border-b border-slate-100">Profit %</th>
                    <th className="w-24 p-2 text-xs text-slate-400 border-b border-slate-100">Overheads %</th>
                    <th className="w-28 p-2 text-xs text-slate-400 border-b border-slate-100">Rate (₹)</th>
                    <th className="w-32 p-2 text-xs text-slate-400 border-b border-slate-100">Total (₹)</th>
                    {!isLocked && <th className="w-16 p-2 text-xs text-slate-400 border-b border-slate-100 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {sortedItems.length === 0 ? (
                    <tr>
                      <td colSpan={isLocked ? "9" : "10"} className="p-2 text-center text-slate-400 text-xs italic">
                        {isLocked ? "No items in this version." : "No items added yet. Click \"Add Item\" to begin."}
                      </td>
                    </tr>
                  ) : (
                    sortedItems.flatMap((item, index) => {
                      const rows = [];

                      // Parent Item Row
                      rows.push(
                        <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                          <td className="p-2 text-xs text-slate-400">{index + 1}</td>
                          <td className="p-2 align-top">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 group">
                                <div className="flex-1">
                                  {(mode === 'received' || isLocked) ? (
                                    <div className="flex flex-col">
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-sm text-slate-900">{item.description || 'No Description'}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500 font-mono">{(item.drawing_no || 'Manual Item').toUpperCase()}</span>
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
                                            options={drawings.map(d => ({
                                              id: String(d.id),
                                              drawing_no: d.drawing_no,
                                              description: d.drawing_description || d.description || ''
                                            }))}
                                            value={(() => {
                                              const matchedDwg = drawings.find(d =>
                                                (item.drawing_id && String(d.id) === String(item.drawing_id)) ||
                                                (!item.drawing_id && item.drawing_no && String(d.drawing_no).trim().toUpperCase() === String(item.drawing_no).trim().toUpperCase())
                                              );
                                              return matchedDwg ? String(matchedDwg.id) : (item.drawing_no || '');
                                            })()}
                                            disabled={isLocked}
                                            allowCustom={false}
                                            onChange={(val) => {
                                              const actualVal = val && typeof val === 'object' && val.target ? val.target.value : val;
                                              const drw = drawings.find(d => String(d.id) === String(actualVal));
                                              const updatedItems = items.map(it => {
                                                if (it.id === item.id) {
                                                  const g = (drw?.item_group || it.item_group || '').toUpperCase();
                                                  const isPart = g.includes('PART');

                                                  // Only update BOM Cost auto-fetch for newly added rows
                                                  const isNewRow = it.isNew;
                                                  const drwBomCost = isNewRow
                                                    ? (drw?.bom_cost && parseFloat(drw.bom_cost) > 0 ? parseFloat(drw.bom_cost) : null)
                                                    : parseFloat(drw?.rate || drw?.quotedPrice || drw?.bom_cost || it.rate || 0);

                                                  const drwRate = isNewRow
                                                    ? (drwBomCost !== null ? drwBomCost : parseFloat(drw?.rate || drw?.quotedPrice || 0))
                                                    : parseFloat(drw?.rate || drw?.quotedPrice || drw?.bom_cost || it.rate || 0);

                                                  const newBomCost = isNewRow ? drwBomCost : drwRate;
                                                  const profit = parseFloat(it.profit_percentage) || 0;
                                                  const override = parseFloat(it.override_percentage) || 0;
                                                  const newRate = newBomCost * (1 + profit / 100) * (1 + override / 100);

                                                  return {
                                                    ...it,
                                                    drawing_id: actualVal,
                                                    drawing_no: (drw?.drawing_no || '').toUpperCase(),
                                                    description: drw?.drawing_description || drw?.description || '',
                                                    rate: newRate,
                                                    bom_cost: newBomCost,
                                                    isBOMCostManuallyEdited: false,
                                                    item_group: drw?.item_group || it.item_group,
                                                    unit: drw?.unit || it.unit || 'Nos',
                                                    total: (parseFloat(it.quantity) || 0) * newRate,
                                                    sub_assemblies: g.includes('ASSEMBLY')
                                                      ? ((drw?.sub_assemblies && drw.sub_assemblies.length > 0)
                                                        ? drw.sub_assemblies.filter(sa => (sa.item_group || '').toUpperCase().includes('PART'))
                                                        : (it.sub_assemblies || []).filter(sa => (sa.item_group || '').toUpperCase().includes('PART'))).map(sa => {
                                                          let actualPartCost = parseFloat(sa.component_bom_cost || sa.child_bom_cost || sa.part_bom_cost || sa.component_cost || sa.bom_cost || sa.rate || 0);
                                                          const parentBOMCost = parseFloat(drwRate || it.bom_cost || 0);
                                                          if (Math.abs(actualPartCost - parentBOMCost) < 0.01) {
                                                            actualPartCost = parseFloat(sa.component_bom_cost || sa.child_bom_cost || sa.part_bom_cost || sa.component_cost || 0);
                                                          }
                                                          return {
                                                            ...sa,
                                                            bom_cost: actualPartCost,
                                                            rate: actualPartCost
                                                          };
                                                        })
                                                      : []
                                                  };
                                                }
                                                return it;
                                              });
                                              setItems(updatedItems);
                                            }}
                                            placeholder="Search Drawing No or Drawing Name..."
                                            labelField="drawing_no"
                                            valueField="id"
                                            subLabelField="description"
                                            className="border-none p-0 focus-within:ring-0 shadow-none bg-transparent text-xs text-slate-500 hide-arrow"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-2 align-top text-xs">
                            {(() => {
                              const g = (item.item_group || '').toUpperCase();
                              const isPart = g.includes('PART');
                              return (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] border ${isPart
                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-blue-100 text-blue-700 border-blue-200'
                                  }`}>
                                  {isPart ? 'PART' : 'ASM'}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                value={item.quantity}
                                readOnly={isLocked}
                                onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value);
                                  handleItemChange(item.id, 'quantity', isNaN(val) ? '' : val);
                                }}
                                className={`flex-1 min-w-0 px-2 py-1 text-xs border rounded outline-none transition-all ${isLocked ? 'bg-transparent border-transparent text-slate-700 ' : 'bg-white border-slate-200 text-slate-700 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'}`}
                              />
                              <span className="text-xs text-slate-400 ">{item.unit || 'Nos'}</span>
                            </div>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={item.bom_cost || ''}
                              readOnly={isLocked}
                              onChange={(e) => handleItemChange(item.id, 'bom_cost', e.target.value)}
                              placeholder=""
                              className={`w-full px-2 py-1 text-xs font-semibold border rounded outline-none transition-all ${isLocked
                                  ? 'bg-transparent border-transparent text-slate-700'
                                  : 'bg-white border-slate-200 text-emerald-600 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'
                                }`}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={item.profit_percentage || ''}
                              readOnly={isLocked}
                              onChange={(e) => handleItemChange(item.id, 'profit_percentage', e.target.value)}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                handleItemChange(item.id, 'profit_percentage', isNaN(val) ? '' : val);
                              }}
                              placeholder="0%"
                              className={`w-full px-2 py-1 text-xs border rounded outline-none transition-all ${isLocked ? 'bg-transparent border-transparent text-slate-700' : 'bg-white border-slate-200 text-slate-700 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'}`}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={item.override_percentage || ''}
                              readOnly={isLocked}
                              onChange={(e) => handleItemChange(item.id, 'override_percentage', e.target.value)}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                handleItemChange(item.id, 'override_percentage', isNaN(val) ? '' : val);
                              }}
                              placeholder="0%"
                              className={`w-full px-2 py-1 text-xs border rounded outline-none transition-all ${isLocked ? 'bg-transparent border-transparent text-slate-700' : 'bg-white border-slate-200 text-slate-700 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'}`}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={item.rate || ''}
                              readOnly
                              className="w-full px-2 py-1 text-xs font-semibold bg-transparent border-transparent text-indigo-600 outline-none cursor-default"
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
                        const uniqueSubAssemblies = item.sub_assemblies.filter(
                          (sa, index, self) => index === self.findIndex(
                            x => x.component_code === sa.component_code && x.description === sa.description
                          )
                        );
                        uniqueSubAssemblies.forEach((sa, saIdx) => {
                          const saQty = parseFloat(sa.quantity || 0) * (parseFloat(item.quantity) || 0);
                          const saBomCost = (() => {
                            const parentCost = parseFloat(item.bom_cost || item.rate || 0);
                            const candidates = [
                              sa.component_bom_cost,
                              sa.child_bom_cost,
                              sa.part_bom_cost,
                              sa.component_cost,
                              sa.bom_cost,
                              sa.rate
                            ];
                            for (const cost of candidates) {
                              const val = parseFloat(cost || 0);
                              if (val > 0 && Math.abs(val - parentCost) > 0.01) {
                                return val;
                              }
                            }
                            const fallback = parseFloat(sa.component_bom_cost || sa.child_bom_cost || sa.part_bom_cost || sa.component_cost || sa.bom_cost || sa.rate || 0);
                            if (Math.abs(fallback - parentCost) < 0.01) {
                              return sa.pending_bom_cost || 0;
                            }
                            return fallback;
                          })();
                          const saRate = saQty * saBomCost;

                          rows.push(
                            <tr key={`${item.id}-sa-${sa.id || saIdx}`} className="bg-slate-50/40">
                              <td className="p-2 border-b border-slate-100"></td>
                              <td className="p-2 border-b border-slate-100">
                                <div className="flex items-center gap-2 pl-3">
                                  <GitBranch size={12} className="text-blue-400 rotate-180" />
                                  <div className="flex flex-col">
                                    <span className="text-[11px] text-slate-700 font-semibold">{sa.description}</span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[9px] text-slate-500 font-mono ">{(sa.drawing_no || '').toUpperCase()}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-2 border-b border-slate-100 text-[10px] text-slate-500 font-semibold">
                                {(sa.item_group || 'PART').toUpperCase().includes('ASSEMBLY') ? 'ASM' : 'PART'}
                              </td>
                              <td className="p-2 border-b border-slate-100 text-[11px] text-slate-600 ">
                                {parseFloat(saQty.toFixed(3))} {sa.unit || 'Nos'}
                              </td>
                              <td className="p-2 border-b border-slate-100 text-[11px] text-indigo-600  bg-indigo-50/30">
                                {formatCurrency(saBomCost)}
                              </td>
                              <td className="p-2 border-b border-slate-100 text-[11px] text-slate-400">-</td>
                              <td className="p-2 border-b border-slate-100 text-[11px] text-slate-400">-</td>
                              <td className="p-2 border-b border-slate-100 text-[11px] text-slate-600">
                                {formatCurrency(saBomCost)}
                              </td>
                              <td className="p-2 border-b border-slate-100 text-[11px] text-slate-700 font-semibold">
                                {formatCurrency(saRate)}
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
                          <span className="text-slate-500">Previous (V{version - 1})</span>
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

              {/* Overall Discount Section */}
              <div className="p-2 bg-slate-50 rounded border border-slate-100 space-y-1.5 my-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Overall Discount</span>
                </div>
                <div className="flex gap-2">
                  <select
                    disabled={isLocked}
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                    className="text-xs bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 w-28 disabled:bg-slate-100 disabled:text-slate-400 font-medium"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed (₹)</option>
                  </select>
                  <input
                    type="number"
                    disabled={isLocked}
                    value={discountValue === 0 ? '' : discountValue}
                    placeholder="0.00"
                    min="0"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setDiscountValue(0);
                      } else {
                        const parsed = parseFloat(val);
                        setDiscountValue(isNaN(parsed) ? 0 : parsed);
                      }
                    }}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setDiscountValue(Math.max(0, val));
                    }}
                    className="flex-1 text-xs text-right bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 font-semibold disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 ">Base Amount (BOM Cost)</span>
                <span className="text-slate-900 ">{formatCurrency(summary.bomBaseAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 ">Profit Added</span>
                <span className="text-slate-900 ">{formatCurrency(summary.profitAdded)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 ">Overheads Added</span>
                <span className="text-slate-900 ">{formatCurrency(summary.overrideAdded)}</span>
              </div>
              {summary.discountAmount > 0 && (
                <div className="flex justify-between items-center text-xs text-rose-600 font-medium">
                  <span>Discount Amount (-)</span>
                  <span>-{formatCurrency(summary.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-xs border-t border-slate-100/60 pt-2">
                <span className="text-slate-500 font-medium">Subtotal (Pre-Tax)</span>
                <span className="text-slate-900 font-medium">{formatCurrency(summary.baseAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 ">CGST (9%)</span>
                <span className="text-slate-900 ">{formatCurrency(summary.gstAmount / 2)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 ">SGST (9%)</span>
                <span className="text-slate-900 ">{formatCurrency(summary.gstAmount / 2)}</span>
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
                        className={`w-full p-2 rounded border transition-all group ${isViewable ? 'cursor-pointer hover:shadow-md hover:border-indigo-300 active:scale-[0.98]' : 'cursor-default opacity-80'
                          } ${v.id === selectedVersionId ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-100' : 'bg-white border-slate-100'
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
                            <div className="flex items-center gap-2 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewPDF(v.id);
                                }}
                                className="px-1.5 py-0.5 text-[9px]  bg-indigo-50 text-indigo-600 border border-indigo-100 rounded hover:bg-indigo-100 transition-all flex items-center gap-1"
                                title="View PDF"
                              >
                                View PDF
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
                <label className="text-[9px]  text-slate-400   block">Terms & Conditions</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  readOnly={isLocked}
                  placeholder={isLocked ? "" : "Enter Terms & Conditions..."}
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
      <SendEmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        data={emailModalData}
        onSend={handleModalSend}
        title="Send Quotation to Client"
        subTitle={quotationNo === 'Generating...' ? 'New Version' : quotationNo}
        attachmentName={emailModalData?.attachmentName}
      />
    </div>
  );
};

export default QuotationFormPage;
