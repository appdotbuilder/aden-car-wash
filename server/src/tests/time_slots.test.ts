import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { zonesTable, bookingsTable, customersTable, servicesTable } from '../db/schema';
import { 
    getAvailableTimeSlots, 
    validateTimeSlot, 
    getZoneSchedule, 
    type TimeSlot 
} from '../handlers/time_slots';
import { eq } from 'drizzle-orm';

// Test data setup
const testZone = {
    name_ar: 'منطقة الاختبار',
    name_en: 'Test Zone',
    polygon_or_center: JSON.stringify({ lat: 24.7136, lng: 46.6753 }),
    notes: 'Test zone for time slots'
};

const testCustomer = {
    name: 'Test Customer',
    phone: '+966501234567',
    whatsapp_verified: false
};

const testService = {
    slug: 'basic-wash',
    name_ar: 'غسيل أساسي',
    name_en: 'Basic Wash',
    desc_ar: 'وصف الغسيل الأساسي',
    desc_en: 'Basic wash description',
    base_price_team: 50.00,
    base_price_solo: 40.00,
    est_minutes: 60,
    order: 1,
    visible: true
};

describe('Time Slots Handler', () => {
    let zoneId: number;
    let customerId: number;
    let serviceId: number;

    beforeEach(async () => {
        await createDB();
        
        // Create test zone
        const zoneResult = await db.insert(zonesTable)
            .values(testZone)
            .returning()
            .execute();
        zoneId = zoneResult[0].id;

        // Create test customer
        const customerResult = await db.insert(customersTable)
            .values(testCustomer)
            .returning()
            .execute();
        customerId = customerResult[0].id;

        // Create test service
        const serviceResult = await db.insert(servicesTable)
            .values({
                ...testService,
                base_price_team: testService.base_price_team.toString(),
                base_price_solo: testService.base_price_solo.toString()
            })
            .returning()
            .execute();
        serviceId = serviceResult[0].id;
    });

    afterEach(resetDB);

    describe('getAvailableTimeSlots', () => {
        it('should return available time slots for a zone', async () => {
            const testDate = new Date('2024-01-15');
            const serviceDuration = 60;

            const result = await getAvailableTimeSlots(zoneId, serviceDuration, testDate);

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);

            // Check first slot structure
            const firstSlot = result[0];
            expect(firstSlot).toHaveProperty('start');
            expect(firstSlot).toHaveProperty('end');
            expect(firstSlot).toHaveProperty('available');
            expect(firstSlot).toHaveProperty('zone_id');
            expect(firstSlot.zone_id).toBe(zoneId);
            expect(firstSlot.start).toBeInstanceOf(Date);
            expect(firstSlot.end).toBeInstanceOf(Date);
            expect(typeof firstSlot.available).toBe('boolean');
        });

        it('should generate slots within operating hours', async () => {
            const testDate = new Date('2024-01-15');
            const serviceDuration = 60;

            const result = await getAvailableTimeSlots(zoneId, serviceDuration, testDate);

            // All slots should be within 8:00-18:00
            result.forEach(slot => {
                expect(slot.start.getHours()).toBeGreaterThanOrEqual(8);
                expect(slot.end.getHours()).toBeLessThanOrEqual(18);
            });
        });

        it('should mark slots as unavailable when zone capacity is exceeded', async () => {
            const testDate = new Date('2024-01-15');
            const serviceDuration = 60;

            // Create 3 bookings (equal to team capacity) that conflict with one slot
            const conflictStart = new Date('2024-01-15T09:00:00');
            const conflictEnd = new Date('2024-01-15T10:30:00');

            // Create 3 bookings at the same time to exceed capacity
            for (let i = 0; i < 3; i++) {
                await db.insert(bookingsTable)
                    .values({
                        customer_id: customerId,
                        service_id: serviceId,
                        addons: [],
                        car_type: 'sedan',
                        zone_id: zoneId,
                        address_text: `Test Address ${i}`,
                        geo_point: JSON.stringify({ lat: 24.7136, lng: 46.6753 }),
                        scheduled_window_start: conflictStart,
                        scheduled_window_end: conflictEnd,
                        status: 'confirmed',
                        price_total: '50.00',
                        is_solo: false,
                        distance_fee: '0.00'
                    })
                    .execute();
            }

            const result = await getAvailableTimeSlots(zoneId, serviceDuration, testDate);

            // Find slots that overlap with the bookings
            const overlappingSlots = result.filter(slot => 
                slot.start < conflictEnd && slot.end > conflictStart
            );

            // Should have found some overlapping slots
            expect(overlappingSlots.length).toBeGreaterThan(0);

            // These slots should be marked as unavailable (capacity exceeded)
            overlappingSlots.forEach(slot => {
                expect(slot.available).toBe(false);
            });
        });

        it('should handle multiple team capacity', async () => {
            const testDate = new Date('2024-01-15');
            const serviceDuration = 60;

            // Create multiple bookings at the same time (within team capacity)
            const slotStart = new Date('2024-01-15T10:00:00');
            const slotEnd = new Date('2024-01-15T11:30:00');

            // Create 2 bookings (within capacity of 3)
            for (let i = 0; i < 2; i++) {
                await db.insert(bookingsTable)
                    .values({
                        customer_id: customerId,
                        service_id: serviceId,
                        addons: [],
                        car_type: 'sedan',
                        zone_id: zoneId,
                        address_text: `Test Address ${i}`,
                        geo_point: JSON.stringify({ lat: 24.7136, lng: 46.6753 }),
                        scheduled_window_start: slotStart,
                        scheduled_window_end: slotEnd,
                        status: 'confirmed',
                        price_total: '50.00',
                        is_solo: false,
                        distance_fee: '0.00'
                    })
                    .execute();
            }

            const result = await getAvailableTimeSlots(zoneId, serviceDuration, testDate);

            // Find the slot that overlaps with bookings
            const targetSlot = result.find(slot => 
                slot.start.getTime() === slotStart.getTime()
            );

            // Should still be available (2 bookings < 3 capacity)
            expect(targetSlot?.available).toBe(true);
        });

        it('should throw error for non-existent zone', async () => {
            const testDate = new Date('2024-01-15');
            const serviceDuration = 60;
            const nonExistentZoneId = 99999;

            await expect(
                getAvailableTimeSlots(nonExistentZoneId, serviceDuration, testDate)
            ).rejects.toThrow(/Zone with ID .* not found/i);
        });
    });

    describe('validateTimeSlot', () => {
        it('should validate available time slot', async () => {
            const startTime = new Date('2024-01-15T10:00:00');
            const endTime = new Date('2024-01-15T11:30:00');

            const result = await validateTimeSlot(zoneId, startTime, endTime);

            expect(result).toBe(true);
        });

        it('should reject time slot outside operating hours', async () => {
            // Slot starting at 6 AM (before 8 AM)
            const startTime = new Date('2024-01-15T06:00:00');
            const endTime = new Date('2024-01-15T07:30:00');

            const result = await validateTimeSlot(zoneId, startTime, endTime);

            expect(result).toBe(false);
        });

        it('should reject time slot ending after operating hours', async () => {
            // Slot ending at 8 PM (after 6 PM)
            const startTime = new Date('2024-01-15T17:00:00');
            const endTime = new Date('2024-01-15T20:00:00');

            const result = await validateTimeSlot(zoneId, startTime, endTime);

            expect(result).toBe(false);
        });

        it('should reject time slot when team capacity is exceeded', async () => {
            const startTime = new Date('2024-01-15T10:00:00');
            const endTime = new Date('2024-01-15T11:30:00');

            // Create 3 bookings (equal to team capacity)
            for (let i = 0; i < 3; i++) {
                await db.insert(bookingsTable)
                    .values({
                        customer_id: customerId,
                        service_id: serviceId,
                        addons: [],
                        car_type: 'sedan',
                        zone_id: zoneId,
                        address_text: `Test Address ${i}`,
                        geo_point: JSON.stringify({ lat: 24.7136, lng: 46.6753 }),
                        scheduled_window_start: startTime,
                        scheduled_window_end: endTime,
                        status: 'confirmed',
                        price_total: '50.00',
                        is_solo: false,
                        distance_fee: '0.00'
                    })
                    .execute();
            }

            const result = await validateTimeSlot(zoneId, startTime, endTime);

            expect(result).toBe(false);
        });

        it('should return false for non-existent zone', async () => {
            const startTime = new Date('2024-01-15T10:00:00');
            const endTime = new Date('2024-01-15T11:30:00');
            const nonExistentZoneId = 99999;

            const result = await validateTimeSlot(nonExistentZoneId, startTime, endTime);

            expect(result).toBe(false);
        });
    });

    describe('getZoneSchedule', () => {
        it('should return zone schedule with operating hours', async () => {
            const testDate = new Date('2024-01-15');

            const result = await getZoneSchedule(zoneId, testDate);

            expect(result).toHaveProperty('operating_hours');
            expect(result).toHaveProperty('booked_slots');
            expect(result).toHaveProperty('team_capacity');
            
            expect(result.operating_hours.start).toBe('08:00');
            expect(result.operating_hours.end).toBe('18:00');
            expect(result.team_capacity).toBe(3);
            expect(Array.isArray(result.booked_slots)).toBe(true);
        });

        it('should return booked slots for the date', async () => {
            const testDate = new Date('2024-01-15');

            // Create a booking for this date
            const bookingStart = new Date('2024-01-15T10:00:00');
            const bookingEnd = new Date('2024-01-15T11:30:00');

            await db.insert(bookingsTable)
                .values({
                    customer_id: customerId,
                    service_id: serviceId,
                    addons: [],
                    car_type: 'sedan',
                    zone_id: zoneId,
                    address_text: 'Test Address',
                    geo_point: JSON.stringify({ lat: 24.7136, lng: 46.6753 }),
                    scheduled_window_start: bookingStart,
                    scheduled_window_end: bookingEnd,
                    status: 'confirmed',
                    price_total: '50.00',
                    is_solo: false,
                    distance_fee: '0.00'
                })
                .execute();

            const result = await getZoneSchedule(zoneId, testDate);

            expect(result.booked_slots.length).toBe(1);
            expect(result.booked_slots[0].start.getTime()).toBe(bookingStart.getTime());
            expect(result.booked_slots[0].end.getTime()).toBe(bookingEnd.getTime());
            expect(result.booked_slots[0].available).toBe(false);
            expect(result.booked_slots[0].zone_id).toBe(zoneId);
        });

        it('should not include bookings from different dates', async () => {
            const testDate = new Date('2024-01-15');

            // Create booking for different date
            const differentDateBooking = new Date('2024-01-16T10:00:00');
            const differentDateEnd = new Date('2024-01-16T11:30:00');

            await db.insert(bookingsTable)
                .values({
                    customer_id: customerId,
                    service_id: serviceId,
                    addons: [],
                    car_type: 'sedan',
                    zone_id: zoneId,
                    address_text: 'Test Address',
                    geo_point: JSON.stringify({ lat: 24.7136, lng: 46.6753 }),
                    scheduled_window_start: differentDateBooking,
                    scheduled_window_end: differentDateEnd,
                    status: 'confirmed',
                    price_total: '50.00',
                    is_solo: false,
                    distance_fee: '0.00'
                })
                .execute();

            const result = await getZoneSchedule(zoneId, testDate);

            expect(result.booked_slots.length).toBe(0);
        });

        it('should only include confirmed bookings', async () => {
            const testDate = new Date('2024-01-15');

            // Create cancelled booking
            const bookingStart = new Date('2024-01-15T10:00:00');
            const bookingEnd = new Date('2024-01-15T11:30:00');

            await db.insert(bookingsTable)
                .values({
                    customer_id: customerId,
                    service_id: serviceId,
                    addons: [],
                    car_type: 'sedan',
                    zone_id: zoneId,
                    address_text: 'Test Address',
                    geo_point: JSON.stringify({ lat: 24.7136, lng: 46.6753 }),
                    scheduled_window_start: bookingStart,
                    scheduled_window_end: bookingEnd,
                    status: 'canceled',
                    price_total: '50.00',
                    is_solo: false,
                    distance_fee: '0.00'
                })
                .execute();

            const result = await getZoneSchedule(zoneId, testDate);

            expect(result.booked_slots.length).toBe(0);
        });
    });

    describe('Edge cases and error handling', () => {
        it('should handle date boundaries correctly', async () => {
            // Test with date at midnight
            const testDate = new Date('2024-01-15T00:00:00');
            const serviceDuration = 60;

            const result = await getAvailableTimeSlots(zoneId, serviceDuration, testDate);

            expect(result.length).toBeGreaterThan(0);
            result.forEach(slot => {
                // All slots should be on the same day
                expect(slot.start.getDate()).toBe(15);
                expect(slot.end.getDate()).toBe(15);
            });
        });

        it('should handle long service duration correctly', async () => {
            const testDate = new Date('2024-01-15');
            const longServiceDuration = 120; // 2 hours (still fits in 90-min slot with 30-min buffer? No, should fail)

            const result = await getAvailableTimeSlots(zoneId, longServiceDuration, testDate);

            // Long service duration should make most/all slots unavailable due to buffer requirements
            const availableSlots = result.filter(slot => slot.available);
            const unavailableSlots = result.filter(slot => !slot.available);
            
            // Most slots should be unavailable due to duration + buffer > slot window
            expect(unavailableSlots.length).toBeGreaterThan(0);
            // Total slots should still be generated
            expect(result.length).toBeGreaterThan(0);
        });

        it('should maintain slot ordering by time', async () => {
            const testDate = new Date('2024-01-15');
            const serviceDuration = 60;

            const result = await getAvailableTimeSlots(zoneId, serviceDuration, testDate);

            // Check that slots are ordered by start time
            for (let i = 1; i < result.length; i++) {
                expect(result[i].start.getTime()).toBeGreaterThan(result[i-1].start.getTime());
            }
        });
    });
});