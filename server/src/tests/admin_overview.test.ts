import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { bookingsTable, customersTable, servicesTable, zonesTable, addonsTable, kpisDailyTable } from '../db/schema';
import { getAdminOverview, getTodayBookings, getBookingsByDateRange } from '../handlers/admin_overview';

// Test data setup
const testCustomer = {
  name: 'Test Customer',
  phone: '+1234567890',
  whatsapp_verified: true
};

const testZone = {
  name_ar: 'منطقة تجريبية',
  name_en: 'Test Zone',
  polygon_or_center: '{"lat": 24.7136, "lng": 46.6753}',
  notes: 'Test zone for admin overview'
};

const testService = {
  slug: 'basic-wash',
  name_ar: 'غسيل أساسي',
  name_en: 'Basic Wash',
  desc_ar: 'خدمة غسيل أساسية',
  desc_en: 'Basic car wash service',
  base_price_team: 50.00,
  base_price_solo: 40.00,
  est_minutes: 30,
  order: 1,
  visible: true
};

describe('Admin Overview Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getAdminOverview', () => {
    it('should return admin overview with empty stats when no data exists', async () => {
      const result = await getAdminOverview();

      expect(result.today_stats.total_bookings).toEqual(0);
      expect(result.today_stats.confirmed).toEqual(0);
      expect(result.today_stats.on_the_way).toEqual(0);
      expect(result.today_stats.completed).toEqual(0);
      expect(result.today_stats.revenue).toEqual(0);
      expect(result.upcoming_bookings).toHaveLength(0);
      expect(typeof result.kpis.on_time_percentage).toBe('number');
      expect(typeof result.kpis.complaints_rate).toBe('number');
      expect(typeof result.kpis.avg_service_time).toBe('number');
    });

    it('should return today stats with proper booking counts and revenue', async () => {
      // Create prerequisite data
      const customerResult = await db.insert(customersTable)
        .values(testCustomer)
        .returning()
        .execute();

      const zoneResult = await db.insert(zonesTable)
        .values(testZone)
        .returning()
        .execute();

      const serviceResult = await db.insert(servicesTable)
        .values({
          ...testService,
          base_price_team: testService.base_price_team.toString(),
          base_price_solo: testService.base_price_solo.toString()
        })
        .returning()
        .execute();

      const customerId = customerResult[0].id;
      const serviceId = serviceResult[0].id;
      const zoneId = zoneResult[0].id;

      // Create today's bookings with different statuses
      const today = new Date();
      const bookingBase = {
        customer_id: customerId,
        service_id: serviceId,
        addons: [],
        car_type: 'sedan' as const,
        zone_id: zoneId,
        address_text: 'Test Address',
        geo_point: '{"lat": 24.7136, "lng": 46.6753}',
        scheduled_window_start: today,
        scheduled_window_end: new Date(today.getTime() + 2 * 60 * 60 * 1000),
        is_solo: false,
        distance_fee: '5.00',
        created_at: today
      };

      await db.insert(bookingsTable).values([
        { ...bookingBase, status: 'confirmed', price_total: '50.00' },
        { ...bookingBase, status: 'confirmed', price_total: '60.00' },
        { ...bookingBase, status: 'on_the_way', price_total: '45.00' },
        { ...bookingBase, status: 'finished', price_total: '70.00' }
      ]).execute();

      const result = await getAdminOverview();

      expect(result.today_stats.total_bookings).toEqual(4);
      expect(result.today_stats.confirmed).toEqual(2);
      expect(result.today_stats.on_the_way).toEqual(1);
      expect(result.today_stats.completed).toEqual(1);
      expect(result.today_stats.revenue).toEqual(225.00);
      expect(typeof result.today_stats.revenue).toBe('number');
    });

    it('should return upcoming bookings with proper data structure', async () => {
      // Create prerequisite data
      const customerResult = await db.insert(customersTable)
        .values(testCustomer)
        .returning()
        .execute();

      const zoneResult = await db.insert(zonesTable)
        .values(testZone)
        .returning()
        .execute();

      const serviceResult = await db.insert(servicesTable)
        .values({
          ...testService,
          base_price_team: testService.base_price_team.toString(),
          base_price_solo: testService.base_price_solo.toString()
        })
        .returning()
        .execute();

      // Create upcoming booking (tomorrow)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      await db.insert(bookingsTable).values({
        customer_id: customerResult[0].id,
        service_id: serviceResult[0].id,
        addons: [1, 2],
        car_type: 'suv',
        zone_id: zoneResult[0].id,
        address_text: 'Upcoming Booking Address',
        geo_point: '{"lat": 24.7136, "lng": 46.6753}',
        scheduled_window_start: tomorrow,
        scheduled_window_end: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000),
        status: 'confirmed',
        price_total: '85.00',
        is_solo: true,
        distance_fee: '10.00'
      }).execute();

      const result = await getAdminOverview();

      expect(result.upcoming_bookings).toHaveLength(1);
      const upcomingBooking = result.upcoming_bookings[0];
      expect(upcomingBooking.car_type).toEqual('suv');
      expect(upcomingBooking.status).toEqual('confirmed');
      expect(upcomingBooking.price_total).toEqual(85.00);
      expect(typeof upcomingBooking.price_total).toBe('number');
      expect(upcomingBooking.is_solo).toBe(true);
      expect(upcomingBooking.addons).toEqual([1, 2]);
      expect(upcomingBooking.scheduled_window_start).toBeInstanceOf(Date);
    });

    it('should calculate KPIs from historical data', async () => {
      // Create KPI data for the last week
      const today = new Date();
      const dates = [];
      for (let i = 1; i <= 5; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
      }

      await db.insert(kpisDailyTable).values([
        { date: dates[0], bookings: 10, aov: '75.50', cpl: '12.30', complaints_rate: 0.02, addons_ratio: 0.35 },
        { date: dates[1], bookings: 8, aov: '68.20', cpl: '11.80', complaints_rate: 0.01, addons_ratio: 0.40 },
        { date: dates[2], bookings: 12, aov: '82.00', cpl: '13.50', complaints_rate: 0.03, addons_ratio: 0.28 },
        { date: dates[3], bookings: 9, aov: '71.75', cpl: '12.00', complaints_rate: 0.02, addons_ratio: 0.45 },
        { date: dates[4], bookings: 11, aov: '79.30', cpl: '12.70', complaints_rate: 0.01, addons_ratio: 0.38 }
      ]).execute();

      const result = await getAdminOverview();

      expect(result.kpis.complaints_rate).toBeGreaterThan(0);
      expect(result.kpis.complaints_rate).toBeLessThan(1);
      expect(typeof result.kpis.complaints_rate).toBe('number');
      expect(typeof result.kpis.on_time_percentage).toBe('number');
      expect(typeof result.kpis.avg_service_time).toBe('number');
    });
  });

  describe('getTodayBookings', () => {
    it('should return empty array when no bookings exist for today', async () => {
      const result = await getTodayBookings();
      expect(result).toHaveLength(0);
    });

    it('should return today bookings with proper type conversions', async () => {
      // Create prerequisite data
      const customerResult = await db.insert(customersTable)
        .values(testCustomer)
        .returning()
        .execute();

      const zoneResult = await db.insert(zonesTable)
        .values(testZone)
        .returning()
        .execute();

      const serviceResult = await db.insert(servicesTable)
        .values({
          ...testService,
          base_price_team: testService.base_price_team.toString(),
          base_price_solo: testService.base_price_solo.toString()
        })
        .returning()
        .execute();

      // Create today booking
      const today = new Date();
      today.setHours(14, 30, 0, 0);

      await db.insert(bookingsTable).values({
        customer_id: customerResult[0].id,
        service_id: serviceResult[0].id,
        addons: [1],
        car_type: 'pickup',
        zone_id: zoneResult[0].id,
        address_text: 'Today Booking Address',
        geo_point: '{"lat": 24.7136, "lng": 46.6753}',
        scheduled_window_start: today,
        scheduled_window_end: new Date(today.getTime() + 90 * 60 * 1000),
        status: 'on_the_way',
        price_total: '120.50',
        is_solo: false,
        distance_fee: '15.75'
      }).execute();

      const result = await getTodayBookings();

      expect(result).toHaveLength(1);
      const booking = result[0];
      expect(booking.car_type).toEqual('pickup');
      expect(booking.status).toEqual('on_the_way');
      expect(booking.price_total).toEqual(120.50);
      expect(typeof booking.price_total).toBe('number');
      expect(booking.distance_fee).toEqual(15.75);
      expect(typeof booking.distance_fee).toBe('number');
      expect(booking.scheduled_window_start).toBeInstanceOf(Date);
    });

    it('should only return bookings scheduled for today', async () => {
      // Create prerequisite data
      const customerResult = await db.insert(customersTable)
        .values(testCustomer)
        .returning()
        .execute();

      const zoneResult = await db.insert(zonesTable)
        .values(testZone)
        .returning()
        .execute();

      const serviceResult = await db.insert(servicesTable)
        .values({
          ...testService,
          base_price_team: testService.base_price_team.toString(),
          base_price_solo: testService.base_price_solo.toString()
        })
        .returning()
        .execute();

      // Create bookings for different days
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const bookingBase = {
        customer_id: customerResult[0].id,
        service_id: serviceResult[0].id,
        addons: [],
        car_type: 'sedan' as const,
        zone_id: zoneResult[0].id,
        address_text: 'Test Address',
        geo_point: '{"lat": 24.7136, "lng": 46.6753}',
        scheduled_window_end: new Date(today.getTime() + 60 * 60 * 1000),
        status: 'confirmed' as const,
        price_total: '50.00',
        is_solo: false,
        distance_fee: '5.00'
      };

      await db.insert(bookingsTable).values([
        { ...bookingBase, scheduled_window_start: yesterday },
        { ...bookingBase, scheduled_window_start: today },
        { ...bookingBase, scheduled_window_start: tomorrow }
      ]).execute();

      const result = await getTodayBookings();

      expect(result).toHaveLength(1);
      expect(result[0].scheduled_window_start.toDateString()).toEqual(today.toDateString());
    });
  });

  describe('getBookingsByDateRange', () => {
    it('should return empty array when no bookings in range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02');

      const result = await getBookingsByDateRange(startDate, endDate);
      expect(result).toHaveLength(0);
    });

    it('should return bookings within the specified date range', async () => {
      // Create prerequisite data
      const customerResult = await db.insert(customersTable)
        .values(testCustomer)
        .returning()
        .execute();

      const zoneResult = await db.insert(zonesTable)
        .values(testZone)
        .returning()
        .execute();

      const serviceResult = await db.insert(servicesTable)
        .values({
          ...testService,
          base_price_team: testService.base_price_team.toString(),
          base_price_solo: testService.base_price_solo.toString()
        })
        .returning()
        .execute();

      // Create bookings for different dates
      const date1 = new Date('2024-06-01T10:00:00Z');
      const date2 = new Date('2024-06-02T14:00:00Z');
      const date3 = new Date('2024-06-05T16:00:00Z');

      const bookingBase = {
        customer_id: customerResult[0].id,
        service_id: serviceResult[0].id,
        addons: [],
        car_type: 'sedan' as const,
        zone_id: zoneResult[0].id,
        address_text: 'Range Test Address',
        geo_point: '{"lat": 24.7136, "lng": 46.6753}',
        scheduled_window_end: new Date(date1.getTime() + 60 * 60 * 1000),
        status: 'confirmed' as const,
        price_total: '60.00',
        is_solo: false,
        distance_fee: '8.00'
      };

      await db.insert(bookingsTable).values([
        { ...bookingBase, scheduled_window_start: date1 },
        { ...bookingBase, scheduled_window_start: date2 },
        { ...bookingBase, scheduled_window_start: date3 }
      ]).execute();

      // Query for bookings between June 1-3, 2024
      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-06-03');

      const result = await getBookingsByDateRange(startDate, endDate);

      expect(result).toHaveLength(2);
      
      // Results should be ordered by scheduled_window_start DESC
      expect(result[0].scheduled_window_start.getTime()).toBeGreaterThan(
        result[1].scheduled_window_start.getTime()
      );

      // Verify numeric conversions
      result.forEach(booking => {
        expect(typeof booking.price_total).toBe('number');
        expect(typeof booking.distance_fee).toBe('number');
        expect(booking.price_total).toEqual(60.00);
        expect(booking.distance_fee).toEqual(8.00);
      });
    });

    it('should order bookings by scheduled date descending', async () => {
      // Create prerequisite data
      const customerResult = await db.insert(customersTable)
        .values(testCustomer)
        .returning()
        .execute();

      const zoneResult = await db.insert(zonesTable)
        .values(testZone)
        .returning()
        .execute();

      const serviceResult = await db.insert(servicesTable)
        .values({
          ...testService,
          base_price_team: testService.base_price_team.toString(),
          base_price_solo: testService.base_price_solo.toString()
        })
        .returning()
        .execute();

      // Create multiple bookings with different times
      const dates = [
        new Date('2024-06-01T09:00:00Z'),
        new Date('2024-06-01T15:00:00Z'),
        new Date('2024-06-01T12:00:00Z')
      ];

      const bookingBase = {
        customer_id: customerResult[0].id,
        service_id: serviceResult[0].id,
        addons: [],
        car_type: 'sedan' as const,
        zone_id: zoneResult[0].id,
        address_text: 'Order Test Address',
        geo_point: '{"lat": 24.7136, "lng": 46.6753}',
        scheduled_window_end: new Date(dates[0].getTime() + 60 * 60 * 1000),
        status: 'confirmed' as const,
        price_total: '45.00',
        is_solo: false,
        distance_fee: '3.50'
      };

      await db.insert(bookingsTable).values(
        dates.map(date => ({
          ...bookingBase,
          scheduled_window_start: date
        }))
      ).execute();

      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-06-02');

      const result = await getBookingsByDateRange(startDate, endDate);

      expect(result).toHaveLength(3);
      
      // Check descending order
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].scheduled_window_start.getTime()).toBeGreaterThanOrEqual(
          result[i + 1].scheduled_window_start.getTime()
        );
      }
    });
  });
});