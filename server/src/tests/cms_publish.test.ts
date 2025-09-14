import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { contentBlocksTable } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import {
  publishContentBlocks,
  createContentVersion,
  rollbackContent,
  revalidateCache
} from '../handlers/cms_publish';

describe('CMS Publish Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('publishContentBlocks', () => {
    it('should publish multiple content blocks', async () => {
      // Create test content blocks
      await db.insert(contentBlocksTable).values([
        {
          key: 'hero.title',
          ar_value: 'عنوان البطل',
          en_value: 'Hero Title',
          status: 'draft',
          updated_by: 'admin'
        },
        {
          key: 'footer.text',
          ar_value: 'نص التذييل',
          en_value: 'Footer Text',
          status: 'draft',
          updated_by: 'admin'
        }
      ]).execute();

      const result = await publishContentBlocks(['hero.title', 'footer.text']);

      expect(result.published).toBe(2);
      expect(result.errors).toHaveLength(0);

      // Verify blocks are published
      const publishedBlocks = await db.select()
        .from(contentBlocksTable)
        .where(inArray(contentBlocksTable.key, ['hero.title', 'footer.text']))
        .execute();

      expect(publishedBlocks).toHaveLength(2);
      publishedBlocks.forEach(block => {
        expect(block.status).toBe('published');
        expect(block.updated_at).toBeInstanceOf(Date);
      });
    });

    it('should handle empty keys array', async () => {
      const result = await publishContentBlocks([]);

      expect(result.published).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle non-existent keys gracefully', async () => {
      const result = await publishContentBlocks(['non.existent.key']);

      expect(result.published).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should publish only existing content blocks', async () => {
      // Create one test content block
      await db.insert(contentBlocksTable).values({
        key: 'existing.key',
        ar_value: 'قيمة موجودة',
        en_value: 'Existing Value',
        status: 'draft',
        updated_by: 'admin'
      }).execute();

      const result = await publishContentBlocks(['existing.key', 'non.existent.key']);

      expect(result.published).toBe(1);
      expect(result.errors).toHaveLength(0);

      // Verify only the existing block was published
      const publishedBlock = await db.select()
        .from(contentBlocksTable)
        .where(eq(contentBlocksTable.key, 'existing.key'))
        .execute();

      expect(publishedBlock).toHaveLength(1);
      expect(publishedBlock[0].status).toBe('published');
    });
  });

  describe('createContentVersion', () => {
    it('should create new content block', async () => {
      await createContentVersion(
        'new.content',
        'محتوى جديد',
        'New Content',
        'editor1'
      );

      const contentBlocks = await db.select()
        .from(contentBlocksTable)
        .where(eq(contentBlocksTable.key, 'new.content'))
        .execute();

      expect(contentBlocks).toHaveLength(1);
      expect(contentBlocks[0].ar_value).toBe('محتوى جديد');
      expect(contentBlocks[0].en_value).toBe('New Content');
      expect(contentBlocks[0].updated_by).toBe('editor1');
      expect(contentBlocks[0].status).toBe('draft');
      expect(contentBlocks[0].updated_at).toBeInstanceOf(Date);
    });

    it('should update existing content block', async () => {
      // Create initial content block
      await db.insert(contentBlocksTable).values({
        key: 'existing.content',
        ar_value: 'محتوى قديم',
        en_value: 'Old Content',
        status: 'published',
        updated_by: 'original_editor'
      }).execute();

      await createContentVersion(
        'existing.content',
        'محتوى محدث',
        'Updated Content',
        'new_editor'
      );

      const contentBlocks = await db.select()
        .from(contentBlocksTable)
        .where(eq(contentBlocksTable.key, 'existing.content'))
        .execute();

      expect(contentBlocks).toHaveLength(1);
      expect(contentBlocks[0].ar_value).toBe('محتوى محدث');
      expect(contentBlocks[0].en_value).toBe('Updated Content');
      expect(contentBlocks[0].updated_by).toBe('new_editor');
      expect(contentBlocks[0].status).toBe('draft'); // New versions start as draft
    });

    it('should handle content with special characters', async () => {
      const specialArabic = 'نص يحتوي على رموز خاصة: @#$%^&*()';
      const specialEnglish = 'Text with special chars: @#$%^&*()';

      await createContentVersion(
        'special.content',
        specialArabic,
        specialEnglish,
        'content_manager'
      );

      const contentBlock = await db.select()
        .from(contentBlocksTable)
        .where(eq(contentBlocksTable.key, 'special.content'))
        .execute();

      expect(contentBlock).toHaveLength(1);
      expect(contentBlock[0].ar_value).toBe(specialArabic);
      expect(contentBlock[0].en_value).toBe(specialEnglish);
    });
  });

  describe('rollbackContent', () => {
    it('should rollback existing content to draft status', async () => {
      // Create published content block
      await db.insert(contentBlocksTable).values({
        key: 'rollback.test',
        ar_value: 'محتوى منشور',
        en_value: 'Published Content',
        status: 'published',
        updated_by: 'editor'
      }).execute();

      const result = await rollbackContent('rollback.test', 1);

      expect(result).toBe(true);

      // Verify content is back to draft
      const contentBlock = await db.select()
        .from(contentBlocksTable)
        .where(eq(contentBlocksTable.key, 'rollback.test'))
        .execute();

      expect(contentBlock).toHaveLength(1);
      expect(contentBlock[0].status).toBe('draft');
      expect(contentBlock[0].updated_at).toBeInstanceOf(Date);
    });

    it('should return false for non-existent content', async () => {
      const result = await rollbackContent('non.existent.key', 1);

      expect(result).toBe(false);
    });

    it('should handle rollback with invalid version ID', async () => {
      // Create content block
      await db.insert(contentBlocksTable).values({
        key: 'test.content',
        ar_value: 'محتوى للاختبار',
        en_value: 'Test Content',
        status: 'published',
        updated_by: 'editor'
      }).execute();

      // Rollback with invalid version ID should still work (simulated)
      const result = await rollbackContent('test.content', 999);

      expect(result).toBe(true);

      const contentBlock = await db.select()
        .from(contentBlocksTable)
        .where(eq(contentBlocksTable.key, 'test.content'))
        .execute();

      expect(contentBlock[0].status).toBe('draft');
    });
  });

  describe('revalidateCache', () => {
    it('should complete cache revalidation for multiple paths', async () => {
      const paths = ['/home', '/about', '/services'];
      
      // Should not throw and complete successfully
      await expect(revalidateCache(paths)).resolves.toBeUndefined();
    });

    it('should handle empty paths array', async () => {
      await expect(revalidateCache([])).resolves.toBeUndefined();
    });

    it('should handle paths with special characters', async () => {
      const paths = ['/ar/الخدمات', '/en/services?category=cleaning'];
      
      await expect(revalidateCache(paths)).resolves.toBeUndefined();
    });

    it('should simulate async revalidation process', async () => {
      const startTime = Date.now();
      await revalidateCache(['/test-path']);
      const endTime = Date.now();

      // Should take at least 100ms due to simulated delay
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Integration workflow', () => {
    it('should handle complete content lifecycle', async () => {
      const contentKey = 'workflow.test';
      
      // 1. Create content version
      await createContentVersion(
        contentKey,
        'محتوى دورة العمل',
        'Workflow Content',
        'content_creator'
      );

      let content = await db.select()
        .from(contentBlocksTable)
        .where(eq(contentBlocksTable.key, contentKey))
        .execute();

      expect(content[0].status).toBe('draft');

      // 2. Publish content
      const publishResult = await publishContentBlocks([contentKey]);
      expect(publishResult.published).toBe(1);

      content = await db.select()
        .from(contentBlocksTable)
        .where(eq(contentBlocksTable.key, contentKey))
        .execute();

      expect(content[0].status).toBe('published');

      // 3. Revalidate cache
      await expect(revalidateCache(['/workflow-page'])).resolves.toBeUndefined();

      // 4. Rollback content
      const rollbackResult = await rollbackContent(contentKey, 1);
      expect(rollbackResult).toBe(true);

      content = await db.select()
        .from(contentBlocksTable)
        .where(eq(contentBlocksTable.key, contentKey))
        .execute();

      expect(content[0].status).toBe('draft');
    });
  });
});