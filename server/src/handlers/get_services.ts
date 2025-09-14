import { db } from '../db';
import { servicesTable } from '../db/schema';
import { type Service } from '../schema';
import { eq, desc } from 'drizzle-orm';

export async function getServices(visible_only: boolean = true): Promise<Service[]> {
  try {
    // Build query step by step without reassigning to maintain type safety
    const baseQuery = db.select().from(servicesTable);
    
    const query = visible_only
      ? baseQuery.where(eq(servicesTable.visible, true)).orderBy(servicesTable.order)
      : baseQuery.orderBy(servicesTable.order);

    const results = await query.execute();

    // Convert numeric fields from strings to numbers
    return results.map(service => ({
      ...service,
      base_price_team: parseFloat(service.base_price_team),
      base_price_solo: parseFloat(service.base_price_solo)
    }));
  } catch (error) {
    console.error('Failed to get services:', error);
    throw error;
  }
}

export async function getServiceById(id: number): Promise<Service | null> {
  try {
    const results = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const service = results[0];
    return {
      ...service,
      base_price_team: parseFloat(service.base_price_team),
      base_price_solo: parseFloat(service.base_price_solo)
    };
  } catch (error) {
    console.error('Failed to get service by ID:', error);
    throw error;
  }
}

export async function getServiceBySlug(slug: string): Promise<Service | null> {
  try {
    const results = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.slug, slug))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const service = results[0];
    return {
      ...service,
      base_price_team: parseFloat(service.base_price_team),
      base_price_solo: parseFloat(service.base_price_solo)
    };
  } catch (error) {
    console.error('Failed to get service by slug:', error);
    throw error;
  }
}