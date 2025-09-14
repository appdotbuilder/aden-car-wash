import { z } from 'zod';

// Core entities
export const customerSchema = z.object({
  id: z.number(),
  name: z.string(),
  phone: z.string(),
  whatsapp_verified: z.boolean(),
  created_at: z.coerce.date()
});

export type Customer = z.infer<typeof customerSchema>;

export const createCustomerInputSchema = z.object({
  name: z.string(),
  phone: z.string(),
  whatsapp_verified: z.boolean().default(false)
});

export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>;

// Zones
export const zoneSchema = z.object({
  id: z.number(),
  name_ar: z.string(),
  name_en: z.string(),
  polygon_or_center: z.string(), // JSON string for polygon/center coordinates
  notes: z.string().nullable()
});

export type Zone = z.infer<typeof zoneSchema>;

export const createZoneInputSchema = z.object({
  name_ar: z.string(),
  name_en: z.string(),
  polygon_or_center: z.string(),
  notes: z.string().nullable().optional()
});

export type CreateZoneInput = z.infer<typeof createZoneInputSchema>;

// Services
export const serviceSchema = z.object({
  id: z.number(),
  slug: z.string(),
  name_ar: z.string(),
  name_en: z.string(),
  desc_ar: z.string(),
  desc_en: z.string(),
  base_price_team: z.number(),
  base_price_solo: z.number(),
  est_minutes: z.number().int(),
  order: z.number().int(),
  visible: z.boolean()
});

export type Service = z.infer<typeof serviceSchema>;

export const createServiceInputSchema = z.object({
  slug: z.string(),
  name_ar: z.string(),
  name_en: z.string(),
  desc_ar: z.string(),
  desc_en: z.string(),
  base_price_team: z.number().positive(),
  base_price_solo: z.number().positive(),
  est_minutes: z.number().int().positive(),
  order: z.number().int().default(0),
  visible: z.boolean().default(true)
});

export type CreateServiceInput = z.infer<typeof createServiceInputSchema>;

// Add-ons
export const addonSchema = z.object({
  id: z.number(),
  slug: z.string(),
  name_ar: z.string(),
  name_en: z.string(),
  desc_ar: z.string(),
  desc_en: z.string(),
  price: z.number(),
  est_minutes: z.number().int(),
  order: z.number().int(),
  visible: z.boolean()
});

export type Addon = z.infer<typeof addonSchema>;

export const createAddonInputSchema = z.object({
  slug: z.string(),
  name_ar: z.string(),
  name_en: z.string(),
  desc_ar: z.string(),
  desc_en: z.string(),
  price: z.number().positive(),
  est_minutes: z.number().int().nonnegative(),
  order: z.number().int().default(0),
  visible: z.boolean().default(true)
});

export type CreateAddonInput = z.infer<typeof createAddonInputSchema>;

// Plans (Subscriptions)
export const planSchema = z.object({
  id: z.number(),
  code: z.string(),
  name_ar: z.string(),
  name_en: z.string(),
  desc_ar: z.string(),
  desc_en: z.string(),
  price: z.number(),
  benefits_ar: z.array(z.string()),
  benefits_en: z.array(z.string()),
  visible: z.boolean()
});

export type Plan = z.infer<typeof planSchema>;

export const createPlanInputSchema = z.object({
  code: z.string(),
  name_ar: z.string(),
  name_en: z.string(),
  desc_ar: z.string(),
  desc_en: z.string(),
  price: z.number().positive(),
  benefits_ar: z.array(z.string()),
  benefits_en: z.array(z.string()),
  visible: z.boolean().default(true)
});

export type CreatePlanInput = z.infer<typeof createPlanInputSchema>;

// Bookings
export const bookingSchema = z.object({
  id: z.number(),
  customer_id: z.number(),
  service_id: z.number(),
  addons: z.array(z.number()), // Array of addon IDs
  car_type: z.enum(['sedan', 'suv', 'pickup']),
  zone_id: z.number(),
  address_text: z.string(),
  geo_point: z.string(), // JSON string for lat/lng
  scheduled_window_start: z.coerce.date(),
  scheduled_window_end: z.coerce.date(),
  status: z.enum(['confirmed', 'on_the_way', 'started', 'finished', 'postponed', 'canceled']),
  price_total: z.number(),
  is_solo: z.boolean(),
  distance_fee: z.number(),
  created_at: z.coerce.date()
});

export type Booking = z.infer<typeof bookingSchema>;

export const createBookingInputSchema = z.object({
  customer: z.object({
    name: z.string(),
    phone: z.string()
  }),
  service_id: z.number(),
  addons: z.array(z.number()).default([]),
  car_type: z.enum(['sedan', 'suv', 'pickup']),
  zone_id: z.number(),
  address_text: z.string(),
  geo_point: z.object({
    lat: z.number(),
    lng: z.number()
  }),
  scheduled_window: z.object({
    start: z.coerce.date(),
    end: z.coerce.date()
  }),
  is_solo: z.boolean().default(false)
});

export type CreateBookingInput = z.infer<typeof createBookingInputSchema>;

