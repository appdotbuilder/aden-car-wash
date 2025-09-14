import { db } from '../db';
import { servicesTable } from '../db/schema';
import { type UpdateServiceInput, type Service } from '../schema';
import { eq } from 'drizzle-orm';

export const updateService = async (input: UpdateServiceInput): Promise<Service> => {
  try {
    // First, verify the service exists
    const existingService = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.id, input.id))
      .execute();

    if (existingService.length === 0) {
      throw new Error(`Service with ID ${input.id} not found`);
    }

    // Build update object with only provided fields
    const updateData: any = {};
    
    if (input.slug !== undefined) updateData.slug = input.slug;
    if (input.name_ar !== undefined) updateData.name_ar = input.name_ar;
    if (input.name_en !== undefined) updateData.name_en = input.name_en;
    if (input.desc_ar !== undefined) updateData.desc_ar = input.desc_ar;
    if (input.desc_en !== undefined) updateData.desc_en = input.desc_en;
    if (input.base_price_team !== undefined) updateData.base_price_team = input.base_price_team.toString();
    if (input.base_price_solo !== undefined) updateData.base_price_solo = input.base_price_solo.toString();
    if (input.est_minutes !== undefined) updateData.est_minutes = input.est_minutes;
    if (input.order !== undefined) updateData.order = input.order;
    if (input.visible !== undefined) updateData.visible = input.visible;

    // Update service record
    const result = await db.update(servicesTable)
      .set(updateData)
      .where(eq(servicesTable.id, input.id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const service = result[0];
    return {
      ...service,
      base_price_team: parseFloat(service.base_price_team),
      base_price_solo: parseFloat(service.base_price_solo)
    };
  } catch (error) {
    console.error('Service update failed:', error);
    throw error;
  }
};