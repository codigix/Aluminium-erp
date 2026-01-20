import { Card } from '../components/ui.jsx';
import { Beaker, Clock, XCircle } from 'lucide-react';

const QualityRejections = () => {
  return (
    <div className="space-y-3">
      <Card title="Quality Rejections" subtitle="Analysis and tracking of non-conforming materials and products">
        <div className="flex flex-col items-center justify-center py-24 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <div className="relative mb-4">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
              <XCircle className="w-8 h-8" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-lg shadow-sm border border-slate-100">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          <h3 className="text-slate-900 font-bold">Quality Rejections</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-xs text-center">
            The non-conformance tracking and rejection analysis module is currently under development.
          </p>
          <div className="mt-6 px-4 py-1.5 bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-widest rounded-full border border-red-200">
            Feature Coming Soon
          </div>
        </div>
      </Card>
    </div>
  );
};

export default QualityRejections;
