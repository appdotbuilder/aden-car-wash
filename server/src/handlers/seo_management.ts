import { db } from '../db';
import { seoMetaTable, servicesTable, serviceAreasTable } from '../db/schema';
import { type CreateSeoMetaInput, type SEOMeta } from '../schema';
import { eq } from 'drizzle-orm';

export async function getSeoMeta(): Promise<SEOMeta[]> {
    try {
        const results = await db.select()
            .from(seoMetaTable)
            .execute();

        return results;
    } catch (error) {
        console.error('Failed to fetch SEO meta data:', error);
        throw error;
    }
}

export async function getSeoMetaByRoute(route: string): Promise<SEOMeta | null> {
    try {
        const results = await db.select()
            .from(seoMetaTable)
            .where(eq(seoMetaTable.route, route))
            .execute();

        return results.length > 0 ? results[0] : null;
    } catch (error) {
        console.error('Failed to fetch SEO meta by route:', error);
        throw error;
    }
}

export async function createSeoMeta(input: CreateSeoMetaInput): Promise<SEOMeta> {
    try {
        const result = await db.insert(seoMetaTable)
            .values({
                route: input.route,
                title_ar: input.title_ar,
                title_en: input.title_en,
                desc_ar: input.desc_ar,
                desc_en: input.desc_en,
                og_image_url: input.og_image_url || null
            })
            .returning()
            .execute();

        return result[0];
    } catch (error) {
        console.error('Failed to create SEO meta:', error);
        throw error;
    }
}

export async function generateSitemap(): Promise<string> {
    try {
        // Get all SEO routes
        const seoRoutes = await db.select()
            .from(seoMetaTable)
            .execute();

        // Get all services for dynamic routes
        const services = await db.select()
            .from(servicesTable)
            .where(eq(servicesTable.visible, true))
            .execute();

        // Get all service areas for location-based routes
        const serviceAreas = await db.select()
            .from(serviceAreasTable)
            .where(eq(serviceAreasTable.visible, true))
            .execute();

        // Build sitemap XML
        let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" 
        xmlns:xhtml="http://www.w3.org/1999/xhtml">`;

        const baseUrl = 'https://example.com'; // In real app, get from config
        const today = new Date().toISOString().split('T')[0];

        // Add static routes from SEO meta
        for (const route of seoRoutes) {
            sitemap += `
  <url>
    <loc>${baseUrl}${route.route}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel="alternate" hreflang="ar" href="${baseUrl}/ar${route.route}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/en${route.route}"/>
  </url>`;
        }

        // Add service pages
        for (const service of services) {
            sitemap += `
  <url>
    <loc>${baseUrl}/services/${service.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
    <xhtml:link rel="alternate" hreflang="ar" href="${baseUrl}/ar/services/${service.slug}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/en/services/${service.slug}"/>
  </url>`;
        }

        // Add service area pages
        for (const area of serviceAreas) {
            const areaSlug = area.name_en.toLowerCase().replace(/\s+/g, '-');
            sitemap += `
  <url>
    <loc>${baseUrl}/areas/${areaSlug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
    <xhtml:link rel="alternate" hreflang="ar" href="${baseUrl}/ar/areas/${areaSlug}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/en/areas/${areaSlug}"/>
  </url>`;
        }

        sitemap += `
</urlset>`;

        return sitemap;
    } catch (error) {
        console.error('Failed to generate sitemap:', error);
        throw error;
    }
}