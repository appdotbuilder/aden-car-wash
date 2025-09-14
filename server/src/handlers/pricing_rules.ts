import { db } from '../db';
import { pricingRulesTable, zonesTable } from '../db/schema';
import { type CreatePricingRuleInput, type PricingRule } from '../schema';
import { eq } from 'drizzle-orm';

export async function getPricingRules(): Promise<PricingRule[]> {
  try {
    const results = await db.select()
      .from(pricingRulesTable)
      .execute();

    return results.map(rule => ({
      ...rule,
      // No numeric conversions needed - all fields are text/boolean
    }));
  } catch (error) {
    console.error('Get pricing rules failed:', error);
    throw error;
  }
}

export async function createPricingRule(input: CreatePricingRuleInput): Promise<PricingRule> {
  try {
    // Insert pricing rule record
    const result = await db.insert(pricingRulesTable)
      .values({
        key: input.key,
        value_json: input.value_json,
        enabled: input.enabled
      })
      .returning()
      .execute();

    const rule = result[0];
    return {
      ...rule,
      // No numeric conversions needed - all fields are text/boolean
    };
  } catch (error) {
    console.error('Pricing rule creation failed:', error);
    throw error;
  }
}

export async function getPricingRuleByKey(key: string): Promise<PricingRule | null> {
  try {
    const results = await db.select()
      .from(pricingRulesTable)
      .where(eq(pricingRulesTable.key, key))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const rule = results[0];
    return {
      ...rule,
      // No numeric conversions needed - all fields are text/boolean
    };
  } catch (error) {
    console.error('Get pricing rule by key failed:', error);
    throw error;
  }
}

export async function calculateDistanceFee(
  geo_point: { lat: number; lng: number },
  zone_id: number
): Promise<number> {
  try {
    // Get the zone information
    const zones = await db.select()
      .from(zonesTable)
      .where(eq(zonesTable.id, zone_id))
      .execute();

    if (zones.length === 0) {
      // Zone not found, apply default distance fee
      return 10; // Default fee for unknown zones
    }

    const zone = zones[0];
    
    // Parse the polygon/center data
    let zoneData;
    try {
      zoneData = JSON.parse(zone.polygon_or_center);
    } catch (parseError) {
      console.error('Invalid zone geometry data:', parseError);
      return 10; // Default fee for invalid geometry
    }

    // Get distance fee pricing rule
    const distanceFeeRule = await getPricingRuleByKey('distance_fee');
    if (!distanceFeeRule || !distanceFeeRule.enabled) {
      return 0; // No distance fee if rule disabled or missing
    }

    let ruleConfig;
    try {
      ruleConfig = JSON.parse(distanceFeeRule.value_json);
    } catch (parseError) {
      console.error('Invalid distance fee rule configuration:', parseError);
      return 0;
    }

    // Simple distance calculation based on zone center
    if (zoneData.center) {
      const distance = calculateHaversineDistance(
        geo_point.lat,
        geo_point.lng,
        zoneData.center.lat,
        zoneData.center.lng
      );

      // Apply distance fee based on configuration
      const maxFreeDistance = ruleConfig.max_free_distance_km || 5;
      const feePerKm = ruleConfig.fee_per_km || 2;
      const maxFee = ruleConfig.max_fee || 50;

      if (distance <= maxFreeDistance) {
        return 0;
      }

      const extraDistance = distance - maxFreeDistance;
      const calculatedFee = extraDistance * feePerKm;
      
      return Math.min(calculatedFee, maxFee);
    }

    // If no center data available, return default fee
    return 10;
  } catch (error) {
    console.error('Distance fee calculation failed:', error);
    return 10; // Default fee on error
  }
}

// Helper function to calculate distance between two points using Haversine formula
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}