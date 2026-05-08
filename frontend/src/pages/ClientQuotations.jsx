  import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Card, StatusBadge, Tabs, Button, DataTable } from '../components/ui.jsx';
import { 
  MessageSquare, Send, X, User, ShieldCheck, RotateCw, Save, Check, FileText, CheckCircle, Mail, ClipboardList, Eye, Trash2, Loader2, Upload, Package, ChevronDown, ChevronUp, History, Search, CheckCheck, Plus, GitBranch, Download, Clock, ArrowUpRight, Calculator
} from 'lucide-react';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');
const UPLOAD_BASE = import.meta.env.VITE_UPLOAD_URL;

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(value || 0);
};

// Robust URL construction
const getFileUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  
  // 1. Determine base URL (priority: VITE_UPLOAD_URL -> API_BASE)
  let base = UPLOAD_BASE || API_BASE;
  if (base.endsWith('/')) base = base.slice(0, -1);
  
  // 2. Clean the incoming path
  let cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // 3. Prevent double 'uploads/' if base already includes it
  if (base.toLowerCase().endsWith('/uploads') && cleanPath.toLowerCase().startsWith('uploads/')) {
    cleanPath = cleanPath.slice(8);
  }
  
  const url = `${base}/${cleanPath}`;
  
  if (url.startsWith('http')) return url;
  return window.location.origin + (url.startsWith('/') ? url : '/' + url);
};

