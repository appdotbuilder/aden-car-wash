import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { faqsTable } from '../db/schema';
import { type CreateFaqInput } from '../schema';
import { getFaqs, getFaqsByTags } from '../handlers/get_faqs';

// Test FAQ data
const testFaq1: CreateFaqInput = {
  q_ar: 'ما هي خدمات غسيل السيارات؟',
  q_en: 'What are the car wash services?',
  a_ar: 'نقدم خدمات غسيل شاملة للسيارات',
  a_en: 'We provide comprehensive car washing services',
  order: 1,
  tags: ['services', 'general'],
  visible: true
};

const testFaq2: CreateFaqInput = {
  q_ar: 'كم تستغرق خدمة الغسيل؟',
  q_en: 'How long does the wash service take?',
  a_ar: 'تستغرق الخدمة حوالي 30-45 دقيقة',
  a_en: 'The service takes about 30-45 minutes',
  order: 2,
  tags: ['timing', 'services'],
  visible: true
};

const testFaq3: CreateFaqInput = {
  q_ar: 'هل تغسلون السيارات ليلاً؟',
  q_en: 'Do you wash cars at night?',
  a_ar: 'لا، نعمل من الساعة 8 صباحاً حتى 6 مساءً',
  a_en: 'No, we work from 8 AM to 6 PM',
  order: 3,
  tags: ['timing', 'schedule'],
  visible: false // Hidden FAQ
};

const testFaq4: CreateFaqInput = {
  q_ar: 'ما هي أسعار الخدمات؟',
  q_en: 'What are the service prices?',
  a_ar: 'تبدأ الأسعار من 25 ريال',
  a_en: 'Prices start from 25 SAR',
  order: 0, // Should appear first when ordered
  tags: ['pricing'],
  visible: true
};

describe('getFaqs', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch visible FAQs ordered by order field', async () => {
    // Insert test FAQs
    await db.insert(faqsTable).values([
      testFaq1,
      testFaq2,
      testFaq3, // This one is hidden
      testFaq4
    ]).execute();

    const result = await getFaqs(true);

    // Should only return visible FAQs
    expect(result).toHaveLength(3);
    
    // Should be ordered by order field (0, 1, 2)
    expect(result[0].order).toBe(0);
    expect(result[0].q_en).toBe('What are the service prices?');
    expect(result[1].order).toBe(1);
    expect(result[1].q_en).toBe('What are the car wash services?');
    expect(result[2].order).toBe(2);
    expect(result[2].q_en).toBe('How long does the wash service take?');

    // Verify all fields are properly mapped
    expect(result[0].id).toBeDefined();
    expect(result[0].q_ar).toBe(testFaq4.q_ar);
    expect(result[0].a_ar).toBe(testFaq4.a_ar);
    expect(result[0].tags).toEqual(['pricing']);
    expect(result[0].visible).toBe(true);
  });

  it('should fetch all FAQs when visible_only is false', async () => {
    // Insert test FAQs
    await db.insert(faqsTable).values([
      testFaq1,
      testFaq2,
      testFaq3 // Hidden FAQ
    ]).execute();

    const result = await getFaqs(false);

    // Should return all FAQs including hidden ones
    expect(result).toHaveLength(3);
    
    // Should include the hidden FAQ
    const hiddenFaq = result.find(faq => !faq.visible);
    expect(hiddenFaq).toBeDefined();
    expect(hiddenFaq!.q_en).toBe('Do you wash cars at night?');
  });

  it('should return empty array when no FAQs exist', async () => {
    const result = await getFaqs();
    expect(result).toEqual([]);
  });

  it('should handle FAQs with empty tags array', async () => {
    const faqWithoutTags = {
      ...testFaq1,
      tags: []
    };

    await db.insert(faqsTable).values([faqWithoutTags]).execute();

    const result = await getFaqs();
    expect(result).toHaveLength(1);
    expect(result[0].tags).toEqual([]);
  });

  it('should default to visible_only=true when no parameter provided', async () => {
    // Insert both visible and hidden FAQs
    await db.insert(faqsTable).values([
      testFaq1, // visible
      testFaq3  // hidden
    ]).execute();

    const result = await getFaqs(); // No parameter = default true

    expect(result).toHaveLength(1);
    expect(result[0].visible).toBe(true);
  });
});

