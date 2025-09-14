import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { galleryMediaTable } from '../db/schema';
import { getGalleryMedia, getGalleryMediaByFilters, uploadGalleryMedia } from '../handlers/get_gallery_media';
import { eq } from 'drizzle-orm';

// Test data
const testMediaItems = [
  {
    url: 'https://example.com/image1.jpg',
    alt_ar: 'صورة اختبار 1',
    alt_en: 'Test image 1',
    tags: ['before', 'sedan'],
    service_filter: 'car-wash',
    district_filter: 'riyadh',
    order: 1,
    visible: true
  },
  {
    url: 'https://example.com/image2.jpg',
    alt_ar: 'صورة اختبار 2',
    alt_en: 'Test image 2',
    tags: ['after', 'suv'],
    service_filter: 'detailing',
    district_filter: 'jeddah',
    order: 2,
    visible: true
  },
  {
    url: 'https://example.com/image3.jpg',
    alt_ar: 'صورة مخفية',
    alt_en: 'Hidden image',
    tags: ['internal'],
    service_filter: null,
    district_filter: null,
    order: 0,
    visible: false
  }
];

describe('getGalleryMedia', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch all visible gallery media ordered by order field', async () => {
    // Insert test data
    await db.insert(galleryMediaTable).values(testMediaItems).execute();

    const result = await getGalleryMedia(true);

    expect(result).toHaveLength(2); // Only visible items
    expect(result[0].url).toEqual('https://example.com/image1.jpg'); // Order 1 comes first among visible
    expect(result[1].url).toEqual('https://example.com/image2.jpg'); // Order 2 comes second among visible
    result.forEach(media => {
      expect(media.visible).toBe(true); // All should be visible
    });
  });

  it('should fetch visible media only when visible_only is true', async () => {
    // Insert test data
    await db.insert(galleryMediaTable).values(testMediaItems).execute();

    const result = await getGalleryMedia(true);

    expect(result).toHaveLength(2);
    result.forEach(media => {
      expect(media.visible).toBe(true);
    });
    
    // Should be ordered by order field
    expect(result[0].order).toBe(1);
    expect(result[1].order).toBe(2);
  });

  it('should fetch all media when visible_only is false', async () => {
    // Insert test data
    await db.insert(galleryMediaTable).values(testMediaItems).execute();

    const result = await getGalleryMedia(false);

    expect(result).toHaveLength(3); // All items including hidden
    
    // Should be ordered by order field (0, 1, 2)
    expect(result[0].order).toBe(0);
    expect(result[1].order).toBe(1);
    expect(result[2].order).toBe(2);
  });

  it('should return empty array when no media exists', async () => {
    const result = await getGalleryMedia();

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should ensure tags array is properly typed', async () => {
    await db.insert(galleryMediaTable).values([testMediaItems[0]]).execute();

    const result = await getGalleryMedia();

    expect(result).toHaveLength(1);
    expect(Array.isArray(result[0].tags)).toBe(true);
    expect(result[0].tags).toEqual(['before', 'sedan']);
  });
});

