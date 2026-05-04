const pool = require('../config/db');

const getMachineAnalysisStats = async () => {
  // 1. Core Metrics (KPIs)
  const oee = 29.05;
  const performance = 29.05;
  const availability = 34.25;
  const quality = 34.24;
  const operationalStatus = 23;

  // 2. Asset Health Spread (Donut Chart)
  const assetHealth = {
    total: 23,
    active: 18,
    idle: 5
  };

  // 3. Temporal Asset Analysis (Bar Chart - Top 10)
  const temporalAnalysis = [
    { name: 'Cupola Furnace', productive: 58, idle: 42 },
    { name: 'Crucible Furnace', productive: 62, idle: 38 },
    { name: 'Sand Mixer', productive: 45, idle: 55 },
    { name: 'Sand Muller', productive: 52, idle: 48 },
    { name: 'Core Shooter Machine', productive: 60, idle: 40 },
    { name: 'Moulding Machine (Manual)', productive: 55, idle: 45 },
    { name: 'Pouring Station (Manual)', productive: 68, idle: 32 }
  ];

  // 4. Multi-Factor Efficiency Stream (Line Chart)
  // Generating daily data for the last 30 days
  const efficiencyStream = [];
  const now = new Date();
  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Simulate some realistic volatility
    const base = 80 + Math.sin(i * 0.5) * 20;
    efficiencyStream.push({
      name: dateStr,
      oeeScore: Math.round(base),
      availability: Math.round(95 + Math.cos(i * 0.3) * 5),
      performance: Math.round(base - 5 + Math.random() * 10),
      quality: Math.round(98 + Math.random() * 2)
    });
  }

  return {
    kpis: {
      oee,
      performance,
      availability,
      quality,
      operationalStatus
    },
    assetHealth,
    temporalAnalysis,
    efficiencyStream,
    lastSync: new Date().toISOString()
  };
};

module.exports = {
  getMachineAnalysisStats
};
