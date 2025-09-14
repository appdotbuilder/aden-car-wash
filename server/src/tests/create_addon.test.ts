import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { addonsTable } from '../db/schema';
import { type CreateAddonInput } from '../schema';
import { createAddon } from '../handlers/create_addon';
import { eq } from 'drizzle-orm';

// Complete test input with all required fields
const testInput: CreateAddonInput = {
  slug: 'test-addon',
  name_ar: 'إضافة تجريبية',
  name_en: 'Test Addon',
  desc_ar: 'وصف الإضافة التجريبية',
  desc_en: 'Description of test addon',
  price: 25.50,
  est_minutes: 15,
  order: 1,
  visible: true
};

describe('createAddon', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an addon with all fields', async () => {
    const result = await createAddon(testInput);

    // Basic field validation
    expect(result.slug).toEqual('test-addon');
    expect(result.name_ar).toEqual('إضافة تجريبية');
    expect(result.name_en).toEqual('Test Addon');
    expect(result.desc_ar).toEqual('وصف الإضافة التجريبية');
    expect(result.desc_en).toEqual('Description of test addon');
    expect(result.price).toEqual(25.50);
    expect(typeof result.price).toBe('number');
    expect(result.est_minutes).toEqual(15);
    expect(result.order).toEqual(1);
    expect(result.visible).toEqual(true);
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
  });

  it('should save addon to database correctly', async () => {
    const result = await createAddon(testInput);

    // Query using proper drizzle syntax
    const addons = await db.select()
      .from(addonsTable)
      .where(eq(addonsTable.id, result.id))
      .execute();

    expect(addons).toHaveLength(1);
    const savedAddon = addons[0];
    expect(savedAddon.slug).toEqual('test-addon');
    expect(savedAddon.name_ar).toEqual('إضافة تجريبية');
    expect(savedAddon.name_en).toEqual('Test Addon');
    expect(savedAddon.desc_ar).toEqual('وصف الإضافة التجريبية');
    expect(savedAddon.desc_en).toEqual('Description of test addon');
    expect(parseFloat(savedAddon.price)).toEqual(25.50); // Convert numeric field back
    expect(savedAddon.est_minutes).toEqual(15);
    expect(savedAddon.order).toEqual(1);
    expect(savedAddon.visible).toEqual(true);
  });

  it('should apply default values correctly', async () => {
    // Test input with explicit default values matching Zod schema defaults
    const minimalInput: CreateAddonInput = {
      slug: 'minimal-addon',
      name_ar: 'إضافة بسيطة',
      name_en: 'Minimal Addon',
      desc_ar: 'وصف بسيط',
      desc_en: 'Simple description',
      price: 10.00,
      est_minutes: 5,
      order: 0, // Zod default value
      visible: true // Zod default value
    };

    const result = await createAddon(minimalInput);

    expect(result.order).toEqual(0); // Default value from Zod schema
    expect(result.visible).toEqual(true); // Default value from Zod schema
    expect(result.slug).toEqual('minimal-addon');
    expect(result.price).toEqual(10.00);
    expect(result.est_minutes).toEqual(5);
  });

  it('should handle decimal prices correctly', async () => {
    const decimalInput: CreateAddonInput = {
      slug: 'decimal-addon',
      name_ar: 'إضافة بأسعار عشرية',
      name_en: 'Decimal Addon',
      desc_ar: 'وصف بأسعار عشرية',
      desc_en: 'Decimal price description',
      price: 15.99,
      est_minutes: 10,
      order: 0,
      visible: true
    };

    const result = await createAddon(decimalInput);

    expect(result.price).toEqual(15.99);
    expect(typeof result.price).toBe('number');

    // Verify in database
    const savedAddons = await db.select()
      .from(addonsTable)
      .where(eq(addonsTable.id, result.id))
      .execute();

    expect(parseFloat(savedAddons[0].price)).toEqual(15.99);
  });

  it('should handle zero estimated minutes', async () => {
    const zeroTimeInput: CreateAddonInput = {
      slug: 'zero-time-addon',
      name_ar: 'إضافة بدون وقت',
      name_en: 'Zero Time Addon',
      desc_ar: 'إضافة لا تحتاج وقت إضافي',
      desc_en: 'Addon that requires no additional time',
      price: 5.00,
      est_minutes: 0, // Zero minutes should be allowed
      order: 2,
      visible: false
    };

    const result = await createAddon(zeroTimeInput);

    expect(result.est_minutes).toEqual(0);
    expect(result.visible).toEqual(false);
    expect(result.order).toEqual(2);
    expect(result.price).toEqual(5.00);
  });

  it('should fail when slug is not unique', async () => {
    // Create first addon
    await createAddon(testInput);

    // Try to create second addon with same slug
    const duplicateInput: CreateAddonInput = {
      ...testInput,
      name_ar: 'إضافة مكررة',
      name_en: 'Duplicate Addon'
    };

    await expect(createAddon(duplicateInput)).rejects.toThrow(/duplicate key value violates unique constraint|UNIQUE constraint failed/i);
  });

  it('should handle large order values', async () => {
    const largeOrderInput: CreateAddonInput = {
      slug: 'large-order-addon',
      name_ar: 'إضافة برقم ترتيب كبير',
      name_en: 'Large Order Addon',
      desc_ar: 'إضافة برقم ترتيب كبير',
      desc_en: 'Addon with large order number',
      price: 50.00,
      est_minutes: 30,
      order: 999,
      visible: true
    };

    const result = await createAddon(largeOrderInput);

    expect(result.order).toEqual(999);
    expect(result.est_minutes).toEqual(30);
    expect(result.price).toEqual(50.00);

    // Verify in database
    const savedAddons = await db.select()
      .from(addonsTable)
      .where(eq(addonsTable.id, result.id))
      .execute();

    expect(savedAddons[0].order).toEqual(999);
  });
});