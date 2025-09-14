import { db } from '../db';
import { zonesTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type Zone } from '../schema';

export async function getZones(): Promise<Zone[]> {
  try {
    const results = await db.select()
      .from(zonesTable)
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch zones:', error);
    throw error;
  }
}

export async function getZoneById(id: number): Promise<Zone | null> {
  try {
    const results = await db.select()
      .from(zonesTable)
      .where(eq(zonesTable.id, id))
      .execute();

    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Failed to fetch zone by ID:', error);
    throw error;
  }
}

export async function getZoneByLocation(lat: number, lng: number): Promise<Zone | null> {
  try {
    // Get all zones and check each one to see if the location falls within its boundaries
    const zones = await db.select()
      .from(zonesTable)
      .execute();

    for (const zone of zones) {
      if (isLocationInZone(lat, lng, zone.polygon_or_center)) {
        return zone;
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to find zone by location:', error);
    throw error;
  }
}

// Helper function to check if a point is inside a zone
function isLocationInZone(lat: number, lng: number, polygonOrCenter: string): boolean {
  try {
    const geoData = JSON.parse(polygonOrCenter);
    
    // If it's a center point (for circular zones), check distance
    if (geoData.type === 'center') {
      const distance = calculateDistance(
        lat, lng,
        geoData.lat, geoData.lng
      );
      // Assume radius in meters (adjust as needed for your business logic)
      const radiusKm = geoData.radius || 10; // Default 10km radius
      return distance <= radiusKm;
    }
    
    // If it's a polygon, use point-in-polygon algorithm
    if (geoData.type === 'polygon' && geoData.coordinates) {
      return isPointInPolygon(lat, lng, geoData.coordinates);
    }

    return false;
  } catch (parseError) {
    console.error('Failed to parse zone geometry:', parseError);
    return false;
  }
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Point-in-polygon algorithm using ray casting
function isPointInPolygon(lat: number, lng: number, polygon: Array<{lat: number, lng: number}>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (
      ((polygon[i].lat > lat) !== (polygon[j].lat > lat)) &&
      (lng < (polygon[j].lng - polygon[i].lng) * (lat - polygon[i].lat) / (polygon[j].lat - polygon[i].lat) + polygon[i].lng)
    ) {
      inside = !inside;
    }
  }
  return inside;
}