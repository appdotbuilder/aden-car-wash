import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { servicesTable, addonsTable, zonesTable, pricingRulesTable } from '../db/schema';
import { type PriceCalculationInput, calculatePrice } from '../handlers/calculate_price';

// Test data
const testService = {
  slug: 'basic-wash',
  name_ar: 'غسيل أساسي',
  name_en: 'Basic Wash',
  desc_ar: 'خدمة غسيل أساسية',
  desc_en: 'Basic washing service',
  base_price_team: '50.00',
  base_price_solo: '35.00',
  est_minutes: 45,
  order: 1,
  visible: true
};

const testAddon1 = {
  slug: 'interior-clean',
  name_ar: 'تنظيف داخلي',
  name_en: 'Interior Cleaning',
  desc_ar: 'تنظيف داخلي شامل',
  desc_en: 'Complete interior cleaning',
  price: '15.00',
  est_minutes: 20,
  order: 1,
  visible: true
};

const testAddon2 = {
  slug: 'wax-polish',
  name_ar: 'تلميع وشمع',
  name_en: 'Wax & Polish',
  desc_ar: 'خدمة التلميع والشمع',
  desc_en: 'Wax and polish service',
  price: '25.00',
  est_minutes: 30,
  order: 2,
  visible: true
};

const testZone = {
  name_ar: 'الرياض الوسط',
  name_en: 'Central Riyadh',
  polygon_or_center: JSON.stringify({ lat: 24.7136, lng: 46.6753 }),
  notes: 'Central zone'
};

const testInput: PriceCalculationInput = {
  service_id: 1,
  addons: [],
  car_type: 'sedan',
  zone_id: 1,
  geo_point: { lat: 24.7136, lng: 46.6753 },
  is_solo: false
};

