import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { kpisDailyTable, bookingsTable, customersTable, servicesTable, zonesTable } from '../db/schema';
import { type CreateKPIsDailyInput } from '../schema';
import { 
  recordDailyKPIs, 
  getKPIsByDateRange, 
  generateKPIReport,
  calculateOperationalKPIs,
  calculateMarketingKPIs
} from '../handlers/kpi_reports';
import { eq, gte, lte, between, and } from 'drizzle-orm';

const testKPIInput: CreateKPIsDailyInput = {
  date: new Date('2024-01-15'),
  bookings: 25,
  aov: 145.50,
  cpl: 18.75,
  complaints_rate: 0.02,
  addons_ratio: 0.4
};

describe('KPI Reports Handler', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('recordDailyKPIs', () => {
    it('should record daily KPI metrics', async () => {
      const result = await recordDailyKPIs(testKPIInput);

      expect(result.date).toEqual(testKPIInput.date);
      expect(result.bookings).toEqual(25);
      expect(result.aov).toEqual(145.50);
      expect(result.cpl).toEqual(18.75);
      expect(result.complaints_rate).toEqual(0.02);
      expect(result.addons_ratio).toEqual(0.4);
      expect(result.id).toBeDefined();
      expect(typeof result.aov).toBe('number');
      expect(typeof result.cpl).toBe('number');
    });

    it('should save KPI record to database', async () => {
      const result = await recordDailyKPIs(testKPIInput);

      const kpis = await db.select()
        .from(kpisDailyTable)
        .where(eq(kpisDailyTable.id, result.id))
        .execute();

      expect(kpis).toHaveLength(1);
      expect(kpis[0].bookings).toEqual(25);
      expect(parseFloat(kpis[0].aov)).toEqual(145.50);
      expect(parseFloat(kpis[0].cpl)).toEqual(18.75);
      expect(kpis[0].complaints_rate).toEqual(0.02);
      expect(kpis[0].addons_ratio).toEqual(0.4);
    });

    it('should update existing KPI record for same date', async () => {
      // Create initial record
      await recordDailyKPIs(testKPIInput);

      // Update with new values
      const updatedInput: CreateKPIsDailyInput = {
        ...testKPIInput,
        bookings: 30,
        aov: 155.75
      };

      const result = await recordDailyKPIs(updatedInput);

      // Should have updated values
      expect(result.bookings).toEqual(30);
      expect(result.aov).toEqual(155.75);

      // Should only have one record for this date
      const dateString = testKPIInput.date.toISOString().split('T')[0];
      const allKPIs = await db.select()
        .from(kpisDailyTable)
        .where(eq(kpisDailyTable.date, dateString))
        .execute();

      expect(allKPIs).toHaveLength(1);
      expect(allKPIs[0].bookings).toEqual(30);
    });

    it('should handle numeric conversions correctly', async () => {
      const highPrecisionInput: CreateKPIsDailyInput = {
        date: new Date('2024-01-16'),
        bookings: 15,
        aov: 123.456789,
        cpl: 45.987654,
        complaints_rate: 0.0123456789,
        addons_ratio: 0.987654321
      };

      const result = await recordDailyKPIs(highPrecisionInput);

      expect(typeof result.aov).toBe('number');
      expect(typeof result.cpl).toBe('number');
      expect(result.aov).toBeCloseTo(123.46, 2);
      expect(result.cpl).toBeCloseTo(45.99, 2);
    });
  });

  describe('getKPIsByDateRange', () => {
    beforeEach(async () => {
      // Create test KPI records for different dates
      const testData = [
        { ...testKPIInput, date: new Date('2024-01-10') },
        { ...testKPIInput, date: new Date('2024-01-15'), bookings: 30 },
        { ...testKPIInput, date: new Date('2024-01-20'), bookings: 20 },
        { ...testKPIInput, date: new Date('2024-01-25'), bookings: 35 }
      ];

      for (const data of testData) {
        await recordDailyKPIs(data);
      }
    });

    it('should fetch KPIs within date range', async () => {
      const startDate = new Date('2024-01-12');
      const endDate = new Date('2024-01-22');

      const result = await getKPIsByDateRange(startDate, endDate);

      expect(result).toHaveLength(2);
      
      // Check that each date is within the range
      result.forEach(kpi => {
        expect(kpi.date.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(kpi.date.getTime()).toBeLessThanOrEqual(endDate.getTime());
      });
      
      // Should be ordered by date descending
      expect(result[0].date.getTime()).toBeGreaterThan(result[1].date.getTime());
    });

    it('should return empty array for date range with no data', async () => {
      const startDate = new Date('2024-02-01');
      const endDate = new Date('2024-02-10');

      const result = await getKPIsByDateRange(startDate, endDate);

      expect(result).toHaveLength(0);
    });

    it('should include boundary dates correctly', async () => {
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-15');

      const result = await getKPIsByDateRange(startDate, endDate);

      expect(result).toHaveLength(1);
      expect(result[0].bookings).toEqual(30);
    });

    it('should convert numeric fields correctly', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const result = await getKPIsByDateRange(startDate, endDate);

      result.forEach(kpi => {
        expect(typeof kpi.aov).toBe('number');
        expect(typeof kpi.cpl).toBe('number');
        expect(kpi.aov).toBeGreaterThan(0);
        expect(kpi.cpl).toBeGreaterThan(0);
      });
    });
  });

  describe('generateKPIReport', () => {
    beforeEach(async () => {
      // Create some test KPI data
      await recordDailyKPIs(testKPIInput);
    });

    it('should generate daily report filename', async () => {
      const filename = await generateKPIReport('daily', 'csv');

      expect(filename).toMatch(/^kpi_report_daily_\d+\.csv$/);
    });

    it('should generate weekly report filename', async () => {
      const filename = await generateKPIReport('weekly', 'pdf');

      expect(filename).toMatch(/^kpi_report_weekly_\d+\.pdf$/);
    });

    it('should generate monthly report filename', async () => {
      const filename = await generateKPIReport('monthly', 'csv');

      expect(filename).toMatch(/^kpi_report_monthly_\d+\.csv$/);
    });

    it('should handle different periods and formats', async () => {
      const csvFilename = await generateKPIReport('daily', 'csv');
      const pdfFilename = await generateKPIReport('weekly', 'pdf');

      expect(csvFilename).toContain('.csv');
      expect(pdfFilename).toContain('.pdf');
      expect(csvFilename).toContain('daily');
      expect(pdfFilename).toContain('weekly');
    });
  });

  describe('calculateOperationalKPIs', () => {
    beforeEach(async () => {
      // Create test data for operational KPI calculations
      // First create zones and services
      const zoneResult = await db.insert(zonesTable)
        .values({
          name_ar: 'منطقة الاختبار',
          name_en: 'Test Zone',
          polygon_or_center: JSON.stringify({ lat: 24.7136, lng: 46.6753 }),
          notes: 'Test zone for KPI calculations'
        })
        .returning()
        .execute();

      const serviceResult = await db.insert(servicesTable)
        .values({
          slug: 'test-wash',
          name_ar: 'غسيل تجريبي',
          name_en: 'Test Wash',
          desc_ar: 'خدمة غسيل للاختبار',
          desc_en: 'Test washing service',
          base_price_team: '100.00',
          base_price_solo: '80.00',
          est_minutes: 45,
          order: 1,
          visible: true
        })
        .returning()
        .execute();

      const customerResult = await db.insert(customersTable)
        .values({
          name: 'Test Customer',
          phone: '+966501234567',
          whatsapp_verified: true
        })
        .returning()
        .execute();

      // Create test bookings with different statuses
      await db.insert(bookingsTable)
        .values([
          {
            customer_id: customerResult[0].id,
            service_id: serviceResult[0].id,
            addons: [],
            car_type: 'sedan',
            zone_id: zoneResult[0].id,
            address_text: 'Test Address 1',
            geo_point: JSON.stringify({ lat: 24.7136, lng: 46.6753 }),
            scheduled_window_start: new Date('2024-01-15T10:00:00Z'),
            scheduled_window_end: new Date('2024-01-15T11:00:00Z'),
            status: 'finished',
            price_total: '120.00',
            is_solo: false,
            distance_fee: '0.00'
          },
          {
            customer_id: customerResult[0].id,
            service_id: serviceResult[0].id,
            addons: [],
            car_type: 'suv',
            zone_id: zoneResult[0].id,
            address_text: 'Test Address 2',
            geo_point: JSON.stringify({ lat: 24.7136, lng: 46.6753 }),
            scheduled_window_start: new Date('2024-01-15T14:00:00Z'),
            scheduled_window_end: new Date('2024-01-15T15:00:00Z'),
            status: 'confirmed',
            price_total: '150.00',
            is_solo: true,
            distance_fee: '10.00'
          }
        ])
        .execute();

      // Create recent KPI data
      await recordDailyKPIs({
        date: new Date('2024-01-15'),
        bookings: 10,
        aov: 135.0,
        cpl: 15.5,
        complaints_rate: 0.02,
        addons_ratio: 0.3
      });
    });

    it('should calculate operational KPIs', async () => {
      const result = await calculateOperationalKPIs();

      expect(result).toHaveProperty('service_time_avg');
      expect(result).toHaveProperty('on_time_percentage');
      expect(result).toHaveProperty('complaints_rate');
      expect(result).toHaveProperty('readiness_percentage');

      expect(typeof result.service_time_avg).toBe('number');
      expect(typeof result.on_time_percentage).toBe('number');
      expect(typeof result.complaints_rate).toBe('number');
      expect(typeof result.readiness_percentage).toBe('number');

      expect(result.service_time_avg).toBeGreaterThan(0);
      expect(result.on_time_percentage).toBeLessThanOrEqual(1);
      expect(result.complaints_rate).toBeGreaterThanOrEqual(0);
      expect(result.readiness_percentage).toBeLessThanOrEqual(1);
    });

    it('should return reasonable default values when no data exists', async () => {
      // Clear all data
      await db.delete(bookingsTable).execute();
      await db.delete(kpisDailyTable).execute();

      const result = await calculateOperationalKPIs();

      expect(result.service_time_avg).toBeGreaterThan(0);
      expect(result.on_time_percentage).toBeGreaterThan(0);
      expect(result.complaints_rate).toBeGreaterThanOrEqual(0);
      expect(result.readiness_percentage).toBeGreaterThan(0);
    });
  });

  describe('calculateMarketingKPIs', () => {
    beforeEach(async () => {
      // Create test data for marketing KPI calculations
      const zoneResult = await db.insert(zonesTable)
        .values({
          name_ar: 'منطقة الاختبار',
          name_en: 'Test Zone',
          polygon_or_center: JSON.stringify({ lat: 24.7136, lng: 46.6753 })
        })
        .returning()
        .execute();

      const serviceResult = await db.insert(servicesTable)
        .values({
          slug: 'test-service',
          name_ar: 'خدمة تجريبية',
          name_en: 'Test Service',
          desc_ar: 'وصف تجريبي',
          desc_en: 'Test description',
          base_price_team: '100.00',
          base_price_solo: '80.00',
          est_minutes: 30,
          order: 1,
          visible: true
        })
        .returning()
        .execute();

      const customerResult = await db.insert(customersTable)
        .values([
          {
            name: 'Customer 1',
            phone: '+966501234567',
            whatsapp_verified: true
          },
          {
            name: 'Customer 2',
            phone: '+966501234568',
            whatsapp_verified: false
          }
        ])
        .returning()
        .execute();

      // Create bookings with and without addons
      await db.insert(bookingsTable)
        .values([
          {
            customer_id: customerResult[0].id,
            service_id: serviceResult[0].id,
            addons: [1, 2], // With addons
            car_type: 'sedan',
            zone_id: zoneResult[0].id,
            address_text: 'Test Address 1',
            geo_point: JSON.stringify({ lat: 24.7136, lng: 46.6753 }),
            scheduled_window_start: new Date(),
            scheduled_window_end: new Date(Date.now() + 3600000),
            status: 'confirmed',
            price_total: '150.00',
            is_solo: false,
            distance_fee: '0.00'
          },
          {
            customer_id: customerResult[1].id,
            service_id: serviceResult[0].id,
            addons: [], // Without addons
            car_type: 'suv',
            zone_id: zoneResult[0].id,
            address_text: 'Test Address 2',
            geo_point: JSON.stringify({ lat: 24.7136, lng: 46.6753 }),
            scheduled_window_start: new Date(),
            scheduled_window_end: new Date(Date.now() + 3600000),
            status: 'finished',
            price_total: '120.00',
            is_solo: true,
            distance_fee: '5.00'
          }
        ])
        .execute();

      // Create recent KPI data
      await recordDailyKPIs({
        date: new Date(),
        bookings: 15,
        aov: 135.0,
        cpl: 18.5,
        complaints_rate: 0.015,
        addons_ratio: 0.4
      });
    });

    it('should calculate marketing KPIs', async () => {
      const result = await calculateMarketingKPIs();

      expect(result).toHaveProperty('cpl');
      expect(result).toHaveProperty('conversion_rate');
      expect(result).toHaveProperty('aov');
      expect(result).toHaveProperty('addons_percentage');
      expect(result).toHaveProperty('subscriptions_growth');

      expect(typeof result.cpl).toBe('number');
      expect(typeof result.conversion_rate).toBe('number');
      expect(typeof result.aov).toBe('number');
      expect(typeof result.addons_percentage).toBe('number');
      expect(typeof result.subscriptions_growth).toBe('number');

      expect(result.cpl).toBeGreaterThan(0);
      expect(result.aov).toBeGreaterThan(0);
      expect(result.addons_percentage).toBeLessThanOrEqual(1);
      expect(result.conversion_rate).toBeGreaterThanOrEqual(0);
      expect(result.subscriptions_growth).toBeGreaterThanOrEqual(0);
    });

    it('should calculate addon percentage correctly', async () => {
      const result = await calculateMarketingKPIs();

      // We have 2 bookings, 1 with addons, so should be 0.5 (50%)
      expect(result.addons_percentage).toBeGreaterThan(0);
      expect(result.addons_percentage).toBeLessThanOrEqual(1);
    });

    it('should return reasonable values when limited data exists', async () => {
      // Clear some data but keep basic structure
      await db.delete(bookingsTable).execute();

      const result = await calculateMarketingKPIs();

      expect(result.cpl).toBeGreaterThan(0);
      expect(result.aov).toBeGreaterThanOrEqual(0);
      expect(result.conversion_rate).toBeGreaterThanOrEqual(0);
      expect(result.addons_percentage).toBeGreaterThanOrEqual(0);
      expect(result.subscriptions_growth).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully in recordDailyKPIs', async () => {
      // Test with extremely large numbers that would cause database constraint errors
      const invalidInput = {
        ...testKPIInput,
        bookings: Number.MAX_SAFE_INTEGER * 2 // This will cause issues
      };

      await expect(recordDailyKPIs(invalidInput)).rejects.toThrow();
    });

    it('should handle invalid date ranges in getKPIsByDateRange', async () => {
      const startDate = new Date('invalid');
      const endDate = new Date('2024-01-15');

      await expect(getKPIsByDateRange(startDate, endDate)).rejects.toThrow();
    });
  });
});