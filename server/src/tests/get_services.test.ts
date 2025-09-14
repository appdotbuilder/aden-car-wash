import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { servicesTable } from '../db/schema';
import { type CreateServiceInput } from '../schema';
import { getServices, getServiceById, getServiceBySlug } from '../handlers/get_services';

// Test service data
const testService1: CreateServiceInput = {
  slug: 'basic-wash',
  name_ar: 'غسيل أساسي',
  name_en: 'Basic Wash',
  desc_ar: 'خدمة غسيل أساسية للسيارة',
  desc_en: 'Basic car wash service',
  base_price_team: 25.99,
  base_price_solo: 19.99,
  est_minutes: 45,
  order: 1,
  visible: true
};

const testService2: CreateServiceInput = {
  slug: 'premium-detailing',
  name_ar: 'تفصيل فاخر',
  name_en: 'Premium Detailing',
  desc_ar: 'خدمة تفصيل فاخرة شاملة',
  desc_en: 'Complete premium detailing service',
  base_price_team: 89.50,
  base_price_solo: 69.99,
  est_minutes: 120,
  order: 2,
  visible: true
};

const hiddenService: CreateServiceInput = {
  slug: 'hidden-service',
  name_ar: 'خدمة مخفية',
  name_en: 'Hidden Service',
  desc_ar: 'خدمة غير مرئية للعامة',
  desc_en: 'Service not visible to public',
  base_price_team: 45.00,
  base_price_solo: 35.00,
  est_minutes: 60,
  order: 3,
  visible: false
};

