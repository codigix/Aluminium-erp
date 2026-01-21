import React from 'react';
import { Card } from '../components/ui.jsx';

const WorkOrder = () => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Work Order</h2>
      </div>
      <Card>
        <div className="p-8 text-center text-slate-500">
          Work Order module content will be implemented here.
        </div>
      </Card>
    </div>
  );
};

export default WorkOrder;
