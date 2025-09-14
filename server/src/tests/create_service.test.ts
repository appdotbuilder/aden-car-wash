import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { servicesTable } from '../db/schema';
import { type CreateServiceInput } from '../schema';
import { createService } from '../handlers/create_service';
import { eq } from 'drizzle-orm';

// Complete test input with all required fields
const testInput: CreateServiceInput = {
  slug: 'test-car-wash',
  name_ar: 'غسيل سيارات تجريبي',
  name_en: 'Test Car Wash',
  desc_ar: 'وصف الخدمة التجريبية',
  desc_en: 'Test service description',
  base_price_team: 89.99,
  base_price_solo: 69.99,
  est_minutes: 45,
  order: 1,
  visible: true
};

describe('createService', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a service with all fields', async () => {
    const result = await createService(testInput);

    // Basic field validation
    expect(result.slug).toEqual('test-car-wash');
    expect(result.name_ar).toEqual('غسيل سيارات تجريبي');
    expect(result.name_en).toEqual('Test Car Wash');
    expect(result.desc_ar).toEqual('وصف الخدمة التجريبية');
    expect(result.desc_en).toEqual('Test service description');
    expect(result.base_price_team).toEqual(89.99);
    expect(result.base_price_solo).toEqual(69.99);
    expect(result.est_minutes).toEqual(45);
    expect(result.order).toEqual(1);
    expect(result.visible).toEqual(true);
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    
    // Verify numeric types are properly converted
    expect(typeof result.base_price_team).toBe('number');
    expect(typeof result.base_price_solo).toBe('number');
  });

  it('should save service to database correctly', async () => {
    const result = await createService(testInput);

    // Query using proper drizzle syntax
    const services = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.id, result.id))
      .execute();

    expect(services).toHaveLength(1);
    expect(services[0].slug).toEqual('test-car-wash');
    expect(services[0].name_ar).toEqual('غسيل سيارات تجريبي');
    expect(services[0].name_en).toEqual('Test Car Wash');
    expect(services[0].desc_ar).toEqual('وصف الخدمة التجريبية');
    expect(services[0].desc_en).toEqual('Test service description');
    expect(parseFloat(services[0].base_price_team)).toEqual(89.99);
    expect(parseFloat(services[0].base_price_solo)).toEqual(69.99);
    expect(services[0].est_minutes).toEqual(45);
    expect(services[0].order).toEqual(1);
    expect(services[0].visible).toEqual(true);
  });

  it('should create service with default values', async () => {
    const minimalInput: CreateServiceInput = {
      slug: 'minimal-service',
      name_ar: 'خدمة أساسية',
      name_en: 'Minimal Service',
      desc_ar: 'وصف أساسي',
      desc_en: 'Basic description',
      base_price_team: 50.00,
      base_price_solo: 40.00,
      est_minutes: 30,
      order: 0, // Explicitly provide default value
      visible: true // Explicitly provide default value
    };

    const result = await createService(minimalInput);

    expect(result.order).toEqual(0); // Default value from Zod schema
    expect(result.visible).toEqual(true); // Default value from Zod schema
    expect(result.slug).toEqual('minimal-service');
    expect(result.base_price_team).toEqual(50.00);
    expect(result.base_price_solo).toEqual(40.00);
  });

  it('should handle unique slug constraint violation', async () => {
    // Create first service
    await createService(testInput);

    // Try to create another service with the same slug
    const duplicateInput: CreateServiceInput = {
      ...testInput,
      name_ar: 'خدمة مختلفة',
      name_en: 'Different Service'
    };

    // Should throw error due to unique constraint on slug
    await expect(createService(duplicateInput)).rejects.toThrow(/duplicate key value violates unique constraint|UNIQUE constraint failed/i);
  });

  it('should handle different pricing scenarios', async () => {
    const expensiveServiceInput: CreateServiceInput = {
      slug: 'premium-detail',
      name_ar: 'تفصيل متقدم',
      name_en: 'Premium Detail',
      desc_ar: 'خدمة تفصيل متقدمة',
      desc_en: 'Premium detailing service',
      base_price_team: 299.95,
      base_price_solo: 199.95,
      est_minutes: 180,
      order: 5,
      visible: true
    };

    const result = await createService(expensiveServiceInput);

    expect(result.base_price_team).toEqual(299.95);
    expect(result.base_price_solo).toEqual(199.95);
    expect(result.est_minutes).toEqual(180);
    expect(typeof result.base_price_team).toBe('number');
    expect(typeof result.base_price_solo).toBe('number');

    // Verify precision is maintained in database
    const dbService = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.id, result.id))
      .execute();

    expect(parseFloat(dbService[0].base_price_team)).toEqual(299.95);
    expect(parseFloat(dbService[0].base_price_solo)).toEqual(199.95);
  });

  it('should create invisible service when specified', async () => {
    const invisibleServiceInput: CreateServiceInput = {
      slug: 'hidden-service',
      name_ar: 'خدمة مخفية',
      name_en: 'Hidden Service',
      desc_ar: 'خدمة غير مرئية',
      desc_en: 'Invisible service',
      base_price_team: 75.00,
      base_price_solo: 60.00,
      est_minutes: 30,
      order: 10,
      visible: false
    };

    const result = await createService(invisibleServiceInput);

    expect(result.visible).toEqual(false);
    
    // Verify in database
    const dbService = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.id, result.id))
      .execute();

    expect(dbService[0].visible).toEqual(false);
  });
});