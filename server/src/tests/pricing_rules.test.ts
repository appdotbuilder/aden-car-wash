import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { pricingRulesTable, zonesTable } from '../db/schema';
import { type CreatePricingRuleInput } from '../schema';
import { 
  getPricingRules, 
  createPricingRule, 
  getPricingRuleByKey, 
  calculateDistanceFee 
} from '../handlers/pricing_rules';
import { eq } from 'drizzle-orm';

// Test data
const testPricingRuleInput: CreatePricingRuleInput = {
  key: 'distance_fee',
  value_json: JSON.stringify({
    max_free_distance_km: 5,
    fee_per_km: 2.5,
    max_fee: 50
  }),
  enabled: true
};

const testZoneInput = {
  name_ar: 'منطقة الرياض',
  name_en: 'Riyadh Zone',
  polygon_or_center: JSON.stringify({
    center: {
      lat: 24.7136,
      lng: 46.6753
    }
  }),
  notes: 'Test zone for pricing calculations'
};

describe('createPricingRule', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a pricing rule', async () => {
    const result = await createPricingRule(testPricingRuleInput);

    expect(result.key).toEqual('distance_fee');
    expect(result.value_json).toEqual(testPricingRuleInput.value_json);
    expect(result.enabled).toEqual(true);
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
  });

  it('should save pricing rule to database', async () => {
    const result = await createPricingRule(testPricingRuleInput);

    const rules = await db.select()
      .from(pricingRulesTable)
      .where(eq(pricingRulesTable.id, result.id))
      .execute();

    expect(rules).toHaveLength(1);
    expect(rules[0].key).toEqual('distance_fee');
    expect(rules[0].value_json).toEqual(testPricingRuleInput.value_json);
    expect(rules[0].enabled).toEqual(true);
  });

  it('should create rule with default enabled value', async () => {
    const input: CreatePricingRuleInput = {
      key: 'surge_pricing',
      value_json: JSON.stringify({ multiplier: 1.5 }),
      enabled: true
    };

    const result = await createPricingRule(input);

    expect(result.enabled).toEqual(true);
  });

  it('should create rule with enabled false', async () => {
    const input: CreatePricingRuleInput = {
      key: 'holiday_surcharge',
      value_json: JSON.stringify({ rate: 0.1 }),
      enabled: false
    };

    const result = await createPricingRule(input);

    expect(result.enabled).toEqual(false);
  });
});

describe('getPricingRules', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no rules exist', async () => {
    const result = await getPricingRules();

    expect(result).toEqual([]);
  });

  it('should return all pricing rules', async () => {
    // Create multiple test rules
    await createPricingRule(testPricingRuleInput);
    await createPricingRule({
      key: 'surge_pricing',
      value_json: JSON.stringify({ multiplier: 1.5 }),
      enabled: false
    });

    const result = await getPricingRules();

    expect(result).toHaveLength(2);
    expect(result.map(r => r.key)).toContain('distance_fee');
    expect(result.map(r => r.key)).toContain('surge_pricing');
    
    // Verify all fields are present
    result.forEach(rule => {
      expect(rule.id).toBeDefined();
      expect(rule.key).toBeDefined();
      expect(rule.value_json).toBeDefined();
      expect(typeof rule.enabled).toBe('boolean');
    });
  });
});

describe('getPricingRuleByKey', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null when rule does not exist', async () => {
    const result = await getPricingRuleByKey('non_existent_key');

    expect(result).toBeNull();
  });

  it('should return pricing rule when exists', async () => {
    const createdRule = await createPricingRule(testPricingRuleInput);
    
    const result = await getPricingRuleByKey('distance_fee');

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(createdRule.id);
    expect(result!.key).toEqual('distance_fee');
    expect(result!.value_json).toEqual(testPricingRuleInput.value_json);
    expect(result!.enabled).toEqual(true);
  });

  it('should return correct rule when multiple rules exist', async () => {
    await createPricingRule(testPricingRuleInput);
    await createPricingRule({
      key: 'surge_pricing',
      value_json: JSON.stringify({ multiplier: 1.5 }),
      enabled: false
    });

    const result = await getPricingRuleByKey('surge_pricing');

    expect(result).not.toBeNull();
    expect(result!.key).toEqual('surge_pricing');
    expect(result!.enabled).toEqual(false);
  });
});