describe('getFaqsByTags', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch FAQs matching specific tags', async () => {
    // Insert test FAQs
    await db.insert(faqsTable).values([
      testFaq1, // tags: ['services', 'general']
      testFaq2, // tags: ['timing', 'services']
      testFaq3, // tags: ['timing', 'schedule'] - hidden
      testFaq4  // tags: ['pricing']
    ]).execute();

    const result = await getFaqsByTags(['services']);

    // Should return FAQs with 'services' tag that are visible
    expect(result).toHaveLength(2);
    
    const returnedIds = result.map(faq => faq.q_en);
    expect(returnedIds).toContain('What are the car wash services?');
    expect(returnedIds).toContain('How long does the wash service take?');
    expect(returnedIds).not.toContain('Do you wash cars at night?'); // Hidden
  });

  it('should fetch FAQs matching multiple tags (OR logic)', async () => {
    await db.insert(faqsTable).values([
      testFaq1, // tags: ['services', 'general']
      testFaq2, // tags: ['timing', 'services']
      testFaq4  // tags: ['pricing']
    ]).execute();

    const result = await getFaqsByTags(['timing', 'pricing']);

    // Should return FAQs that have either 'timing' OR 'pricing' tags
    expect(result).toHaveLength(2);
    
    const returnedQuestions = result.map(faq => faq.q_en);
    expect(returnedQuestions).toContain('How long does the wash service take?');
    expect(returnedQuestions).toContain('What are the service prices?');
  });

  it('should only return visible FAQs even when matching tags', async () => {
    await db.insert(faqsTable).values([
      testFaq2, // visible, tags: ['timing', 'services']
      testFaq3  // hidden, tags: ['timing', 'schedule']
    ]).execute();

    const result = await getFaqsByTags(['timing']);

    // Should only return visible FAQ even though both match the tag
    expect(result).toHaveLength(1);
    expect(result[0].visible).toBe(true);
    expect(result[0].q_en).toBe('How long does the wash service take?');
  });

  it('should return empty array for empty tags input', async () => {
    await db.insert(faqsTable).values([testFaq1]).execute();

    const result = await getFaqsByTags([]);
    expect(result).toEqual([]);
  });

  it('should return empty array when no FAQs match the tags', async () => {
    await db.insert(faqsTable).values([testFaq1]).execute();

    const result = await getFaqsByTags(['nonexistent']);
    expect(result).toEqual([]);
  });

  it('should order results by order field', async () => {
    await db.insert(faqsTable).values([
      { ...testFaq1, order: 5 }, // services tag, order 5
      { ...testFaq2, order: 1 }, // services tag, order 1
      { ...testFaq4, order: 3, tags: ['services'] } // services tag, order 3
    ]).execute();

    const result = await getFaqsByTags(['services']);

    expect(result).toHaveLength(3);
    expect(result[0].order).toBe(1);
    expect(result[1].order).toBe(3);
    expect(result[2].order).toBe(5);
  });

  it('should handle tags with special characters safely', async () => {
    const specialFaq = {
      ...testFaq1,
      tags: ["test'quote", "test\"double", "test\\backslash"]
    };

    await db.insert(faqsTable).values([specialFaq]).execute();

    // Should not throw error and should handle special characters
    const result = await getFaqsByTags(["test'quote"]);
    expect(result).toHaveLength(1);
    expect(result[0].tags).toContain("test'quote");
  });

  it('should match FAQs with overlapping tag arrays', async () => {
    const multiTagFaq = {
      ...testFaq1,
      tags: ['a', 'b', 'c', 'd']
    };

    await db.insert(faqsTable).values([multiTagFaq]).execute();

    const result = await getFaqsByTags(['b', 'e', 'f']);
    
    // Should match because 'b' overlaps
    expect(result).toHaveLength(1);
    expect(result[0].tags).toEqual(['a', 'b', 'c', 'd']);
  });
});