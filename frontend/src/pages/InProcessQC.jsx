import { Card } from '../components/ui.jsx';
import { Beaker, Clock } from 'lucide-react';

const InProcessQC = () => {
  return (
    <div className="space-y-3">
      <Card title="In-Process QC" subtitle="Real-time production quality monitoring and line inspections">
        <div className="flex flex-col items-center justify-center py-24 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <div className="relative mb-4">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <Beaker className="w-8 h-8" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-lg shadow-sm border border-slate-100">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          <h3 className="text-slate-900 ">In-Process Quality Control</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-xs text-center">
            The real-time production monitoring module is currently under development.
          </p>
          <div className="mt-6 px-4 py-1.5 bg-emerald-100 text-emerald-700 text-[10px]    rounded-full border border-emerald-200">
            Feature Coming Soon
          </div>
        </div>
      </Card>
    </div>
  );
};

export default InProcessQC;

