import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { customersTable, bookingsTable, servicesTable, addonsTable, zonesTable } from '../db/schema';
import { type CreateBookingInput } from '../schema';
import { createBooking } from '../handlers/create_booking';
import { eq } from 'drizzle-orm';

describe('createBooking', () => {
  let testZoneId: number;
  let testServiceId: number;
  let testAddonIds: number[];

  beforeEach(async () => {
    await createDB();

    // Create test zone
    const zoneResult = await db.insert(zonesTable)
      .values({
        name_ar: 'منطقة الاختبار',
        name_en: 'Test Zone',
        polygon_or_center: JSON.stringify({ lat: 24.7136, lng: 46.6753 }),
        notes: 'Test zone for booking'
      })
      .returning()
      .execute();
    testZoneId = zoneResult[0].id;

    // Create test service
    const serviceResult = await db.insert(servicesTable)
      .values({
        slug: 'test-wash',
        name_ar: 'غسيل تجريبي',
        name_en: 'Test Wash',
        desc_ar: 'وصف الغسيل التجريبي',
        desc_en: 'Test wash description',
        base_price_team: '150.00',
        base_price_solo: '100.00',
        est_minutes: 60,
        order: 1,
        visible: true
      })
      .returning()
      .execute();
    testServiceId = serviceResult[0].id;

    // Create test addons
    const addon1Result = await db.insert(addonsTable)
      .values({
        slug: 'test-addon1',
        name_ar: 'إضافة تجريبية 1',
        name_en: 'Test Addon 1',
        desc_ar: 'وصف الإضافة التجريبية 1',
        desc_en: 'Test addon 1 description',
        price: '25.00',
        est_minutes: 15,
        order: 1,
        visible: true
      })
      .returning()
      .execute();

    const addon2Result = await db.insert(addonsTable)
      .values({
        slug: 'test-addon2',
        name_ar: 'إضافة تجريبية 2',
        name_en: 'Test Addon 2',
        desc_ar: 'وصف الإضافة التجريبية 2',
        desc_en: 'Test addon 2 description',
        price: '35.00',
        est_minutes: 20,
        order: 2,
        visible: true
      })
      .returning()
      .execute();

    testAddonIds = [addon1Result[0].id, addon2Result[0].id];
  });

  afterEach(resetDB);

  const createTestInput = (overrides: Partial<CreateBookingInput> = {}): CreateBookingInput => ({
    customer: {
      name: 'Ahmed Al-Rashid',
      phone: '+966501234567'
    },
    service_id: testServiceId,
    addons: [],
    car_type: 'sedan',
    zone_id: testZoneId,
    address_text: 'King Fahd Road, Riyadh',
    geo_point: {
      lat: 24.7136,
      lng: 46.6753
    },
    scheduled_window: {
      start: new Date('2024-12-20T10:00:00Z'),
      end: new Date('2024-12-20T12:00:00Z')
    },
    is_solo: false,
    ...overrides
  });

  it('should create a booking for new customer', async () => {
    const input = createTestInput();
    const result = await createBooking(input);

    // Verify response structure
    expect(result.booking_id).toBeDefined();
    expect(typeof result.booking_id).toBe('string');
    expect(result.price_total).toBe(150); // Team price
    expect(result.wa_message_id).toBeDefined();
    expect(result.wa_message_id.startsWith('wa_')).toBe(true);

    // Verify booking was saved to database
    const bookings = await db.select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, parseInt(result.booking_id)))
      .execute();

    expect(bookings).toHaveLength(1);
    const booking = bookings[0];
    expect(booking.service_id).toBe(testServiceId);
    expect(booking.zone_id).toBe(testZoneId);
    expect(booking.car_type).toBe('sedan');
    expect(booking.address_text).toBe('King Fahd Road, Riyadh');
    expect(booking.status).toBe('confirmed');
    expect(parseFloat(booking.price_total)).toBe(150);
    expect(booking.is_solo).toBe(false);
    expect(parseFloat(booking.distance_fee)).toBe(0);
    expect(booking.addons).toEqual([]);

    // Verify customer was created
    const customers = await db.select()
      .from(customersTable)
      .where(eq(customersTable.id, booking.customer_id))
      .execute();

    expect(customers).toHaveLength(1);
    expect(customers[0].name).toBe('Ahmed Al-Rashid');
    expect(customers[0].phone).toBe('+966501234567');
    expect(customers[0].whatsapp_verified).toBe(false);
  });

  it('should create booking for existing customer', async () => {
    // Create existing customer
    const existingCustomer = await db.insert(customersTable)
      .values({
        name: 'Ahmed Al-Rashid',
        phone: '+966501234567',
        whatsapp_verified: true
      })
      .returning()
      .execute();

    const input = createTestInput();
    const result = await createBooking(input);

    // Verify booking uses existing customer
    const bookings = await db.select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, parseInt(result.booking_id)))
      .execute();

    expect(bookings[0].customer_id).toBe(existingCustomer[0].id);

    // Verify no duplicate customer was created
    const customers = await db.select()
      .from(customersTable)
      .where(eq(customersTable.phone, '+966501234567'))
      .execute();

    expect(customers).toHaveLength(1);
    expect(customers[0].whatsapp_verified).toBe(true); // Original value preserved
  });

  it('should calculate price with addons correctly', async () => {
    const input = createTestInput({
      addons: testAddonIds,
      is_solo: true
    });

    const result = await createBooking(input);

    // Solo price (100) + addon1 (25) + addon2 (35) = 160
    expect(result.price_total).toBe(160);

    // Verify addons saved to booking
    const bookings = await db.select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, parseInt(result.booking_id)))
      .execute();

    expect(bookings[0].addons).toEqual(testAddonIds);
    expect(bookings[0].is_solo).toBe(true);
  });

  it('should handle different car types', async () => {
    const input = createTestInput({
      car_type: 'suv'
    });

    const result = await createBooking(input);

    const bookings = await db.select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, parseInt(result.booking_id)))
      .execute();

    expect(bookings[0].car_type).toBe('suv');
  });

  it('should store geo_point as JSON string', async () => {
    const input = createTestInput({
      geo_point: {
        lat: 25.1234,
        lng: 47.5678
      }
    });

    const result = await createBooking(input);

    const bookings = await db.select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, parseInt(result.booking_id)))
      .execute();

    const geoPoint = JSON.parse(bookings[0].geo_point);
    expect(geoPoint.lat).toBe(25.1234);
    expect(geoPoint.lng).toBe(47.5678);
  });

  it('should store scheduled window correctly', async () => {
    const startTime = new Date('2024-12-20T14:00:00Z');
    const endTime = new Date('2024-12-20T16:00:00Z');

    const input = createTestInput({
      scheduled_window: {
        start: startTime,
        end: endTime
      }
    });

    const result = await createBooking(input);

    const bookings = await db.select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, parseInt(result.booking_id)))
      .execute();

    expect(bookings[0].scheduled_window_start).toEqual(startTime);
    expect(bookings[0].scheduled_window_end).toEqual(endTime);
  });

  it('should throw error for invalid service_id', async () => {
    const input = createTestInput({
      service_id: 99999
    });

    await expect(createBooking(input)).rejects.toThrow(/Service with id 99999 not found/i);
  });

  it('should throw error for invalid zone_id', async () => {
    const input = createTestInput({
      zone_id: 99999
    });

    await expect(createBooking(input)).rejects.toThrow(/Zone with id 99999 not found/i);
  });

  it('should throw error for invalid addon_ids', async () => {
    const input = createTestInput({
      addons: [99999, 88888]
    });

    await expect(createBooking(input)).rejects.toThrow(/One or more addons not found/i);
  });

  it('should handle empty addons array', async () => {
    const input = createTestInput({
      addons: []
    });

    const result = await createBooking(input);

    expect(result.price_total).toBe(150); // Just base team price

    const bookings = await db.select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, parseInt(result.booking_id)))
      .execute();

    expect(bookings[0].addons).toEqual([]);
  });

  it('should set default status to confirmed', async () => {
    const input = createTestInput();
    const result = await createBooking(input);

    const bookings = await db.select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, parseInt(result.booking_id)))
      .execute();

    expect(bookings[0].status).toBe('confirmed');
  });
});