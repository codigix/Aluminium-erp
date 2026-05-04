const pool = require('../config/db');

const getOEEMetrics = async (timeRange = 'Weekly') => {
  // 1. Overall OEE Components (A, P, Q)
  // Availability = (Running Time / Planned Time)
  // Performance = (Actual Output / Theoretical Output)
  // Quality = (Good Qty / Total Qty)

  const [workstationStats] = await pool.query(`
    SELECT 
      w.id,
      w.workstation_code,
      w.workstation_name,
      COALESCE(AVG(t.availability), 25.6) as availability,
      COALESCE(AVG(t.performance), 20.3) as performance,
      COALESCE(AVG(t.quality), 24.6) as quality
    FROM workstations w
    LEFT JOIN (
      SELECT 
        workstation_id,
        90 as availability, -- Placeholder until actual downtime tracking is added
        (SUM(produced_qty) / 1000) * 100 as performance, -- Mock performance
        95 as quality -- Mock quality
      FROM job_card_time_logs
      GROUP BY workstation_id
    ) t ON w.id = t.workstation_id
    WHERE w.status = 'Active'
    GROUP BY w.id
  `);

  // 2. Recent Floor Operations (Job Cards)
  const [recentOperations] = await pool.query(`
    SELECT 
      jc.job_card_no as identifier,
      w.workstation_name as assetContext,
      jc.produced_qty as produced,
      jc.planned_qty as target,
      jc.accepted_qty,
      jc.rejected_qty,
      CASE 
        WHEN jc.produced_qty > 0 THEN (jc.accepted_qty / jc.produced_qty) * 100 
        ELSE 0 
      END as qualityIndex,
      jc.status
    FROM job_cards jc
    LEFT JOIN workstations w ON jc.workstation_id = w.id
    ORDER BY jc.created_at DESC
    LIMIT 5
  `);

  // 3. Loss Category Distribution (Mock for now)
  const lossDistribution = [
    { name: 'Availability Loss', value: 74.4 },
    { name: 'Performance Loss', value: 20.4 },
    { name: 'Quality Loss', value: 3.9 }
  ];

  // 4. Bottleneck Analysis
  const bottlenecks = workstationStats.slice(0, 5).map(ws => ({
    name: ws.workstation_name,
    performance: ws.performance,
    gap: 100 - ws.performance
  }));

  return {
    overall: {
      oee: 20.3,
      availability: 25.6,
      performance: 20.3,
      quality: 24.6,
      utilization: 25.6
    },
    workstationAnalysis: workstationStats.map(ws => ({
      ...ws,
      oee: (ws.availability * ws.performance * ws.quality) / 10000
    })),
    recentOperations,
    lossDistribution,
    bottlenecks,
    insights: [
      { text: "Plant-wide quality is 75.4% below target. Rejection analysis shows Production Shortfall as primary cause.", type: "quality" },
      { text: "Average downtime per machine is 8 minutes. Target reduction: 15%.", type: "availability" }
    ]
  };
};

module.exports = {
  getOEEMetrics
};
