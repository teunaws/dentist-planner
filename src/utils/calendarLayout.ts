
import type { Appointment } from '@/types';
import { parseTimeToMinutes } from '@/services/availabilityService';

export interface LayoutAppointment extends Appointment {
    _start: number;
    _end: number;
    layout: {
        top: number;      // percent
        height: number;   // percent
        left: number;     // percent
        width: number;    // percent
        zIndex: number;
    };
}

/**
 * Calculates visual position (top, height, left, width) for appointments
 * to handle overlaps gracefully.
 */
export function computeAppointmentLayout(
    appointments: Appointment[],
    durationMap: Record<string, number>,
    startHour: number = 9,
    endHour: number = 17
): LayoutAppointment[] {
    if (!appointments.length) return [];

    const TOTAL_MINUTES = (endHour - startHour) * 60;

    // 1. Calculate vertical position (Time -> Top/Height)
    const items = appointments.map((apt) => {
        let startMins = parseTimeToMinutes(apt.time);

        // Normalize start time relative to calendar start
        let relativeStart = startMins - (startHour * 60);

        // Get correct duration
        // Priority: 1. Explicit duration on appointment, 2. Map match, 3. Case-insensitive Map match, 4. Default 60
        let duration = apt.duration ?? durationMap[apt.type] ?? 60;
        if (!apt.duration && !durationMap[apt.type]) {
            const key = Object.keys(durationMap).find(k => k.toLowerCase() === apt.type.toLowerCase());
            if (key) duration = durationMap[key];
        }

        const endMins = startMins + duration;

        // Clamp to view
        const top = Math.max(0, (relativeStart / TOTAL_MINUTES) * 100);
        const height = (duration / TOTAL_MINUTES) * 100;

        return {
            ...apt,
            _start: startMins,
            _end: endMins,
            layout: {
                top,
                height,
                left: 0,
                width: 100,
                zIndex: 10
            }
        };
    });

    // 2. Sort by start time, then duration (longer first)
    items.sort((a, b) => {
        if (a._start !== b._start) return a._start - b._start;
        return (b._end - b._start) - (a._end - a._start);
    });

    // 3. Compute Columns for Overlaps
    // Simple algorithm: assign column 0..N
    const columns: LayoutAppointment[][] = [];

    items.forEach(item => {
        let placed = false;
        // Find first column where this item fits without overlap
        for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            const lastInCol = col[col.length - 1];
            if (lastInCol._end <= item._start) {
                col.push(item);
                item.layout.left = i; // Temporarily store col index
                placed = true;
                break;
            }
        }

        if (!placed) {
            columns.push([item]);
            item.layout.left = columns.length - 1;
        }
    });

    // 4. Determine Widths based on clusters
    // A cluster is a group of overlapping columns. 
    // For simplicity here, we can just say "if 3 columns exist total for the day, divide by 3". 
    // But that's inefficient. Better: checking max concurrency at the specific time.
    // 
    // Let's use a simpler heuristic for now: 
    // If we have N columns max for the day, width = 100/N is safe but potentially narrow.
    // We want to expand if possible.
    //
    // Revised approach: "Expand to fill".
    // This is complex to get perfect. Let's stick to "Max columns at this time".

    items.forEach(item => {
        // Find all items that overlap with this item
        const overlaps = items.filter(other =>
            item !== other &&
            !(other._end <= item._start || other._start >= item._end)
        );

        // Total concurrency count calculation (unused but good for reference)
        // const maxConcurrency = overlaps.length + 1;

        // But we need to know the specific "column index" relative to the cluster.
        // We already assigned a column index (0..N) in step 3. 
        // We need to know how many columns participate in this specific overlap group.

        // Let's refine: Use the column assignment from step 3.
        // Find the max column index used by any item that overlaps with current item.
        let maxColIndex = item.layout.left;
        overlaps.forEach(o => {
            if (o.layout.left > maxColIndex) maxColIndex = o.layout.left;
        });

        const totalCols = maxColIndex + 1;
        item.layout.width = 100 / totalCols;
        item.layout.left = (item.layout.left / totalCols) * 100;
    });

    return items;
}
