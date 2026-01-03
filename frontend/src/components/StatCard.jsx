const StatCard = ({ label, value, helper, trend }) => (
  <div className="stat-card">
    <p>{label}</p>
    <h2>{value}</h2>
    {helper && <span>{helper}</span>}
    {trend && <span className={`trend ${trend > 0 ? 'up' : trend < 0 ? 'down' : 'steady'}`}>{trend > 0 ? `▲ ${trend}%` : trend < 0 ? `▼ ${Math.abs(trend)}%` : '—'}</span>}
  </div>
)

export default StatCard
