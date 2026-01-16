import { useMutation, useQueryClient } from '@tanstack/react-query'
import { appointmentService } from '../services/appointmentService'
import type { BlockTimeData } from '../services/appointmentService'

interface UseOptimisticBlockTimeParams {
    tenantId: string
    onSuccess?: (data: any) => void
    onError?: (error: Error) => void
}

export function useOptimisticBlockTime({ tenantId, onSuccess, onError }: UseOptimisticBlockTimeParams) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (params: BlockTimeData) => appointmentService.blockTime(params),
        onMutate: async (newBlockedTime) => {
            // 1. Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: ['appointments', tenantId] })

            // 2. Snapshot the previous value
            const previousAppointments = queryClient.getQueryData(['appointments', tenantId])

            // 3. Optimistically update to the new value
            queryClient.setQueryData(['appointments', tenantId], (old: any[] | undefined) => {
                const optimisticAppointment = {
                    id: 'temp-' + Date.now(), // Temporary ID
                    date: newBlockedTime.date,
                    time: newBlockedTime.startTime, // Using start time from params
                    service_type: 'Blocked Time',
                    status: 'Blocked',
                    provider_id: null,
                    notes: `DURATION:${calculateDuration(newBlockedTime.startTime, newBlockedTime.endTime)}`,
                    isOptimistic: true, // Visual cue flag (optional)
                }
                return old ? [...old, optimisticAppointment] : [optimisticAppointment]
            })

            // Return a context object with the snapshotted value
            return { previousAppointments }
        },
        onError: (err, _newBlockedTime, context) => {
            // If the mutation fails, use the context returned from onMutate to roll back
            if (context?.previousAppointments) {
                queryClient.setQueryData(['appointments', tenantId], context.previousAppointments)
            }
            onError?.(err instanceof Error ? err : new Error('Failed to block time'))
        },
        onSettled: () => {
            // Always refetch after error or success:
            void queryClient.invalidateQueries({ queryKey: ['appointments', tenantId] })
        },
        onSuccess: (data) => {
            onSuccess?.(data)
        },
    })
}

// Helper to calculate duration in minutes for the optimistic note
function calculateDuration(start: string, end: string): number {
    const [startH, startM] = start.split(':').map(Number)
    const [endH, endM] = end.split(':').map(Number)
    const startTotal = startH * 60 + startM
    const endTotal = endH * 60 + endM
    return endTotal - startTotal
}
