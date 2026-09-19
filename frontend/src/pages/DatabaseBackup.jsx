import React, { useState, useEffect, useCallback } from 'react';
import {
  Database, Download, Trash2, RefreshCw, Play, Shield,
  CheckCircle2, XCircle, Clock, HardDrive, Calendar,
  AlertTriangle, Settings, ChevronRight, RotateCcw, Info,
  Loader2, ServerCrash, Zap, Archive
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken') || localStorage.getItem('token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
};

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const getAgeLabel = (days) => {
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusPill = ({ status }) => {
  const map = {
    success: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Success' },
    failed:  { bg: 'bg-rose-100',    text: 'text-rose-700',    dot: 'bg-rose-500',    label: 'Failed'  },
    running: { bg: 'bg-indigo-100',  text: 'text-indigo-700',  dot: 'bg-indigo-500',  label: 'Running' },
  };
  const s = map[status] || map.success;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${status === 'running' ? 'animate-pulse' : ''}`} />
      {s.label}
    </span>
  );
};

const StatCard = ({ icon: Icon, label, value, sub, color = 'indigo', loading }) => {
  const colors = {
    indigo:  { bg: 'bg-indigo-50',  icon: 'text-indigo-600',  border: 'border-indigo-100' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100' },
    amber:   { bg: 'bg-amber-50',   icon: 'text-amber-600',   border: 'border-amber-100' },
    slate:   { bg: 'bg-slate-50',   icon: 'text-slate-600',   border: 'border-slate-200' },
  };
  const c = colors[color] || colors.indigo;
  return (
    <div className={`bg-white rounded-2xl border ${c.border} p-5 shadow-sm hover:shadow-md transition-all duration-200`}>
      <div className="flex items-start justify-between">
        <div className={`${c.bg} p-3 rounded-xl`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
      </div>
      <div className="mt-4">
        {loading ? (
          <div className="h-7 w-24 bg-slate-100 rounded animate-pulse" />
        ) : (
          <div className="text-2xl font-bold text-slate-800 tracking-tight">{value}</div>
        )}
        <div className="text-sm text-slate-500 mt-0.5 font-medium">{label}</div>
        {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
      </div>
    </div>
  );
};

// ─── Confirm Modal ─────────────────────────────────────────────────────────────
const ConfirmModal = ({ isOpen, type, filename, onConfirm, onCancel, loading }) => {
  if (!isOpen) return null;
  const isRestore = type === 'restore';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in">
        <div className={`w-14 h-14 rounded-2xl ${isRestore ? 'bg-amber-100' : 'bg-rose-100'} flex items-center justify-center mb-4`}>
          {isRestore
            ? <AlertTriangle className="w-7 h-7 text-amber-600" />
            : <Trash2 className="w-7 h-7 text-rose-600" />
          }
        </div>

        <h3 className="text-lg font-bold text-slate-800 mb-2">
          {isRestore ? 'Restore Database?' : 'Delete Backup?'}
        </h3>

        {isRestore ? (
          <div className="space-y-3 mb-6">
            <p className="text-sm text-slate-600">
              You are about to restore the database from:
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <code className="text-xs font-mono text-amber-800 break-all">{filename}</code>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700 font-medium">
                <strong>Warning:</strong> This will overwrite the current database with the backup data. This action cannot be undone.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            <p className="text-sm text-slate-600">
              Permanently delete this backup file?
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <code className="text-xs font-mono text-slate-700 break-all">{filename}</code>
            </div>
            <p className="text-xs text-slate-500">This action cannot be undone.</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm text-white transition-colors flex items-center justify-center gap-2
              ${isRestore ? 'bg-amber-500 hover:bg-amber-600' : 'bg-rose-500 hover:bg-rose-600'}
              ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              : isRestore ? 'Yes, Restore' : 'Yes, Delete'
            }
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
const DatabaseBackup = () => {
  const [backups, setBackups]           = useState([]);
  const [config, setConfig]             = useState(null);
  const [summary, setSummary]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [triggering, setTriggering]     = useState(false);
  const [toast, setToast]               = useState(null);
  const [modal, setModal]               = useState({ open: false, type: null, filename: null });
  const [actionLoading, setActionLoading] = useState(false);

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // ── Fetch data ────────────────────────────────────────────────────────────
  const fetchBackups = useCallback(async () => {
    try {
      const [listRes, cfgRes] = await Promise.all([
        fetch(`${API_BASE}/api/backups`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/api/backups/config`, { headers: getAuthHeaders() }),
      ]);

      const listData = await listRes.json();
      const cfgData  = await cfgRes.json();

      if (listData.success) {
        setBackups(listData.files || []);
        setSummary({
          total: listData.total,
          totalSize: listData.totalSizeFormatted,
          maxCount: listData.maxCount,
          backupDir: listData.backupDir,
        });
      }
      if (cfgData.success) {
        setConfig(cfgData.config);
      }
    } catch (err) {
      console.error('Fetch backups error:', err);
      showToast('Failed to load backup data.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBackups(); }, [fetchBackups]);

  // ── Manual trigger ────────────────────────────────────────────────────────
  const handleTrigger = async () => {
    setTriggering(true);
    try {
      const res  = await fetch(`${API_BASE}/api/backups/trigger`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Backup created: ${data.filename} (${data.size})`, 'success');
        fetchBackups();
      } else {
        showToast(`❌ Backup failed: ${data.error || data.message}`, 'error');
      }
    } catch (err) {
      showToast('Network error while triggering backup.', 'error');
    } finally {
      setTriggering(false);
    }
  };

  // ── Download ──────────────────────────────────────────────────────────────
  const handleDownload = (filename) => {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    const url   = `${API_BASE}/api/backups/${encodeURIComponent(filename)}/download`;

    // Use fetch + blob to properly handle auth header
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        showToast(`Downloaded: ${filename}`, 'success');
      })
      .catch(() => showToast('Download failed.', 'error'));
  };

  // ── Modal actions ─────────────────────────────────────────────────────────
  const openModal = (type, filename) => setModal({ open: true, type, filename });
  const closeModal = () => setModal({ open: false, type: null, filename: null });

  const handleModalConfirm = async () => {
    setActionLoading(true);
    const { type, filename } = modal;

    try {
      let res, data;
      if (type === 'restore') {
        res  = await fetch(`${API_BASE}/api/backups/${encodeURIComponent(filename)}/restore`, {
          method: 'POST', headers: getAuthHeaders(),
        });
      } else {
        res  = await fetch(`${API_BASE}/api/backups/${encodeURIComponent(filename)}`, {
          method: 'DELETE', headers: getAuthHeaders(),
        });
      }
      data = await res.json();

      if (data.success) {
        showToast(data.message, 'success');
        fetchBackups();
      } else {
        showToast(data.error || 'Operation failed.', 'error');
      }
    } catch (err) {
      showToast('Network error.', 'error');
    } finally {
      setActionLoading(false);
      closeModal();
    }
  };

  // ── Calculated values ─────────────────────────────────────────────────────
  const lastBackup  = backups[0] || null;
  const nextRunText = config?.cronHuman || 'Daily at 2:00 AM';

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 max-w-sm px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold transition-all duration-300
          ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            : <XCircle className="w-4 h-4 flex-shrink-0" />
          }
          {toast.message}
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={modal.open}
        type={modal.type}
        filename={modal.filename}
        onConfirm={handleModalConfirm}
        onCancel={closeModal}
        loading={actionLoading}
      />

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 bg-indigo-600 rounded-xl">
                <Database className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800">Database Backup</h1>
            </div>
            <p className="text-slate-500 text-sm ml-11">
              Automated daily backups · Admin access only
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchBackups}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              id="btn-run-backup-now"
              onClick={handleTrigger}
              disabled={triggering}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white shadow-md transition-all duration-200
                ${triggering
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg active:scale-95'
                }`}
            >
              {triggering
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Running Backup...</>
                : <><Play className="w-4 h-4" /> Run Backup Now</>
              }
            </button>
          </div>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={CheckCircle2}
            label="Last Backup"
            value={lastBackup ? formatDate(lastBackup.createdAt).split(',')[0] : 'Never'}
            sub={lastBackup ? formatDate(lastBackup.createdAt).split(',').slice(1).join(',').trim() : '—'}
            color="emerald"
            loading={loading}
          />
          <StatCard
            icon={Clock}
            label="Next Scheduled"
            value={nextRunText}
            sub="Auto-runs every day"
            color="indigo"
            loading={loading}
          />
          <StatCard
            icon={Archive}
            label="Total Backups"
            value={loading ? '—' : `${summary?.total || 0} files`}
            sub={summary?.totalSize ? `Total: ${summary.totalSize}` : '0 B'}
            color="amber"
            loading={loading}
          />
          <StatCard
            icon={Shield}
            label="Max Backups Kept"
            value={loading ? '—' : `${summary?.maxCount || 30} Files`}
            sub="Always keeps latest 30"
            color="slate"
            loading={loading}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Backup History Table ─────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-800 text-base">Backup History</h2>
                  <p className="text-xs text-slate-500 mt-0.5">All available backup files</p>
                </div>
                <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                  {backups.length} files
                </span>
              </div>

              {loading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : backups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                    <ServerCrash className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="font-semibold text-slate-600 mb-1">No backups found</p>
                  <p className="text-sm text-slate-400 max-w-xs">
                    Click <strong>"Run Backup Now"</strong> to create your first backup, or wait for the scheduled 2:00 AM run.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {backups.map((file, idx) => (
                    <div
                      key={file.filename}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors"
                    >
                      {/* Index + icon */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                        ${idx === 0 ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                        <Database className={`w-4 h-4 ${idx === 0 ? 'text-emerald-600' : 'text-slate-500'}`} />
                      </div>

                      {/* Filename + date */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate font-mono">
                          {file.filename}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-slate-400">
                            {formatDate(file.createdAt)}
                          </span>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs text-slate-400">{file.sizeFormatted}</span>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs text-slate-400">{getAgeLabel(file.ageDays)}</span>
                        </div>
                      </div>

                      {idx === 0 && (
                        <StatusPill status="success" />
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          id={`btn-download-${file.filename}`}
                          onClick={() => handleDownload(file.filename)}
                          className="p-2 rounded-lg hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          id={`btn-restore-${file.filename}`}
                          onClick={() => openModal('restore', file.filename)}
                          className="p-2 rounded-lg hover:bg-amber-50 text-slate-500 hover:text-amber-600 transition-colors"
                          title="Restore"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          id={`btn-delete-${file.filename}`}
                          onClick={() => openModal('delete', file.filename)}
                          className="p-2 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right Panel ──────────────────────────────────────────────── */}
          <div className="space-y-6">

            {/* Config Card */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-500" />
                <h2 className="font-bold text-slate-800 text-sm">Backup Configuration</h2>
              </div>
              <div className="p-5 space-y-4">
                {loading ? (
                  <div className="space-y-3">
                    {[1,2,3,4].map(i => <div key={i} className="h-8 bg-slate-50 rounded animate-pulse" />)}
                  </div>
                ) : config ? (
                  <>
                    <ConfigRow icon={Calendar} label="Schedule" value={config.cronHuman || 'Daily at 2:00 AM'} />
                    <ConfigRow icon={Shield}   label="Max Backups" value={`${config.maxCount || 30} files`} />
                    <ConfigRow icon={Database} label="Database" value={config.database || '—'} />
                    <ConfigRow icon={HardDrive} label="Backup Folder"
                      value={config.backupDir ? config.backupDir.split(/[\\/]/).pop() + '/' : '—'}
                      tooltip={config.backupDir}
                    />
                    <ConfigRow icon={Zap} label="Admin Email" value={config.adminEmail || '—'} />
                  </>
                ) : (
                  <p className="text-xs text-slate-400">Config unavailable.</p>
                )}
              </div>
            </div>

            {/* Info / Tips Card */}
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-5 text-white shadow-md">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 opacity-80" />
                <h3 className="font-bold text-sm">How Backups Work</h3>
              </div>
              <ul className="space-y-2 text-xs text-indigo-100">
                {[
                  'Create new backup daily at 2:00 AM',
                  'Uses mysqldump for full database export',
                  'Files named with date & time stamp',
                  'Keeps latest 30 backups (rolling)',
                  'Oldest backup auto-deleted when limit reached',
                  'Admin email sent if backup fails',
                  'Only SYS_ADMIN can manage backups',
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <ChevronRight className="w-3 h-3 mt-0.5 opacity-60 flex-shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

// Small config row helper
const ConfigRow = ({ icon: Icon, label, value, tooltip }) => (
  <div className="flex items-start justify-between gap-2">
    <div className="flex items-center gap-2 text-slate-500 flex-shrink-0">
      <Icon className="w-3.5 h-3.5" />
      <span className="text-xs font-medium">{label}</span>
    </div>
    <span
      className="text-xs font-semibold text-slate-700 text-right max-w-[140px] truncate"
      title={tooltip || value}
    >
      {value}
    </span>
  </div>
);

export default DatabaseBackup;