describe('calculatePrice', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should calculate basic price for team service', async () => {
    // Create test data
    const serviceResult = await db.insert(servicesTable)
      .values(testService)
      .returning()
      .execute();

    const zoneResult = await db.insert(zonesTable)
      .values(testZone)
      .returning()
      .execute();

    const input = {
      ...testInput,
      service_id: serviceResult[0].id,
      zone_id: zoneResult[0].id,
      is_solo: false
    };

    const result = await calculatePrice(input);

    expect(result.base_price).toEqual(50);
    expect(result.addons_total).toEqual(0);
    expect(result.distance_fee).toEqual(0);
    expect(result.total_price).toEqual(50);
    expect(result.estimated_duration).toEqual(45);
  });

  it('should calculate basic price for solo service', async () => {
    // Create test data
    const serviceResult = await db.insert(servicesTable)
      .values(testService)
      .returning()
      .execute();

    const zoneResult = await db.insert(zonesTable)
      .values(testZone)
      .returning()
      .execute();

    const input = {
      ...testInput,
      service_id: serviceResult[0].id,
      zone_id: zoneResult[0].id,
      is_solo: true
    };

    const result = await calculatePrice(input);

    expect(result.base_price).toEqual(35);
    expect(result.addons_total).toEqual(0);
    expect(result.distance_fee).toEqual(0);
    expect(result.total_price).toEqual(35);
    expect(result.estimated_duration).toEqual(45);
  });

  it('should calculate price with single addon', async () => {
    // Create test data
    const serviceResult = await db.insert(servicesTable)
      .values(testService)
      .returning()
      .execute();

    const addonResult = await db.insert(addonsTable)
      .values(testAddon1)
      .returning()
      .execute();

    const zoneResult = await db.insert(zonesTable)
      .values(testZone)
      .returning()
      .execute();

    const input = {
      ...testInput,
      service_id: serviceResult[0].id,
      addons: [addonResult[0].id],
      zone_id: zoneResult[0].id
    };

    const result = await calculatePrice(input);

    expect(result.base_price).toEqual(50);
    expect(result.addons_total).toEqual(15);
    expect(result.distance_fee).toEqual(0);
    expect(result.total_price).toEqual(65);
    expect(result.estimated_duration).toEqual(65); // 45 + 20
  });

  it('should calculate price with multiple addons', async () => {
    // Create test data
    const serviceResult = await db.insert(servicesTable)
      .values(testService)
      .returning()
      .execute();

    const addon1Result = await db.insert(addonsTable)
      .values(testAddon1)
      .returning()
      .execute();

    const addon2Result = await db.insert(addonsTable)
      .values(testAddon2)
      .returning()
      .execute();

    const zoneResult = await db.insert(zonesTable)
      .values(testZone)
      .returning()
      .execute();

    const input = {
      ...testInput,
      service_id: serviceResult[0].id,
      addons: [addon1Result[0].id, addon2Result[0].id],
      zone_id: zoneResult[0].id
    };

    const result = await calculatePrice(input);

    expect(result.base_price).toEqual(50);
    expect(result.addons_total).toEqual(40); // 15 + 25
    expect(result.distance_fee).toEqual(0);
    expect(result.total_price).toEqual(90);
    expect(result.estimated_duration).toEqual(95); // 45 + 20 + 30
  });

  it('should apply distance fee when beyond free radius', async () => {
    // Create test data
    const serviceResult = await db.insert(servicesTable)
      .values(testService)
      .returning()
      .execute();

    const zoneResult = await db.insert(zonesTable)
      .values({
        ...testZone,
        polygon_or_center: JSON.stringify({ lat: 24.7136, lng: 46.6753 })
      })
      .returning()
      .execute();

    // Create distance fee pricing rule
    await db.insert(pricingRulesTable)
      .values({
        key: 'distance_fee',
        value_json: JSON.stringify({
          free_radius_km: 5,
          fee_per_km: 3
        }),
        enabled: true
      })
      .execute();

    const input = {
      ...testInput,
      service_id: serviceResult[0].id,
      zone_id: zoneResult[0].id,
      // Point ~10km away from zone center
      geo_point: { lat: 24.8, lng: 46.7 }
    };

    const result = await calculatePrice(input);

    expect(result.base_price).toEqual(50);
    expect(result.addons_total).toEqual(0);
    expect(result.distance_fee).toBeGreaterThan(0);
    expect(result.total_price).toBeGreaterThan(50);
  });

  it('should apply car type multipliers', async () => {
    // Create test data
    const serviceResult = await db.insert(servicesTable)
      .values(testService)
      .returning()
      .execute();

    const addonResult = await db.insert(addonsTable)
      .values(testAddon1)
      .returning()
      .execute();

    const zoneResult = await db.insert(zonesTable)
      .values(testZone)
      .returning()
      .execute();

    // Create car type pricing rule
    await db.insert(pricingRulesTable)
      .values({
        key: 'car_type_multipliers',
        value_json: JSON.stringify({
          sedan: 1.0,
          suv: 1.2,
          pickup: 1.5
        }),
        enabled: true
      })
      .execute();

    const inputSUV = {
      ...testInput,
      service_id: serviceResult[0].id,
      addons: [addonResult[0].id],
      zone_id: zoneResult[0].id,
      car_type: 'suv' as const
    };

    const result = await calculatePrice(inputSUV);

    expect(result.base_price).toEqual(60); // 50 * 1.2
    expect(result.addons_total).toEqual(18); // 15 * 1.2
    expect(result.distance_fee).toEqual(0);
    expect(result.total_price).toEqual(78);
    expect(result.estimated_duration).toEqual(65);
  });

  it('should throw error for non-existent service', async () => {
    const zoneResult = await db.insert(zonesTable)
      .values(testZone)
      .returning()
      .execute();

    const input = {
      ...testInput,
      service_id: 999,
      zone_id: zoneResult[0].id
    };

    await expect(calculatePrice(input)).rejects.toThrow(/Service with ID 999 not found/i);
  });

  it('should throw error for non-existent zone', async () => {
    const serviceResult = await db.insert(servicesTable)
      .values(testService)
      .returning()
      .execute();

    const input = {
      ...testInput,
      service_id: serviceResult[0].id,
      zone_id: 999
    };

    await expect(calculatePrice(input)).rejects.toThrow(/Zone with ID 999 not found/i);
  });

  it('should handle missing addons gracefully', async () => {
    // Create test data
    const serviceResult = await db.insert(servicesTable)
      .values(testService)
      .returning()
      .execute();

    const zoneResult = await db.insert(zonesTable)
      .values(testZone)
      .returning()
      .execute();

    const input = {
      ...testInput,
      service_id: serviceResult[0].id,
      zone_id: zoneResult[0].id,
      addons: [999] // Non-existent addon
    };

    const result = await calculatePrice(input);

    // Should still work but with 0 addons total
    expect(result.base_price).toEqual(50);
    expect(result.addons_total).toEqual(0);
    expect(result.total_price).toEqual(50);
  });

  it('should handle malformed pricing rules gracefully', async () => {
    // Create test data
    const serviceResult = await db.insert(servicesTable)
      .values(testService)
      .returning()
      .execute();

    const zoneResult = await db.insert(zonesTable)
      .values(testZone)
      .returning()
      .execute();

    // Create malformed pricing rule
    await db.insert(pricingRulesTable)
      .values({
        key: 'distance_fee',
        value_json: 'invalid json',
        enabled: true
      })
      .execute();

    const input = {
      ...testInput,
      service_id: serviceResult[0].id,
      zone_id: zoneResult[0].id
    };

    const result = await calculatePrice(input);

    // Should still work with default values
    expect(result.base_price).toEqual(50);
    expect(result.distance_fee).toEqual(0);
    expect(result.total_price).toEqual(50);
  });

  it('should calculate complex scenario with all features', async () => {
    // Create test data
    const serviceResult = await db.insert(servicesTable)
      .values(testService)
      .returning()
      .execute();

    const addon1Result = await db.insert(addonsTable)
      .values(testAddon1)
      .returning()
      .execute();

    const addon2Result = await db.insert(addonsTable)
      .values(testAddon2)
      .returning()
      .execute();

    const zoneResult = await db.insert(zonesTable)
      .values(testZone)
      .returning()
      .execute();

    // Create pricing rules
    await db.insert(pricingRulesTable)
      .values({
        key: 'car_type_multipliers',
        value_json: JSON.stringify({
          sedan: 1.0,
          suv: 1.2,
          pickup: 1.5
        }),
        enabled: true
      })
      .execute();

    await db.insert(pricingRulesTable)
      .values({
        key: 'distance_fee',
        value_json: JSON.stringify({
          free_radius_km: 2,
          fee_per_km: 2
        }),
        enabled: true
      })
      .execute();

    const input = {
      ...testInput,
      service_id: serviceResult[0].id,
      addons: [addon1Result[0].id, addon2Result[0].id],
      zone_id: zoneResult[0].id,
      car_type: 'pickup' as const,
      is_solo: true,
      geo_point: { lat: 24.75, lng: 46.7 } // ~5km away
    };

    const result = await calculatePrice(input);

    // Solo service: 35 * 1.5 = 52.5
    // Addons: (15 + 25) * 1.5 = 60
    // Distance fee: ~6 (3km beyond free radius * 2)
    expect(result.base_price).toEqual(52.5);
    expect(result.addons_total).toEqual(60);
    expect(result.distance_fee).toBeGreaterThan(0);
    expect(result.total_price).toBeGreaterThan(110);
    expect(result.estimated_duration).toEqual(95); // 45 + 20 + 30
  });
});