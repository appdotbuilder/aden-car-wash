import { db } from '../db';
import { bookingsTable, zonesTable } from '../db/schema';
import { eq, and, between, gte, lte } from 'drizzle-orm';

export interface TimeSlot {
    start: Date;
    end: Date;
    available: boolean;
    zone_id: number;
}

export interface ZoneSchedule {
    operating_hours: { start: string; end: string };
    booked_slots: TimeSlot[];
    team_capacity: number;
}

// Configuration constants
const DEFAULT_OPERATING_HOURS = { start: '08:00', end: '18:00' };
const DEFAULT_TEAM_CAPACITY = 3;
const SLOT_WINDOW_MINUTES = 90; // 90-minute appointment windows
const BUFFER_MINUTES = 30; // Buffer between appointments
const SLOT_INTERVAL_MINUTES = 60; // Generate slots every 60 minutes

export async function getAvailableTimeSlots(
    zone_id: number,
    service_duration: number,
    date: Date
): Promise<TimeSlot[]> {
    try {
        // Validate zone exists
        const zone = await db.select()
            .from(zonesTable)
            .where(eq(zonesTable.id, zone_id))
            .execute();

        if (zone.length === 0) {
            throw new Error(`Zone with ID ${zone_id} not found`);
        }

        // Get zone schedule for the date
        const schedule = await getZoneSchedule(zone_id, date);
        
        // Generate all possible time slots for the day
        const allSlots = generateTimeSlots(date, schedule.operating_hours);
        
        // Check availability for each slot
        const availableSlots: TimeSlot[] = [];
        
        for (const slot of allSlots) {
            const isAvailable = isSlotAvailable(
                zone_id,
                slot.start,
                slot.end,
                service_duration,
                schedule.booked_slots,
                schedule.team_capacity
            );
            
            availableSlots.push({
                ...slot,
                available: isAvailable,
                zone_id
            });
        }
        
        return availableSlots;
    } catch (error) {
        console.error('Failed to get available time slots:', error);
        throw error;
    }
}

export async function validateTimeSlot(
    zone_id: number,
    start_time: Date,
    end_time: Date
): Promise<boolean> {
    try {
        // Validate zone exists
        const zone = await db.select()
            .from(zonesTable)
            .where(eq(zonesTable.id, zone_id))
            .execute();

        if (zone.length === 0) {
            return false;
        }

        // Check if slot is within operating hours
        const schedule = await getZoneSchedule(zone_id, start_time);
        if (!isWithinOperatingHours(start_time, end_time, schedule.operating_hours)) {
            return false;
        }

        // Check for conflicts with existing bookings
        const conflictingBookings = await getConflictingBookings(zone_id, start_time, end_time);
        
        // Validate team capacity isn't exceeded
        if (conflictingBookings.length >= schedule.team_capacity) {
            return false;
        }

        return true;
    } catch (error) {
        console.error('Failed to validate time slot:', error);
        return false;
    }
}

export async function getZoneSchedule(zone_id: number, date: Date): Promise<ZoneSchedule> {
    try {
        // Get start and end of the day
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        // Get all bookings for the zone on this date
        const bookings = await db.select()
            .from(bookingsTable)
            .where(
                and(
                    eq(bookingsTable.zone_id, zone_id),
                    between(bookingsTable.scheduled_window_start, dayStart, dayEnd),
                    eq(bookingsTable.status, 'confirmed') // Only consider confirmed bookings
                )
            )
            .execute();

        // Convert bookings to time slots
        const bookedSlots: TimeSlot[] = bookings.map(booking => ({
            start: booking.scheduled_window_start,
            end: booking.scheduled_window_end,
            available: false,
            zone_id: booking.zone_id
        }));

        return {
            operating_hours: DEFAULT_OPERATING_HOURS,
            booked_slots: bookedSlots,
            team_capacity: DEFAULT_TEAM_CAPACITY
        };
    } catch (error) {
        console.error('Failed to get zone schedule:', error);
        throw error;
    }
}

