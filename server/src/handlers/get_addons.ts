import { db } from '../db';
import { addonsTable } from '../db/schema';
import { type Addon } from '../schema';
import { eq, inArray } from 'drizzle-orm';

export async function getAddons(visible_only: boolean = true): Promise<Addon[]> {
  try {
    const baseQuery = db.select().from(addonsTable);
    
    const results = visible_only 
      ? await baseQuery
          .where(eq(addonsTable.visible, true))
          .orderBy(addonsTable.order, addonsTable.id)
          .execute()
      : await baseQuery
          .orderBy(addonsTable.order, addonsTable.id)
          .execute();

    // Convert numeric fields back to numbers
    return results.map(addon => ({
      ...addon,
      price: parseFloat(addon.price)
    }));
  } catch (error) {
    console.error('Failed to fetch addons:', error);
    throw error;
  }
}

export async function getAddonById(id: number): Promise<Addon | null> {
  try {
    const results = await db.select()
      .from(addonsTable)
      .where(eq(addonsTable.id, id))
      .limit(1)
      .execute();

    if (results.length === 0) {
      return null;
    }

    const addon = results[0];
    return {
      ...addon,
      price: parseFloat(addon.price)
    };
  } catch (error) {
    console.error('Failed to fetch addon by ID:', error);
    throw error;
  }
}

export async function getAddonsByIds(ids: number[]): Promise<Addon[]> {
  try {
    if (ids.length === 0) {
      return [];
    }

    const results = await db.select()
      .from(addonsTable)
      .where(inArray(addonsTable.id, ids))
      .orderBy(addonsTable.order, addonsTable.id)
      .execute();

    // Convert numeric fields back to numbers
    return results.map(addon => ({
      ...addon,
      price: parseFloat(addon.price)
    }));
  } catch (error) {
    console.error('Failed to fetch addons by IDs:', error);
    throw error;
  }
}