'use client';

import type { LayoutAppointment } from '../../utils/calendarLayout'
import { X } from 'lucide-react'
import { GlassBadge } from '../ui/GlassBadge'
import type { Provider } from '../../types'

interface WeeklyCalendarProps {
    week: Date[];
    hours: number[];
    calendar: Record<string, LayoutAppointment[]>;
    providerMap: Map<string, Provider>;
    onDeleteBlockedTime: (id: string) => void;
    onAppointmentClick: (id: string) => void;
}

const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
    week,
    hours,
    calendar,
    providerMap,
    onDeleteBlockedTime,
    onAppointmentClick
}) => {
    console.log('[WeeklyCalendar] Rendering', {
        weekLength: week?.length,
        appointmentsCount: Object.values(calendar).flat().length
    })

    return (
        <div className="min-w-[720px] max-w-[900px] mx-auto h-full flex flex-col">
            <div className="grid grid-cols-[50px_repeat(7,minmax(0,1fr))] gap-1.5 text-sm text-slate-600 mb-2 flex-shrink-0">
                <div />
                {week.map((day) => (
                    <div key={`head-${day.toDateString()}`} className="text-center">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">
                            {day.toLocaleDateString(undefined, { weekday: 'short' })}
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                            {day.toLocaleDateString(undefined, { day: '2-digit' })}
                        </p>
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-[50px_repeat(7,minmax(0,1fr))] gap-1 text-slate-900 flex-1 relative">
                <div className="relative h-full">
                    {hours.map((hour, index) => (
                        <div
                            key={hour}
                            className="absolute left-0 right-1 flex items-center justify-end pr-1 text-[10px] text-slate-500"
                            style={{
                                top: `${(index / (hours.length - 1)) * 100}%`,
                                transform: 'translateY(-50%)',
                            }}
                        >
                            {`${hour.toString().padStart(2, '0')}:00`}
                        </div>
                    ))}
                </div>
                {week.map((day) => {
                    const dayKey = day.toDateString()
                    const dayAppointments = calendar[dayKey] ?? []
                    return (
                        <div
                            key={`col-${dayKey}`}
                            className="relative h-full rounded-xl border border-slate-200 bg-white px-0.5"
                            style={{
                                // Removed hardcoded gradient to ensure alignment with time labels
                            }}
                        >
                            {/* Grid Lines reflecting the hours */}
                            {hours.map((_, index) => (
                                <div
                                    key={`grid-line-${index}`}
                                    className="absolute left-0 right-0 border-t border-slate-100 pointer-events-none"
                                    style={{
                                        top: `${(index / (hours.length - 1)) * 100}%`,
                                    }}
                                />
                            ))}

                            {dayAppointments.length === 0 && (
                                <p className="absolute inset-x-2 top-2 text-[9px] text-slate-400">Open day</p>
                            )}
                            {dayAppointments.map((appointment) => {
                                const isBlocked = appointment.type === 'Blocked Time' || appointment.status === 'Blocked'
                                // Get provider color if appointment has a provider
                                const provider = appointment.providerId ? providerMap.get(appointment.providerId) : null
                                const providerColor = provider?.color || '#3b82f6'

                                return (
                                    <div
                                        key={appointment.id}
                                        onClick={() => {
                                            if (appointment.type !== 'Blocked Time' && appointment.status !== 'Blocked') {
                                                onAppointmentClick(appointment.id)
                                            }
                                        }}
                                        className={`absolute rounded-lg border p-1 text-[9px] leading-tight shadow-sm cursor-pointer transition-all hover:ring-1 hover:ring-indigo-300 ${isBlocked
                                            ? 'border-amber-200 bg-amber-50 cursor-default'
                                            : 'border-slate-200 bg-white'
                                            }`}
                                        style={{
                                            top: `${appointment.layout.top}%`,
                                            height: `${appointment.layout.height}%`,
                                            left: `${appointment.layout.left}%`,
                                            width: `${appointment.layout.width}%`,
                                            zIndex: appointment.layout.zIndex,
                                            minHeight: '32px',
                                            // Add left border color for provider identification
                                            borderLeftWidth: provider && !isBlocked ? '3px' : undefined,
                                            borderLeftColor: provider && !isBlocked ? providerColor : undefined,
                                        }}
                                    >
                                        <div className="flex items-center justify-between gap-0.5 text-slate-900">
                                            <p className="text-[9px] font-semibold truncate">
                                                {appointment.type === 'Blocked Time' ? 'Blocked' : appointment.patientName}
                                            </p>
                                            <div className="flex items-center gap-0.5">
                                                <GlassBadge
                                                    tone={
                                                        appointment.status === 'Blocked'
                                                            ? 'warning'
                                                            : appointment.status === 'Confirmed'
                                                                ? 'success'
                                                                : appointment.status === 'Pending'
                                                                    ? 'info'
                                                                    : 'warning'
                                                    }
                                                    className="text-[7px] px-1 py-0"
                                                >
                                                    {appointment.status}
                                                </GlassBadge>
                                                {isBlocked && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            onDeleteBlockedTime(appointment.id)
                                                        }}
                                                        className="rounded p-0.5 text-rose-500 transition hover:bg-rose-50 hover:text-rose-700"
                                                        title="Delete blocked time"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <p className="mt-0.5 text-slate-700 line-clamp-1 text-[8px]">
                                            {appointment.type === 'Blocked Time' ? 'Unavailable' : appointment.type}
                                        </p>
                                        <div className="flex items-center justify-between gap-1">
                                            <p className="text-slate-500 text-[8px]">{appointment.time}</p>
                                            {provider && !isBlocked && (
                                                <div
                                                    className="h-2 w-2 rounded-full"
                                                    style={{ backgroundColor: providerColor }}
                                                    title={provider.name}
                                                />
                                            )}
                                        </div>
                                        {appointment.notes && (
                                            <p className="mt-0.5 text-[8px] text-slate-500 line-clamp-1">
                                                {appointment.notes
                                                    .replace(/\s*\|\s*END_TIME:\d{2}:\d{2}\s*/g, '')
                                                    .replace(/\s*\|\s*DURATION:\d+\s*/g, '')
                                                    .trim() || 'Blocked time'}
                                            </p>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default WeeklyCalendar;