describe('get_services', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getServices', () => {
    it('should return empty array when no services exist', async () => {
      const result = await getServices();
      expect(result).toEqual([]);
    });

    it('should return all visible services ordered by order field', async () => {
      // Insert test services
      await db.insert(servicesTable).values([
        {
          ...testService2,
          base_price_team: testService2.base_price_team.toString(),
          base_price_solo: testService2.base_price_solo.toString()
        },
        {
          ...testService1,
          base_price_team: testService1.base_price_team.toString(),
          base_price_solo: testService1.base_price_solo.toString()
        },
        {
          ...hiddenService,
          base_price_team: hiddenService.base_price_team.toString(),
          base_price_solo: hiddenService.base_price_solo.toString()
        }
      ]).execute();

      const result = await getServices(true);

      expect(result).toHaveLength(2);
      // Should be ordered by 'order' field (1, 2)
      expect(result[0].slug).toEqual('basic-wash');
      expect(result[1].slug).toEqual('premium-detailing');

      // Verify numeric conversion
      expect(typeof result[0].base_price_team).toBe('number');
      expect(result[0].base_price_team).toEqual(25.99);
      expect(typeof result[0].base_price_solo).toBe('number');
      expect(result[0].base_price_solo).toEqual(19.99);
    });

    it('should return all services including hidden when visible_only is false', async () => {
      await db.insert(servicesTable).values([
        {
          ...testService1,
          base_price_team: testService1.base_price_team.toString(),
          base_price_solo: testService1.base_price_solo.toString()
        },
        {
          ...hiddenService,
          base_price_team: hiddenService.base_price_team.toString(),
          base_price_solo: hiddenService.base_price_solo.toString()
        }
      ]).execute();

      const result = await getServices(false);

      expect(result).toHaveLength(2);
      expect(result.some(s => s.slug === 'hidden-service')).toBe(true);
      expect(result.some(s => s.visible === false)).toBe(true);
    });

    it('should maintain proper ordering with mixed visible/hidden services', async () => {
      const service0: CreateServiceInput = {
        ...testService1,
        slug: 'first-service',
        order: 0
      };

      await db.insert(servicesTable).values([
        {
          ...testService2,
          base_price_team: testService2.base_price_team.toString(),
          base_price_solo: testService2.base_price_solo.toString()
        },
        {
          ...service0,
          base_price_team: service0.base_price_team.toString(),
          base_price_solo: service0.base_price_solo.toString()
        },
        {
          ...hiddenService,
          base_price_team: hiddenService.base_price_team.toString(),
          base_price_solo: hiddenService.base_price_solo.toString()
        }
      ]).execute();

      const allServices = await getServices(false);
      expect(allServices).toHaveLength(3);
      expect(allServices[0].order).toEqual(0); // first-service
      expect(allServices[1].order).toEqual(2); // premium-detailing
      expect(allServices[2].order).toEqual(3); // hidden-service
    });
  });

  describe('getServiceById', () => {
    it('should return null when service does not exist', async () => {
      const result = await getServiceById(999);
      expect(result).toBeNull();
    });

    it('should return service by ID with proper numeric conversion', async () => {
      const insertResult = await db.insert(servicesTable).values({
        ...testService1,
        base_price_team: testService1.base_price_team.toString(),
        base_price_solo: testService1.base_price_solo.toString()
      }).returning().execute();

      const serviceId = insertResult[0].id;
      const result = await getServiceById(serviceId);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(serviceId);
      expect(result!.slug).toEqual('basic-wash');
      expect(result!.name_en).toEqual('Basic Wash');
      
      // Verify numeric conversion
      expect(typeof result!.base_price_team).toBe('number');
      expect(result!.base_price_team).toEqual(25.99);
      expect(typeof result!.base_price_solo).toBe('number');
      expect(result!.base_price_solo).toEqual(19.99);
      expect(result!.est_minutes).toEqual(45);
    });

    it('should return hidden service by ID', async () => {
      const insertResult = await db.insert(servicesTable).values({
        ...hiddenService,
        base_price_team: hiddenService.base_price_team.toString(),
        base_price_solo: hiddenService.base_price_solo.toString()
      }).returning().execute();

      const serviceId = insertResult[0].id;
      const result = await getServiceById(serviceId);

      expect(result).not.toBeNull();
      expect(result!.visible).toBe(false);
      expect(result!.slug).toEqual('hidden-service');
    });
  });

  describe('getServiceBySlug', () => {
    it('should return null when service with slug does not exist', async () => {
      const result = await getServiceBySlug('non-existent');
      expect(result).toBeNull();
    });

    it('should return service by slug with proper numeric conversion', async () => {
      await db.insert(servicesTable).values({
        ...testService2,
        base_price_team: testService2.base_price_team.toString(),
        base_price_solo: testService2.base_price_solo.toString()
      }).execute();

      const result = await getServiceBySlug('premium-detailing');

      expect(result).not.toBeNull();
      expect(result!.slug).toEqual('premium-detailing');
      expect(result!.name_ar).toEqual('تفصيل فاخر');
      expect(result!.name_en).toEqual('Premium Detailing');
      
      // Verify numeric conversion
      expect(typeof result!.base_price_team).toBe('number');
      expect(result!.base_price_team).toEqual(89.50);
      expect(typeof result!.base_price_solo).toBe('number');
      expect(result!.base_price_solo).toEqual(69.99);
      expect(result!.est_minutes).toEqual(120);
    });

    it('should return hidden service by slug', async () => {
      await db.insert(servicesTable).values({
        ...hiddenService,
        base_price_team: hiddenService.base_price_team.toString(),
        base_price_solo: hiddenService.base_price_solo.toString()
      }).execute();

      const result = await getServiceBySlug('hidden-service');

      expect(result).not.toBeNull();
      expect(result!.visible).toBe(false);
      expect(result!.name_en).toEqual('Hidden Service');
    });

    it('should handle slug case sensitivity correctly', async () => {
      await db.insert(servicesTable).values({
        ...testService1,
        base_price_team: testService1.base_price_team.toString(),
        base_price_solo: testService1.base_price_solo.toString()
      }).execute();

      // Exact match should work
      const exactMatch = await getServiceBySlug('basic-wash');
      expect(exactMatch).not.toBeNull();

      // Different case should not match (PostgreSQL is case-sensitive by default)
      const wrongCase = await getServiceBySlug('Basic-Wash');
      expect(wrongCase).toBeNull();
    });

    it('should verify all fields are properly returned', async () => {
      await db.insert(servicesTable).values({
        ...testService1,
        base_price_team: testService1.base_price_team.toString(),
        base_price_solo: testService1.base_price_solo.toString()
      }).execute();

      const result = await getServiceBySlug('basic-wash');

      expect(result).not.toBeNull();
      expect(result!).toMatchObject({
        slug: 'basic-wash',
        name_ar: 'غسيل أساسي',
        name_en: 'Basic Wash',
        desc_ar: 'خدمة غسيل أساسية للسيارة',
        desc_en: 'Basic car wash service',
        base_price_team: 25.99,
        base_price_solo: 19.99,
        est_minutes: 45,
        order: 1,
        visible: true
      });
      expect(result!.id).toBeDefined();
    });
  });
});