import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { testimonialsTable } from '../db/schema';
import { getTestimonials, getTestimonialsByDistrict } from '../handlers/get_testimonials';

// Test testimonial data
const testTestimonials = [
  {
    name: 'Ahmed Ali',
    district: 'Riyadh',
    stars: 5,
    text_ar: 'خدمة ممتازة جداً',
    text_en: 'Excellent service',
    order: 1,
    visible: true
  },
  {
    name: 'Sara Mohammed',
    district: 'Jeddah',
    stars: 4,
    text_ar: 'خدمة جيدة',
    text_en: 'Good service',
    order: 2,
    visible: true
  },
  {
    name: 'Omar Hassan',
    district: 'Riyadh',
    stars: 5,
    text_ar: 'راضي جداً عن الخدمة',
    text_en: 'Very satisfied',
    order: 3,
    visible: false
  },
  {
    name: 'Layla Fares',
    district: 'Dammam',
    stars: 3,
    text_ar: 'خدمة مقبولة',
    text_en: 'Acceptable service',
    order: 0,
    visible: true
  }
];

describe('getTestimonials', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should get all visible testimonials ordered by order field', async () => {
    // Insert test testimonials
    await db.insert(testimonialsTable)
      .values(testTestimonials)
      .execute();

    const result = await getTestimonials();

    // Should return 3 visible testimonials
    expect(result).toHaveLength(3);
    
    // Check ordering by 'order' field
    expect(result[0].order).toEqual(0);
    expect(result[0].name).toEqual('Layla Fares');
    expect(result[1].order).toEqual(1);
    expect(result[1].name).toEqual('Ahmed Ali');
    expect(result[2].order).toEqual(2);
    expect(result[2].name).toEqual('Sara Mohammed');

    // Verify all returned testimonials are visible
    result.forEach(testimonial => {
      expect(testimonial.visible).toBe(true);
    });

    // Check field types and values
    expect(result[0].stars).toEqual(3);
    expect(typeof result[0].stars).toBe('number');
    expect(result[0].district).toEqual('Dammam');
    expect(result[0].text_ar).toEqual('خدمة مقبولة');
    expect(result[0].text_en).toEqual('Acceptable service');
    expect(result[0].id).toBeDefined();
  });

  it('should get all testimonials including hidden ones when visible_only is false', async () => {
    // Insert test testimonials
    await db.insert(testimonialsTable)
      .values(testTestimonials)
      .execute();

    const result = await getTestimonials(false);

    // Should return all 4 testimonials
    expect(result).toHaveLength(4);
    
    // Check ordering is still maintained
    expect(result[0].order).toEqual(0);
    expect(result[1].order).toEqual(1);
    expect(result[2].order).toEqual(2);
    expect(result[3].order).toEqual(3);

    // Verify we get both visible and hidden testimonials
    const visibleCount = result.filter(t => t.visible).length;
    const hiddenCount = result.filter(t => !t.visible).length;
    expect(visibleCount).toEqual(3);
    expect(hiddenCount).toEqual(1);

    // Check the hidden testimonial is included
    const hiddenTestimonial = result.find(t => t.name === 'Omar Hassan');
    expect(hiddenTestimonial).toBeDefined();
    expect(hiddenTestimonial?.visible).toBe(false);
  });

  it('should return empty array when no testimonials exist', async () => {
    const result = await getTestimonials();
    
    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle testimonials with same order correctly', async () => {
    const sameOrderTestimonials = [
      {
        name: 'Test User 1',
        district: 'Test District',
        stars: 5,
        text_ar: 'تجربة أولى',
        text_en: 'First experience',
        order: 1,
        visible: true
      },
      {
        name: 'Test User 2',
        district: 'Test District',
        stars: 4,
        text_ar: 'تجربة ثانية',
        text_en: 'Second experience',
        order: 1,
        visible: true
      }
    ];

    await db.insert(testimonialsTable)
      .values(sameOrderTestimonials)
      .execute();

    const result = await getTestimonials();

    expect(result).toHaveLength(2);
    expect(result[0].order).toEqual(1);
    expect(result[1].order).toEqual(1);
  });
});

describe('getTestimonialsByDistrict', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should get testimonials filtered by district', async () => {
    // Insert test testimonials
    await db.insert(testimonialsTable)
      .values(testTestimonials)
      .execute();

    const result = await getTestimonialsByDistrict('Riyadh');

    // Should return only 1 visible testimonial from Riyadh (Omar's is hidden)
    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Ahmed Ali');
    expect(result[0].district).toEqual('Riyadh');
    expect(result[0].visible).toBe(true);
    expect(result[0].stars).toEqual(5);
    expect(result[0].order).toEqual(1);
  });

  it('should return empty array for district with no visible testimonials', async () => {
    // Insert test testimonials
    await db.insert(testimonialsTable)
      .values(testTestimonials)
      .execute();

    const result = await getTestimonialsByDistrict('Mecca');

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should only return visible testimonials for district', async () => {
    // Insert test testimonials
    await db.insert(testimonialsTable)
      .values(testTestimonials)
      .execute();

    // Try to get testimonials from Riyadh - should not include hidden one
    const result = await getTestimonialsByDistrict('Riyadh');

    expect(result).toHaveLength(1);
    
    // Verify all returned testimonials are visible
    result.forEach(testimonial => {
      expect(testimonial.visible).toBe(true);
      expect(testimonial.district).toEqual('Riyadh');
    });

    // Verify hidden testimonial is not included
    const hiddenTestimonial = result.find(t => t.name === 'Omar Hassan');
    expect(hiddenTestimonial).toBeUndefined();
  });

  it('should order results by order field', async () => {
    const districtTestimonials = [
      {
        name: 'User A',
        district: 'TestDistrict',
        stars: 5,
        text_ar: 'تجربة أ',
        text_en: 'Experience A',
        order: 3,
        visible: true
      },
      {
        name: 'User B',
        district: 'TestDistrict',
        stars: 4,
        text_ar: 'تجربة ب',
        text_en: 'Experience B',
        order: 1,
        visible: true
      },
      {
        name: 'User C',
        district: 'TestDistrict',
        stars: 5,
        text_ar: 'تجربة ج',
        text_en: 'Experience C',
        order: 2,
        visible: true
      }
    ];

    await db.insert(testimonialsTable)
      .values(districtTestimonials)
      .execute();

    const result = await getTestimonialsByDistrict('TestDistrict');

    expect(result).toHaveLength(3);
    
    // Check ordering
    expect(result[0].order).toEqual(1);
    expect(result[0].name).toEqual('User B');
    expect(result[1].order).toEqual(2);
    expect(result[1].name).toEqual('User C');
    expect(result[2].order).toEqual(3);
    expect(result[2].name).toEqual('User A');
  });

  it('should handle case-sensitive district matching', async () => {
    // Insert test testimonials
    await db.insert(testimonialsTable)
      .values(testTestimonials)
      .execute();

    // Test exact case match
    const exactMatch = await getTestimonialsByDistrict('Riyadh');
    expect(exactMatch).toHaveLength(1);

    // Test different case - should return empty (case-sensitive)
    const differentCase = await getTestimonialsByDistrict('riyadh');
    expect(differentCase).toHaveLength(0);
  });
});