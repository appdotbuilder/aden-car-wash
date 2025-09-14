import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { faqsTable } from '../db/schema';
import { type CreateFaqInput } from '../schema';
import { createFaq } from '../handlers/create_faq';
import { eq, and } from 'drizzle-orm';

// Simple test input with all required fields
const testInput: CreateFaqInput = {
  q_ar: 'ما هي ساعات العمل؟',
  q_en: 'What are the operating hours?',
  a_ar: 'نحن نعمل من الساعة 8 صباحاً إلى 6 مساءً',
  a_en: 'We operate from 8 AM to 6 PM',
  order: 1,
  tags: ['hours', 'schedule'],
  visible: true
};

// Test input with defaults applied
const minimalInput: CreateFaqInput = {
  q_ar: 'سؤال بسيط',
  q_en: 'Simple question',
  a_ar: 'إجابة بسيطة',
  a_en: 'Simple answer',
  order: 0,
  tags: [],
  visible: true
};

describe('createFaq', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an FAQ with all fields', async () => {
    const result = await createFaq(testInput);

    // Basic field validation
    expect(result.q_ar).toEqual('ما هي ساعات العمل؟');
    expect(result.q_en).toEqual('What are the operating hours?');
    expect(result.a_ar).toEqual('نحن نعمل من الساعة 8 صباحاً إلى 6 مساءً');
    expect(result.a_en).toEqual('We operate from 8 AM to 6 PM');
    expect(result.order).toEqual(1);
    expect(result.tags).toEqual(['hours', 'schedule']);
    expect(result.visible).toEqual(true);
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
  });

  it('should save FAQ to database', async () => {
    const result = await createFaq(testInput);

    // Query using proper drizzle syntax
    const faqs = await db.select()
      .from(faqsTable)
      .where(eq(faqsTable.id, result.id))
      .execute();

    expect(faqs).toHaveLength(1);
    expect(faqs[0].q_ar).toEqual('ما هي ساعات العمل؟');
    expect(faqs[0].q_en).toEqual('What are the operating hours?');
    expect(faqs[0].a_ar).toEqual('نحن نعمل من الساعة 8 صباحاً إلى 6 مساءً');
    expect(faqs[0].a_en).toEqual('We operate from 8 AM to 6 PM');
    expect(faqs[0].order).toEqual(1);
    expect(faqs[0].tags).toEqual(['hours', 'schedule']);
    expect(faqs[0].visible).toEqual(true);
  });

  it('should create FAQ with default values', async () => {
    const result = await createFaq(minimalInput);

    expect(result.q_ar).toEqual('سؤال بسيط');
    expect(result.q_en).toEqual('Simple question');
    expect(result.a_ar).toEqual('إجابة بسيطة');
    expect(result.a_en).toEqual('Simple answer');
    expect(result.order).toEqual(0);
    expect(result.tags).toEqual([]);
    expect(result.visible).toEqual(true);
    expect(result.id).toBeDefined();
  });

  it('should handle FAQ with empty tags array', async () => {
    const inputWithEmptyTags: CreateFaqInput = {
      ...testInput,
      tags: []
    };

    const result = await createFaq(inputWithEmptyTags);

    expect(result.tags).toEqual([]);
    
    // Verify in database
    const faqs = await db.select()
      .from(faqsTable)
      .where(eq(faqsTable.id, result.id))
      .execute();

    expect(faqs[0].tags).toEqual([]);
  });

  it('should handle FAQ with multiple tags', async () => {
    const inputWithManyTags: CreateFaqInput = {
      ...testInput,
      tags: ['general', 'pricing', 'services', 'booking', 'support']
    };

    const result = await createFaq(inputWithManyTags);

    expect(result.tags).toHaveLength(5);
    expect(result.tags).toContain('general');
    expect(result.tags).toContain('pricing');
    expect(result.tags).toContain('services');
    expect(result.tags).toContain('booking');
    expect(result.tags).toContain('support');
  });

  it('should create multiple FAQs with different orders', async () => {
    const faq1 = await createFaq({
      ...testInput,
      order: 1,
      q_ar: 'السؤال الأول',
      q_en: 'First question'
    });

    const faq2 = await createFaq({
      ...testInput,
      order: 2,
      q_ar: 'السؤال الثاني',
      q_en: 'Second question'
    });

    const faq3 = await createFaq({
      ...testInput,
      order: 0,
      q_ar: 'السؤال صفر',
      q_en: 'Zero question'
    });

    expect(faq1.order).toEqual(1);
    expect(faq2.order).toEqual(2);
    expect(faq3.order).toEqual(0);

    // Verify different FAQs exist in database
    const allFaqs = await db.select()
      .from(faqsTable)
      .execute();

    expect(allFaqs).toHaveLength(3);
  });

  it('should query FAQs by visibility and tags correctly', async () => {
    // Create visible FAQ with specific tags
    await createFaq({
      ...testInput,
      tags: ['pricing', 'general'],
      visible: true
    });

    // Create hidden FAQ
    await createFaq({
      ...testInput,
      q_ar: 'سؤال مخفي',
      q_en: 'Hidden question',
      tags: ['hidden'],
      visible: false
    });

    // Query visible FAQs only
    const visibleFaqs = await db.select()
      .from(faqsTable)
      .where(eq(faqsTable.visible, true))
      .execute();

    expect(visibleFaqs).toHaveLength(1);
    expect(visibleFaqs[0].visible).toBe(true);
    expect(visibleFaqs[0].tags).toEqual(['pricing', 'general']);

    // Query all FAQs
    const allFaqs = await db.select()
      .from(faqsTable)
      .execute();

    expect(allFaqs).toHaveLength(2);

    // Query hidden FAQs
    const hiddenFaqs = await db.select()
      .from(faqsTable)
      .where(and(
        eq(faqsTable.visible, false),
        eq(faqsTable.q_en, 'Hidden question')
      ))
      .execute();

    expect(hiddenFaqs).toHaveLength(1);
    expect(hiddenFaqs[0].visible).toBe(false);
  });
});