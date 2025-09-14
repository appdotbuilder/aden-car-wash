import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean,
  jsonb,
  varchar,
  date,
  real,
  index
} from 'drizzle-orm/pg-core';

// Core entities
export const customersTable = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  whatsapp_verified: boolean('whatsapp_verified').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  phoneIdx: index('customers_phone_idx').on(table.phone),
}));

export const zonesTable = pgTable('zones', {
  id: serial('id').primaryKey(),
  name_ar: text('name_ar').notNull(),
  name_en: text('name_en').notNull(),
  polygon_or_center: text('polygon_or_center').notNull(), // JSON string
  notes: text('notes'),
});

// Catalog & Pricing
export const servicesTable = pgTable('services', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  name_ar: text('name_ar').notNull(),
  name_en: text('name_en').notNull(),
  desc_ar: text('desc_ar').notNull(),
  desc_en: text('desc_en').notNull(),
  base_price_team: numeric('base_price_team', { precision: 10, scale: 2 }).notNull(),
  base_price_solo: numeric('base_price_solo', { precision: 10, scale: 2 }).notNull(),
  est_minutes: integer('est_minutes').notNull(),
  order: integer('order').notNull().default(0),
  visible: boolean('visible').notNull().default(true),
}, (table) => ({
  slugIdx: index('services_slug_idx').on(table.slug),
  orderIdx: index('services_order_idx').on(table.order),
}));

export const addonsTable = pgTable('addons', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  name_ar: text('name_ar').notNull(),
  name_en: text('name_en').notNull(),
  desc_ar: text('desc_ar').notNull(),
  desc_en: text('desc_en').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  est_minutes: integer('est_minutes').notNull().default(0),
  order: integer('order').notNull().default(0),
  visible: boolean('visible').notNull().default(true),
}, (table) => ({
  slugIdx: index('addons_slug_idx').on(table.slug),
  orderIdx: index('addons_order_idx').on(table.order),
}));

export const plansTable = pgTable('plans', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name_ar: text('name_ar').notNull(),
  name_en: text('name_en').notNull(),
  desc_ar: text('desc_ar').notNull(),
  desc_en: text('desc_en').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  benefits_ar: jsonb('benefits_ar').notNull().$type<string[]>(),
  benefits_en: jsonb('benefits_en').notNull().$type<string[]>(),
  visible: boolean('visible').notNull().default(true),
}, (table) => ({
  codeIdx: index('plans_code_idx').on(table.code),
}));

export const pricingRulesTable = pgTable('pricing_rules', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value_json: text('value_json').notNull(),
  enabled: boolean('enabled').notNull().default(true),
}, (table) => ({
  keyIdx: index('pricing_rules_key_idx').on(table.key),
}));

// Bookings
export const bookingsTable = pgTable('bookings', {
  id: serial('id').primaryKey(),
  customer_id: integer('customer_id').notNull().references(() => customersTable.id),
  service_id: integer('service_id').notNull().references(() => servicesTable.id),
  addons: jsonb('addons').notNull().$type<number[]>(),
  car_type: varchar('car_type', { length: 20 }).notNull(), // sedan, suv, pickup
  zone_id: integer('zone_id').notNull().references(() => zonesTable.id),
  address_text: text('address_text').notNull(),
  geo_point: text('geo_point').notNull(), // JSON string for lat/lng
  scheduled_window_start: timestamp('scheduled_window_start').notNull(),
  scheduled_window_end: timestamp('scheduled_window_end').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('confirmed'), // confirmed, on_the_way, started, finished, postponed, canceled
  price_total: numeric('price_total', { precision: 10, scale: 2 }).notNull(),
  is_solo: boolean('is_solo').notNull().default(false),
  distance_fee: numeric('distance_fee', { precision: 10, scale: 2 }).notNull().default('0'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  customerIdx: index('bookings_customer_idx').on(table.customer_id),
  statusIdx: index('bookings_status_idx').on(table.status),
  dateIdx: index('bookings_date_idx').on(table.scheduled_window_start),
  createdIdx: index('bookings_created_idx').on(table.created_at),
}));

// Content CMS
export const contentBlocksTable = pgTable('content_blocks', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  ar_value: text('ar_value').notNull(),
  en_value: text('en_value').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'), // draft, published
  updated_by: varchar('updated_by', { length: 100 }).notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  keyIdx: index('content_blocks_key_idx').on(table.key),
  statusIdx: index('content_blocks_status_idx').on(table.status),
}));