// Helper functions
function generateTimeSlots(
    date: Date,
    operating_hours: { start: string; end: string }
): Omit<TimeSlot, 'available' | 'zone_id'>[] {
    const slots: Omit<TimeSlot, 'available' | 'zone_id'>[] = [];
    
    // Parse operating hours
    const [startHour, startMin] = operating_hours.start.split(':').map(Number);
    const [endHour, endMin] = operating_hours.end.split(':').map(Number);
    
    // Set up start time
    const currentSlot = new Date(date);
    currentSlot.setHours(startHour, startMin, 0, 0);
    
    // Set up end boundary
    const dayEnd = new Date(date);
    dayEnd.setHours(endHour, endMin, 0, 0);
    
    // Generate slots at intervals
    while (currentSlot.getTime() + (SLOT_WINDOW_MINUTES * 60 * 1000) <= dayEnd.getTime()) {
        const slotStart = new Date(currentSlot);
        const slotEnd = new Date(currentSlot);
        slotEnd.setMinutes(slotEnd.getMinutes() + SLOT_WINDOW_MINUTES);
        
        slots.push({
            start: slotStart,
            end: slotEnd
        });
        
        // Move to next slot
        currentSlot.setMinutes(currentSlot.getMinutes() + SLOT_INTERVAL_MINUTES);
    }
    
    return slots;
}

function isSlotAvailable(
    zone_id: number,
    start: Date,
    end: Date,
    service_duration: number,
    booked_slots: TimeSlot[],
    team_capacity: number
): boolean {
    // Check for overlapping bookings
    const overlapping = booked_slots.filter(slot => 
        isTimeOverlap(start, end, slot.start, slot.end)
    );
    
    // If number of overlapping bookings exceeds or equals team capacity, slot is not available
    if (overlapping.length >= team_capacity) {
        return false;
    }
    
    // Additional check: ensure service duration fits within the slot with buffer
    const slotDuration = (end.getTime() - start.getTime()) / (1000 * 60); // in minutes
    if (service_duration + BUFFER_MINUTES > slotDuration) {
        return false;
    }
    
    return true;
}

async function getConflictingBookings(
    zone_id: number,
    start_time: Date,
    end_time: Date
): Promise<any[]> {
    // Get bookings that overlap with the proposed time slot
    const bookings = await db.select()
        .from(bookingsTable)
        .where(
            and(
                eq(bookingsTable.zone_id, zone_id),
                // Check for overlap: booking starts before our slot ends AND booking ends after our slot starts
                lte(bookingsTable.scheduled_window_start, end_time),
                gte(bookingsTable.scheduled_window_end, start_time),
                eq(bookingsTable.status, 'confirmed')
            )
        )
        .execute();
    
    return bookings;
}

function isWithinOperatingHours(
    start_time: Date,
    end_time: Date,
    operating_hours: { start: string; end: string }
): boolean {
    const [startHour, startMin] = operating_hours.start.split(':').map(Number);
    const [endHour, endMin] = operating_hours.end.split(':').map(Number);
    
    const slotStartHour = start_time.getHours();
    const slotStartMin = start_time.getMinutes();
    const slotEndHour = end_time.getHours();
    const slotEndMin = end_time.getMinutes();
    
    // Convert to minutes for easier comparison
    const opStartMinutes = startHour * 60 + startMin;
    const opEndMinutes = endHour * 60 + endMin;
    const slotStartMinutes = slotStartHour * 60 + slotStartMin;
    const slotEndMinutes = slotEndHour * 60 + slotEndMin;
    
    return slotStartMinutes >= opStartMinutes && slotEndMinutes <= opEndMinutes;
}

function isTimeOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
): boolean {
    // Two time ranges overlap if one starts before the other ends AND vice versa
    return start1 < end2 && start2 < end1;
}