import { db } from '../db';
import { galleryMediaTable } from '../db/schema';
import { type GalleryMedia } from '../schema';
import { eq, and, asc, SQL } from 'drizzle-orm';

export async function getGalleryMedia(visible_only: boolean = true): Promise<GalleryMedia[]> {
  try {
    // Build query with conditional filtering
    const baseQuery = db.select().from(galleryMediaTable);
    
    const results = visible_only 
      ? await baseQuery
          .where(eq(galleryMediaTable.visible, true))
          .orderBy(asc(galleryMediaTable.order), asc(galleryMediaTable.id))
          .execute()
      : await baseQuery
          .orderBy(asc(galleryMediaTable.order), asc(galleryMediaTable.id))
          .execute();

    // Convert numeric fields and ensure proper types
    return results.map(media => ({
      ...media,
      tags: media.tags || []
    }));
  } catch (error) {
    console.error('Gallery media fetch failed:', error);
    throw error;
  }
}

export async function getGalleryMediaByFilters(
    service_filter?: string, 
    district_filter?: string
): Promise<GalleryMedia[]> {
  try {
    // Collect conditions for filtering
    const conditions: SQL<unknown>[] = [];

    // Always filter for visible items in public views
    conditions.push(eq(galleryMediaTable.visible, true));

    // Add service filter if provided
    if (service_filter) {
      conditions.push(eq(galleryMediaTable.service_filter, service_filter));
    }

    // Add district filter if provided
    if (district_filter) {
      conditions.push(eq(galleryMediaTable.district_filter, district_filter));
    }

    // Execute query with all conditions
    const results = await db.select()
      .from(galleryMediaTable)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(asc(galleryMediaTable.order), asc(galleryMediaTable.id))
      .execute();

    // Convert numeric fields and ensure proper types
    return results.map(media => ({
      ...media,
      tags: media.tags || []
    }));
  } catch (error) {
    console.error('Gallery media filtered fetch failed:', error);
    throw error;
  }
}

export async function uploadGalleryMedia(
    url: string, 
    alt_ar: string, 
    alt_en: string, 
    tags: string[] = []
): Promise<GalleryMedia> {
  try {
    // Insert new gallery media record
    const result = await db.insert(galleryMediaTable)
      .values({
        url,
        alt_ar,
        alt_en,
        tags,
        service_filter: null,
        district_filter: null,
        order: 0,
        visible: true
      })
      .returning()
      .execute();

    const media = result[0];
    
    // Ensure proper types for return value
    return {
      ...media,
      tags: media.tags || []
    };
  } catch (error) {
    console.error('Gallery media upload failed:', error);
    throw error;
  }
}