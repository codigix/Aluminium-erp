import { Card } from '../components/ui.jsx';

const IncomingQC = () => {
  return (
    <div className="space-y-6">
      <Card title="Incoming QC" subtitle="Quality verification for incoming materials and components">
        <div className="text-center py-12">
          <p className="text-slate-500 italic">Incoming Quality Control module initialized</p>
        </div>
      </Card>
    </div>
  );
};

export default IncomingQC;