// Pricing Rules
export const pricingRuleSchema = z.object({
  id: z.number(),
  key: z.string(),
  value_json: z.string(), // JSON string
  enabled: z.boolean()
});

export type PricingRule = z.infer<typeof pricingRuleSchema>;

export const createPricingRuleInputSchema = z.object({
  key: z.string(),
  value_json: z.string(),
  enabled: z.boolean().default(true)
});

export type CreatePricingRuleInput = z.infer<typeof createPricingRuleInputSchema>;

// Content CMS
export const contentBlockSchema = z.object({
  id: z.number(),
  key: z.string(),
  ar_value: z.string(),
  en_value: z.string(),
  status: z.enum(['draft', 'published']),
  updated_by: z.string(),
  updated_at: z.coerce.date()
});

export type ContentBlock = z.infer<typeof contentBlockSchema>;

export const createContentBlockInputSchema = z.object({
  key: z.string(),
  ar_value: z.string(),
  en_value: z.string(),
  status: z.enum(['draft', 'published']).default('draft'),
  updated_by: z.string()
});

export type CreateContentBlockInput = z.infer<typeof createContentBlockInputSchema>;

// FAQs
export const faqSchema = z.object({
  id: z.number(),
  q_ar: z.string(),
  q_en: z.string(),
  a_ar: z.string(),
  a_en: z.string(),
  order: z.number().int(),
  tags: z.array(z.string()),
  visible: z.boolean()
});

export type FAQ = z.infer<typeof faqSchema>;

export const createFaqInputSchema = z.object({
  q_ar: z.string(),
  q_en: z.string(),
  a_ar: z.string(),
  a_en: z.string(),
  order: z.number().int().default(0),
  tags: z.array(z.string()).default([]),
  visible: z.boolean().default(true)
});

export type CreateFaqInput = z.infer<typeof createFaqInputSchema>;

// Testimonials
export const testimonialSchema = z.object({
  id: z.number(),
  name: z.string(),
  district: z.string(),
  stars: z.number().int().min(1).max(5),
  text_ar: z.string(),
  text_en: z.string(),
  order: z.number().int(),
  visible: z.boolean()
});

export type Testimonial = z.infer<typeof testimonialSchema>;

export const createTestimonialInputSchema = z.object({
  name: z.string(),
  district: z.string(),
  stars: z.number().int().min(1).max(5),
  text_ar: z.string(),
  text_en: z.string(),
  order: z.number().int().default(0),
  visible: z.boolean().default(true)
});

export type CreateTestimonialInput = z.infer<typeof createTestimonialInputSchema>;

// Gallery Media
export const galleryMediaSchema = z.object({
  id: z.number(),
  url: z.string(),
  alt_ar: z.string(),
  alt_en: z.string(),
  tags: z.array(z.string()),
  service_filter: z.string().nullable(),
  district_filter: z.string().nullable(),
  order: z.number().int(),
  visible: z.boolean()
});

export type GalleryMedia = z.infer<typeof galleryMediaSchema>;

export const createGalleryMediaInputSchema = z.object({
  url: z.string(),
  alt_ar: z.string(),
  alt_en: z.string(),
  tags: z.array(z.string()).default([]),
  service_filter: z.string().nullable().optional(),
  district_filter: z.string().nullable().optional(),
  order: z.number().int().default(0),
  visible: z.boolean().default(true)
});

export type CreateGalleryMediaInput = z.infer<typeof createGalleryMediaInputSchema>;

// Service Areas
export const serviceAreaSchema = z.object({
  id: z.number(),
  name_ar: z.string(),
  name_en: z.string(),
  polygon_or_center: z.string(), // JSON string
  order: z.number().int(),
  visible: z.boolean()
});

export type ServiceArea = z.infer<typeof serviceAreaSchema>;

export const createServiceAreaInputSchema = z.object({
  name_ar: z.string(),
  name_en: z.string(),
  polygon_or_center: z.string(),
  order: z.number().int().default(0),
  visible: z.boolean().default(true)
});

export type CreateServiceAreaInput = z.infer<typeof createServiceAreaInputSchema>;

// Pop-ups
export const popupSchema = z.object({
  id: z.number(),
  location_name_ar: z.string(),
  location_name_en: z.string(),
  zone_id: z.number(),
  day_of_week: z.number().int().min(0).max(6), // 0 = Sunday
  start_time: z.string(), // HH:MM format
  end_time: z.string(), // HH:MM format
  partner_share_pct: z.number(),
  visible: z.boolean()
});

export type Popup = z.infer<typeof popupSchema>;

export const createPopupInputSchema = z.object({
  location_name_ar: z.string(),
  location_name_en: z.string(),
  zone_id: z.number(),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string(),
  end_time: z.string(),
  partner_share_pct: z.number().min(0).max(100),
  visible: z.boolean().default(true)
});

export type CreatePopupInput = z.infer<typeof createPopupInputSchema>;

// SEO Meta
export const seoMetaSchema = z.object({
  id: z.number(),
  route: z.string(),
  title_ar: z.string(),
  title_en: z.string(),
  desc_ar: z.string(),
  desc_en: z.string(),
  og_image_url: z.string().nullable()
});

