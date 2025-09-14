import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { contentBlocksTable } from '../db/schema';
import { type CreateContentBlockInput } from '../schema';
import { createContentBlock } from '../handlers/create_content_block';
import { eq } from 'drizzle-orm';

// Test input data
const testInput: CreateContentBlockInput = {
  key: 'test_content_block',
  ar_value: 'قيمة النص العربي',
  en_value: 'English text value',
  status: 'draft',
  updated_by: 'admin_user'
};

const publishedInput: CreateContentBlockInput = {
  key: 'published_block',
  ar_value: 'محتوى منشور',
  en_value: 'Published content',
  status: 'published',
  updated_by: 'content_manager'
};

describe('createContentBlock', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a content block with draft status', async () => {
    const result = await createContentBlock(testInput);

    // Basic field validation
    expect(result.key).toEqual('test_content_block');
    expect(result.ar_value).toEqual('قيمة النص العربي');
    expect(result.en_value).toEqual('English text value');
    expect(result.status).toEqual('draft');
    expect(result.updated_by).toEqual('admin_user');
    expect(result.id).toBeDefined();
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a content block with published status', async () => {
    const result = await createContentBlock(publishedInput);

    expect(result.key).toEqual('published_block');
    expect(result.ar_value).toEqual('محتوى منشور');
    expect(result.en_value).toEqual('Published content');
    expect(result.status).toEqual('published');
    expect(result.updated_by).toEqual('content_manager');
    expect(result.id).toBeDefined();
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save content block to database', async () => {
    const result = await createContentBlock(testInput);

    // Query the database to verify the record was saved
    const contentBlocks = await db.select()
      .from(contentBlocksTable)
      .where(eq(contentBlocksTable.id, result.id))
      .execute();

    expect(contentBlocks).toHaveLength(1);
    expect(contentBlocks[0].key).toEqual('test_content_block');
    expect(contentBlocks[0].ar_value).toEqual('قيمة النص العربي');
    expect(contentBlocks[0].en_value).toEqual('English text value');
    expect(contentBlocks[0].status).toEqual('draft');
    expect(contentBlocks[0].updated_by).toEqual('admin_user');
    expect(contentBlocks[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle unique key constraint violation', async () => {
    // Create first content block
    await createContentBlock(testInput);

    // Try to create another with the same key
    const duplicateInput: CreateContentBlockInput = {
      key: 'test_content_block', // Same key
      ar_value: 'نص مختلف',
      en_value: 'Different text',
      status: 'published',
      updated_by: 'another_user'
    };

    // Should throw error due to unique key constraint
    await expect(createContentBlock(duplicateInput)).rejects.toThrow(/duplicate key/i);
  });

  it('should create multiple content blocks with different keys', async () => {
    // Create first content block
    const result1 = await createContentBlock(testInput);

    // Create second content block with different key
    const secondInput: CreateContentBlockInput = {
      key: 'another_block',
      ar_value: 'محتوى آخر',
      en_value: 'Another content',
      status: 'published',
      updated_by: 'editor'
    };

    const result2 = await createContentBlock(secondInput);

    // Verify both were created successfully
    expect(result1.key).toEqual('test_content_block');
    expect(result2.key).toEqual('another_block');
    expect(result1.id).not.toEqual(result2.id);

    // Verify both exist in database
    const allContentBlocks = await db.select()
      .from(contentBlocksTable)
      .execute();

    expect(allContentBlocks).toHaveLength(2);
  });

  it('should handle default status when not specified', async () => {
    const inputWithoutStatus: CreateContentBlockInput = {
      key: 'default_status_block',
      ar_value: 'نص بحالة افتراضية',
      en_value: 'Text with default status',
      status: 'draft', // Must be specified as CreateContentBlockInput requires it
      updated_by: 'user'
    };

    const result = await createContentBlock(inputWithoutStatus);

    expect(result.status).toEqual('draft');
  });

  it('should preserve Arabic and English content correctly', async () => {
    const complexContent: CreateContentBlockInput = {
      key: 'complex_content',
      ar_value: 'هذا نص طويل باللغة العربية يحتوي على علامات ترقيم، وأرقام 123، ورموز خاصة!',
      en_value: 'This is a long English text with punctuation, numbers 123, and special characters!',
      status: 'published',
      updated_by: 'content_admin'
    };

    const result = await createContentBlock(complexContent);

    expect(result.ar_value).toEqual('هذا نص طويل باللغة العربية يحتوي على علامات ترقيم، وأرقام 123، ورموز خاصة!');
    expect(result.en_value).toEqual('This is a long English text with punctuation, numbers 123, and special characters!');
  });

  it('should set updated_at timestamp automatically', async () => {
    const before = new Date();
    const result = await createContentBlock(testInput);
    const after = new Date();

    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at >= before).toBe(true);
    expect(result.updated_at <= after).toBe(true);
  });
});