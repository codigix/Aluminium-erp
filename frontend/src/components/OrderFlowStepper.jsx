import React from 'react';
import { FLOW_STAGES, getSalesOrderStatusInfo, normalizeSalesOrderStatus } from '../constants/workflow';

// Compact Sales -> Accounts progress indicator for a sales order.
// Done stages are filled, the current one is highlighted, later ones are grey.
const OrderFlowStepper = ({ status }) => {
  const info = getSalesOrderStatusInfo(status);
  if (normalizeSalesOrderStatus(status) === 'CANCELLED') {
    return <span className="text-[10px] text-rose-500 uppercase tracking-wide">Cancelled</span>;
  }
  const currentIndex = FLOW_STAGES.findIndex(stage => stage.key === info.stage);

  return (
    <div className="flex items-center gap-1" title={`${info.label} (${FLOW_STAGES[currentIndex]?.label || ''})`}>
      {FLOW_STAGES.map((stage, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
        return (
          <div key={stage.key} className="flex items-center gap-1">
            <span
              className={`block h-1.5 rounded-full ${
                state === 'done' ? 'w-4 bg-emerald-500' : state === 'current' ? 'w-6 bg-indigo-600' : 'w-4 bg-slate-200'
              }`}
              title={stage.label}
            />
          </div>
        );
      })}
      <span className="ml-1 text-[10px] text-slate-500 whitespace-nowrap">{FLOW_STAGES[currentIndex]?.label}</span>
    </div>
  );
};

export default OrderFlowStepper;
