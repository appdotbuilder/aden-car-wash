import { db } from '../db';
import { servicesTable, addonsTable, zonesTable, pricingRulesTable } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export interface PriceCalculationInput {
    service_id: number;
    addons: number[];
    car_type: 'sedan' | 'suv' | 'pickup';
    zone_id: number;
    geo_point: { lat: number; lng: number };
    is_solo: boolean;
}

export interface PriceCalculationResult {
    base_price: number;
    addons_total: number;
    distance_fee: number;
    total_price: number;
    estimated_duration: number;
}

export const calculatePrice = async (input: PriceCalculationInput): Promise<PriceCalculationResult> => {
    try {
        // 1. Get service base price (team vs solo)
        const serviceResults = await db.select()
            .from(servicesTable)
            .where(eq(servicesTable.id, input.service_id))
            .execute();

        if (serviceResults.length === 0) {
            throw new Error(`Service with ID ${input.service_id} not found`);
        }

        const service = serviceResults[0];
        const base_price = input.is_solo 
            ? parseFloat(service.base_price_solo)
            : parseFloat(service.base_price_team);

        let estimated_duration = service.est_minutes;

        // 2. Calculate addons total
        let addons_total = 0;
        if (input.addons.length > 0) {
            const addonResults = await db.select()
                .from(addonsTable)
                .where(inArray(addonsTable.id, input.addons))
                .execute();

            addons_total = addonResults.reduce((total, addon) => {
                estimated_duration += addon.est_minutes;
                return total + parseFloat(addon.price);
            }, 0);
        }

        // 3. Verify zone exists
        const zoneResults = await db.select()
            .from(zonesTable)
            .where(eq(zonesTable.id, input.zone_id))
            .execute();

        if (zoneResults.length === 0) {
            throw new Error(`Zone with ID ${input.zone_id} not found`);
        }

        // 4. Check if location requires distance fee
        let distance_fee = 0;
        
        // Get distance fee pricing rule
        const distanceFeeRules = await db.select()
            .from(pricingRulesTable)
            .where(and(
                eq(pricingRulesTable.key, 'distance_fee'),
                eq(pricingRulesTable.enabled, true)
            ))
            .execute();

        if (distanceFeeRules.length > 0) {
            try {
                const distanceRule = JSON.parse(distanceFeeRules[0].value_json);
                
                // Simple distance calculation based on zone center
                // In a real implementation, this would use proper geospatial calculations
                const zone = zoneResults[0];
                const zoneCenter = JSON.parse(zone.polygon_or_center);
                
                // Calculate distance if zone center has coordinates
                if (zoneCenter.lat && zoneCenter.lng) {
                    const distance = calculateDistance(
                        input.geo_point.lat, input.geo_point.lng,
                        zoneCenter.lat, zoneCenter.lng
                    );
                    
                    // Apply distance fee if beyond threshold
                    if (distance > (distanceRule.free_radius_km || 5)) {
                        const extra_distance = distance - (distanceRule.free_radius_km || 5);
                        distance_fee = extra_distance * (distanceRule.fee_per_km || 5);
                    }
                }
            } catch (error) {
                console.error('Error parsing distance fee rule:', error);
            }
        }

        // 5. Apply car type pricing adjustments
        const carTypePricingRules = await db.select()
            .from(pricingRulesTable)
            .where(and(
                eq(pricingRulesTable.key, 'car_type_multipliers'),
                eq(pricingRulesTable.enabled, true)
            ))
            .execute();

        let car_type_multiplier = 1;
        if (carTypePricingRules.length > 0) {
            try {
                const carTypeRule = JSON.parse(carTypePricingRules[0].value_json);
                car_type_multiplier = carTypeRule[input.car_type] || 1;
            } catch (error) {
                console.error('Error parsing car type rule:', error);
            }
        }

        // Apply car type multiplier to base price and addons
        const adjusted_base_price = base_price * car_type_multiplier;
        const adjusted_addons_total = addons_total * car_type_multiplier;

        const total_price = adjusted_base_price + adjusted_addons_total + distance_fee;

        return {
            base_price: adjusted_base_price,
            addons_total: adjusted_addons_total,
            distance_fee,
            total_price,
            estimated_duration
        };
    } catch (error) {
        console.error('Price calculation failed:', error);
        throw error;
    }
};

// Helper function to calculate distance between two points (Haversine formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}