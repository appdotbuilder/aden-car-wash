import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { bookingsTable, customersTable, servicesTable, zonesTable } from '../db/schema';
import { getBookings, getBookingById } from '../handlers/get_bookings';
import { eq } from 'drizzle-orm';

// Test data setup
const testCustomer = {
  name: 'Test Customer',
  phone: '+966501234567',
  whatsapp_verified: true
};

const testZone = {
  name_ar: 'الرياض الشمالي',
  name_en: 'North Riyadh',
  polygon_or_center: JSON.stringify({ lat: 24.7136, lng: 46.6753 }),
  notes: 'Main service area'
};

const testService = {
  slug: 'car-wash-basic',
  name_ar: 'غسيل السيارة الأساسي',
  name_en: 'Basic Car Wash',
  desc_ar: 'خدمة غسيل أساسية للسيارة',
  desc_en: 'Basic car washing service',
  base_price_team: 50.00,
  base_price_solo: 35.00,
  est_minutes: 45,
  order: 1,
  visible: true
};

const testBooking = {
  addons: [1, 2],
  car_type: 'sedan' as const,
  address_text: '123 Test Street, Riyadh',
  geo_point: JSON.stringify({ lat: 24.7136, lng: 46.6753 }),
  scheduled_window_start: new Date('2024-01-15T10:00:00Z'),
  scheduled_window_end: new Date('2024-01-15T12:00:00Z'),
  status: 'confirmed' as const,
  price_total: 75.50,
  is_solo: false,
  distance_fee: 5.00
};

describe('getBookings', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no bookings exist', async () => {
    const result = await getBookings();
    expect(result).toEqual([]);
  });

  it('should fetch all bookings with proper numeric conversions', async () => {
    // Create prerequisite data
    const [customer] = await db.insert(customersTable)
      .values(testCustomer)
      .returning()
      .execute();

    const [zone] = await db.insert(zonesTable)
      .values(testZone)
      .returning()
      .execute();

    const [service] = await db.insert(servicesTable)
      .values({
        ...testService,
        base_price_team: testService.base_price_team.toString(),
        base_price_solo: testService.base_price_solo.toString()
      })
      .returning()
      .execute();

    // Create booking
    const [booking] = await db.insert(bookingsTable)
      .values({
        ...testBooking,
        customer_id: customer.id,
        service_id: service.id,
        zone_id: zone.id,
        price_total: testBooking.price_total.toString(),
        distance_fee: testBooking.distance_fee.toString()
      })
      .returning()
      .execute();

    const result = await getBookings();

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(booking.id);
    expect(result[0].customer_id).toEqual(customer.id);
    expect(result[0].service_id).toEqual(service.id);
    expect(result[0].zone_id).toEqual(zone.id);
    expect(result[0].car_type).toEqual('sedan');
    expect(result[0].address_text).toEqual('123 Test Street, Riyadh');
    expect(result[0].status).toEqual('confirmed');
    expect(result[0].is_solo).toEqual(false);
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].scheduled_window_start).toBeInstanceOf(Date);
    expect(result[0].scheduled_window_end).toBeInstanceOf(Date);
    
    // Verify numeric conversions
    expect(typeof result[0].price_total).toBe('number');
    expect(result[0].price_total).toEqual(75.50);
    expect(typeof result[0].distance_fee).toBe('number');
    expect(result[0].distance_fee).toEqual(5.00);
    
    // Verify array fields
    expect(Array.isArray(result[0].addons)).toBe(true);
    expect(result[0].addons).toEqual([1, 2]);
  });

  it('should fetch multiple bookings correctly', async () => {
    // Create prerequisite data
    const [customer] = await db.insert(customersTable)
      .values(testCustomer)
      .returning()
      .execute();

    const [zone] = await db.insert(zonesTable)
      .values(testZone)
      .returning()
      .execute();

    const [service] = await db.insert(servicesTable)
      .values({
        ...testService,
        base_price_team: testService.base_price_team.toString(),
        base_price_solo: testService.base_price_solo.toString()
      })
      .returning()
      .execute();

    // Create multiple bookings
    const booking1Data = {
      ...testBooking,
      customer_id: customer.id,
      service_id: service.id,
      zone_id: zone.id,
      price_total: '75.50',
      distance_fee: '5.00',
      status: 'confirmed' as const
    };

    const booking2Data = {
      ...testBooking,
      customer_id: customer.id,
      service_id: service.id,
      zone_id: zone.id,
      price_total: '125.75',
      distance_fee: '10.25',
      status: 'finished' as const,
      scheduled_window_start: new Date('2024-01-16T14:00:00Z'),
      scheduled_window_end: new Date('2024-01-16T16:00:00Z')
    };

    await db.insert(bookingsTable)
      .values([booking1Data, booking2Data])
      .execute();

    const result = await getBookings();

    expect(result).toHaveLength(2);
    
    // Verify both bookings have proper numeric conversions
    result.forEach(booking => {
      expect(typeof booking.price_total).toBe('number');
      expect(typeof booking.distance_fee).toBe('number');
      expect(booking.created_at).toBeInstanceOf(Date);
      expect(booking.scheduled_window_start).toBeInstanceOf(Date);
      expect(booking.scheduled_window_end).toBeInstanceOf(Date);
    });

    // Verify different statuses
    const statuses = result.map(b => b.status).sort();
    expect(statuses).toEqual(['confirmed', 'finished']);
  });

  it('should handle bookings with zero distance fee', async () => {
    // Create prerequisite data
    const [customer] = await db.insert(customersTable)
      .values(testCustomer)
      .returning()
      .execute();

    const [zone] = await db.insert(zonesTable)
      .values(testZone)
      .returning()
      .execute();

    const [service] = await db.insert(servicesTable)
      .values({
        ...testService,
        base_price_team: testService.base_price_team.toString(),
        base_price_solo: testService.base_price_solo.toString()
      })
      .returning()
      .execute();

    // Create booking with zero distance fee
    await db.insert(bookingsTable)
      .values({
        ...testBooking,
        customer_id: customer.id,
        service_id: service.id,
        zone_id: zone.id,
        price_total: '50.00',
        distance_fee: '0.00'
      })
      .returning()
      .execute();

    const result = await getBookings();

    expect(result).toHaveLength(1);
    expect(typeof result[0].distance_fee).toBe('number');
    expect(result[0].distance_fee).toEqual(0.00);
  });
});

