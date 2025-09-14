import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { contentBlocksTable } from '../db/schema';
import { type CreateContentBlockInput } from '../schema';
import { getContentBlocks, getContentBlockByKey, getContentBlocksByKeys } from '../handlers/get_content_blocks';

// Test data
const testContentBlocks: CreateContentBlockInput[] = [
  {
    key: 'hero_title',
    ar_value: 'عنوان البطل',
    en_value: 'Hero Title',
    status: 'published',
    updated_by: 'admin'
  },
  {
    key: 'hero_subtitle',
    ar_value: 'عنوان فرعي للبطل',
    en_value: 'Hero Subtitle',
    status: 'draft',
    updated_by: 'editor'
  },
  {
    key: 'contact_phone',
    ar_value: '+966501234567',
    en_value: '+966501234567',
    status: 'published',
    updated_by: 'admin'
  },
  {
    key: 'about_us_text',
    ar_value: 'نص حولنا',
    en_value: 'About us text',
    status: 'published',
    updated_by: 'content_manager'
  }
];

describe('getContentBlocks', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  beforeEach(async () => {
    // Insert test content blocks
    await db.insert(contentBlocksTable)
      .values(testContentBlocks)
      .execute();
  });

  describe('getContentBlocks', () => {
    it('should get all published content blocks by default', async () => {
      const result = await getContentBlocks();

      expect(result).toHaveLength(3); // Only published blocks
      
      const keys = result.map(block => block.key);
      expect(keys).toContain('hero_title');
      expect(keys).toContain('contact_phone');
      expect(keys).toContain('about_us_text');
      expect(keys).not.toContain('hero_subtitle'); // Draft should not be included

      // Verify each block has correct structure
      result.forEach(block => {
        expect(block.id).toBeDefined();
        expect(block.key).toBeDefined();
        expect(block.ar_value).toBeDefined();
        expect(block.en_value).toBeDefined();
        expect(block.status).toEqual('published');
        expect(block.updated_by).toBeDefined();
        expect(block.updated_at).toBeInstanceOf(Date);
      });
    });

    it('should get all published content blocks when status is explicitly set to published', async () => {
      const result = await getContentBlocks('published');

      expect(result).toHaveLength(3);
      result.forEach(block => {
        expect(block.status).toEqual('published');
      });
    });

    it('should get all draft content blocks when status is draft', async () => {
      const result = await getContentBlocks('draft');

      expect(result).toHaveLength(1);
      expect(result[0].key).toEqual('hero_subtitle');
      expect(result[0].status).toEqual('draft');
      expect(result[0].ar_value).toEqual('عنوان فرعي للبطل');
      expect(result[0].en_value).toEqual('Hero Subtitle');
      expect(result[0].updated_by).toEqual('editor');
    });

    it('should get all content blocks when status is all', async () => {
      const result = await getContentBlocks('all');

      expect(result).toHaveLength(4);
      
      const statuses = result.map(block => block.status);
      expect(statuses).toContain('published');
      expect(statuses).toContain('draft');
    });

    it('should return empty array when no content blocks exist', async () => {
      // Clear all content blocks
      await db.delete(contentBlocksTable).execute();

      const result = await getContentBlocks();
      expect(result).toHaveLength(0);
    });
  });

  describe('getContentBlockByKey', () => {
    it('should get content block by key', async () => {
      const result = await getContentBlockByKey('hero_title');

      expect(result).not.toBeNull();
      expect(result!.key).toEqual('hero_title');
      expect(result!.ar_value).toEqual('عنوان البطل');
      expect(result!.en_value).toEqual('Hero Title');
      expect(result!.status).toEqual('published');
      expect(result!.updated_by).toEqual('admin');
      expect(result!.updated_at).toBeInstanceOf(Date);
      expect(result!.id).toBeDefined();
    });

    it('should get draft content block by key', async () => {
      const result = await getContentBlockByKey('hero_subtitle');

      expect(result).not.toBeNull();
      expect(result!.key).toEqual('hero_subtitle');
      expect(result!.status).toEqual('draft');
      expect(result!.updated_by).toEqual('editor');
    });

    it('should return null when content block key does not exist', async () => {
      const result = await getContentBlockByKey('nonexistent_key');

      expect(result).toBeNull();
    });

    it('should handle special characters in key', async () => {
      // Insert a content block with special characters
      await db.insert(contentBlocksTable)
        .values({
          key: 'special-key_123',
          ar_value: 'قيمة خاصة',
          en_value: 'Special value',
          status: 'published',
          updated_by: 'admin'
        })
        .execute();

      const result = await getContentBlockByKey('special-key_123');

      expect(result).not.toBeNull();
      expect(result!.key).toEqual('special-key_123');
      expect(result!.ar_value).toEqual('قيمة خاصة');
    });
  });

  describe('getContentBlocksByKeys', () => {
    it('should get multiple content blocks by keys', async () => {
      const keys = ['hero_title', 'contact_phone', 'about_us_text'];
      const result = await getContentBlocksByKeys(keys);

      expect(result).toHaveLength(3);
      
      const resultKeys = result.map(block => block.key);
      expect(resultKeys).toContain('hero_title');
      expect(resultKeys).toContain('contact_phone');
      expect(resultKeys).toContain('about_us_text');

      // Verify content is correct
      const heroTitle = result.find(block => block.key === 'hero_title');
      expect(heroTitle!.ar_value).toEqual('عنوان البطل');
      expect(heroTitle!.en_value).toEqual('Hero Title');
      expect(heroTitle!.status).toEqual('published');
    });

    it('should get both published and draft content blocks by keys', async () => {
      const keys = ['hero_title', 'hero_subtitle']; // One published, one draft
      const result = await getContentBlocksByKeys(keys);

      expect(result).toHaveLength(2);
      
      const statuses = result.map(block => block.status);
      expect(statuses).toContain('published');
      expect(statuses).toContain('draft');
    });

    it('should return only existing content blocks when some keys do not exist', async () => {
      const keys = ['hero_title', 'nonexistent_key', 'contact_phone'];
      const result = await getContentBlocksByKeys(keys);

      expect(result).toHaveLength(2);
      
      const resultKeys = result.map(block => block.key);
      expect(resultKeys).toContain('hero_title');
      expect(resultKeys).toContain('contact_phone');
      expect(resultKeys).not.toContain('nonexistent_key');
    });

    it('should return empty array when no keys match', async () => {
      const keys = ['nonexistent1', 'nonexistent2'];
      const result = await getContentBlocksByKeys(keys);

      expect(result).toHaveLength(0);
    });

    it('should return empty array when keys array is empty', async () => {
      const result = await getContentBlocksByKeys([]);

      expect(result).toHaveLength(0);
    });

    it('should handle single key in array', async () => {
      const keys = ['hero_title'];
      const result = await getContentBlocksByKeys(keys);

      expect(result).toHaveLength(1);
      expect(result[0].key).toEqual('hero_title');
      expect(result[0].ar_value).toEqual('عنوان البطل');
    });

    it('should handle duplicate keys in array', async () => {
      const keys = ['hero_title', 'hero_title', 'contact_phone'];
      const result = await getContentBlocksByKeys(keys);

      // Should not return duplicates
      expect(result).toHaveLength(2);
      
      const resultKeys = result.map(block => block.key);
      expect(resultKeys).toContain('hero_title');
      expect(resultKeys).toContain('contact_phone');
    });
  });

  it('should verify database operations work correctly', async () => {
    // Test that we can query the database directly
    const allBlocks = await db.select().from(contentBlocksTable).execute();
    expect(allBlocks).toHaveLength(4);

    // Test that our handler returns the same data structure
    const handlerResult = await getContentBlocks('all');
    expect(handlerResult).toHaveLength(4);

    // Verify data consistency
    handlerResult.forEach(block => {
      const dbBlock = allBlocks.find(b => b.id === block.id);
      expect(dbBlock).toBeDefined();
      expect(block.key).toEqual(dbBlock!.key);
      expect(block.ar_value).toEqual(dbBlock!.ar_value);
      expect(block.en_value).toEqual(dbBlock!.en_value);
      expect(block.status).toEqual(dbBlock!.status as 'draft' | 'published');
      expect(block.updated_by).toEqual(dbBlock!.updated_by);
    });
  });
});