const ClientQuotations = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'sent', or 'received'
  const [groupedByClient, setGroupedByClient] = useState({});
  const [sentQuotations, setSentQuotations] = useState([]);
  const [receivedQuotations, setReceivedQuotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedClientName, setExpandedClientName] = useState(null);
  const [expandedSentKey, setExpandedSentKey] = useState(null);
  const [quotePricesMap, setQuotePricesMap] = useState({});
  const [profitMap, setProfitMap] = useState({});
  const [gstMap, setGstMap] = useState({});
  const [editingSentAmounts, setEditingSentAmounts] = useState({});
  const [savingSentAmount, setSavingSentAmount] = useState(null);
  const [editingItemRates, setEditingItemRates] = useState({});
  const [savingItemRateId, setSavingItemRateId] = useState(null);

  // Communication States
  const [showCommDrawer, setShowCommDrawer] = useState(false);
  const [selectedQuoteForComm, setSelectedQuoteForComm] = useState(null);
  const [commType, setCommType] = useState('CLIENT'); // 'CLIENT' or 'INTERNAL'
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});
  const [internalUnreadCounts, setInternalUnreadCounts] = useState({});
  const [sendingMsg, setSendingMsg] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (showCommDrawer) {
      scrollToBottom();
    }
  }, [messages, showCommDrawer]);

  const fetchUnreadCounts = async () => {
    try {
      const token = localStorage.getItem('authToken');
      
      // Fetch Client unread counts
      const clientResponse = await fetch(`${API_BASE}/quotations/communications/unread-counts?type=CLIENT`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (clientResponse.ok) {
        const data = await clientResponse.json();
        const counts = {};
        data.forEach(item => {
          counts[item.quotation_id] = item.unread_count;
        });
        setUnreadCounts(counts);
      }

      // Fetch Internal unread counts
      const internalResponse = await fetch(`${API_BASE}/quotations/communications/unread-counts?type=INTERNAL`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (internalResponse.ok) {
        const data = await internalResponse.json();
        const counts = {};
        data.forEach(item => {
          counts[item.quotation_id] = item.unread_count;
        });
        setInternalUnreadCounts(counts);
      }
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    }
  };

  const fetchMessages = async (quotationId, type = commType) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/communications?quotationId=${quotationId}&type=${type}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
        
        // Mark as read
        await fetch(`${API_BASE}/quotations/communications/mark-as-read`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ quotationId, type })
        });
        fetchUnreadCounts();
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleCommTypeChange = (newType) => {
    if (newType === commType) return;
    setCommType(newType);
    if (selectedQuoteForComm) {
      setMessages([]);
      fetchMessages(selectedQuoteForComm.id, newType);
    }
  };

  const handleRefreshMessages = async () => {
    if (!selectedQuoteForComm || syncing) return;
    
    try {
      setSyncing(true);
      const token = localStorage.getItem('authToken');
      // Trigger sync
      await fetch(`${API_BASE}/quotations/communications/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Wait 3 seconds for sync to start processing
      setTimeout(() => {
        fetchMessages(selectedQuoteForComm.id);
        setSyncing(false);
      }, 3000);
    } catch (error) {
      console.error('Error syncing messages:', error);
      fetchMessages(selectedQuoteForComm.id);
      setSyncing(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedQuoteForComm) return;

    try {
      setSendingMsg(true);
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`${API_BASE}/quotations/communications`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quotationId: selectedQuoteForComm.id,
          quotationType: commType,
          message: newMessage,
          recipientEmail: selectedQuoteForComm.clientEmail,
          quoteNumber: `QRT-${String(selectedQuoteForComm.id).padStart(4, '0')}`
        })
      });

      if (response.ok) {
        setNewMessage('');
        fetchMessages(selectedQuoteForComm.id);
      } else {
        errorToast('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      errorToast('Error sending message');
    } finally {
      setSendingMsg(false);
    }
  };

  const openCommDrawer = (group) => {
    if (!group) return;
    const firstQuote = group.quotes?.[0];
    
    setSelectedQuoteForComm({
      id: group.id,
      company_name: group.company_name,
      clientEmail: firstQuote?.email || ''
    });
    setMessages([]);
    setCommType('CLIENT');
    setShowCommDrawer(true);
    fetchMessages(group.id, 'CLIENT');
  };

  const fetchApprovedOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/approved-drawings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch approved orders');
      const data = await response.json();
      
      const grouped = {};
      const initialPrices = {};
      const initialProfits = {};
      const initialGst = {};
      data.forEach(order => {
        const clientName = order.company_name || 'Unassigned';
        if (!grouped[clientName]) {
          grouped[clientName] = {
            company_name: clientName,
            company_id: order.company_id,
            contact_person: order.contact_person || '',
            email: order.email || '',
            phone: order.phone || '',
            address: order.address || '',
            created_at: order.created_at,
            orders: [],
            // Store all items here for client-wide grouping
            all_items_map: {} 
          };
          initialPrices[clientName] = {};
          initialProfits[clientName] = {};
          initialGst[clientName] = {};
        }

          // Process items and group by identity across ALL orders for this client
        (order.items || []).forEach(item => {
          const g = (item.item_group || '').trim().toUpperCase();
          const t = (item.item_type || '').trim().toUpperCase();
          const p = (item.product_type || '').trim().toUpperCase();
          
          // Refined detection: prioritize FG even if it has SA/ASSEMBLY in name if it's explicitly marked as FG type/group
          const isFG = (g.includes('FG') || t.includes('FG') || p.includes('FG') || g.includes('FINISHED') || t.includes('FINISHED')) && !g.includes('SA') && !g.includes('SUB') && !t.includes('SA') && !t.includes('SUB');
          const isSA = (g.includes('SA') || g.includes('SUB') || g.includes('ASSEMBLY') || t.includes('SA') || t.includes('SUB') || t.includes('ASSEMBLY')) && !isFG;
          
          // Skip if rejected, or if it's an FG with no cost (SA/ASSEMBLY can have 0 cost)
          if ((!isFG && !isSA) || item.status === 'REJECTED' || (isFG && !Number(item.bom_cost))) return;

          // Set calc group for UI badge
          item.item_group_calc = isFG ? 'FG' : (g.includes('ASSEMBLY') || t.includes('ASSEMBLY') ? (g.includes('SUB') || t.includes('SUB') ? 'SUB ASSEMBLY' : 'ASSEMBLY') : 'SUB ASSEMBLY');

          // Hide sub-assemblies from top-level if they are part of another item (identified by is_component > 0)
          // Exception: if it's an FG, always show it at top level
          if (item.is_component > 0 && !isFG) return;

          const identity = `${item.drawing_no || 'NA'}_${item.item_code || 'NA'}_${item.item_group_calc}`;
          const existing = grouped[clientName].all_items_map[identity];
          
          const parseVer = (v) => parseFloat(String(v || 0).replace(/[^\d.]/g, '')) || 0;

          if (!existing) {
            grouped[clientName].all_items_map[identity] = { ...item, project_name: order.project_name };
          } else {
            const currentRev = parseVer(item.revision_no || item.version);
            const existingRev = parseVer(existing.revision_no || existing.version);
            
            // Prioritize higher revision, then higher ID
            if (currentRev > existingRev || (currentRev === existingRev && parseInt(item.id) > parseInt(existing.id))) {
              grouped[clientName].all_items_map[identity] = { ...item, project_name: order.project_name };
            }
          }
        });
      });

      // Finalize the grouped data structure
      Object.keys(grouped).forEach(clientName => {
        const client = grouped[clientName];
        let items = Object.values(client.all_items_map);

        // EXTRA PASS: Hide items from top-level if they already exist as nested sub-assemblies in this client group
        // This handles cases where an SA might be in one order and its parent FG in another
        const nestedIdentities = new Set();
        items.forEach(item => {
          if (item.sub_assemblies && item.sub_assemblies.length > 0) {
            item.sub_assemblies.forEach(sa => {
              const saCode = (sa.component_code || sa.componentCode || '').trim().toUpperCase();
              const saDrawing = (sa.drawing_no || '').trim().toUpperCase();
              const saDesc = (sa.description || sa.item_description || '').trim().toUpperCase();
              
              if (saCode) {
                nestedIdentities.add(`${saDrawing}_${saCode}`);
                nestedIdentities.add(`_ANY_DRAWING_${saCode}`);
              }
              if (saDesc) {
                nestedIdentities.add(`${saDrawing}_DESC_${saDesc}`);
                nestedIdentities.add(`_ANY_DRAWING_DESC_${saDesc}`);
              }
            });
          }
        });

        // Filter items: Keep it if it's an FG OR if it's NOT found in nestedIdentities
        items = items.filter(item => {
          const g = (item.item_group_calc || '').toUpperCase();
          const t = (item.item_type || '').trim().toUpperCase();
          const p = (item.product_type || '').trim().toUpperCase();

          // Be very specific about FG vs SA
          const isFG = (g === 'FG' || g.includes('FINISHED') || t.includes('FG') || p.includes('FG')) && !g.includes('SA') && !g.includes('SUB') && !t.includes('SA');
          
          if (isFG) return true; // Always show FGs at top level
          
          const code = (item.item_code || '').trim().toUpperCase();
          const drawing = (item.drawing_no || '').trim().toUpperCase();
          const desc = (item.description || item.item_description || '').trim().toUpperCase();
          
          const identity = `${drawing}_${code}`;
          const identityDesc = `${drawing}_DESC_${desc}`;
          
          const isNested = nestedIdentities.has(identity) || 
                          nestedIdentities.has(`_ANY_DRAWING_${code}`) ||
                          nestedIdentities.has(identityDesc) ||
                          nestedIdentities.has(`_ANY_DRAWING_DESC_${desc}`);
          
          return !isNested;
        });
        
        // Sort items: FG first, then SAs
        items.sort((a, b) => {
          const gA = (a.item_group_calc || '').toUpperCase();
          const gB = (b.item_group_calc || '').toUpperCase();
          const isSAA = (gA.includes('SA') || gA.includes('SUB') || gA.includes('ASSEMBLY')) && !gA.includes('FG');
          const isSAB = (gB.includes('SA') || gB.includes('SUB') || gB.includes('ASSEMBLY')) && !gB.includes('FG');
          const isFGA = (gA.includes('FG') || gA.includes('FINISHED')) && !isSAA;
          const isFGB = (gB.includes('FG') || gB.includes('FINISHED')) && !isSAB;
          
          if (isFGA && !isFGB) return -1;
          if (!isFGA && isFGB) return 1;
          if (isSAA && !isSAB) return -1;
          if (!isSAA && isSAB) return 1;
          return 0;
        });

        // Clear temporary maps and set final items
        // We simulate an 'order' structure to keep compatibility with existing render logic
        client.orders = [{
          id: `grouped_${client.company_id}`,
          items: items,
          project_name: items[0]?.project_name || 'Multiple Projects'
        }];

        items.forEach(item => {
          const margin = 0; // Default margin
          initialProfits[clientName][item.id] = margin;
          initialGst[clientName][item.id] = 18;

          const g = (item.item_group_calc || '').toUpperCase();
          const isSA = (g.includes('SA') || g.includes('SUB') || g.includes('ASSEMBLY')) && !g.includes('FG');
          const isFG = (g.includes('FG') || g.includes('FINISHED')) && !isSA;

          if (item.bom_cost && Number(item.bom_cost) > 0) {
            // Calculate price for both FG and Sub-Assemblies as per user request
            const calculatedPrice = (isFG || isSA) ? Number(item.bom_cost) * (1 + margin / 100) : 0;
            initialPrices[clientName][item.id] = calculatedPrice.toFixed(2);
          } else {
            initialPrices[clientName][item.id] = "0.00";
          }
        });
        
        delete client.all_items_map;
      });

      // Filter out clients that have no items after all filtering/grouping
      const finalGrouped = {};
      Object.keys(grouped).forEach(clientName => {
        if (grouped[clientName].orders?.[0]?.items?.length > 0) {
          finalGrouped[clientName] = grouped[clientName];
        }
      });

      setGroupedByClient(finalGrouped);
      setQuotePricesMap(initialPrices);
      setProfitMap(initialProfits);
      setGstMap(initialGst);
    } catch (error) {
      console.error(error);
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSentQuotations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      // Fetch more statuses to ensure we can identify the latest version correctly
      const response = await fetch(`${API_BASE}/quotation-requests?status=SENT,DRAFT,REVISED,Revised,Approved,Accepted,REJECTED,Completed`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch sent quotations');
      const data = await response.json();
      
      // 1. Group items by their batch_id to form "Quotation Versions"
      const versionBatches = {};
      data.forEach(quote => {
        const bId = quote.batch_id || `legacy_${quote.company_id}_${Math.floor(new Date(quote.created_at).getTime() / 60000)}`;
        if (!versionBatches[bId]) {
          versionBatches[bId] = {
            version: quote.version || 1,
            created_at: quote.created_at,
            items: []
          };
        }
        versionBatches[bId].items.push(quote);
      });

      // 2. Consolidate Versions into Quotation Chains
      const grouped = {};
      Object.values(versionBatches).forEach(batch => {
        const leadItem = batch.items[0];
        const rootId = leadItem.parent_id || leadItem.id; 
        const chainKey = `chain_${rootId}`;
        
        const currentVer = parseInt(batch.version || 1);

        if (!grouped[chainKey]) {
          grouped[chainKey] = {
            id: leadItem.id,
            display_id: rootId,
            uniqueKey: chainKey,
            company_name: leadItem.company_name,
            company_id: leadItem.company_id,
            created_at: batch.created_at,
            status: leadItem.status, 
            reply_pdf: leadItem.reply_pdf,
            project_name: leadItem.project_name, 
            total_amount: 0,
            received_amount: 0,
            quotes: batch.items, 
            version: currentVer,
            batch_id: leadItem.batch_id,
            has_revisions: (currentVer > 1),
            all_batches: [batch]
          };
        } else {
          grouped[chainKey].all_batches.push(batch);
          grouped[chainKey].has_revisions = true;
          
          // Update to latest version info if this batch is newer
          if (currentVer > grouped[chainKey].version) {
            grouped[chainKey].id = leadItem.id;
            grouped[chainKey].status = leadItem.status;
            grouped[chainKey].version = currentVer;
            grouped[chainKey].created_at = batch.created_at;
            grouped[chainKey].quotes = batch.items;
            grouped[chainKey].batch_id = leadItem.batch_id;
            grouped[chainKey].reply_pdf = leadItem.reply_pdf;
          }
        }

        if (batch.items.some(it => it.pending_bom_cost)) {
          grouped[chainKey].has_pending_bom = true;
        }
      });
      
      // 3. Filter chains: keep if the latest version is in a relevant state
      const filtered = Object.values(grouped).filter(group => {
        const s = (group.status || '').toUpperCase();
        return ['SENT', 'DRAFT', 'REVISED'].includes(s);
      });

      // 4. Final calculations
      filtered.forEach(group => {
        const billableQuotes = group.quotes.filter(q => {
          const g = (q.item_group || q.item_group_calc || '').toUpperCase();
          const isSA = (g.includes('SA') || g.includes('SUB') || g.includes('ASSEMBLY')) && !g.includes('FG');
          const isFG = (g.includes('FG') || g.includes('FINISHED')) && !isSA;
          return isFG || isSA;
        });

        group.total_amount = billableQuotes.reduce((sum, q) => sum + (parseFloat(q.total_amount) || 0), 0);
        group.received_amount = billableQuotes.reduce((sum, q) => sum + (parseFloat(q.received_amount) || 0), 0);
        group.status = group.status || 'Sent';
      });
      
      setSentQuotations(filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (error) {
      console.error(error);
      errorToast(error.message || 'Failed to fetch sent quotations');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchApprovedOrders(),
      fetchSentQuotations(),
      fetchReceivedQuotations(),
      fetchUnreadCounts()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    fetchUnreadCounts();
    if (activeTab === 'pending') {
      fetchApprovedOrders();
    } else if (activeTab === 'sent') {
      fetchSentQuotations();
    } else if (activeTab === 'received') {
      fetchReceivedQuotations();
    }
  }, [activeTab]);

  const fetchReceivedQuotations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      // Include REVISED and Revised status here
      const response = await fetch(`${API_BASE}/quotation-requests?status=Approved,Approved,Rejected,REJECTED,Accepted,ACCEPTED,Approval,APPROVAL,Completed,COMPLETED,REVISED,Revised`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch received quotations');
      const data = await response.json();
      
      const grouped = {};
      data.forEach(quote => {
        const rootId = quote.parent_id || quote.id;
        const groupKey = `received_${quote.company_id}_${rootId}`;
        
        if (!grouped[groupKey]) {
          grouped[groupKey] = {
            id: quote.id,
            display_id: rootId,
            uniqueKey: groupKey,
            company_name: quote.company_name,
            company_id: quote.company_id,
            created_at: quote.created_at,
            status: quote.status,
            reply_pdf: quote.reply_pdf,
            project_name: quote.project_name, 
            total_amount: 0,
            received_amount: 0,
            quotes: [],
            version: quote.version || 1,
            batch_id: quote.batch_id,
            parent_id: quote.parent_id
          };
        }
        
        grouped[groupKey].quotes.push(quote);

        const currentVersion = grouped[groupKey].version || 0;
        const quoteVersion = quote.version || 1;
        const currentStatus = (grouped[groupKey].status || '').trim().toUpperCase();
        const quoteStatus = (quote.status || '').trim().toUpperCase();

        if (quoteVersion > currentVersion || (quoteVersion === currentVersion && quoteStatus === 'APPROVED' && currentStatus !== 'APPROVED')) {
          grouped[groupKey].id = quote.id;
          grouped[groupKey].status = quote.status;
          grouped[groupKey].version = quote.version;
          grouped[groupKey].created_at = quote.created_at;
          grouped[groupKey].project_name = quote.project_name;
          grouped[groupKey].reply_pdf = quote.reply_pdf;
          grouped[groupKey].batch_id = quote.batch_id;
          grouped[groupKey].parent_id = quote.parent_id;
        }
      });
      
      // Filter groups: keep those where the LATEST version has a "Received" type status
      const filteredGroups = Object.values(grouped).filter(group => {
        const s = (group.status || '').trim().toUpperCase();
        // Show only APPROVED quotations in the Received tab
        return s === 'APPROVED';
      });

      filteredGroups.forEach(group => {
        // Sort quotes DESC by version so group.quotes[0] is always the latest
        if (!group.quotes) group.quotes = [];
        group.quotes.sort((a, b) => (b.version || 0) - (a.version || 0));

        // RECALCULATE total and items based ONLY on the latest version found in this group
        const latestVersion = group.version || 1;
        const targetBatchId = group.batch_id;
        const targetParentId = group.parent_id;
        const targetCreatedAt = group.created_at;

        const latestQuotes = group.quotes.filter(q => {
          if ((q.version || 1) !== latestVersion) return false;
          
          // 1. Match by batch_id if available
          if (targetBatchId && q.batch_id) {
            return q.batch_id === targetBatchId;
          }
          
          // 2. Match by parent_id if batch_id is missing
          if (targetParentId && q.parent_id) {
            return q.parent_id === targetParentId;
          }

          // 3. Fallback: Check if this item is the "latest" one itself or shares the same creation window
          if (q.id === group.id) return true;
          
          const diff = Math.abs(new Date(q.created_at) - new Date(targetCreatedAt));
          return diff < 10000; // 10 seconds window for legacy items without batch_id
        });
        
        const billableLatestQuotes = latestQuotes.filter(q => {
          const g = (q.item_group || q.item_group_calc || '').toUpperCase();
          const isSA = (g.includes('SA') || g.includes('SUB') || g.includes('ASSEMBLY')) && !g.includes('FG');
          const isFG = (g.includes('FG') || g.includes('FINISHED')) && !isSA;
          return isFG || isSA;
        });
        
        group.total_amount = billableLatestQuotes.reduce((sum, q) => sum + (parseFloat(q.total_amount) || 0), 0);
        group.received_amount = billableLatestQuotes.reduce((sum, q) => sum + (parseFloat(q.received_amount) || 0), 0);
        group.quotes = latestQuotes; // Fix: Only keep latest version items to avoid incorrect drawing/item counts
      });
      
      setReceivedQuotations(filteredGroups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (error) {
      console.error(error);
      errorToast(error.message || 'Failed to fetch received quotations');
    } finally {
      setLoading(false);
    }
  };

  const combinedQuotations = React.useMemo(() => {
    if (activeTab === 'pending') {
      return Object.entries(groupedByClient).map(([name, data]) => ({
        ...data,
        type: 'PENDING',
        status: 'BOM Approved',
        displayStatus: 'BOM Approved',
        uniqueKey: `pending_${name}`,
        quotes: data.orders.flatMap(o => (o.items || []).map(item => ({ ...item, project_name: o.project_name })))
      })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    if (activeTab === 'sent') {
      return sentQuotations.filter(q => q && q.uniqueKey).map(q => ({
        ...q,
        type: 'SENT',
        displayStatus: q.status,
        uniqueKey: `sent_${q.uniqueKey}`
      })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    if (activeTab === 'received') {
      return receivedQuotations.filter(q => q && q.uniqueKey).map(q => ({
        ...q,
        type: 'RECEIVED',
        displayStatus: q.status,
        uniqueKey: `received_${q.uniqueKey}`
      })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return [];
  }, [groupedByClient, sentQuotations, receivedQuotations, activeTab]);

  const columns = React.useMemo(() => [
    {
      label: 'Quotation ID / Type',
      key: 'id',
      render: (val, group) => {
        const isPending = group.type === 'PENDING';
        const hasUpdate = (group.quotes || []).some(q => q.pending_bom_cost);

        return (
          <div className="flex flex-col gap-1">
            {isPending ? (
              <span className="p-1 text-amber-600  text-xs">
                Pending
              </span>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="p-1 bg-indigo-50 text-indigo-600 rounded text-xs border border-indigo-100 w-fit">
                  QRT-{String(group.display_id || val).padStart(4, '0')}
                </span>
                {group.version && (
                  <span className="text-xs  text-slate-500  ml-1">
                    Version {group.version}
                  </span>
                )}
              </div>
            )}
            {hasUpdate && (
              <span className="p-1 bg-rose-50 text-rose-600 rounded text-[9px] border border-rose-100 w-fit animate-pulse ">
                BOM UPDATE REQUESTED
              </span>
            )}
          </div>
        );
      }
    },
    {
      label: 'Client & Project',
      key: 'company_name',
      render: (val, group) => (
        <div className="flex flex-col">
          <span className="text-xs  text-slate-900">{val}</span>
          <span className="text-[11px] text-slate-500 italic">
            {group.project_name || 'General Project'}
          </span>
          <span className="text-[9px] text-slate-400 mt-0.5">
            {new Date(group.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
      )
    },
    {
      label: 'Drawings / Items',
      key: 'id',
      render: (_, group) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-slate-700 ">
            {(() => {
              const uniqueDrawings = [...new Set((group.quotes || []).map(q => q.drawing_no).filter(Boolean))];
              return uniqueDrawings.length > 1 
                ? `${uniqueDrawings.length} Drawings` 
                : (uniqueDrawings[0] || '—');
            })()}
          </span>
          <div className="flex items-center gap-1">
            {(() => {
              const items = group.quotes || [];
              const fgCount = items.filter(q => {
                const g = (q.item_group || q.item_group_calc || '').toUpperCase();
                const isSA = g.includes('SA') || g.includes('SUB') || g.includes('ASSEMBLY');
                return (g === 'FG' || g === 'FINISHED GOODS' || g === 'FINISHED_GOODS' || g.includes('FG')) && !isSA;
              }).length;
              const saCount = items.filter(q => {
                const g = (q.item_group || q.item_group_calc || '').toUpperCase();
                return g.includes('SA') || g.includes('SUB') || g.includes('ASSEMBLY');
              }).length;
              
              const parts = [];
              if (fgCount > 0) parts.push(`${fgCount} FG`);
              if (saCount > 0) parts.push(`${saCount} SA`);
              
              return (
                <span className="text-xs  text-slate-400  bg-slate-50 px-1 rounded border border-slate-100">
                  {parts.length > 0 ? parts.join(' + ') : `${items.length} item(s)`}
                </span>
              );
            })()}
          </div>
        </div>
      )
    },
    {
      label: 'Amount',
      key: 'id',
      render: (_, group) => {
        const isPending = group.type === 'PENDING';
        const key = group.uniqueKey;
        if (isPending) {
          return (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs  text-slate-700">
                {(() => {
                  let total = 0;
                  (group.quotes || []).forEach(item => {
                    const g = (item.item_group || item.item_group_calc || '').toUpperCase();
                    const isSA = g.includes('SA') || g.includes('SUB') || g.includes('ASSEMBLY');
                    const isFG = (g.includes('FG') || g.includes('FINISHED')) && !isSA;
                    
                    if (isFG || isSA) {
                      const rate = parseFloat(quotePricesMap[group.company_name]?.[item.id]) || 0;
                      const qty = parseFloat(item.design_qty) || 0;
                      const gst = parseFloat(gstMap[group.company_name]?.[item.id]) || 18;
                      total += (rate * qty) * (1 + gst / 100);
                    }
                  });
                  return formatCurrency(total);
                })()}
              </span>
              <span className="text-xs  text-slate-400">Estimated Total</span>
            </div>
          );
        } else {
          return (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded px-2 py-1 w-fit" onClick={(e) => e.stopPropagation()}>
                <span className="text-emerald-600 text-xs ">₹</span>
                <input
                  type="text"
                  value={editingSentAmounts[key] !== undefined ? editingSentAmounts[key] : (parseFloat(group.received_amount || 0) > 0 ? group.received_amount : (parseFloat(group.total_amount || 0) * 1.18)).toFixed(2)}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      handleSentAmountChange(key, val);
                    }
                  }}
                  className="w-24 bg-transparent text-emerald-700 text-xs focus:outline-none"
                />
                {editingSentAmounts[key] !== undefined && (
                  <button
                    onClick={() => saveSentAmount(group)}
                    disabled={savingSentAmount === key}
                    className="p-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-all shadow-sm active:scale-90"
                  >
                    {savingSentAmount === key ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                  </button>
                )}
              </div>
              <span className="text-xs text-slate-400 ml-1">Incl. GST (18%)</span>
            </div>
          );
        }
      }
    },
    {
      label: 'Action',
      key: 'id',
      className: 'text-right',
      render: (_, group) => {
        const isPending = group.type === 'PENDING';
        
        return (
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            {!isPending && (group.quotes || []).some(q => q.pending_bom_cost) && (
              <button
                onClick={() => {
                  const target = (group.quotes || []).find(q => q.pending_bom_cost);
                  if (target) handleApplyPendingBOM(group, target);
                }}
                className="p-2 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 rounded transition-all active:scale-95 animate-pulse"
                title="Review BOM Update Request"
              >
                <Calculator size={15} />
              </button>
            )}

            {!isPending && group.reply_pdf && (
              <a
                href={getFileUrl(group.reply_pdf)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-all border border-transparent hover:border-blue-100"
                title="View Reply PDF"
              >
                <FileText size={15} />
              </a>
            )}

            {!isPending && (
              <button
                onClick={() => handleDownloadPDF(group)}
                className="p-2 bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 rounded transition-all active:scale-95"
                title="Download PDF"
              >
                <Download size={15} />
              </button>
            )}

            {!isPending && (
              <>
                <button
                  onClick={() => openCommDrawer(group)}
                  className="p-2 relative bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded transition-all active:scale-95"
                  title="Chat with Client"
                >
                  <MessageSquare size={15} />
                  {unreadCounts[group.id] > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded bg-rose-500 text-xs text-white shadow-sm ring-2 ring-white animate-bounce">
                      {unreadCounts[group.id]}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleUploadReplyPDF(group)}
                  className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded transition-all active:scale-95"
                  title="Upload Reply PDF"
                >
                  <Upload size={15} />
                </button>
                <button
                  onClick={() => handleRevise(group)}
                  className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-amber-600 hover:bg-slate-50 rounded transition-all active:scale-95"
                  title="Revise Quotation"
                >
                  <GitBranch size={15} />
                </button>
              </>
            )}

            <button
              onClick={() => isPending ? handleDeleteApprovedOrders(group.company_name) : handleDeleteSentQuotation(group)}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all active:scale-95"
              title="Delete"
            >
              <Trash2 size={15} />
            </button>
          </div>
        );
      }
    }
  ], [activeTab, editingSentAmounts, savingSentAmount, quotePricesMap, gstMap, unreadCounts]);

  const renderExpanded = (group) => {
    const isPending = group.type === 'PENDING';
    return (
      <div className="bg-slate-200 p-2">
        <div className=" animate-in slide-in-from-top-2 duration-300">
          <div className="px-5 p-3 border-b border-slate-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded">
                <Package size={16} />
              </div>
              <div>
                <h3 className="text-sm  text-slate-900">
                  {isPending ? 'Approved Drawings & Pricing' : 'Quotation Details'}
                </h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <User size={12} className="text-slate-400" />
                    <span className="">{group.company_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Package size={12} className="text-slate-400" />
                    <span className=" italic">{group.project_name || 'General Project'}</span>
                  </div>
                  {group.quotes?.[0]?.email && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <Mail size={12} className="text-slate-400" />
                      <span>{group.quotes[0]?.email}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {isPending && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSendQuote(group.company_name)}
                icon={Send}
              >
                Draft Quotation
              </Button>
            )}
          </div>
          <div className="overflow-x-auto bg-white">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/30">
                <tr>
                  <th className="px-4 p-2 text-left text-xs text-slate-500">Drawing & Description</th>
                  <th className="px-4 p-2 text-center text-xs text-slate-500">Qty</th>
                  <th className="px-4 p-2 text-left text-xs text-slate-500">BOM Cost</th>
                  {isPending ? (
                    <>
                      <th className="px-4 p-2 text-left text-xs text-slate-500 w-24">Profit %</th>
                      <th className="px-4 p-2 text-left text-xs text-slate-500 w-32">Unit Rate</th>
                      <th className="px-4 p-2 text-left text-xs text-slate-500 w-24">GST %</th>
                      <th className="px-4 p-2 text-right text-xs text-slate-500 pr-6">Quote Price</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 p-2 text-right text-xs text-slate-500">Rate</th>
                      <th className="px-4 p-2 text-right text-xs text-slate-500 pr-6">Total (Base)</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 bg-white">
                {(() => {
                  const drawingGroups = {};
                  (group.quotes || []).forEach(item => {
                    const dNo = item.drawing_no || 'NA';
                    if (!drawingGroups[dNo]) drawingGroups[dNo] = [];
                    drawingGroups[dNo].push(item);
                  });

                  return Object.entries(drawingGroups).map(([dNo, dItems]) => {
                    const sorted = [...dItems].sort((a, b) => {
                      const gA = (a.item_group || a.item_group_calc || '').toUpperCase();
                      const gB = (b.item_group || b.item_group_calc || '').toUpperCase();
                      const isSAA = (gA.includes('SA') || gA.includes('SUB') || gA.includes('ASSEMBLY')) && !gA.includes('FG');
                      const isSAB = (gB.includes('SA') || gB.includes('SUB') || gB.includes('ASSEMBLY')) && !gB.includes('FG');
                      const isFGA = (gA.includes('FG') || gA.includes('FINISHED')) && !isSAA;
                      const isFGB = (gB.includes('FG') || gB.includes('FINISHED')) && !isSAB;
                      
                      if (isFGA && !isFGB) return -1;
                      if (!isFGA && isFGB) return 1;
                      if (isSAA && !isSAB) return -1;
                      if (!isSAA && isSAB) return 1;
                      return 0;
                    });

                    return (
                      <React.Fragment key={dNo}>
                        <tr className="bg-slate-50/50 border-y border-slate-100">
                          <td colSpan={isPending ? 7 : 4} className="px-4 py-1.5 text-xs   text-slate-500 uppercase tracking-wider bg-slate-100/30">
                            Drawing: {dNo}
                          </td>
                        </tr>
                        {sorted.flatMap((item) => {
                          const g = (item.item_group || item.item_group_calc || '').toUpperCase();
                          const isSA = (g.includes('SA') || g.includes('SUB') || g.includes('ASSEMBLY')) && !g.includes('FG');
                          const isFG = (g.includes('FG') || g.includes('FINISHED')) && !isSA;
                          
                          const displayGroup = isSA ? (g.includes('ASSEMBLY') && !g.includes('SUB') ? 'ASSY' : 'SA') : (isFG ? 'FG' : g);

                          const mainRow = (
                            <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors ${isSA ? 'bg-slate-50/20' : ''}`}>
                              <td className="px-4 p-2">
                                <div className="flex flex-col">
                                  <div className={`flex items-center gap-2 mb-0.5 ${isSA ? 'ml-4' : ''}`}>
                                    {isSA && <GitBranch size={10} className="text-slate-400 rotate-180" />}
                                    <span className="text-xs  text-slate-900 ">{item.description || item.item_description || '—'}</span>
                                    {displayGroup && (
                                      <span className={`px-1.5 py-0.5 rounded text-xs    ${
                                        isSA 
                                          ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                                          : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                      }`}>
                                        {displayGroup}
                                      </span>
                                    )}
                                  </div>
                                  {!isSA && (
                                    <span className="text-xs  text-slate-500  ">
                                      DRAWING: {item.drawing_no || 'NA'}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 p-2 text-center">
                                <span className="text-xs  text-slate-900">
                                  {item.item_qty || item.design_qty}
                                </span>
                                <span className="text-xs  text-slate-400 ml-1 ">{item.item_unit || item.unit || 'Nos'}</span>
                              </td>
                              <td className="px-4 p-2">
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs  text-slate-600">
                                    {formatCurrency(item.bom_cost || item.latest_bom_cost)}
                                  </span>
                                  {item.pending_bom_cost && (
                                    <div className="flex items-center gap-1.5 animate-in slide-in-from-left duration-300">
                                      <div className="p-1 bg-rose-50 text-rose-600 rounded border border-rose-100 flex items-center gap-1" title="New BOM Update Requested">
                                        <ArrowUpRight size={10} className={item.pending_bom_cost > (item.bom_cost || item.latest_bom_cost) ? 'text-rose-500' : 'rotate-90 text-emerald-500'} />
                                        <span className="text-xs  ">{formatCurrency(item.pending_bom_cost)}</span>
                                      </div>
                                      <button
                                        onClick={() => handleApplyPendingBOM(group, item)}
                                        className="p-1 bg-rose-600 text-white rounded hover:bg-rose-700 shadow-sm transition-all active:scale-90"
                                        title="Apply this new BOM cost and REVISE quotation"
                                      >
                                        <CheckCheck size={10} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                              {isPending ? (
                                <>
                                  {!isSA ? (
                                    <>
                                      <td className="px-4 p-2">
                                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
                                          <input
                                            type="text"
                                            value={profitMap[group.company_name]?.[item.id]}
                                            onChange={(e) => handleProfitChange(group.company_name, item, e.target.value)}
                                            className="w-full bg-transparent text-xs text-slate-900 focus:outline-none "
                                          />
                                          <span className="text-slate-400 text-xs ">%</span>
                                        </div>
                                      </td>
                                      <td className="px-4 p-2">
                                        <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 rounded px-2 py-1">
                                          <span className="text-indigo-600 text-xs  ">₹</span>
                                          <input
                                            type="text"
                                            value={quotePricesMap[group.company_name]?.[item.id]}
                                            onChange={(e) => handlePriceChange(group.company_name, item, e.target.value)}
                                            className="w-full bg-transparent text-xs text-indigo-700 focus:outline-none "
                                          />
                                        </div>
                                      </td>
                                      <td className="px-4 p-2">
                                        <select
                                          value={gstMap[group.company_name]?.[item.id]}
                                          onChange={(e) => handleGstChange(group.company_name, item.id, e.target.value)}
                                          className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-xs text-slate-700 focus:outline-none"
                                        >
                                          <option value="0">0%</option>
                                          <option value="5">5%</option>
                                          <option value="12">12%</option>
                                          <option value="18">18%</option>
                                          <option value="28">28%</option>
                                        </select>
                                      </td>
                                      <td className="px-4 p-2 text-right pr-6">
                                        <div className="flex flex-col">
                                          <span className="text-xs  text-slate-900">
                                            {formatCurrency((parseFloat(quotePricesMap[group.company_name]?.[item.id]) || 0) * (parseFloat(item.design_qty || item.item_qty) || 0))}
                                          </span>
                                          <span className="text-[9px] text-slate-400">Base Amount</span>
                                        </div>
                                      </td>
                                    </>
                                  ) : (
                                    <td colSpan={4} className="bg-slate-50/5"></td>
                                  )}
                                </>
                              ) : (
                                <>
                                  {!isSA ? (
                                    <>
                                      <td className="px-4 p-2 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                          {editingItemRates[item.id] !== undefined ? (
                                            <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 rounded px-2 py-1">
                                              <span className="text-emerald-600 text-xs ">₹</span>
                                              <input
                                                type="text"
                                                value={editingItemRates[item.id]}
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                    setEditingItemRates(prev => ({ ...prev, [item.id]: val }));
                                                  }
                                                }}
                                                className="w-16 bg-transparent text-emerald-700 text-xs focus:outline-none"
                                              />
                                              <button
                                                onClick={() => saveItemRate(item)}
                                                disabled={savingItemRateId === item.id}
                                                className="text-emerald-600 hover:text-emerald-800"
                                              >
                                                {savingItemRateId === item.id ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                                              </button>
                                            </div>
                                          ) : (
                                            <button 
                                              onClick={() => setEditingItemRates(prev => ({ ...prev, [item.id]: (parseFloat(item.unit_rate) || (parseFloat(item.total_amount) / (parseFloat(item.item_qty) || 1))).toFixed(2) }))}
                                              className="text-xs  text-slate-600 hover:text-indigo-600"
                                            >
                                              {formatCurrency(item.unit_rate || (parseFloat(item.total_amount) / (parseFloat(item.item_qty) || 1)))}
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-4 p-2 text-right pr-6">
                                        <span className="text-xs  text-slate-900">
                                          {formatCurrency(parseFloat(item.total_amount) || 0)}
                                        </span>
                                      </td>
                                    </>
                                  ) : (
                                    <td colSpan={2} className="bg-slate-50/5"></td>
                                  )}
                                </>
                              )}
                            </tr>
                          );

                          // Sub-assembly components logic
                          // ONLY show nested sub-assemblies for Finished Goods to avoid redundant display
                          const subRows = (isFG && item.sub_assemblies && item.sub_assemblies.length > 0) ? item.sub_assemblies.map(sa => (
                            <tr key={`sa_${sa.id || Math.random()}`} className="bg-slate-50/10 hover:bg-slate-50/30 transition-colors">
                              <td className="px-4 p-2 pl-8 border-l-2 border-slate-100">
                                <div className="flex items-center gap-2">
                                  <GitBranch size={10} className="text-slate-400" />
                                  <span className="text-[11px] text-slate-600 italic">
                                    {sa.description || sa.component_code}
                                  </span>
                                  <span className="px-1 py-0.5 rounded text-[9px] bg-blue-50 text-blue-600 border border-blue-100">
                                    SA
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 p-2 text-center">
                                <span className="text-[11px] text-slate-500">
                                  {(parseFloat(sa.quantity || sa.qty || 0) * parseFloat(item.item_qty || item.design_qty || 0)).toFixed(2)}
                                </span>
                              </td>
                              <td className="px-4 p-2">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[11px] text-slate-500 italic">
                                    {formatCurrency(sa.rate || sa.bom_cost || 0)}
                                  </span>
                                  {sa.pending_bom_cost && (
                                    <div className="flex items-center gap-1.5 animate-in slide-in-from-left duration-300">
                                      <div className="p-0.5 bg-rose-50 text-rose-600 rounded border border-rose-100 flex items-center gap-1" title="New BOM Update Requested">
                                        <ArrowUpRight size={8} className={sa.pending_bom_cost > (sa.rate || sa.bom_cost) ? 'text-rose-500' : 'rotate-90 text-emerald-500'} />
                                        <span className="text-[9px] ">{formatCurrency(sa.pending_bom_cost)}</span>
                                      </div>
                                      <button
                                        onClick={() => handleApplyPendingBOM(group, sa)}
                                        className="p-1 bg-rose-600 text-white rounded hover:bg-rose-700 shadow-sm transition-all active:scale-90"
                                        title="Apply this new BOM cost and REVISE quotation"
                                      >
                                        <CheckCheck size={8} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                              {isPending ? (
                                <td colSpan={4} className="bg-slate-50/5"></td>
                              ) : (
                                <td colSpan={2} className="bg-slate-50/5"></td>
                              )}
                            </tr>
                          )) : [];

                          return [mainRow, ...subRows];
                        })}
                      </React.Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
          {isPending && (
            <div className="p-6 bg-white border-t border-slate-100 flex flex-col items-end gap-2">
              {(() => {
                let subTotal = 0;
                let totalTax = 0;
                let totalProfit = 0;

                (group.quotes || []).forEach(item => {
                  const g = (item.item_group || item.item_group_calc || '').toUpperCase();
                  const isSA = (g.includes('SA') || g.includes('SUB') || g.includes('ASSEMBLY')) && !g.includes('FG');
                  const isFG = (g.includes('FG') || g.includes('FINISHED')) && !isSA;

                  if (isFG) {
                    const unitRate = parseFloat(quotePricesMap[group.company_name]?.[item.id]) || 0;
                    const qty = parseFloat(item.design_qty) || 0;
                    const gstRate = parseFloat(gstMap[group.company_name]?.[item.id]) || 18;
                    const profitP = parseFloat(profitMap[group.company_name]?.[item.id]) || 0;
                    const lineTotal = unitRate * qty;
                    
                    subTotal += lineTotal;
                    totalTax += lineTotal * (gstRate / 100);
                    const basePrice = unitRate / (1 + profitP / 100);
                    totalProfit += (unitRate - basePrice) * qty;
                  }
                });

                return (
                  <>
                    <div className="space-y-1 w-72">
                      <div className="flex justify-between text-xs ">
                        <span className="text-slate-500">Sub Total:</span>
                        <span className="text-slate-900">{formatCurrency(subTotal)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-indigo-600">
                        <span>Est. Profit:</span>
                        <span>{formatCurrency(totalProfit)}</span>
                      </div>
                      <div className="flex justify-between text-xs ">
                        <span className="text-slate-500">Tax (GST):</span>
                        <span className="text-slate-900">{formatCurrency(totalTax)}</span>
                      </div>
                      <div className="flex justify-between pt-2 mt-2 border-t border-slate-200">
                        <span className="text-xs text-slate-900">Grand Total:</span>
                        <span className="text-xl text-indigo-600">{formatCurrency(subTotal + totalTax)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSendQuote(group.company_name)}
                      disabled={(subTotal + totalTax) === 0}
                      className="mt-2  flex justify-center items-center gap-2 p-2 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-95"
                    >
                      <Save className="w-4 h-4" />
                      Create Quotation
                    </button>
                  </>
                );
              })()}
            </div>
          )}
          {!isPending && (
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <div className="text-xs text-slate-500">
                <span className="">Summary:</span> {(group.quotes || []).length} items included in this quotation set.
              </div>
              <div className="flex gap-4 text-xs">
                <div className="flex flex-col items-end">
                  <span className="text-slate-400">Base Amount</span>
                  <span className="text-slate-900 ">{formatCurrency(group.total_amount)}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-slate-400">Total (Incl. GST)</span>
                  <span className="text-indigo-600 ">{formatCurrency(group.received_amount > 0 ? group.received_amount : group.total_amount * 1.18)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handlePriceChange = (clientName, item, price) => {
    const rate = parseFloat(price) || 0;
    const bomCost = parseFloat(item.bom_cost) || 0;
    let profit = 0;
    if (bomCost > 0) {
      profit = ((rate / bomCost) - 1) * 100;
    }

    setQuotePricesMap(prev => ({
      ...prev,
      [clientName]: {
        ...prev[clientName],
        [item.id]: price
      }
    }));

    setProfitMap(prev => ({
      ...prev,
      [clientName]: {
        ...prev[clientName],
        [item.id]: profit.toFixed(2)
      }
    }));
  };

  const handleProfitChange = (clientName, item, profitVal) => {
    const profit = parseFloat(profitVal) || 0;
    const bomCost = parseFloat(item.bom_cost) || 0;
    const newRate = (bomCost * (1 + profit / 100)).toFixed(2);
    
    setProfitMap(prev => ({
      ...prev,
      [clientName]: {
        ...prev[clientName],
        [item.id]: profitVal
      }
    }));
    
    setQuotePricesMap(prev => ({
      ...prev,
      [clientName]: {
        ...prev[clientName],
        [item.id]: newRate
      }
    }));
  };

  const handleGstChange = (clientName, itemId, gstVal) => {
    setGstMap(prev => ({
      ...prev,
      [clientName]: {
        ...prev[clientName],
        [itemId]: gstVal
      }
    }));
  };

  const handleSentAmountChange = (key, value) => {
    setEditingSentAmounts(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const saveSentAmount = async (group) => {
    const newAmount = editingSentAmounts[group.uniqueKey];
    if (newAmount === undefined || newAmount === '') return;

    try {
      setSavingSentAmount(group.uniqueKey);
      const token = localStorage.getItem('authToken');
      
      const totalOriginal = group.total_amount;
      const newTotalInclGst = parseFloat(newAmount);
      const newTotalBase = newTotalInclGst / 1.18;
      const quotes = group.quotes || [];
      
      const itemsToUpdate = quotes.map(q => {
        const originalItemTotal = parseFloat(q.total_amount) || 0;
        const itemQty = parseFloat(q.item_qty) || 1;
        
        let newItemTotal;
        if (totalOriginal > 0) {
          newItemTotal = (originalItemTotal / totalOriginal) * newTotalBase;
        } else {
          newItemTotal = newTotalBase / quotes.length;
        }
        
        return {
          id: q.id,
          rate: newItemTotal / itemQty,
          qty: itemQty,
          received_amount: newTotalInclGst / quotes.length
        };
      });

      const response = await fetch(`${API_BASE}/quotation-requests/batch-update-rates`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ items: itemsToUpdate })
      });

      if (response.ok) {
        successToast('Amount updated successfully');
        fetchAllData();
        setEditingSentAmounts(prev => {
          const next = { ...prev };
          delete next[group.uniqueKey];
          return next;
        });
      } else {
        errorToast('Failed to update amount');
      }
    } catch (error) {
      console.error('Error updating amount:', error);
      errorToast('Error updating amount');
    } finally {
      setSavingSentAmount(null);
    }
  };

  const saveItemRate = async (quote) => {
    const newRate = editingItemRates[quote.id];
    if (newRate === undefined || newRate === '') return;

    try {
      setSavingItemRateId(quote.id);
      const token = localStorage.getItem('authToken');
      
      const rateVal = parseFloat(newRate) || 0;
      const qtyVal = parseFloat(quote.item_qty) || 1;
      const totalBase = rateVal * qtyVal;
      const totalInclGst = totalBase * (1 + (parseFloat(quote.gst_percentage) || 18) / 100);

      const itemsToUpdate = [{
        id: quote.id,
        rate: rateVal,
        qty: qtyVal,
        received_amount: totalInclGst
      }];

      const response = await fetch(`${API_BASE}/quotation-requests/batch-update-rates`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ items: itemsToUpdate })
      });

      if (response.ok) {
        successToast('Rate updated successfully');
        fetchAllData();
        setEditingItemRates(prev => {
          const next = { ...prev };
          delete next[quote.id];
          return next;
        });
      } else {
        errorToast('Failed to update rate');
      }
    } catch (error) {
      console.error('Error updating rate:', error);
      errorToast('Error updating rate');
    } finally {
      setSavingItemRateId(null);
    }
  };

  const handleSendQuote = async (clientName) => {
    const clientData = groupedByClient[clientName];
    if (!clientData) return;

    const prices = quotePricesMap[clientName] || {};
    let allItems = [];
    
    clientData.orders.forEach(order => {
      if (order.items) {
        allItems = allItems.concat(order.items);
      }
    });

    const hasPrices = allItems.some(item => item.status !== 'REJECTED' && prices[item.id] && parseFloat(prices[item.id]) > 0);
    if (!hasPrices) {
      errorToast('Please enter quote prices for at least one item');
      return;
    }

    const itemsMissingDesignQty = allItems.filter(item => item.status !== 'REJECTED' && !item.design_qty);
    if (itemsMissingDesignQty.length > 0) {
      errorToast(`Design quantity missing for: ${itemsMissingDesignQty.map(i => i.drawing_no || i.item_code).join(', ')}. Quotation blocked.`);
      return;
    }

    navigate('/quotation-form', { 
      state: { 
        initialData: {
          clientId: clientData.company_id,
          clientName: clientData.company_name,
          clientEmail: clientData.email,
          contact_person: clientData.contact_person,
          phone: clientData.phone,
          address: clientData.address,
          projectName: clientData.orders[0]?.project_name || allItems[0]?.project_name || '',
          items: allItems.map(item => {
            const gsts = gstMap[clientName] || {};
            const itemPrice = parseFloat(prices[item.id]) || 0;
            
            return {
              id: item.id,
              salesOrderItemId: item.id,
              bom_id: item.bom_id,
              revision_no: item.revision_no,
              item_code: item.item_code,
              bom_cost: item.bom_cost,
              orderId: item.sales_order_id, // Link to original sales order
              drawing_id: item.drawing_id,
              drawing_no: item.drawing_no,
              description: item.description,
              quantity: item.design_qty,
              unit: item.unit,
              rate: itemPrice,
              total: item.design_qty * itemPrice,
              item_group: item.item_group || item.item_group_calc,
              item_group_calc: item.item_group_calc,
              gst_percentage: gsts[item.id] || 18,
              status: item.status,
              rejection_reason: item.rejection_reason,
              sub_assemblies: item.sub_assemblies || []
            };
          }),
          notes: `Drawing Numbers: ${[...new Set(allItems.map(i => i.drawing_no))].filter(Boolean).join(', ')}`
        } 
      } 
    });
  };

  const handleUploadReplyPDF = async (group) => {
    const result = await Swal.fire({
      title: 'Upload Reply PDF',
      text: `Select the client's reply PDF for QRT-${String(group.id).padStart(4, '0')}`,
      icon: 'info',
      input: 'file',
      inputAttributes: {
        'accept': 'application/pdf',
        'aria-label': 'Upload reply PDF'
      },
      showCancelButton: true,
      confirmButtonText: 'Upload',
      confirmButtonColor: '#6366f1',
      showLoaderOnConfirm: true,
      preConfirm: (file) => {
        if (!file) {
          Swal.showValidationMessage('Please select a PDF file');
          return false;
        }
        return file;
      }
    });

    if (result.isConfirmed) {
      try {
        const file = result.value;
        const token = localStorage.getItem('authToken');
        const ids = (group.quotes || []).map(q => q.id);
        
        const formData = new FormData();
        formData.append('reply_pdf', file);
        formData.append('ids', JSON.stringify(ids));

        const response = await fetch(`${API_BASE}/quotation-requests/batch-upload-reply`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (response.ok) {
          successToast('Reply PDF uploaded successfully');
          fetchAllData();
        } else {
          const errorData = await response.json();
          errorToast(errorData.error || 'Failed to upload PDF');
        }
      } catch (error) {
        console.error('Error uploading PDF:', error);
        errorToast('Error uploading PDF');
      }
    }
  };

  const handleDeleteApprovedOrders = async (clientName) => {
    const clientData = groupedByClient[clientName];
    if (!clientData) return;

    const result = await Swal.fire({
      title: 'Dismiss Approved Orders',
      html: `
        <div style="text-align: left; font-size: 14px;">
          <p>Are you sure you want to dismiss these approved orders for <strong>${clientData.company_name}</strong>?</p>
          <p style="color: #64748b; margin-top: 12px;">They will be hidden from the quotation pending list but not deleted from the system.</p>
        </div>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Yes, dismiss',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#6366f1'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        let updateCount = 0;

        for (const order of clientData.orders) {
          try {
            const response = await fetch(`${API_BASE}/sales-orders/${order.id}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ status: 'QUOTATION_IGNORED' })
            });

            if (response.ok) {
              updateCount++;
            }
          } catch (err) {
            console.error('Error updating order:', err);
          }
        }

        successToast(`Dismissed ${updateCount} approved orders`);
        setExpandedClientName(null);
        setQuotePricesMap(prev => ({
          ...prev,
          [clientName]: {}
        }));
        fetchApprovedOrders();
      } catch (error) {
        console.error(error);
        errorToast('Failed to dismiss approved orders');
      }
    }
  };

  const handleViewReceived = (group) => {
    // Only get items from the LATEST version in this group
    const latestVersion = group.version || 1;
    const quotes = group?.quotes || [];
    const latestQuotes = quotes.filter(q => (q.version || 1) === latestVersion);
    const firstQuote = latestQuotes[0] || quotes[0];

    navigate('/quotation-form', {
      state: {
        initialData: {
          id: group.id,
          clientId: group.company_id,
          clientName: group.company_name,
          clientEmail: firstQuote?.client_email || '',
          phone: firstQuote?.client_phone || '',
          address: firstQuote?.client_address || '',
          version: group.version || 1,
          parentId: firstQuote?.parent_id || null,
          batchId: group.batch_id || firstQuote?.batch_id || null,
          projectName: group.project_name || '',
          mode: 'received',
          items: latestQuotes.map(q => ({
            id: q.id,
            salesOrderItemId: q.sales_order_item_id,
            item_code: q.item_code,
            orderId: q.sales_order_id,
            drawing_id: q.drawing_id,
            drawing_no: q.drawing_no,
            description: q.item_description,
            quantity: q.item_qty,
            unit: q.item_unit || q.uom || 'Nos',
            rate: q.unit_rate || (parseFloat(q.total_amount) / (parseFloat(q.item_qty) || 1)),
            bom_cost: q.bom_cost || 0,
            gst_percentage: q.gst_percentage || 18,
            item_group: q.item_group,
            status: q.status,
            sub_assemblies: q.sub_assemblies || []
          })),
          notes: firstQuote?.notes || ''
        }
      }
    });
  };

  const handleRevise = (group) => {
    // Only get items from the LATEST version to revise
    const latestVersion = group.version || 1;
    const quotes = group?.quotes || [];
    const latestQuotes = quotes.filter(q => (q.version || 1) === latestVersion);
    const firstQuote = latestQuotes[0] || quotes[0];
    
    navigate('/quotation-form', {
      state: {
        initialData: {
          clientId: group.company_id,
          clientName: group.company_name,
          clientEmail: firstQuote?.client_email || '',
          phone: firstQuote?.client_phone || '',
          address: firstQuote?.client_address || '',
          version: (group.version || 1) + 1,
          parentId: firstQuote?.parent_id || group.id,
          batchId: null, // New version = new batch
          projectName: group.project_name || '',
          mode: 'revise',
          items: latestQuotes.map(q => {
            const bCost = q.bom_cost || 0;
            // Favor BOM cost for revisions to ensure Rate == BOM Cost consistency
            const rRate = bCost || q.unit_rate || (parseFloat(q.total_amount) / (parseFloat(q.item_qty) || 1));

            return {
              id: Date.now() + Math.random(),
              salesOrderItemId: q.sales_order_item_id,
              item_code: q.item_code,
              orderId: q.sales_order_id,
              drawing_id: q.drawing_id,
              drawing_no: q.drawing_no,
              description: q.item_description,
              quantity: q.item_qty,
              unit: q.item_unit || q.uom || 'Nos',
              rate: rRate,
              bom_cost: bCost || rRate,
              gst_percentage: q.gst_percentage || 18,
              item_group: q.item_group,
              status: 'PENDING',
              sub_assemblies: q.sub_assemblies || []
            };
          }),
          notes: firstQuote?.notes || ''
        }
      }
    });
  };

  const handleApplyPendingBOM = async (group, targetItem) => {
    const result = await Swal.fire({
      title: 'Apply New BOM Cost?',
      html: `
        <div style="text-align: left; font-size: 14px;">
          <p>You are about to revise this quotation with the new BOM cost for <strong>${targetItem.description || targetItem.item_code}</strong>.</p>
          <div style="margin-top: 15px; padding: 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>Current BOM Cost:</span>
              <span style="font-weight: 600; color: #64748b;">${formatCurrency(targetItem.bom_cost || targetItem.latest_bom_cost)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>New BOM Cost:</span>
              <span style="font-weight: 700; color: #e11d48;">${formatCurrency(targetItem.pending_bom_cost)}</span>
            </div>
          </div>
          <p style="margin-top: 15px; color: #64748b;">This will open the quotation revision form with the updated costs.</p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Revise Quotation',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#6366f1'
    });

    if (result.isConfirmed) {
      // Find latest version items
      const latestVersion = group.version || 1;
      const quotes = group?.quotes || [];
      const latestQuotes = quotes.filter(q => (q.version || 1) === latestVersion);
      const firstQuote = latestQuotes[0] || quotes[0];

      navigate('/quotation-form', {
        state: {
          initialData: {
            id: group.id,
            clientId: group.company_id,
            clientName: group.company_name,
            clientEmail: firstQuote?.client_email || '',
            phone: firstQuote?.client_phone || '',
            address: firstQuote?.client_address || '',
            version: (group.version || 1) + 1,
            parentId: firstQuote?.parent_id || group.id,
            batchId: null,
            projectName: group.project_name || '',
            mode: 'revise',
            items: latestQuotes.map(q => {
              // Apply pending BOM cost if it's the target item (direct match)
              // OR if the target item is a sub-assembly component of this quote item
              const isTarget = q.id === targetItem.id;
              
              const targetComp = (q.sub_assemblies || []).find(sa => 
                (sa.component_code === targetItem.item_code || sa.component_code === targetItem.component_code) &&
                sa.drawing_no === targetItem.drawing_no
              );

              const newBomCost = isTarget 
                ? targetItem.pending_bom_cost 
                : (q.bom_cost || q.latest_bom_cost || 0);
              
              return {
                id: Date.now() + Math.random(),
                salesOrderItemId: q.sales_order_item_id,
                item_code: q.item_code,
                orderId: q.sales_order_id,
                drawing_id: q.drawing_id,
                drawing_no: q.drawing_no,
                description: q.item_description,
                quantity: q.item_qty,
                unit: q.item_unit || q.uom || 'Nos',
                rate: newBomCost, // Match rate with new BOM cost
                bom_cost: newBomCost,
                gst_percentage: q.gst_percentage || 18,
                item_group: q.item_group,
                status: 'PENDING',
                sub_assemblies: q.sub_assemblies || []
              };
            }),
            notes: firstQuote?.notes || ''
          }
        }
      });
    }
  };

  const handleDownloadPDF = async (group) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotation-requests/download-pdf/${group.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to download PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Quotation_QRT-${String(group.id).padStart(4, '0')}.pdf`;
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

  const handleDeleteSentQuotation = async (group) => {
    if (!group) return;
    const result = await Swal.fire({
      title: 'Delete Quotation',
      text: 'Are you sure you want to delete this quotation history? This will not affect the Sales Order.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const ids = (group.quotes || []).map(q => q.id);
        
        const response = await fetch(`${API_BASE}/quotation-requests/batch-delete`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ids })
        });

        if (response.ok) {
          successToast('Quotation deleted successfully');
          fetchAllData();
        } else {
          errorToast('Failed to delete quotation');
        }
      } catch (error) {
        console.error('Delete error:', error);
        errorToast('Error deleting quotation');
      }
    }
  };

  return (
    <div className="  animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          
          <div>
            <h1 className="text-xl  text-slate-900 ">Client Quotations</h1>
            <p className="text-xs text-slate-500 ">Track all quotations from BOM-approved orders</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/quotation-form')}
            className="p-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded transition-all shadow-md flex items-center gap-2 text-xs"
          >
            <Plus size={15} />
            Create Quotation
          </button>
          
          <button
            onClick={fetchAllData}
            disabled={loading}
            className="p-2 text-slate-500 hover:bg-slate-50 rounded  transition-all border border-slate-200 flex items-center gap-2 text-xs "
          >
            <RotateCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh All
          </button>
        </div>
      </div>

      <Tabs
        tabs={[
          { label: 'Pending Approval', value: 'pending', icon: Clock },
          { label: 'Sent Quotations', value: 'sent', icon: Send },
          { label: 'Received Quotes', value: 'received', icon: History }
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="my-4 border-none px-0"
      />

      <div className="space-y-2">
        <DataTable
          columns={columns}
          data={combinedQuotations}
          loading={loading}
          renderExpanded={renderExpanded}
          onRowClick={(group, e) => {
            // Check if the click was on an interactive element or the expander
            if (e && (e.target.closest('button') || e.target.closest('a') || e.target.closest('input') || e.target.closest('select') || e.target.closest('[data-expander="true"]'))) {
              return;
            }
            if (activeTab === 'received') {
              handleViewReceived(group);
            }
          }}
          emptyMessage="No quotations found"
          disableRowClickExpansion={true}
          className=""
        />
      </div>



        {/* Communication Modal */}
        {showCommDrawer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-6 md:p-10">
            <div 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity duration-300"
              onClick={() => setShowCommDrawer(false)}
            />
            <div className="relative w-full max-w-5xl h-full max-h-[800px] bg-white rounded-2xl shadow-2xl flex overflow-hidden animate-in zoom-in-95 duration-300">
              {/* Left Sidebar - Quote Info */}
              <div className="w-80 bg-slate-50 border-r border-slate-100 flex flex-col hidden md:flex">
                <div className="p-6 border-b border-slate-200/60">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100">
                      <MessageSquare size={20} />
                    </div>
                    <h3 className="text-lg  text-slate-900">Communication</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs   text-slate-400   mb-1">Client</p>
                      <p className="text-sm font-semibold text-slate-700">{selectedQuoteForComm?.company_name}</p>
                    </div>
                    <div>
                      <p className="text-xs   text-slate-400   mb-1">Reference</p>
                      <p className="text-sm font-mono text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md w-fit">
                        QRT-{String(selectedQuoteForComm?.id).padStart(4, '0')}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 p-6 overflow-y-auto">
                  <h4 className="text-xs  text-slate-400   mb-4">Quick Actions</h4>
                  <div className="space-y-2">
                    <button 
                      onClick={handleRefreshMessages}
                      disabled={syncing}
                      className="w-full flex items-center gap-3 p-3 text-slate-600 hover:bg-white hover:text-indigo-600 hover:shadow-md rounded-xl transition-all group"
                    >
                      <RotateCw size={18} className={syncing ? 'animate-spin' : 'group-hover:rotate-180 duration-500'} />
                      <span className="text-sm ">Sync with Email</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Chat Area */}
              <div className="flex-1 flex flex-col bg-white">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="md:hidden p-2 bg-indigo-50 text-indigo-600 rounded">
                      <MessageSquare size={18} />
                    </div>
                    <div>
                      <h3 className=" text-slate-900">{selectedQuoteForComm?.company_name}</h3>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded ${commType === 'CLIENT' ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                        <span className="text-xs   text-slate-400 ">
                          {commType === 'CLIENT' ? 'Active Channel (Client)' : 'Internal Requests'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Tab Selector */}
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => handleCommTypeChange('CLIENT')}
                      className={`px-4 py-1.5 rounded text-xs  transition-all ${
                        commType === 'CLIENT' 
                          ? 'bg-white text-indigo-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Client
                    </button>
                    <button
                      onClick={() => handleCommTypeChange('INTERNAL')}
                      className={`px-4 py-1.5 rounded text-xs  transition-all relative ${
                        commType === 'INTERNAL' 
                          ? 'bg-white text-indigo-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Internal
                      {internalUnreadCounts[selectedQuoteForComm?.id] > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[8px] flex items-center justify-center rounded border-2 border-white">
                          {internalUnreadCounts[selectedQuoteForComm?.id]}
                        </span>
                      )}
                    </button>
                  </div>

                  <button 
                    onClick={() => setShowCommDrawer(false)}
                    className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-10">
                      <div className="w-20 h-20 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center mb-4">
                        <Mail className="w-10 h-10 text-slate-200" />
                      </div>
                      <h4 className="text-lg  text-slate-900 mb-2">No conversations yet</h4>
                      <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
                        {commType === 'CLIENT' 
                          ? `Start a conversation with ${selectedQuoteForComm?.company_name} regarding this quotation.`
                          : 'No internal requests or notes found for this quotation.'}
                      </p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      const isClient = msg.sender_type === 'CLIENT';
                      const isSystem = msg.sender_type === 'SYSTEM';
                      const isInternal = msg.sender_type === 'INTERNAL';
                      
                      return (
                        <div key={idx} className={`flex ${isClient ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                          <div className={`max-w-[80%] flex flex-col ${isClient ? 'items-start' : 'items-end'}`}>
                            <div className={`flex items-center gap-2 mb-1.5 ${isClient ? 'flex-row' : 'flex-row-reverse'}`}>
                              <span className={`text-xs     ${
                                isClient ? 'text-slate-400' : isSystem ? 'text-amber-500' : 'text-indigo-400'
                              }`}>
                                {isClient ? 'Client' : isSystem ? 'System Notification' : 'Internal Team'}
                              </span>
                              <span className="text-xs  text-slate-300">•</span>
                              <span className="text-xs  text-slate-400">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className={`p-4 rounded-2xl shadow-sm ${
                              isClient 
                                ? 'bg-white text-slate-700 rounded-tl-none border border-slate-100' 
                                : isSystem
                                  ? 'bg-amber-50 text-amber-900 border border-amber-100 rounded-tr-none'
                                  : 'bg-indigo-600 text-white rounded-tr-none'
                            }`}>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                            </div>
                            {!isClient && !isSystem && (
                              <div className="flex items-center gap-1 mt-1.5">
                                <CheckCheck size={12} className="text-indigo-400" />
                                <span className="text-xs   text-slate-400 ">Sent</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-6 bg-white border-t border-slate-100">
                  <form onSubmit={handleSendMessage} className="relative">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message here..."
                      className="w-full bg-slate-50 border-0 rounded-2xl p-4 pr-16 text-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all resize-none min-h-[100px]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim() || sendingMsg}
                      className="absolute bottom-4 right-4 p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all active:scale-90"
                    >
                      {sendingMsg ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <Send size={20} />
                      )}
                    </button>
                  </form>
                  <p className="mt-3 text-xs  text-center text-slate-400 ">
                    Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-sans">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-sans">Shift+Enter</kbd> for new line.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default ClientQuotations;