export const faqsTable = pgTable('faqs', {
  id: serial('id').primaryKey(),
  q_ar: text('q_ar').notNull(),
  q_en: text('q_en').notNull(),
  a_ar: text('a_ar').notNull(),
  a_en: text('a_en').notNull(),
  order: integer('order').notNull().default(0),
  tags: jsonb('tags').notNull().$type<string[]>(),
  visible: boolean('visible').notNull().default(true),
}, (table) => ({
  orderIdx: index('faqs_order_idx').on(table.order),
  visibleIdx: index('faqs_visible_idx').on(table.visible),
}));

export const testimonialsTable = pgTable('testimonials', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  district: varchar('district', { length: 100 }).notNull(),
  stars: integer('stars').notNull(), // 1-5
  text_ar: text('text_ar').notNull(),
  text_en: text('text_en').notNull(),
  order: integer('order').notNull().default(0),
  visible: boolean('visible').notNull().default(true),
}, (table) => ({
  orderIdx: index('testimonials_order_idx').on(table.order),
  visibleIdx: index('testimonials_visible_idx').on(table.visible),
}));

export const galleryMediaTable = pgTable('gallery_media', {
  id: serial('id').primaryKey(),
  url: text('url').notNull(),
  alt_ar: text('alt_ar').notNull(),
  alt_en: text('alt_en').notNull(),
  tags: jsonb('tags').notNull().$type<string[]>(),
  service_filter: varchar('service_filter', { length: 100 }),
  district_filter: varchar('district_filter', { length: 100 }),
  order: integer('order').notNull().default(0),
  visible: boolean('visible').notNull().default(true),
}, (table) => ({
  orderIdx: index('gallery_media_order_idx').on(table.order),
  visibleIdx: index('gallery_media_visible_idx').on(table.visible),
  serviceFilterIdx: index('gallery_media_service_filter_idx').on(table.service_filter),
}));

export const serviceAreasTable = pgTable('service_areas', {
  id: serial('id').primaryKey(),
  name_ar: text('name_ar').notNull(),
  name_en: text('name_en').notNull(),
  polygon_or_center: text('polygon_or_center').notNull(), // JSON string
  order: integer('order').notNull().default(0),
  visible: boolean('visible').notNull().default(true),
}, (table) => ({
  orderIdx: index('service_areas_order_idx').on(table.order),
  visibleIdx: index('service_areas_visible_idx').on(table.visible),
}));

export const popupsTable = pgTable('popups', {
  id: serial('id').primaryKey(),
  location_name_ar: text('location_name_ar').notNull(),
  location_name_en: text('location_name_en').notNull(),
  zone_id: integer('zone_id').notNull().references(() => zonesTable.id),
  day_of_week: integer('day_of_week').notNull(), // 0-6, 0 = Sunday
  start_time: varchar('start_time', { length: 5 }).notNull(), // HH:MM
  end_time: varchar('end_time', { length: 5 }).notNull(), // HH:MM
  partner_share_pct: real('partner_share_pct').notNull(),
  visible: boolean('visible').notNull().default(true),
}, (table) => ({
  zoneIdx: index('popups_zone_idx').on(table.zone_id),
  dayIdx: index('popups_day_idx').on(table.day_of_week),
  visibleIdx: index('popups_visible_idx').on(table.visible),
}));

export const seoMetaTable = pgTable('seo_meta', {
  id: serial('id').primaryKey(),
  route: varchar('route', { length: 200 }).notNull().unique(),
  title_ar: text('title_ar').notNull(),
  title_en: text('title_en').notNull(),
  desc_ar: text('desc_ar').notNull(),
  desc_en: text('desc_en').notNull(),
  og_image_url: text('og_image_url'),
}, (table) => ({
  routeIdx: index('seo_meta_route_idx').on(table.route),
}));

export const whatsappTemplatesTable = pgTable('whatsapp_templates', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 50 }).notNull().unique(),
  body_ar: text('body_ar').notNull(),
  body_en: text('body_en').notNull(),
}, (table) => ({
  keyIdx: index('whatsapp_templates_key_idx').on(table.key),
}));

// Marketing & Operations
export const couponsTable = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  discount_type: varchar('discount_type', { length: 20 }).notNull(), // percentage, fixed
  value: numeric('value', { precision: 10, scale: 2 }).notNull(),
  start_at: timestamp('start_at').notNull(),
  end_at: timestamp('end_at').notNull(),
  usage_limit: integer('usage_limit').notNull(),
}, (table) => ({
  codeIdx: index('coupons_code_idx').on(table.code),
  dateRangeIdx: index('coupons_date_range_idx').on(table.start_at, table.end_at),
}));

