import { db } from '../db';
import { testimonialsTable } from '../db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { type Testimonial } from '../schema';

export async function getTestimonials(visible_only: boolean = true): Promise<Testimonial[]> {
  try {
    // Build query based on visibility filter
    const results = visible_only
      ? await db.select()
          .from(testimonialsTable)
          .where(eq(testimonialsTable.visible, true))
          .orderBy(asc(testimonialsTable.order))
          .execute()
      : await db.select()
          .from(testimonialsTable)
          .orderBy(asc(testimonialsTable.order))
          .execute();

    // Return results - all fields are already in correct format
    return results;
  } catch (error) {
    console.error('Failed to get testimonials:', error);
    throw error;
  }
}

export async function getTestimonialsByDistrict(district: string): Promise<Testimonial[]> {
  try {
    // Query testimonials filtered by district and visibility, ordered by order field
    const results = await db.select()
      .from(testimonialsTable)
      .where(and(
        eq(testimonialsTable.district, district),
        eq(testimonialsTable.visible, true)
      ))
      .orderBy(asc(testimonialsTable.order))
      .execute();

    // Return results - all fields are already in correct format
    return results;
  } catch (error) {
    console.error('Failed to get testimonials by district:', error);
    throw error;
  }
}