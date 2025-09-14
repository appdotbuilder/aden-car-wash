import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { bookingsTable, customersTable, servicesTable, zonesTable } from '../db/schema';
import { type UpdateBookingInput } from '../schema';
import { updateBooking } from '../handlers/update_booking';
import { eq } from 'drizzle-orm';

describe('updateBooking', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test prerequisites
  const createTestData = async () => {
    // Create customer
    const customerResult = await db.insert(customersTable)
      .values({
        name: 'Test Customer',
        phone: '+1234567890',
        whatsapp_verified: true
      })
      .returning()
      .execute();
    const customer = customerResult[0];

    // Create zone
    const zoneResult = await db.insert(zonesTable)
      .values({
        name_ar: 'منطقة تجريبية',
        name_en: 'Test Zone',
        polygon_or_center: '{"lat": 24.7136, "lng": 46.6753}',
        notes: 'Test zone'
      })
      .returning()
      .execute();
    const zone = zoneResult[0];

    // Create service
    const serviceResult = await db.insert(servicesTable)
      .values({
        slug: 'test-service',
        name_ar: 'خدمة تجريبية',
        name_en: 'Test Service',
        desc_ar: 'وصف الخدمة',
        desc_en: 'Service description',
        base_price_team: '100.00',
        base_price_solo: '80.00',
        est_minutes: 60,
        order: 1,
        visible: true
      })
      .returning()
      .execute();
    const service = serviceResult[0];

    // Create booking
    const bookingResult = await db.insert(bookingsTable)
      .values({
        customer_id: customer.id,
        service_id: service.id,
        addons: [],
        car_type: 'sedan',
        zone_id: zone.id,
        address_text: 'Original address',
        geo_point: '{"lat": 24.7136, "lng": 46.6753}',
        scheduled_window_start: new Date('2024-01-15 10:00:00'),
        scheduled_window_end: new Date('2024-01-15 12:00:00'),
        status: 'confirmed',
        price_total: '100.00',
        is_solo: false,
        distance_fee: '0.00'
      })
      .returning()
      .execute();
    const booking = bookingResult[0];

    return { customer, zone, service, booking };
  };

  it('should update booking status', async () => {
    const { booking } = await createTestData();

    const updateInput: UpdateBookingInput = {
      id: booking.id,
      status: 'on_the_way'
    };

    const result = await updateBooking(updateInput);

    expect(result.id).toBe(booking.id);
    expect(result.status).toBe('on_the_way');
    expect(result.customer_id).toBe(booking.customer_id);
    expect(result.price_total).toBe(100);
    expect(typeof result.price_total).toBe('number');

    // Verify in database
    const updatedBookings = await db.select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, booking.id))
      .execute();

    expect(updatedBookings[0].status).toBe('on_the_way');
  });

  it('should update scheduled window', async () => {
    const { booking } = await createTestData();

    const newStart = new Date('2024-01-16 14:00:00');
    const newEnd = new Date('2024-01-16 16:00:00');

    const updateInput: UpdateBookingInput = {
      id: booking.id,
      scheduled_window_start: newStart,
      scheduled_window_end: newEnd
    };

    const result = await updateBooking(updateInput);

    expect(result.id).toBe(booking.id);
    expect(result.scheduled_window_start).toEqual(newStart);
    expect(result.scheduled_window_end).toEqual(newEnd);
    expect(result.status).toBe('confirmed'); // Should remain unchanged

    // Verify in database
    const updatedBookings = await db.select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, booking.id))
      .execute();

    expect(updatedBookings[0].scheduled_window_start).toEqual(newStart);
    expect(updatedBookings[0].scheduled_window_end).toEqual(newEnd);
  });

  it('should update address and location', async () => {
    const { booking } = await createTestData();

    const updateInput: UpdateBookingInput = {
      id: booking.id,
      address_text: 'New updated address',
      geo_point: '{"lat": 25.0000, "lng": 47.0000}'
    };

    const result = await updateBooking(updateInput);

    expect(result.id).toBe(booking.id);
    expect(result.address_text).toBe('New updated address');
    expect(result.geo_point).toBe('{"lat": 25.0000, "lng": 47.0000}');

    // Verify in database
    const updatedBookings = await db.select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, booking.id))
      .execute();

    expect(updatedBookings[0].address_text).toBe('New updated address');
    expect(updatedBookings[0].geo_point).toBe('{"lat": 25.0000, "lng": 47.0000}');
  });

  it('should update multiple fields simultaneously', async () => {
    const { booking } = await createTestData();

    const newStart = new Date('2024-01-20 09:00:00');
    const newEnd = new Date('2024-01-20 11:00:00');

    const updateInput: UpdateBookingInput = {
      id: booking.id,
      status: 'started',
      scheduled_window_start: newStart,
      scheduled_window_end: newEnd,
      address_text: 'Multi-field update address'
    };

    const result = await updateBooking(updateInput);

    expect(result.id).toBe(booking.id);
    expect(result.status).toBe('started');
    expect(result.scheduled_window_start).toEqual(newStart);
    expect(result.scheduled_window_end).toEqual(newEnd);
    expect(result.address_text).toBe('Multi-field update address');

    // Verify all changes persisted in database
    const updatedBookings = await db.select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, booking.id))
      .execute();

    const dbBooking = updatedBookings[0];
    expect(dbBooking.status).toBe('started');
    expect(dbBooking.scheduled_window_start).toEqual(newStart);
    expect(dbBooking.scheduled_window_end).toEqual(newEnd);
    expect(dbBooking.address_text).toBe('Multi-field update address');
  });

  it('should return unchanged booking when no update fields provided', async () => {
    const { booking } = await createTestData();

    const updateInput: UpdateBookingInput = {
      id: booking.id
    };

    const result = await updateBooking(updateInput);

    expect(result.id).toBe(booking.id);
    expect(result.status).toBe('confirmed');
    expect(result.address_text).toBe('Original address');
    expect(result.price_total).toBe(100);
    expect(typeof result.price_total).toBe('number');
  });

  it('should handle cancellation status update', async () => {
    const { booking } = await createTestData();

    const updateInput: UpdateBookingInput = {
      id: booking.id,
      status: 'canceled'
    };

    const result = await updateBooking(updateInput);

    expect(result.id).toBe(booking.id);
    expect(result.status).toBe('canceled');

    // Verify in database
    const updatedBookings = await db.select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, booking.id))
      .execute();

    expect(updatedBookings[0].status).toBe('canceled');
  });

  it('should handle completion status update', async () => {
    const { booking } = await createTestData();

    const updateInput: UpdateBookingInput = {
      id: booking.id,
      status: 'finished'
    };

    const result = await updateBooking(updateInput);

    expect(result.id).toBe(booking.id);
    expect(result.status).toBe('finished');

    // Verify in database
    const updatedBookings = await db.select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, booking.id))
      .execute();

    expect(updatedBookings[0].status).toBe('finished');
  });

  it('should convert numeric fields correctly', async () => {
    const { booking } = await createTestData();

    const updateInput: UpdateBookingInput = {
      id: booking.id,
      status: 'on_the_way'
    };

    const result = await updateBooking(updateInput);

    // Verify numeric field types
    expect(typeof result.price_total).toBe('number');
    expect(typeof result.distance_fee).toBe('number');
    expect(result.price_total).toBe(100);
    expect(result.distance_fee).toBe(0);
  });

  it('should throw error when booking not found', async () => {
    const updateInput: UpdateBookingInput = {
      id: 999999, // Non-existent booking ID
      status: 'finished'
    };

    await expect(updateBooking(updateInput)).rejects.toThrow(/Booking with ID 999999 not found/i);
  });

  it('should preserve unchanged fields when updating specific fields', async () => {
    const { booking } = await createTestData();

    // Only update status
    const updateInput: UpdateBookingInput = {
      id: booking.id,
      status: 'started'
    };

    const result = await updateBooking(updateInput);

    // Status should be updated
    expect(result.status).toBe('started');

    // Other fields should remain unchanged
    expect(result.address_text).toBe('Original address');
    expect(result.geo_point).toBe('{"lat": 24.7136, "lng": 46.6753}');
    expect(result.car_type).toBe('sedan');
    expect(result.is_solo).toBe(false);
  });
});