import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { servicesTable } from '../db/schema';
import { type UpdateServiceInput } from '../schema';
import { updateService } from '../handlers/update_service';
import { eq } from 'drizzle-orm';

// Test service data
const initialServiceData = {
  slug: 'initial-service',
  name_ar: 'خدمة أولية',
  name_en: 'Initial Service',
  desc_ar: 'وصف الخدمة الأولية',
  desc_en: 'Initial service description',
  base_price_team: '150.00',
  base_price_solo: '120.00',
  est_minutes: 60,
  order: 1,
  visible: true
};

describe('updateService', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update a service with all fields', async () => {
    // Create initial service
    const [createdService] = await db.insert(servicesTable)
      .values(initialServiceData)
      .returning()
      .execute();

    const updateInput: UpdateServiceInput = {
      id: createdService.id,
      slug: 'updated-service',
      name_ar: 'خدمة محدثة',
      name_en: 'Updated Service',
      desc_ar: 'وصف محدث للخدمة',
      desc_en: 'Updated service description',
      base_price_team: 200.00,
      base_price_solo: 160.00,
      est_minutes: 90,
      order: 2,
      visible: false
    };

    const result = await updateService(updateInput);

    // Verify returned data
    expect(result.id).toEqual(createdService.id);
    expect(result.slug).toEqual('updated-service');
    expect(result.name_ar).toEqual('خدمة محدثة');
    expect(result.name_en).toEqual('Updated Service');
    expect(result.desc_ar).toEqual('وصف محدث للخدمة');
    expect(result.desc_en).toEqual('Updated service description');
    expect(result.base_price_team).toEqual(200.00);
    expect(result.base_price_solo).toEqual(160.00);
    expect(result.est_minutes).toEqual(90);
    expect(result.order).toEqual(2);
    expect(result.visible).toEqual(false);

    // Verify numeric type conversion
    expect(typeof result.base_price_team).toBe('number');
    expect(typeof result.base_price_solo).toBe('number');
  });

  it('should update service with partial fields', async () => {
    // Create initial service
    const [createdService] = await db.insert(servicesTable)
      .values(initialServiceData)
      .returning()
      .execute();

    const updateInput: UpdateServiceInput = {
      id: createdService.id,
      name_en: 'Partially Updated Service',
      base_price_team: 175.50,
      visible: false
    };

    const result = await updateService(updateInput);

    // Verify updated fields
    expect(result.name_en).toEqual('Partially Updated Service');
    expect(result.base_price_team).toEqual(175.50);
    expect(result.visible).toEqual(false);

    // Verify unchanged fields remain the same
    expect(result.slug).toEqual('initial-service');
    expect(result.name_ar).toEqual('خدمة أولية');
    expect(result.desc_ar).toEqual('وصف الخدمة الأولية');
    expect(result.desc_en).toEqual('Initial service description');
    expect(result.base_price_solo).toEqual(120.00);
    expect(result.est_minutes).toEqual(60);
    expect(result.order).toEqual(1);
  });

  it('should save changes to database correctly', async () => {
    // Create initial service
    const [createdService] = await db.insert(servicesTable)
      .values(initialServiceData)
      .returning()
      .execute();

    const updateInput: UpdateServiceInput = {
      id: createdService.id,
      name_en: 'Database Test Service',
      base_price_team: 225.75,
      est_minutes: 45
    };

    await updateService(updateInput);

    // Query database to verify changes
    const services = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.id, createdService.id))
      .execute();

    expect(services).toHaveLength(1);
    const service = services[0];
    expect(service.name_en).toEqual('Database Test Service');
    expect(parseFloat(service.base_price_team)).toEqual(225.75);
    expect(service.est_minutes).toEqual(45);
    // Verify unchanged fields
    expect(service.slug).toEqual('initial-service');
    expect(parseFloat(service.base_price_solo)).toEqual(120.00);
  });

  it('should handle price updates correctly', async () => {
    // Create initial service
    const [createdService] = await db.insert(servicesTable)
      .values(initialServiceData)
      .returning()
      .execute();

    const updateInput: UpdateServiceInput = {
      id: createdService.id,
      base_price_team: 299.99,
      base_price_solo: 199.99
    };

    const result = await updateService(updateInput);

    // Verify price updates with proper decimal handling
    expect(result.base_price_team).toEqual(299.99);
    expect(result.base_price_solo).toEqual(199.99);
    expect(typeof result.base_price_team).toBe('number');
    expect(typeof result.base_price_solo).toBe('number');

    // Verify in database
    const services = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.id, createdService.id))
      .execute();

    const service = services[0];
    expect(parseFloat(service.base_price_team)).toEqual(299.99);
    expect(parseFloat(service.base_price_solo)).toEqual(199.99);
  });

  it('should throw error when service does not exist', async () => {
    const updateInput: UpdateServiceInput = {
      id: 99999,
      name_en: 'Non-existent Service'
    };

    await expect(updateService(updateInput)).rejects.toThrow(/Service with ID 99999 not found/i);
  });

  it('should handle slug uniqueness constraint', async () => {
    // Create two services
    const [service1] = await db.insert(servicesTable)
      .values({
        ...initialServiceData,
        slug: 'service-one'
      })
      .returning()
      .execute();

    await db.insert(servicesTable)
      .values({
        ...initialServiceData,
        slug: 'service-two'
      })
      .returning()
      .execute();

    // Try to update service1 with service2's slug
    const updateInput: UpdateServiceInput = {
      id: service1.id,
      slug: 'service-two'
    };

    // Should throw due to unique constraint violation
    await expect(updateService(updateInput)).rejects.toThrow();
  });

  it('should handle boolean field updates correctly', async () => {
    // Create initial service
    const [createdService] = await db.insert(servicesTable)
      .values({
        ...initialServiceData,
        visible: true
      })
      .returning()
      .execute();

    const updateInput: UpdateServiceInput = {
      id: createdService.id,
      visible: false
    };

    const result = await updateService(updateInput);

    expect(result.visible).toEqual(false);
    expect(typeof result.visible).toBe('boolean');

    // Verify in database
    const services = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.id, createdService.id))
      .execute();

    expect(services[0].visible).toEqual(false);
  });
});