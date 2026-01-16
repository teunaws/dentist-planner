// @ts-nocheck
import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  Calendar,
  Mail,
  Phone,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  UserX,
} from 'lucide-react'
import { GlassCard } from '../../components/ui/GlassCard'
import { GlassButton } from '../../components/ui/GlassButton'
import { useTenant } from '../../context/TenantContext'
import { useAuthStore } from '../../store/authStore'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <GlassCard className="p-2 text-xs shadow-lg bg-white border border-slate-200">
        <p className="mb-1 font-semibold text-slate-900">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-slate-600">
            {entry.name}: <span className="font-semibold">{entry.value}</span>
          </p>
        ))}
      </GlassCard>
    )
  }
  return null
}

export const AnalyticsDashboard = () => {
  const { user } = useAuthStore()
  const { slug, config, analyticsData, isAnalyticsLoading, refreshAnalytics } = useTenant()
  const { tenant } = useParams()

  // Stale-While-Revalidate: Trigger background refresh if data is stale
  useEffect(() => {
    // Only refresh if we don't have data yet (first load)
    // If we have cached data, it will render immediately while refresh happens in background
    if (!analyticsData && config?.id) {
      refreshAnalytics()
    }
  }, [analyticsData, config?.id, refreshAnalytics])

  if (!user || user.role !== 'dentist') {
    const tenantSlug = slug || tenant || 'lumina'
    return <Navigate to={`/${tenantSlug}/login`} replace />
  }

  // Only show spinner if we have absolutely NO data to show AND we're loading
  if (!analyticsData && isAnalyticsLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <GlassCard className="text-center text-slate-600">
          <p className="text-sm">Loading analytics...</p>
        </GlassCard>
      </div>
    )
  }

  // If we have no data and not loading, show empty state
  if (!analyticsData) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <GlassCard className="text-center text-slate-600">
          <p className="text-sm">No analytics data available</p>
        </GlassCard>
      </div>
    )
  }

  // Use cached data from context
  const analytics = analyticsData

  const totalPatients = analytics.newVsReturning.reduce((sum, m) => sum + m.new + m.returning, 0)
  const avgMonthlyPatients = Math.round(totalPatients / 6)

  // Transform data for chart
  const chartData = analytics.newVsReturning.map((item) => ({
    month: item.month,
    total: item.new + item.returning,
    new: item.new,
    returning: item.returning,
  }))

  // Calculate max value for Y-axis
  const maxValue = Math.max(...chartData.map((d) => d.total), 50)
  const yAxisMax = Math.ceil(maxValue / 50) * 50

  // Calculate date range from data or use current year
  const getDateRange = () => {
    if (chartData.length === 0) {
      // If no data, use current year
      const currentYear = new Date().getFullYear()
      return {
        start: `01/01/${currentYear}`,
        end: `12/31/${currentYear}`,
      }
    }

    // Extract dates from month labels (format: "Jan 2024" or "January 2024")
    const months = chartData.map((d) => d.month)
    const dates = months
      .map((month) => {
        // Try to parse month string (e.g., "Jan 2024", "January 2024", "2024-01")
        const dateStr = month.toString()
        // Try different date parsing strategies
        let date: Date | null = null

        // Try parsing as "MMM YYYY" or "MMMM YYYY"
        const monthYearMatch = dateStr.match(/(\w+)\s+(\d{4})/)
        if (monthYearMatch) {
          date = new Date(`${monthYearMatch[1]} 1, ${monthYearMatch[2]}`)
        }

        // Try parsing as "YYYY-MM"
        if (!date || isNaN(date.getTime())) {
          const isoMatch = dateStr.match(/(\d{4})-(\d{2})/)
          if (isoMatch) {
            date = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, 1)
          }
        }

        return date && !isNaN(date.getTime()) ? date : null
      })
      .filter((d): d is Date => d !== null)

    if (dates.length === 0) {
      // Fallback to current year if parsing fails
      const currentYear = new Date().getFullYear()
      return {
        start: `01/01/${currentYear}`,
        end: `12/31/${currentYear}`,
      }
    }

    // Find min and max dates
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))

    // Get the last day of the max month
    const lastDay = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0)

    return {
      start: `${String(minDate.getMonth() + 1).padStart(2, '0')}/${String(minDate.getDate()).padStart(2, '0')}/${minDate.getFullYear()}`,
      end: `${String(lastDay.getMonth() + 1).padStart(2, '0')}/${String(lastDay.getDate()).padStart(2, '0')}/${lastDay.getFullYear()}`,
    }
  }

  const dateRange = getDateRange()

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header Strip */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500">
            <Calendar className="h-4 w-4" />
            <span>{dateRange.start} - {dateRange.end}</span>
          </div>
        </div>
        <GlassButton variant="primary" onClick={() => { console.log('Download report') }}>
          <Download className="mr-2 h-4 w-4" />
          Download Report
        </GlassButton>
      </div>

      {/* Main Content - Fixed Height Container */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden">
        {/* KPI Mega-Card - Reduced Size */}
        <GlassCard className="rounded-3xl p-4 flex-shrink-0">
          {/* Top Row: 4 Equal Sections */}
          <div className="grid grid-cols-4 gap-3 pb-4 border-b border-slate-200">
            {/* No-Show Rate */}
            <div className="pr-3 border-r border-slate-200 last:border-r-0">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                No-Show Rate
              </p>
              <p className="mb-1 text-3xl font-bold text-slate-900">{analytics.noShowRate.value}%</p>
              <div
                className={`flex items-center gap-1 text-xs font-semibold ${analytics.noShowRate.trend === 'down' ? 'text-emerald-500' : 'text-rose-500'
                  }`}
              >
                {analytics.noShowRate.trend === 'down' ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {Math.abs(analytics.noShowRate.value - analytics.noShowRate.previousValue).toFixed(0)}%
              </div>
            </div>

            {/* Patient Recall Rate */}
            <div className="pr-3 border-r border-slate-200 last:border-r-0">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Patient Recall Rate
              </p>
              <p className="mb-1 text-3xl font-bold text-slate-900">{analytics.recallRate.value}%</p>
              <div
                className={`flex items-center gap-1 text-xs font-semibold ${analytics.recallRate.trend === 'up' ? 'text-emerald-500' : 'text-rose-500'
                  }`}
              >
                {analytics.recallRate.trend === 'up' ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {Math.abs(analytics.recallRate.value - analytics.recallRate.previousValue).toFixed(0)}%
              </div>
            </div>

            {/* Total Patients */}
            <div className="pr-3 border-r border-slate-200 last:border-r-0">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Total Patients
              </p>
              <p className="mb-1 text-3xl font-bold text-slate-900">{totalPatients}</p>
              <div className="flex items-center gap-1 text-xs font-semibold text-emerald-500">
                <ArrowUpRight className="h-3 w-3" />
                {Math.round(totalPatients * 0.1).toFixed(0)}%
              </div>
            </div>

            {/* Client Impact Issues */}
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Client Impact Issues
              </p>
              <p className="mb-1 text-3xl font-bold text-slate-900">{analytics.atRiskPatients.length}</p>
              <div className="flex items-center gap-1 text-xs font-semibold text-rose-500">
                <ArrowUpRight className="h-3 w-3" />
                {Math.max(1, Math.round(analytics.atRiskPatients.length * 0.15)).toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Bottom Footer Row: Smaller Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div>
              <p className="mb-1 text-[10px] font-medium text-slate-500">Avg. Monthly Patients</p>
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-bold text-slate-900">{avgMonthlyPatients}</p>
                <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500">
                  <ArrowUpRight className="h-2.5 w-2.5" />
                  {Math.round(avgMonthlyPatients * 0.1).toFixed(0)}%
                </div>
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-medium text-slate-500">Total Appointments</p>
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-bold text-slate-900">{totalPatients}</p>
                <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500">
                  <ArrowUpRight className="h-2.5 w-2.5" />
                  {Math.round(totalPatients * 0.15).toFixed(0)}%
                </div>
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-medium text-slate-500">Market Share</p>
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-bold text-slate-900">7%</p>
                <span className="text-[10px] font-medium text-rose-500">Underperforming</span>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Split View - 50/50 Split */}
        <div className="grid flex-1 gap-4 overflow-hidden lg:grid-cols-2">
          {/* Left: Chart Card */}
          <GlassCard className="rounded-3xl p-6 flex flex-col overflow-hidden">
            <div className="mb-4 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">New vs. Returning Patients</h2>
                <p className="mt-1 text-sm text-slate-500">{dateRange.start} - {dateRange.end}</p>
              </div>
              <button className="text-sm font-medium text-slate-500 hover:text-slate-900 transition">
                View More
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                  barCategoryGap="35%"
                >
                  <defs>
                    <linearGradient id="indigoGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818CF8" stopOpacity={1} />
                      <stop offset="100%" stopColor="#818CF8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="#cbd5e1"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 400 }}
                    interval={0}
                  />
                  <YAxis
                    stroke="#cbd5e1"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 400 }}
                    domain={[0, yAxisMax]}
                    tickCount={6}
                    width={40}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                  <Legend
                    wrapperStyle={{ paddingTop: '15px', color: '#0f172a', fontSize: '12px' }}
                    iconType="square"
                    iconSize={8}
                  />
                  <Bar
                    dataKey="new"
                    stackId="a"
                    fill="url(#indigoGradient)"
                    name="New Patients"
                    radius={[0, 0, 0, 0]}
                    maxBarSize={60}
                  />
                  <Bar
                    dataKey="returning"
                    stackId="a"
                    fill="url(#indigoGradient)"
                    name="Returning Patients"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={60}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Right: At-Risk Patients List - Internal Scroll */}
          <GlassCard className="rounded-3xl p-6 flex flex-col overflow-hidden">
            <div className="mb-4 flex-shrink-0">
              <h2 className="text-xl font-semibold text-slate-900">At-Risk Patients</h2>
              <p className="mt-2 text-xs text-slate-500">
                Patients who haven't visited in 18+ months with no future appointment booked.
              </p>
            </div>
            {analytics.atRiskPatients.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <UserX className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                  <p className="text-sm text-slate-500">No at-risk patients found.</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 space-y-4 overflow-y-auto">
                {analytics.atRiskPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className="flex items-center justify-between gap-4 py-3 transition hover:bg-slate-50 rounded-lg -mx-2 px-2"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 border border-slate-200">
                        <UserX className="h-5 w-5 text-slate-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{patient.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">Last visit: {patient.lastVisit}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {patient.email && (
                        <GlassButton
                          variant="ghost"
                          size="sm"
                          onClick={() => (window.location.href = `mailto:${patient.email}`)}
                          className="p-2"
                        >
                          <Mail className="h-4 w-4" />
                        </GlassButton>
                      )}
                      {patient.phone && (
                        <GlassButton
                          variant="ghost"
                          size="sm"
                          onClick={() => (window.location.href = `tel:${patient.phone}`)}
                          className="p-2"
                        >
                          <Phone className="h-4 w-4" />
                        </GlassButton>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
