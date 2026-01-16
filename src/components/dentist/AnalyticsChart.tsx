'use client';

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
import { GlassCard } from '../ui/GlassCard'

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

interface AnalyticsChartProps {
    chartData: {
        month: string;
        total: number;
        new: number;
        returning: number;
    }[];
    yAxisMax: number;
}

const AnalyticsChart: React.FC<AnalyticsChartProps> = ({ chartData, yAxisMax }) => {
    console.log('[AnalyticsChart] Rendering with data:', { dataLength: chartData?.length, yAxisMax })

    if (!chartData || chartData.length === 0) {
        console.warn('[AnalyticsChart] No data to display')
        return <div className="h-full w-full flex items-center justify-center text-red-500">No Data</div>
    }

    return (
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
    )
}

export default AnalyticsChart;
