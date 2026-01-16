'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { X, Calendar, Clock, User, Phone, Mail, FileText, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

interface AppointmentDetailsModalProps {
    appointmentId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

interface DecryptedAppointment {
    id: string;
    date: string;
    time: string;
    service_type: string; // The join returns this or we use service name
    status: string;
    notes: string | null;
    patient_name: string;
    patient_email: string;
    patient_phone: string;
    tenants?: { name: string };
    provider_name?: string;
    provider_color?: string;
}

export function AppointmentDetailsModal({ appointmentId, isOpen, onClose }: AppointmentDetailsModalProps) {
    const [details, setDetails] = useState<DecryptedAppointment | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const supabase = createClient();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (isOpen && appointmentId) {
            fetchDetails(appointmentId);
            setShowCancelConfirm(false); // Reset on open
        } else {
            setDetails(null);
            setError(null);
        }
    }, [isOpen, appointmentId]);

    const fetchDetails = async (id: string) => {
        setLoading(true);
        setError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-appointment-details`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ appointmentId: id }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to fetch details');
            }

            const data = await response.json();
            setDetails(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelAppointment = async () => {
        if (!appointmentId) return;
        setIsCancelling(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cancel-appointment`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ appointment_id: appointmentId }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to cancel appointment');
            }

            toast.success('Appointment cancelled successfully');
            queryClient.invalidateQueries({ queryKey: ['appointments'] }); // Verify key matches CalendarView
            onClose();
        } catch (err: any) {
            toast.error(err.message || 'Failed to cancel appointment');
        } finally {
            setIsCancelling(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="w-full max-w-md"
                    >
                        <GlassCard className="relative overflow-hidden">
                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <h2 className="text-lg font-semibold text-slate-800 mb-6">Appointment Details</h2>

                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                    <p className="text-sm">Decrypting patient data...</p>
                                </div>
                            ) : error ? (
                                <div className="p-4 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 text-sm flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <p>{error}</p>
                                </div>
                            ) : details ? (
                                <div className="space-y-6">
                                    {/* Header Info */}
                                    <div className="flex items-start gap-3 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                            <Calendar className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900">{details.service_type || 'Dental Service'}</p>
                                            <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                                                <span>{new Date(details.date).toLocaleDateString()}</span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> {details.time}
                                                </span>
                                            </div>
                                            <div className="mt-1">
                                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${details.status === 'Cancelled' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                    details.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                        'bg-sky-50 text-sky-700 border-sky-200'
                                                    }`}>
                                                    {details.status}
                                                </span>
                                            </div>
                                        </div>
                                        {/* Provider Badge */}
                                        {details.provider_name && (
                                            <div
                                                className="ml-auto px-2 py-1 rounded-md text-[10px] font-medium border shadow-sm flex items-center gap-1.5"
                                                style={{
                                                    backgroundColor: 'white',
                                                    borderColor: details.provider_color || '#e2e8f0',
                                                    color: '#475569'
                                                }}
                                            >
                                                <div
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: details.provider_color || '#3b82f6' }}
                                                />
                                                {details.provider_name}
                                            </div>
                                        )}
                                    </div>

                                    {/* Patient Info */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 text-sm">
                                            <User className="w-4 h-4 text-slate-400" />
                                            <span className="font-medium text-slate-900">{details.patient_name}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <Mail className="w-4 h-4 text-slate-400" />
                                            <a href={`mailto:${details.patient_email}`} className="text-indigo-600 hover:underline truncate">
                                                {details.patient_email}
                                            </a>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <Phone className="w-4 h-4 text-slate-400" />
                                            <a href={`tel:${details.patient_phone}`} className="text-slate-600 hover:text-slate-900">
                                                {details.patient_phone}
                                            </a>
                                        </div>
                                        {details.notes && (
                                            <div className="flex items-start gap-3 text-sm bg-slate-50 p-3 rounded border border-slate-100 mt-2">
                                                <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
                                                <p className="text-slate-600 italic">"{details.notes}"</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    {!showCancelConfirm ? (
                                        <div className="flex justify-end pt-4 border-t border-slate-100">
                                            <button
                                                onClick={() => setShowCancelConfirm(true)}
                                                disabled={details.status === 'Cancelled'}
                                                className="text-sm text-rose-600 hover:text-rose-700 font-medium px-4 py-2 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Cancel Appointment
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="bg-rose-50 p-4 rounded-lg border border-rose-100 animate-in fade-in slide-in-from-bottom-2">
                                            <h4 className="font-medium text-rose-900 mb-1 flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4" />
                                                Cancel this appointment?
                                            </h4>
                                            <p className="text-xs text-rose-700 mb-3">
                                                The patient will be notified via email immediately. This action cannot be undone.
                                            </p>
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => setShowCancelConfirm(false)}
                                                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md shadow-sm"
                                                    disabled={isCancelling}
                                                >
                                                    Keep it
                                                </button>
                                                <GlassButton
                                                    onClick={handleCancelAppointment}
                                                    isLoading={isCancelling}
                                                    variant="primary" // Assuming primary exists, usually we use standard classes
                                                    className="!bg-rose-600 !border-rose-500 !text-white !hover:bg-rose-700 !shadow-none !text-xs !py-1.5"
                                                >
                                                    Confirm Cancellation
                                                </GlassButton>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : null}
                        </GlassCard>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