describe('calculateDistanceFee', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return 0 when no distance fee rule exists', async () => {
    // Create zone without distance fee rule
    const zoneResult = await db.insert(zonesTable)
      .values(testZoneInput)
      .returning()
      .execute();

    const result = await calculateDistanceFee(
      { lat: 24.7136, lng: 46.6753 },
      zoneResult[0].id
    );

    expect(result).toEqual(0);
  });

  it('should return 0 when distance fee rule is disabled', async () => {
    // Create disabled distance fee rule
    await createPricingRule({
      ...testPricingRuleInput,
      enabled: false
    });

    const zoneResult = await db.insert(zonesTable)
      .values(testZoneInput)
      .returning()
      .execute();

    const result = await calculateDistanceFee(
      { lat: 24.7136, lng: 46.6753 },
      zoneResult[0].id
    );

    expect(result).toEqual(0);
  });

  it('should return 0 for location within free distance', async () => {
    await createPricingRule(testPricingRuleInput);
    
    const zoneResult = await db.insert(zonesTable)
      .values(testZoneInput)
      .returning()
      .execute();

    // Location close to zone center (within 5km free distance)
    const result = await calculateDistanceFee(
      { lat: 24.7200, lng: 46.6800 }, // About 1km from center
      zoneResult[0].id
    );

    expect(result).toEqual(0);
  });

  it('should calculate distance fee for location outside free distance', async () => {
    await createPricingRule(testPricingRuleInput);
    
    const zoneResult = await db.insert(zonesTable)
      .values(testZoneInput)
      .returning()
      .execute();

    // Location far from zone center (outside 5km free distance)
    const result = await calculateDistanceFee(
      { lat: 25.0000, lng: 47.0000 }, // About 40km from center
      zoneResult[0].id
    );

    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(50); // Should not exceed max fee
  });

  it('should return default fee for non-existent zone', async () => {
    await createPricingRule(testPricingRuleInput);

    const result = await calculateDistanceFee(
      { lat: 24.7136, lng: 46.6753 },
      999 // Non-existent zone ID
    );

    expect(result).toEqual(10); // Default fee
  });

  it('should handle invalid zone geometry gracefully', async () => {
    await createPricingRule(testPricingRuleInput);
    
    // Create zone with invalid geometry data
    const invalidZoneResult = await db.insert(zonesTable)
      .values({
        ...testZoneInput,
        polygon_or_center: 'invalid json'
      })
      .returning()
      .execute();

    const result = await calculateDistanceFee(
      { lat: 24.7136, lng: 46.6753 },
      invalidZoneResult[0].id
    );

    expect(result).toEqual(10); // Default fee for invalid geometry
  });

  it('should handle invalid rule configuration gracefully', async () => {
    await createPricingRule({
      key: 'distance_fee',
      value_json: 'invalid json',
      enabled: true
    });
    
    const zoneResult = await db.insert(zonesTable)
      .values(testZoneInput)
      .returning()
      .execute();

    const result = await calculateDistanceFee(
      { lat: 24.7136, lng: 46.6753 },
      zoneResult[0].id
    );

    expect(result).toEqual(0); // Return 0 for invalid configuration
  });

  it('should apply max fee limit correctly', async () => {
    await createPricingRule({
      key: 'distance_fee',
      value_json: JSON.stringify({
        max_free_distance_km: 1,
        fee_per_km: 100, // Very high rate
        max_fee: 25 // Low max fee
      }),
      enabled: true
    });
    
    const zoneResult = await db.insert(zonesTable)
      .values(testZoneInput)
      .returning()
      .execute();

    const result = await calculateDistanceFee(
      { lat: 25.0000, lng: 47.0000 }, // Far location
      zoneResult[0].id
    );

    expect(result).toEqual(25); // Should be capped at max fee
  });
});