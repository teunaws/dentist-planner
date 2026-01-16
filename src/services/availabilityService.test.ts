import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTenantSchedule } from './availabilityService'
import { supabase } from '../lib/supabase'

// Mock Supabase client
vi.mock('../lib/supabase', () => ({
    supabase: {
        rpc: vi.fn(),
    },
}))

describe('availabilityService', () => {
    const tenantId = 'tenant-123'
    const startDate = '2025-01-01'
    const endDate = '2025-01-07'

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should return empty list when RPC returns no data', async () => {
        // Mock RPC returning empty array
        vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any)

        const result = await getTenantSchedule(tenantId, startDate, endDate)

        expect(supabase.rpc).toHaveBeenCalledWith('get_tenant_schedule', {
            p_tenant_id: tenantId,
            p_start_date: startDate,
            p_end_date: endDate,
        })
        expect(result).toEqual([])
    })

    it('should map RPC data to LightweightAppointment correctly', async () => {
        const mockRpcData = [
            {
                id: 'apt-1',
                date: '2025-01-01',
                time: '09:00',
                service_type: 'Checkup',
                status: 'Booked',
                provider_id: 'prov-1',
                dentist_name: 'Dr. Smith',
                notes: 'Some notes',
            },
        ]

        vi.mocked(supabase.rpc).mockResolvedValue({ data: mockRpcData, error: null } as any)

        const result = await getTenantSchedule(tenantId, startDate, endDate)

        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            id: 'apt-1',
            date: '2025-01-01',
            time: '09:00',
            service_type: 'Checkup',
            status: 'Booked',
            provider_id: 'prov-1',
            providerName: 'Dr. Smith', // Mapped field
            dentist_name: 'Dr. Smith',
            notes: 'Some notes',
        })
    })

    it('should map Blocked Time correctly', async () => {
        const mockRpcData = [
            {
                id: 'apt-block',
                date: '2025-01-01',
                time: '12:00',
                service_type: 'Blocked Time',
                status: 'Blocked',
                provider_id: null,
                dentist_name: null,
                notes: 'DURATION:60',
            },
        ]

        vi.mocked(supabase.rpc).mockResolvedValue({ data: mockRpcData, error: null } as any)

        const result = await getTenantSchedule(tenantId, startDate, endDate)

        expect(result[0].status).toBe('Blocked')
        expect(result[0].service_type).toBe('Blocked Time')
        expect(result[0].notes).toBe('DURATION:60')
    })

    it('should throw error if RPC fails', async () => {
        const mockError = { message: 'RPC Failed', details: '', hint: '', code: '' }
        vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: mockError } as any)

        await expect(getTenantSchedule(tenantId, startDate, endDate)).rejects.toEqual(mockError)
    })
})
