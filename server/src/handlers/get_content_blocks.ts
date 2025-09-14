import { db } from '../db';
import { contentBlocksTable } from '../db/schema';
import { type ContentBlock } from '../schema';
import { eq, inArray, and } from 'drizzle-orm';

export async function getContentBlocks(status: 'draft' | 'published' | 'all' = 'published'): Promise<ContentBlock[]> {
  try {
    const baseQuery = db.select().from(contentBlocksTable);
    
    // Apply status filter if not 'all'
    const results = status !== 'all'
      ? await baseQuery.where(eq(contentBlocksTable.status, status)).execute()
      : await baseQuery.execute();

    return results.map(block => ({
      ...block,
      status: block.status as 'draft' | 'published',
      updated_at: block.updated_at
    }));
  } catch (error) {
    console.error('Failed to get content blocks:', error);
    throw error;
  }
}

export async function getContentBlockByKey(key: string): Promise<ContentBlock | null> {
  try {
    const results = await db.select()
      .from(contentBlocksTable)
      .where(eq(contentBlocksTable.key, key))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const block = results[0];
    return {
      ...block,
      status: block.status as 'draft' | 'published',
      updated_at: block.updated_at
    };
  } catch (error) {
    console.error('Failed to get content block by key:', error);
    throw error;
  }
}

export async function getContentBlocksByKeys(keys: string[]): Promise<ContentBlock[]> {
  try {
    if (keys.length === 0) {
      return [];
    }

    const results = await db.select()
      .from(contentBlocksTable)
      .where(inArray(contentBlocksTable.key, keys))
      .execute();

    return results.map(block => ({
      ...block,
      status: block.status as 'draft' | 'published',
      updated_at: block.updated_at
    }));
  } catch (error) {
    console.error('Failed to get content blocks by keys:', error);
    throw error;
  }
}