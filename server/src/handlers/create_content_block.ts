import { db } from '../db';
import { contentBlocksTable } from '../db/schema';
import { type CreateContentBlockInput, type ContentBlock } from '../schema';

export const createContentBlock = async (input: CreateContentBlockInput): Promise<ContentBlock> => {
  try {
    // Insert content block record
    const result = await db.insert(contentBlocksTable)
      .values({
        key: input.key,
        ar_value: input.ar_value,
        en_value: input.en_value,
        status: input.status,
        updated_by: input.updated_by
      })
      .returning()
      .execute();

    const contentBlock = result[0];
    return {
      ...contentBlock,
      status: contentBlock.status as 'draft' | 'published'
    };
  } catch (error) {
    console.error('Content block creation failed:', error);
    throw error;
  }
};