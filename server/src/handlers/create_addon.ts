import { db } from '../db';
import { addonsTable } from '../db/schema';
import { type CreateAddonInput, type Addon } from '../schema';

export const createAddon = async (input: CreateAddonInput): Promise<Addon> => {
  try {
    // Insert addon record
    const result = await db.insert(addonsTable)
      .values({
        slug: input.slug,
        name_ar: input.name_ar,
        name_en: input.name_en,
        desc_ar: input.desc_ar,
        desc_en: input.desc_en,
        price: input.price.toString(), // Convert number to string for numeric column
        est_minutes: input.est_minutes, // Integer column - no conversion needed
        order: input.order, // Integer column - no conversion needed
        visible: input.visible // Boolean column - no conversion needed
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const addon = result[0];
    return {
      ...addon,
      price: parseFloat(addon.price) // Convert string back to number
    };
  } catch (error) {
    console.error('Addon creation failed:', error);
    throw error;
  }
};