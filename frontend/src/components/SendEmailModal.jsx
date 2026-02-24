import React, { useState, useEffect } from 'react';
import { errorToast, successToast } from '../utils/toast';

const SendEmailModal = ({ isOpen, onClose, data, onSend, title, subTitle, attachmentName }) => {
  const [emailData, setEmailData] = useState({
    to: '',
    subject: '',
    message: '',
    attachPDF: true
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && data) {
      setEmailData({
        to: data.to || '',
        subject: data.subject || '',
        message: data.message || '',
        attachPDF: true
      });
    }
  }, [isOpen, data]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!emailData.to) {
      errorToast('Recipient email is required');
      return;
    }

    setLoading(true);
    try {
      await onSend(emailData);
      onClose();
    } catch (error) {
      console.error('Error sending email:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl my-auto animate-in fade-in zoom-in duration-200 overflow-hidden border border-slate-100">
        <div className="flex justify-between items-center p-6 border-b border-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M1.946 9.315c-.522-.174-.527-.455.01-.634l19.087-6.362c.529-.176.832.12.684.638l-5.454 19.086c-.15.529-.455.547-.679.045L12 14l6-8-8 6-8.054-2.685z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">{title || 'Send Email'}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{subTitle}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Recipient Email *</label>
              <input
                type="email"
                value={emailData.to}
                onChange={(e) => setEmailData({...emailData, to: e.target.value})}
                placeholder="recipient@example.com"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Subject</label>
              <input
                type="text"
                value={emailData.subject}
                onChange={(e) => setEmailData({...emailData, subject: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Message</label>
              <textarea
                value={emailData.message}
                onChange={(e) => setEmailData({...emailData, message: e.target.value})}
                rows="5"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                required
              />
            </div>

            {attachmentName && (
              <div className="flex items-center gap-3 p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                <div className="p-2 bg-emerald-500 text-white rounded-lg">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Attachment</p>
                  <p className="text-xs font-bold text-emerald-600">{attachmentName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="attachPDF"
                    checked={emailData.attachPDF}
                    onChange={(e) => setEmailData({...emailData, attachPDF: e.target.checked})}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <label htmlFor="attachPDF" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Include</label>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Sending...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M1.946 9.315c-.522-.174-.527-.455.01-.634l19.087-6.362c.529-.176.832.12.684.638l-5.454 19.086c-.15.529-.455.547-.679.045L12 14l6-8-8 6-8.054-2.685z" /></svg>
                  Send Email
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SendEmailModal;
