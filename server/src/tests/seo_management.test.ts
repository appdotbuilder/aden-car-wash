import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { seoMetaTable, servicesTable, serviceAreasTable } from '../db/schema';
import { type CreateSeoMetaInput } from '../schema';
import { getSeoMeta, getSeoMetaByRoute, createSeoMeta, generateSitemap } from '../handlers/seo_management';
import { eq } from 'drizzle-orm';

// Test input data
const testSeoMetaInput: CreateSeoMetaInput = {
  route: '/about',
  title_ar: 'حولنا - خدمات غسيل السيارات',
  title_en: 'About Us - Car Wash Services',
  desc_ar: 'تعرف على شركتنا وخدماتنا المميزة في غسيل السيارات',
  desc_en: 'Learn about our company and premium car wash services',
  og_image_url: 'https://example.com/images/about-og.jpg'
};

const testSeoMetaInputWithoutImage: CreateSeoMetaInput = {
  route: '/contact',
  title_ar: 'اتصل بنا',
  title_en: 'Contact Us',
  desc_ar: 'تواصل معنا للحصول على خدمات غسيل السيارات',
  desc_en: 'Contact us for car wash services'
};

describe('SEO Management', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createSeoMeta', () => {
    it('should create SEO meta with all fields', async () => {
      const result = await createSeoMeta(testSeoMetaInput);

      expect(result.id).toBeDefined();
      expect(result.route).toEqual('/about');
      expect(result.title_ar).toEqual('حولنا - خدمات غسيل السيارات');
      expect(result.title_en).toEqual('About Us - Car Wash Services');
      expect(result.desc_ar).toEqual('تعرف على شركتنا وخدماتنا المميزة في غسيل السيارات');
      expect(result.desc_en).toEqual('Learn about our company and premium car wash services');
      expect(result.og_image_url).toEqual('https://example.com/images/about-og.jpg');
    });

    it('should create SEO meta without og_image_url', async () => {
      const result = await createSeoMeta(testSeoMetaInputWithoutImage);

      expect(result.id).toBeDefined();
      expect(result.route).toEqual('/contact');
      expect(result.title_ar).toEqual('اتصل بنا');
      expect(result.title_en).toEqual('Contact Us');
      expect(result.desc_ar).toEqual('تواصل معنا للحصول على خدمات غسيل السيارات');
      expect(result.desc_en).toEqual('Contact us for car wash services');
      expect(result.og_image_url).toBeNull();
    });

    it('should save SEO meta to database', async () => {
      const result = await createSeoMeta(testSeoMetaInput);

      const seoMetas = await db.select()
        .from(seoMetaTable)
        .where(eq(seoMetaTable.id, result.id))
        .execute();

      expect(seoMetas).toHaveLength(1);
      expect(seoMetas[0].route).toEqual('/about');
      expect(seoMetas[0].title_ar).toEqual(testSeoMetaInput.title_ar);
      expect(seoMetas[0].title_en).toEqual(testSeoMetaInput.title_en);
      expect(seoMetas[0].og_image_url).toEqual(testSeoMetaInput.og_image_url || null);
    });

    it('should enforce unique route constraint', async () => {
      await createSeoMeta(testSeoMetaInput);

      const duplicateInput: CreateSeoMetaInput = {
        ...testSeoMetaInput,
        title_ar: 'عنوان مختلف',
        title_en: 'Different Title'
      };

      await expect(createSeoMeta(duplicateInput)).rejects.toThrow();
    });
  });

  describe('getSeoMeta', () => {
    it('should return empty array when no SEO meta exists', async () => {
      const result = await getSeoMeta();
      expect(result).toEqual([]);
    });

    it('should return all SEO meta records', async () => {
      await createSeoMeta(testSeoMetaInput);
      await createSeoMeta(testSeoMetaInputWithoutImage);

      const result = await getSeoMeta();

      expect(result).toHaveLength(2);
      
      const aboutMeta = result.find(m => m.route === '/about');
      const contactMeta = result.find(m => m.route === '/contact');
      
      expect(aboutMeta).toBeDefined();
      expect(aboutMeta!.title_en).toEqual('About Us - Car Wash Services');
      expect(aboutMeta!.og_image_url).toEqual('https://example.com/images/about-og.jpg');
      
      expect(contactMeta).toBeDefined();
      expect(contactMeta!.title_en).toEqual('Contact Us');
      expect(contactMeta!.og_image_url).toBeNull();
    });
  });

  describe('getSeoMetaByRoute', () => {
    beforeEach(async () => {
      await createSeoMeta(testSeoMetaInput);
      await createSeoMeta(testSeoMetaInputWithoutImage);
    });

    it('should return SEO meta for existing route', async () => {
      const result = await getSeoMetaByRoute('/about');

      expect(result).toBeDefined();
      expect(result!.route).toEqual('/about');
      expect(result!.title_ar).toEqual('حولنا - خدمات غسيل السيارات');
      expect(result!.title_en).toEqual('About Us - Car Wash Services');
      expect(result!.og_image_url).toEqual('https://example.com/images/about-og.jpg');
    });

    it('should return null for non-existent route', async () => {
      const result = await getSeoMetaByRoute('/non-existent');
      expect(result).toBeNull();
    });

    it('should handle exact route matching', async () => {
      const result1 = await getSeoMetaByRoute('/contact');
      const result2 = await getSeoMetaByRoute('/contact/');
      
      expect(result1).toBeDefined();
      expect(result1!.route).toEqual('/contact');
      expect(result2).toBeNull(); // Different route with trailing slash
    });
  });

  describe('generateSitemap', () => {
    beforeEach(async () => {
      // Create SEO meta entries
      await createSeoMeta(testSeoMetaInput);
      await createSeoMeta(testSeoMetaInputWithoutImage);

      // Create test services
      await db.insert(servicesTable).values([
        {
          slug: 'exterior-wash',
          name_ar: 'غسيل خارجي',
          name_en: 'Exterior Wash',
          desc_ar: 'غسيل السيارة من الخارج',
          desc_en: 'Wash car exterior',
          base_price_team: '50.00',
          base_price_solo: '40.00',
          est_minutes: 30,
          order: 1,
          visible: true
        },
        {
          slug: 'full-service',
          name_ar: 'خدمة شاملة',
          name_en: 'Full Service',
          desc_ar: 'خدمة غسيل شاملة',
          desc_en: 'Complete wash service',
          base_price_team: '80.00',
          base_price_solo: '70.00',
          est_minutes: 60,
          order: 2,
          visible: true
        },
        {
          slug: 'hidden-service',
          name_ar: 'خدمة مخفية',
          name_en: 'Hidden Service',
          desc_ar: 'خدمة مخفية',
          desc_en: 'Hidden service',
          base_price_team: '100.00',
          base_price_solo: '90.00',
          est_minutes: 45,
          order: 3,
          visible: false // Should not appear in sitemap
        }
      ]).execute();

      // Create test service areas
      await db.insert(serviceAreasTable).values([
        {
          name_ar: 'الرياض',
          name_en: 'Riyadh',
          polygon_or_center: '{"lat": 24.7136, "lng": 46.6753}',
          order: 1,
          visible: true
        },
        {
          name_ar: 'جدة',
          name_en: 'Jeddah',
          polygon_or_center: '{"lat": 21.2854, "lng": 39.2376}',
          order: 2,
          visible: true
        },
        {
          name_ar: 'منطقة مخفية',
          name_en: 'Hidden Area',
          polygon_or_center: '{"lat": 0, "lng": 0}',
          order: 3,
          visible: false // Should not appear in sitemap
        }
      ]).execute();
    });

    it('should generate valid XML sitemap', async () => {
      const sitemap = await generateSitemap();

      expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
      expect(sitemap).toContain('</urlset>');
    });

    it('should include SEO meta routes', async () => {
      const sitemap = await generateSitemap();

      expect(sitemap).toContain('<loc>https://example.com/about</loc>');
      expect(sitemap).toContain('<loc>https://example.com/contact</loc>');
    });

    it('should include visible services', async () => {
      const sitemap = await generateSitemap();

      expect(sitemap).toContain('<loc>https://example.com/services/exterior-wash</loc>');
      expect(sitemap).toContain('<loc>https://example.com/services/full-service</loc>');
      expect(sitemap).not.toContain('hidden-service'); // Should exclude hidden services
    });

    it('should include visible service areas', async () => {
      const sitemap = await generateSitemap();

      expect(sitemap).toContain('<loc>https://example.com/areas/riyadh</loc>');
      expect(sitemap).toContain('<loc>https://example.com/areas/jeddah</loc>');
      expect(sitemap).not.toContain('hidden-area'); // Should exclude hidden areas
    });

    it('should include hreflang alternates', async () => {
      const sitemap = await generateSitemap();

      expect(sitemap).toContain('hreflang="ar"');
      expect(sitemap).toContain('hreflang="en"');
      expect(sitemap).toContain('/ar/about');
      expect(sitemap).toContain('/en/about');
      expect(sitemap).toContain('/ar/services/exterior-wash');
      expect(sitemap).toContain('/en/services/exterior-wash');
    });

    it('should include proper lastmod dates', async () => {
      const sitemap = await generateSitemap();
      const today = new Date().toISOString().split('T')[0];

      expect(sitemap).toContain(`<lastmod>${today}</lastmod>`);
    });

    it('should handle empty database gracefully', async () => {
      // Clear all data
      await db.delete(seoMetaTable).execute();
      await db.delete(servicesTable).execute();
      await db.delete(serviceAreasTable).execute();

      const sitemap = await generateSitemap();

      expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(sitemap).toContain('<urlset');
      expect(sitemap).toContain('</urlset>');
      // Should still be valid XML even with no URLs
    });
  });
});