export type SEOMeta = z.infer<typeof seoMetaSchema>;

export const createSeoMetaInputSchema = z.object({
  route: z.string(),
  title_ar: z.string(),
  title_en: z.string(),
  desc_ar: z.string(),
  desc_en: z.string(),
  og_image_url: z.string().nullable().optional()
});

export type CreateSeoMetaInput = z.infer<typeof createSeoMetaInputSchema>;

// WhatsApp Templates
export const whatsappTemplateSchema = z.object({
  id: z.number(),
  key: z.string(),
  body_ar: z.string(),
  body_en: z.string()
});

export type WhatsAppTemplate = z.infer<typeof whatsappTemplateSchema>;

export const createWhatsappTemplateInputSchema = z.object({
  key: z.string(),
  body_ar: z.string(),
  body_en: z.string()
});

export type CreateWhatsAppTemplateInput = z.infer<typeof createWhatsappTemplateInputSchema>;

// Coupons
export const couponSchema = z.object({
  id: z.number(),
  code: z.string(),
  discount_type: z.enum(['percentage', 'fixed']),
  value: z.number(),
  start_at: z.coerce.date(),
  end_at: z.coerce.date(),
  usage_limit: z.number().int()
});

export type Coupon = z.infer<typeof couponSchema>;

export const createCouponInputSchema = z.object({
  code: z.string(),
  discount_type: z.enum(['percentage', 'fixed']),
  value: z.number().positive(),
  start_at: z.coerce.date(),
  end_at: z.coerce.date(),
  usage_limit: z.number().int().positive()
});

export type CreateCouponInput = z.infer<typeof createCouponInputSchema>;

// Fleet Leads
export const fleetLeadSchema = z.object({
  id: z.number(),
  company_name: z.string(),
  contact_person: z.string(),
  phone: z.string(),
  status: z.enum(['new', 'contacted', 'proposal_sent', 'trial_active', 'converted', 'lost']),
  notes: z.string().nullable(),
  created_at: z.coerce.date()
});

export type FleetLead = z.infer<typeof fleetLeadSchema>;

export const createFleetLeadInputSchema = z.object({
  company_name: z.string(),
  contact_person: z.string(),
  phone: z.string(),
  status: z.enum(['new', 'contacted', 'proposal_sent', 'trial_active', 'converted', 'lost']).default('new'),
  notes: z.string().nullable().optional()
});

export type CreateFleetLeadInput = z.infer<typeof createFleetLeadInputSchema>;

// KPIs Daily
export const kpisDailySchema = z.object({
  id: z.number(),
  date: z.coerce.date(),
  bookings: z.number().int(),
  aov: z.number(),
  cpl: z.number(),
  complaints_rate: z.number(),
  addons_ratio: z.number()
});

export type KPIsDaily = z.infer<typeof kpisDailySchema>;

export const createKpisDailyInputSchema = z.object({
  date: z.coerce.date(),
  bookings: z.number().int().nonnegative(),
  aov: z.number().nonnegative(),
  cpl: z.number().nonnegative(),
  complaints_rate: z.number().min(0).max(1),
  addons_ratio: z.number().min(0).max(1)
});

export type CreateKPIsDailyInput = z.infer<typeof createKpisDailyInputSchema>;

// API Response schemas
export const createBookingResponseSchema = z.object({
  booking_id: z.string(),
  price_total: z.number(),
  wa_message_id: z.string()
});

export type CreateBookingResponse = z.infer<typeof createBookingResponseSchema>;

export const adminOverviewResponseSchema = z.object({
  today_stats: z.object({
    total_bookings: z.number().int(),
    confirmed: z.number().int(),
    on_the_way: z.number().int(),
    completed: z.number().int(),
    revenue: z.number()
  }),
  upcoming_bookings: z.array(bookingSchema),
  kpis: z.object({
    on_time_percentage: z.number(),
    complaints_rate: z.number(),
    avg_service_time: z.number()
  })
});

export type AdminOverviewResponse = z.infer<typeof adminOverviewResponseSchema>;

// Update schemas
export const updateServiceInputSchema = z.object({
  id: z.number(),
  slug: z.string().optional(),
  name_ar: z.string().optional(),
  name_en: z.string().optional(),
  desc_ar: z.string().optional(),
  desc_en: z.string().optional(),
  base_price_team: z.number().positive().optional(),
  base_price_solo: z.number().positive().optional(),
  est_minutes: z.number().int().positive().optional(),
  order: z.number().int().optional(),
  visible: z.boolean().optional()
});

export type UpdateServiceInput = z.infer<typeof updateServiceInputSchema>;

export const updateBookingInputSchema = z.object({
  id: z.number(),
  status: z.enum(['confirmed', 'on_the_way', 'started', 'finished', 'postponed', 'canceled']).optional(),
  scheduled_window_start: z.coerce.date().optional(),
  scheduled_window_end: z.coerce.date().optional(),
  address_text: z.string().optional(),
  geo_point: z.string().optional()
});

export type UpdateBookingInput = z.infer<typeof updateBookingInputSchema>;