describe('getGalleryMediaByFilters', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch media filtered by service', async () => {
    // Insert test data
    await db.insert(galleryMediaTable).values(testMediaItems).execute();

    const result = await getGalleryMediaByFilters('car-wash');

    expect(result).toHaveLength(1);
    expect(result[0].service_filter).toEqual('car-wash');
    expect(result[0].url).toEqual('https://example.com/image1.jpg');
  });

  it('should fetch media filtered by district', async () => {
    // Insert test data
    await db.insert(galleryMediaTable).values(testMediaItems).execute();

    const result = await getGalleryMediaByFilters(undefined, 'jeddah');

    expect(result).toHaveLength(1);
    expect(result[0].district_filter).toEqual('jeddah');
    expect(result[0].url).toEqual('https://example.com/image2.jpg');
  });

  it('should fetch media filtered by both service and district', async () => {
    // Insert test data with additional item matching both filters
    const additionalItem = {
      url: 'https://example.com/image4.jpg',
      alt_ar: 'صورة مطابقة',
      alt_en: 'Matching image',
      tags: ['special'],
      service_filter: 'car-wash',
      district_filter: 'riyadh',
      order: 3,
      visible: true
    };
    
    await db.insert(galleryMediaTable).values([...testMediaItems, additionalItem]).execute();

    const result = await getGalleryMediaByFilters('car-wash', 'riyadh');

    expect(result).toHaveLength(2); // Original riyadh + car-wash item, plus new matching item
    result.forEach(media => {
      expect(media.service_filter).toEqual('car-wash');
      expect(media.district_filter).toEqual('riyadh');
      expect(media.visible).toBe(true);
    });
  });

  it('should only return visible media even without explicit filter', async () => {
    // Insert test data
    await db.insert(galleryMediaTable).values(testMediaItems).execute();

    const result = await getGalleryMediaByFilters();

    expect(result).toHaveLength(2); // Only visible items
    result.forEach(media => {
      expect(media.visible).toBe(true);
    });
  });

  it('should return empty array when no media matches filters', async () => {
    // Insert test data
    await db.insert(galleryMediaTable).values(testMediaItems).execute();

    const result = await getGalleryMediaByFilters('non-existent-service');

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should order results by order field', async () => {
    // Create items that all match the 'car-wash' service filter
    const orderedItems = [
      { 
        url: 'https://example.com/image-order-5.jpg',
        alt_ar: 'صورة 5',
        alt_en: 'Image 5',
        tags: ['test'],
        service_filter: 'car-wash',
        district_filter: null,
        order: 5,
        visible: true
      },
      { 
        url: 'https://example.com/image-order-1.jpg',
        alt_ar: 'صورة 1',
        alt_en: 'Image 1',
        tags: ['test'],
        service_filter: 'car-wash',
        district_filter: null,
        order: 1,
        visible: true
      },
      { 
        url: 'https://example.com/image-order-3.jpg',
        alt_ar: 'صورة 3',
        alt_en: 'Image 3',
        tags: ['test'],
        service_filter: 'car-wash',
        district_filter: null,
        order: 3,
        visible: true
      }
    ];

    await db.insert(galleryMediaTable).values(orderedItems).execute();

    const result = await getGalleryMediaByFilters('car-wash');

    expect(result).toHaveLength(3);
    expect(result[0].order).toBe(1); // Should come first
    expect(result[1].order).toBe(3); // Should come second  
    expect(result[2].order).toBe(5); // Should come third
  });
});

describe('uploadGalleryMedia', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create new gallery media entry', async () => {
    const url = 'https://example.com/uploaded.jpg';
    const alt_ar = 'صورة محملة';
    const alt_en = 'Uploaded image';
    const tags = ['upload', 'test'];

    const result = await uploadGalleryMedia(url, alt_ar, alt_en, tags);

    expect(result.url).toEqual(url);
    expect(result.alt_ar).toEqual(alt_ar);
    expect(result.alt_en).toEqual(alt_en);
    expect(result.tags).toEqual(tags);
    expect(result.service_filter).toBeNull();
    expect(result.district_filter).toBeNull();
    expect(result.order).toBe(0);
    expect(result.visible).toBe(true);
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
  });

  it('should save media to database', async () => {
    const url = 'https://example.com/saved.jpg';
    const alt_ar = 'صورة محفوظة';
    const alt_en = 'Saved image';
    const tags = ['save', 'test'];

    const result = await uploadGalleryMedia(url, alt_ar, alt_en, tags);

    // Verify it was saved in database
    const saved = await db.select()
      .from(galleryMediaTable)
      .where(eq(galleryMediaTable.id, result.id))
      .execute();

    expect(saved).toHaveLength(1);
    expect(saved[0].url).toEqual(url);
    expect(saved[0].alt_ar).toEqual(alt_ar);
    expect(saved[0].alt_en).toEqual(alt_en);
    expect(saved[0].tags).toEqual(tags);
    expect(saved[0].visible).toBe(true);
  });

  it('should handle empty tags array', async () => {
    const result = await uploadGalleryMedia(
      'https://example.com/no-tags.jpg',
      'بدون علامات',
      'No tags'
    );

    expect(result.tags).toEqual([]);
    expect(Array.isArray(result.tags)).toBe(true);
  });

  it('should use default values for optional fields', async () => {
    const result = await uploadGalleryMedia(
      'https://example.com/defaults.jpg',
      'قيم افتراضية',
      'Default values',
      ['default']
    );

    expect(result.service_filter).toBeNull();
    expect(result.district_filter).toBeNull();
    expect(result.order).toBe(0);
    expect(result.visible).toBe(true);
  });
});