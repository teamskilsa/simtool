// Barrel — only the real, in-use exports. The legacy EnbStats / EnbTestPage
// test pages were removed; the live entry point is EnbMonitoringDashboard
// (rendered by /stats).
export { EnbMonitoringDashboard } from './EnbMonitoringDashboard';
export { EnbStatsView } from './EnbStatsView';
export { PerformanceView, DetailedStatsView } from './StatsViews';
export { DashboardSettings } from './DashboardComponents';
