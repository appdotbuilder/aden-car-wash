import { db } from '../db';
import { servicesTable } from '../db/schema';
import { type CreateServiceInput, type Service } from '../schema';

export const createService = async (input: CreateServiceInput): Promise<Service> => {
  try {
    // Insert service record
    const result = await db.insert(servicesTable)
      .values({
        slug: input.slug,
        name_ar: input.name_ar,
        name_en: input.name_en,
        desc_ar: input.desc_ar,
        desc_en: input.desc_en,
        base_price_team: input.base_price_team.toString(), // Convert number to string for numeric column
        base_price_solo: input.base_price_solo.toString(), // Convert number to string for numeric column
        est_minutes: input.est_minutes, // Integer column - no conversion needed
        order: input.order, // Integer column - no conversion needed
        visible: input.visible // Boolean column - no conversion needed
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const service = result[0];
    return {
      ...service,
      base_price_team: parseFloat(service.base_price_team), // Convert string back to number
      base_price_solo: parseFloat(service.base_price_solo) // Convert string back to number
    };
  } catch (error) {
    console.error('Service creation failed:', error);
    throw error;
  }
};