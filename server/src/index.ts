import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Schema imports
import {
  createBookingInputSchema,
  updateBookingInputSchema,
  createServiceInputSchema,
  updateServiceInputSchema,
  createAddonInputSchema,
  createContentBlockInputSchema,
  createFaqInputSchema,
  createFleetLeadInputSchema,
  createKpisDailyInputSchema,
  createCustomerInputSchema,
  createPricingRuleInputSchema,
  createSeoMetaInputSchema
} from './schema';

// Additional schema for price calculation
const calculatePriceInputSchema = z.object({
  service_id: z.number(),
  addons: z.array(z.number()),
  car_type: z.enum(['sedan', 'suv', 'pickup']),
  zone_id: z.number(),
  geo_point: z.object({
    lat: z.number(),
    lng: z.number()
  }),
  is_solo: z.boolean()
});

// Handler imports
import { createBooking } from './handlers/create_booking';
import { getBookings, getBookingById } from './handlers/get_bookings';
import { updateBooking } from './handlers/update_booking';
import { calculatePrice } from './handlers/calculate_price';
import { getServices, getServiceById, getServiceBySlug } from './handlers/get_services';
import { createService } from './handlers/create_service';
import { updateService } from './handlers/update_service';
import { getAddons, getAddonById, getAddonsByIds } from './handlers/get_addons';
import { createAddon } from './handlers/create_addon';
import { getZones, getZoneById, getZoneByLocation } from './handlers/get_zones';
import { getContentBlocks, getContentBlockByKey, getContentBlocksByKeys } from './handlers/get_content_blocks';
import { createContentBlock } from './handlers/create_content_block';
import { getFaqs, getFaqsByTags } from './handlers/get_faqs';
import { createFaq } from './handlers/create_faq';
import { getTestimonials, getTestimonialsByDistrict } from './handlers/get_testimonials';
import { getGalleryMedia, getGalleryMediaByFilters, uploadGalleryMedia } from './handlers/get_gallery_media';
import { getAdminOverview, getTodayBookings, getBookingsByDateRange } from './handlers/admin_overview';
import { sendWhatsAppMessage, sendBookingConfirmation, sendStatusUpdate } from './handlers/whatsapp_integration';
import { createFleetLead, getFleetLeads, updateFleetLeadStatus, generateFleetLOI } from './handlers/fleet_management';
import { recordDailyKPIs, getKPIsByDateRange, generateKPIReport, calculateOperationalKPIs, calculateMarketingKPIs } from './handlers/kpi_reports';
import { getAvailableTimeSlots, validateTimeSlot, getZoneSchedule } from './handlers/time_slots';
import { createCustomer, findCustomerByPhone, verifyCustomerWhatsApp } from './handlers/create_customer';
import { getPricingRules, createPricingRule, calculateDistanceFee } from './handlers/pricing_rules';
import { publishContentBlocks, revalidateCache } from './handlers/cms_publish';
import { getSeoMeta, getSeoMetaByRoute, createSeoMeta, generateSitemap } from './handlers/seo_management';
import { uploadMedia, deleteMedia } from './handlers/media_upload';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Public booking procedures
  createBooking: publicProcedure
    .input(createBookingInputSchema)
    .mutation(({ input }) => createBooking(input)),

  calculatePrice: publicProcedure
    .input(calculatePriceInputSchema)
    .query(({ input }) => calculatePrice(input)),

  getBookingById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getBookingById(input.id)),

  updateBooking: publicProcedure
    .input(updateBookingInputSchema)
    .mutation(({ input }) => updateBooking(input)),

  // Public content procedures
  getServices: publicProcedure.query(() => getServices(true)),

  getServiceById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getServiceById(input.id)),

  getServiceBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(({ input }) => getServiceBySlug(input.slug)),

  getAddons: publicProcedure.query(() => getAddons(true)),

  getAddonsByIds: publicProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .query(({ input }) => getAddonsByIds(input.ids)),

  getZones: publicProcedure.query(() => getZones()),

  getZoneByLocation: publicProcedure
    .input(z.object({ lat: z.number(), lng: z.number() }))
    .query(({ input }) => getZoneByLocation(input.lat, input.lng)),

  getContentBlocksByKeys: publicProcedure
    .input(z.object({ keys: z.array(z.string()) }))
    .query(({ input }) => getContentBlocksByKeys(input.keys)),

  getFaqs: publicProcedure.query(() => getFaqs(true)),

  getFaqsByTags: publicProcedure
    .input(z.object({ tags: z.array(z.string()) }))
    .query(({ input }) => getFaqsByTags(input.tags)),

  getTestimonials: publicProcedure.query(() => getTestimonials(true)),

  getTestimonialsByDistrict: publicProcedure
    .input(z.object({ district: z.string() }))
    .query(({ input }) => getTestimonialsByDistrict(input.district)),

  getGalleryMedia: publicProcedure.query(() => getGalleryMedia(true)),

  getGalleryMediaByFilters: publicProcedure
    .input(z.object({
      service_filter: z.string().optional(),
      district_filter: z.string().optional()
    }))
    .query(({ input }) => getGalleryMediaByFilters(input.service_filter, input.district_filter)),

  getAvailableTimeSlots: publicProcedure
    .input(z.object({
      zone_id: z.number(),
      service_duration: z.number(),
      date: z.coerce.date()
    }))
    .query(({ input }) => getAvailableTimeSlots(input.zone_id, input.service_duration, input.date)),

  // Fleet lead submission
  createFleetLead: publicProcedure
    .input(createFleetLeadInputSchema)
    .mutation(({ input }) => createFleetLead(input)),

  // Customer management
  createCustomer: publicProcedure
    .input(createCustomerInputSchema)
    .mutation(({ input }) => createCustomer(input)),

  findCustomerByPhone: publicProcedure
    .input(z.object({ phone: z.string() }))
    .query(({ input }) => findCustomerByPhone(input.phone)),

  verifyCustomerWhatsApp: publicProcedure
    .input(z.object({ phone: z.string() }))
    .mutation(({ input }) => verifyCustomerWhatsApp(input.phone)),

  // SEO and content
  getSeoMetaByRoute: publicProcedure
    .input(z.object({ route: z.string() }))
    .query(({ input }) => getSeoMetaByRoute(input.route)),

  generateSitemap: publicProcedure.query(() => generateSitemap()),

  // Admin procedures (in production these would be protected with auth)
  admin: router({
    // Overview
    getOverview: publicProcedure.query(() => getAdminOverview()),
    getTodayBookings: publicProcedure.query(() => getTodayBookings()),
    getBookingsByDateRange: publicProcedure
      .input(z.object({
        startDate: z.coerce.date(),
        endDate: z.coerce.date()
      }))
      .query(({ input }) => getBookingsByDateRange(input.startDate, input.endDate)),

    // Bookings management
    getAllBookings: publicProcedure.query(() => getBookings()),
    getZoneSchedule: publicProcedure
      .input(z.object({ zone_id: z.number(), date: z.coerce.date() }))
      .query(({ input }) => getZoneSchedule(input.zone_id, input.date)),

    // Services management
    getAllServices: publicProcedure.query(() => getServices(false)),
    createService: publicProcedure
      .input(createServiceInputSchema)
      .mutation(({ input }) => createService(input)),
    updateService: publicProcedure
      .input(updateServiceInputSchema)
      .mutation(({ input }) => updateService(input)),

    // Addons management
    getAllAddons: publicProcedure.query(() => getAddons(false)),
    createAddon: publicProcedure
      .input(createAddonInputSchema)
      .mutation(({ input }) => createAddon(input)),

    // Content management
    getAllContentBlocks: publicProcedure
      .input(z.object({ status: z.enum(['draft', 'published', 'all']).default('all') }))
      .query(({ input }) => getContentBlocks(input.status)),
    createContentBlock: publicProcedure
      .input(createContentBlockInputSchema)
      .mutation(({ input }) => createContentBlock(input)),

    // FAQ management
    getAllFaqs: publicProcedure.query(() => getFaqs(false)),
    createFaq: publicProcedure
      .input(createFaqInputSchema)
      .mutation(({ input }) => createFaq(input)),

    // Gallery management
    getAllGalleryMedia: publicProcedure.query(() => getGalleryMedia(false)),
    uploadGalleryMedia: publicProcedure
      .input(z.object({
        url: z.string(),
        alt_ar: z.string(),
        alt_en: z.string(),
        tags: z.array(z.string()).default([])
      }))
      .mutation(({ input }) => uploadGalleryMedia(input.url, input.alt_ar, input.alt_en, input.tags)),

    // Fleet management
    getFleetLeads: publicProcedure.query(() => getFleetLeads()),
    updateFleetLeadStatus: publicProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['new', 'contacted', 'proposal_sent', 'trial_active', 'converted', 'lost']),
        notes: z.string().optional()
      }))
      .mutation(({ input }) => updateFleetLeadStatus(input.id, input.status, input.notes)),
    generateFleetLOI: publicProcedure
      .input(z.object({ leadId: z.number() }))
      .mutation(({ input }) => generateFleetLOI(input.leadId)),

    // KPI and reporting
    recordDailyKPIs: publicProcedure
      .input(createKpisDailyInputSchema)
      .mutation(({ input }) => recordDailyKPIs(input)),
    getKPIsByDateRange: publicProcedure
      .input(z.object({
        startDate: z.coerce.date(),
        endDate: z.coerce.date()
      }))
      .query(({ input }) => getKPIsByDateRange(input.startDate, input.endDate)),
    generateKPIReport: publicProcedure
      .input(z.object({
        period: z.enum(['daily', 'weekly', 'monthly']),
        format: z.enum(['csv', 'pdf'])
      }))
      .mutation(({ input }) => generateKPIReport(input.period, input.format)),
    getOperationalKPIs: publicProcedure.query(() => calculateOperationalKPIs()),
    getMarketingKPIs: publicProcedure.query(() => calculateMarketingKPIs()),

    // WhatsApp integration
    sendWhatsAppMessage: publicProcedure
      .input(z.object({
        to: z.string(),
        template: z.string(),
        variables: z.record(z.string())
      }))
      .mutation(({ input }) => sendWhatsAppMessage(input)),
    sendStatusUpdate: publicProcedure
      .input(z.object({
        phone: z.string(),
        status: z.enum(['on_the_way', 'started', 'finished']),
        details: z.record(z.any()).optional()
      }))
      .mutation(({ input }) => sendStatusUpdate(input.phone, input.status, input.details)),

    // Pricing rules management
    getPricingRules: publicProcedure.query(() => getPricingRules()),
    createPricingRule: publicProcedure
      .input(createPricingRuleInputSchema)
      .mutation(({ input }) => createPricingRule(input)),

    // CMS publishing
    publishContentBlocks: publicProcedure
      .input(z.object({ keys: z.array(z.string()) }))
      .mutation(({ input }) => publishContentBlocks(input.keys)),

    // SEO management
    getAllSeoMeta: publicProcedure.query(() => getSeoMeta()),
    createSeoMeta: publicProcedure
      .input(createSeoMetaInputSchema)
      .mutation(({ input }) => createSeoMeta(input)),

    // Media management
    uploadMedia: publicProcedure
      .input(z.object({
        filename: z.string(),
        content: z.string(), // base64 encoded
        mime_type: z.string()
      }))
      .mutation(({ input }) => {
        const buffer = Buffer.from(input.content, 'base64');
        return uploadMedia(buffer, input.filename, input.mime_type);
      }),
    deleteMedia: publicProcedure
      .input(z.object({ url: z.string() }))
      .mutation(({ input }) => deleteMedia(input.url))
  })
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();