describe('getBookingById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null when booking does not exist', async () => {
    const result = await getBookingById(999);
    expect(result).toBeNull();
  });

  it('should fetch booking by ID with proper numeric conversions', async () => {
    // Create prerequisite data
    const [customer] = await db.insert(customersTable)
      .values(testCustomer)
      .returning()
      .execute();

    const [zone] = await db.insert(zonesTable)
      .values(testZone)
      .returning()
      .execute();

    const [service] = await db.insert(servicesTable)
      .values({
        ...testService,
        base_price_team: testService.base_price_team.toString(),
        base_price_solo: testService.base_price_solo.toString()
      })
      .returning()
      .execute();

    // Create booking
    const [booking] = await db.insert(bookingsTable)
      .values({
        ...testBooking,
        customer_id: customer.id,
        service_id: service.id,
        zone_id: zone.id,
        price_total: testBooking.price_total.toString(),
        distance_fee: testBooking.distance_fee.toString()
      })
      .returning()
      .execute();

    const result = await getBookingById(booking.id);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(booking.id);
    expect(result!.customer_id).toEqual(customer.id);
    expect(result!.service_id).toEqual(service.id);
    expect(result!.zone_id).toEqual(zone.id);
    expect(result!.car_type).toEqual('sedan');
    expect(result!.address_text).toEqual('123 Test Street, Riyadh');
    expect(result!.status).toEqual('confirmed');
    expect(result!.is_solo).toEqual(false);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.scheduled_window_start).toBeInstanceOf(Date);
    expect(result!.scheduled_window_end).toBeInstanceOf(Date);
    
    // Verify numeric conversions
    expect(typeof result!.price_total).toBe('number');
    expect(result!.price_total).toEqual(75.50);
    expect(typeof result!.distance_fee).toBe('number');
    expect(result!.distance_fee).toEqual(5.00);
    
    // Verify JSON fields
    expect(Array.isArray(result!.addons)).toBe(true);
    expect(result!.addons).toEqual([1, 2]);
    expect(typeof result!.geo_point).toBe('string');
    expect(JSON.parse(result!.geo_point)).toEqual({ lat: 24.7136, lng: 46.6753 });
  });

  it('should handle booking with empty addons array', async () => {
    // Create prerequisite data
    const [customer] = await db.insert(customersTable)
      .values(testCustomer)
      .returning()
      .execute();

    const [zone] = await db.insert(zonesTable)
      .values(testZone)
      .returning()
      .execute();

    const [service] = await db.insert(servicesTable)
      .values({
        ...testService,
        base_price_team: testService.base_price_team.toString(),
        base_price_solo: testService.base_price_solo.toString()
      })
      .returning()
      .execute();

    // Create booking with empty addons
    const [booking] = await db.insert(bookingsTable)
      .values({
        ...testBooking,
        customer_id: customer.id,
        service_id: service.id,
        zone_id: zone.id,
        addons: [],
        price_total: '35.00',
        distance_fee: '0.00'
      })
      .returning()
      .execute();

    const result = await getBookingById(booking.id);

    expect(result).not.toBeNull();
    expect(Array.isArray(result!.addons)).toBe(true);
    expect(result!.addons).toEqual([]);
    expect(result!.price_total).toEqual(35.00);
    expect(result!.distance_fee).toEqual(0.00);
  });

  it('should fetch booking with different car types and statuses', async () => {
    // Create prerequisite data
    const [customer] = await db.insert(customersTable)
      .values(testCustomer)
      .returning()
      .execute();

    const [zone] = await db.insert(zonesTable)
      .values(testZone)
      .returning()
      .execute();

    const [service] = await db.insert(servicesTable)
      .values({
        ...testService,
        base_price_team: testService.base_price_team.toString(),
        base_price_solo: testService.base_price_solo.toString()
      })
      .returning()
      .execute();

    // Create booking with different attributes
    const [booking] = await db.insert(bookingsTable)
      .values({
        ...testBooking,
        customer_id: customer.id,
        service_id: service.id,
        zone_id: zone.id,
        car_type: 'suv',
        status: 'on_the_way',
        is_solo: true,
        price_total: '95.25',
        distance_fee: '15.50'
      })
      .returning()
      .execute();

    const result = await getBookingById(booking.id);

    expect(result).not.toBeNull();
    expect(result!.car_type).toEqual('suv');
    expect(result!.status).toEqual('on_the_way');
    expect(result!.is_solo).toEqual(true);
    expect(result!.price_total).toEqual(95.25);
    expect(result!.distance_fee).toEqual(15.50);
  });
});