export const fleetLeadsTable = pgTable('fleet_leads', {
  id: serial('id').primaryKey(),
  company_name: varchar('company_name', { length: 200 }).notNull(),
  contact_person: varchar('contact_person', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('new'), // new, contacted, proposal_sent, trial_active, converted, lost
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  statusIdx: index('fleet_leads_status_idx').on(table.status),
  createdIdx: index('fleet_leads_created_idx').on(table.created_at),
}));

export const kpisDailyTable = pgTable('kpis_daily', {
  id: serial('id').primaryKey(),
  date: date('date').notNull().unique(),
  bookings: integer('bookings').notNull().default(0),
  aov: numeric('aov', { precision: 10, scale: 2 }).notNull().default('0'),
  cpl: numeric('cpl', { precision: 10, scale: 2 }).notNull().default('0'),
  complaints_rate: real('complaints_rate').notNull().default(0),
  addons_ratio: real('addons_ratio').notNull().default(0),
}, (table) => ({
  dateIdx: index('kpis_daily_date_idx').on(table.date),
}));

// TypeScript types for the table schemas
export type Customer = typeof customersTable.$inferSelect;
export type NewCustomer = typeof customersTable.$inferInsert;

export type Zone = typeof zonesTable.$inferSelect;
export type NewZone = typeof zonesTable.$inferInsert;

export type Service = typeof servicesTable.$inferSelect;
export type NewService = typeof servicesTable.$inferInsert;

export type Addon = typeof addonsTable.$inferSelect;
export type NewAddon = typeof addonsTable.$inferInsert;

export type Plan = typeof plansTable.$inferSelect;
export type NewPlan = typeof plansTable.$inferInsert;

export type PricingRule = typeof pricingRulesTable.$inferSelect;
export type NewPricingRule = typeof pricingRulesTable.$inferInsert;

export type Booking = typeof bookingsTable.$inferSelect;
export type NewBooking = typeof bookingsTable.$inferInsert;

export type ContentBlock = typeof contentBlocksTable.$inferSelect;
export type NewContentBlock = typeof contentBlocksTable.$inferInsert;

export type FAQ = typeof faqsTable.$inferSelect;
export type NewFAQ = typeof faqsTable.$inferInsert;

export type Testimonial = typeof testimonialsTable.$inferSelect;
export type NewTestimonial = typeof testimonialsTable.$inferInsert;

export type GalleryMedia = typeof galleryMediaTable.$inferSelect;
export type NewGalleryMedia = typeof galleryMediaTable.$inferInsert;

export type ServiceArea = typeof serviceAreasTable.$inferSelect;
export type NewServiceArea = typeof serviceAreasTable.$inferInsert;

export type Popup = typeof popupsTable.$inferSelect;
export type NewPopup = typeof popupsTable.$inferInsert;

export type SEOMeta = typeof seoMetaTable.$inferSelect;
export type NewSEOMeta = typeof seoMetaTable.$inferInsert;

export type WhatsAppTemplate = typeof whatsappTemplatesTable.$inferSelect;
export type NewWhatsAppTemplate = typeof whatsappTemplatesTable.$inferInsert;

export type Coupon = typeof couponsTable.$inferSelect;
export type NewCoupon = typeof couponsTable.$inferInsert;

export type FleetLead = typeof fleetLeadsTable.$inferSelect;
export type NewFleetLead = typeof fleetLeadsTable.$inferInsert;

export type KPIsDaily = typeof kpisDailyTable.$inferSelect;
export type NewKPIsDaily = typeof kpisDailyTable.$inferInsert;

// Export all tables for proper relation queries
export const tables = {
  customers: customersTable,
  zones: zonesTable,
  services: servicesTable,
  addons: addonsTable,
  plans: plansTable,
  pricingRules: pricingRulesTable,
  bookings: bookingsTable,
  contentBlocks: contentBlocksTable,
  faqs: faqsTable,
  testimonials: testimonialsTable,
  galleryMedia: galleryMediaTable,
  serviceAreas: serviceAreasTable,
  popups: popupsTable,
  seoMeta: seoMetaTable,
  whatsappTemplates: whatsappTemplatesTable,
  coupons: couponsTable,
  fleetLeads: fleetLeadsTable,
  kpisDaily: kpisDailyTable,
};