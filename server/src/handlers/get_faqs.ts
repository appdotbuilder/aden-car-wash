import { db } from '../db';
import { faqsTable } from '../db/schema';
import { type FAQ } from '../schema';
import { eq, and, sql } from 'drizzle-orm';

export async function getFaqs(visible_only: boolean = true): Promise<FAQ[]> {
  try {
    // Build conditions array
    const conditions = [];
    
    if (visible_only) {
      conditions.push(eq(faqsTable.visible, true));
    }

    // Build query with optional where clause
    const query = conditions.length > 0
      ? db.select().from(faqsTable).where(and(...conditions)).orderBy(faqsTable.order)
      : db.select().from(faqsTable).orderBy(faqsTable.order);

    const results = await query.execute();

    // Convert database results to schema types
    return results.map(faq => ({
      ...faq,
      tags: faq.tags as string[] // Cast jsonb to string array
    }));
  } catch (error) {
    console.error('Failed to fetch FAQs:', error);
    throw error;
  }
}

export async function getFaqsByTags(tags: string[]): Promise<FAQ[]> {
  try {
    if (!tags.length) {
      return [];
    }

    const conditions = [];
    
    // Add visibility condition
    conditions.push(eq(faqsTable.visible, true));

    // Add tag matching condition - PostgreSQL jsonb operator for array overlap
    // Using sql template to properly handle JSONB array operations
    const escapedTags = tags.map(tag => `'${tag.replace(/'/g, "''")}'`).join(',');
    conditions.push(
      sql`${faqsTable.tags} ?| array[${sql.raw(escapedTags)}]`
    );

    // Build and execute query
    const results = await db.select()
      .from(faqsTable)
      .where(and(...conditions))
      .orderBy(faqsTable.order)
      .execute();

    // Convert database results to schema types
    return results.map(faq => ({
      ...faq,
      tags: faq.tags as string[] // Cast jsonb to string array
    }));
  } catch (error) {
    console.error('Failed to fetch FAQs by tags:', error);
    throw error;
  }
}