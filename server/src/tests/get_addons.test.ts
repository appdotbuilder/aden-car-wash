import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { addonsTable } from '../db/schema';
import { type CreateAddonInput } from '../schema';
import { getAddons, getAddonById, getAddonsByIds } from '../handlers/get_addons';

// Test addon inputs
const testAddon1: CreateAddonInput = {
  slug: 'interior-cleaning',
  name_ar: 'تنظيف داخلي',
  name_en: 'Interior Cleaning',
  desc_ar: 'تنظيف شامل للمقصورة الداخلية',
  desc_en: 'Complete interior cleaning',
  price: 25.00,
  est_minutes: 30,
  order: 1,
  visible: true
};

const testAddon2: CreateAddonInput = {
  slug: 'wax-polish',
  name_ar: 'تلميع بالشمع',
  name_en: 'Wax Polish',
  desc_ar: 'تلميع احترافي بالشمع',
  desc_en: 'Professional wax polish',
  price: 35.50,
  est_minutes: 45,
  order: 2,
  visible: true
};

const testAddon3: CreateAddonInput = {
  slug: 'hidden-addon',
  name_ar: 'إضافة مخفية',
  name_en: 'Hidden Addon',
  desc_ar: 'إضافة غير مرئية',
  desc_en: 'Hidden addon',
  price: 15.00,
  est_minutes: 20,
  order: 3,
  visible: false
};

describe('getAddons', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch all visible addons ordered correctly', async () => {
    // Create test addons
    await db.insert(addonsTable).values([
      {
        ...testAddon2,
        price: testAddon2.price.toString()
      },
      {
        ...testAddon1,
        price: testAddon1.price.toString()
      },
      {
        ...testAddon3,
        price: testAddon3.price.toString()
      }
    ]).execute();

    const results = await getAddons(true);

    expect(results).toHaveLength(2);
    expect(results[0].slug).toEqual('interior-cleaning');
    expect(results[0].price).toEqual(25.00);
    expect(typeof results[0].price).toEqual('number');
    expect(results[0].order).toEqual(1);
    
    expect(results[1].slug).toEqual('wax-polish');
    expect(results[1].price).toEqual(35.50);
    expect(typeof results[1].price).toEqual('number');
    expect(results[1].order).toEqual(2);
  });

  it('should fetch all addons including hidden when visible_only is false', async () => {
    // Create test addons
    await db.insert(addonsTable).values([
      {
        ...testAddon1,
        price: testAddon1.price.toString()
      },
      {
        ...testAddon3,
        price: testAddon3.price.toString()
      }
    ]).execute();

    const results = await getAddons(false);

    expect(results).toHaveLength(2);
    expect(results[0].visible).toEqual(true);
    expect(results[1].visible).toEqual(false);
    expect(results[1].slug).toEqual('hidden-addon');
  });

  it('should return empty array when no addons exist', async () => {
    const results = await getAddons();
    expect(results).toHaveLength(0);
  });

  it('should return empty array when no visible addons exist', async () => {
    // Create only hidden addon
    await db.insert(addonsTable).values({
      ...testAddon3,
      price: testAddon3.price.toString()
    }).execute();

    const results = await getAddons(true);
    expect(results).toHaveLength(0);
  });
});

describe('getAddonById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch addon by ID with correct numeric conversion', async () => {
    // Create test addon
    const insertResult = await db.insert(addonsTable).values({
      ...testAddon1,
      price: testAddon1.price.toString()
    }).returning().execute();

    const addonId = insertResult[0].id;
    const result = await getAddonById(addonId);

    expect(result).toBeDefined();
    expect(result!.id).toEqual(addonId);
    expect(result!.slug).toEqual('interior-cleaning');
    expect(result!.name_ar).toEqual('تنظيف داخلي');
    expect(result!.name_en).toEqual('Interior Cleaning');
    expect(result!.price).toEqual(25.00);
    expect(typeof result!.price).toEqual('number');
    expect(result!.est_minutes).toEqual(30);
    expect(result!.visible).toEqual(true);
  });

  it('should return null when addon does not exist', async () => {
    const result = await getAddonById(999);
    expect(result).toBeNull();
  });

  it('should fetch hidden addon by ID', async () => {
    // Create hidden addon
    const insertResult = await db.insert(addonsTable).values({
      ...testAddon3,
      price: testAddon3.price.toString()
    }).returning().execute();

    const addonId = insertResult[0].id;
    const result = await getAddonById(addonId);

    expect(result).toBeDefined();
    expect(result!.visible).toEqual(false);
    expect(result!.slug).toEqual('hidden-addon');
  });
});

describe('getAddonsByIds', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch multiple addons by IDs with correct ordering', async () => {
    // Create test addons
    const insertResults = await db.insert(addonsTable).values([
      {
        ...testAddon2,
        price: testAddon2.price.toString()
      },
      {
        ...testAddon1,
        price: testAddon1.price.toString()
      }
    ]).returning().execute();

    const ids = insertResults.map(r => r.id);
    const results = await getAddonsByIds(ids);

    expect(results).toHaveLength(2);
    // Should be ordered by order field, then ID
    expect(results[0].order).toEqual(1);
    expect(results[1].order).toEqual(2);
    expect(results[0].price).toEqual(25.00);
    expect(results[1].price).toEqual(35.50);
    expect(typeof results[0].price).toEqual('number');
    expect(typeof results[1].price).toEqual('number');
  });

  it('should return empty array for empty ID list', async () => {
    const results = await getAddonsByIds([]);
    expect(results).toHaveLength(0);
  });

  it('should return empty array when no addons match IDs', async () => {
    const results = await getAddonsByIds([999, 1000]);
    expect(results).toHaveLength(0);
  });

  it('should return partial results when some IDs exist', async () => {
    // Create one addon
    const insertResult = await db.insert(addonsTable).values({
      ...testAddon1,
      price: testAddon1.price.toString()
    }).returning().execute();

    const addonId = insertResult[0].id;
    const results = await getAddonsByIds([addonId, 999]);

    expect(results).toHaveLength(1);
    expect(results[0].id).toEqual(addonId);
    expect(results[0].slug).toEqual('interior-cleaning');
  });

  it('should include hidden addons in results', async () => {
    // Create visible and hidden addons
    const insertResults = await db.insert(addonsTable).values([
      {
        ...testAddon1,
        price: testAddon1.price.toString()
      },
      {
        ...testAddon3,
        price: testAddon3.price.toString()
      }
    ]).returning().execute();

    const ids = insertResults.map(r => r.id);
    const results = await getAddonsByIds(ids);

    expect(results).toHaveLength(2);
    expect(results.some(r => r.visible === true)).toBe(true);
    expect(results.some(r => r.visible === false)).toBe(true);
  });

  it('should maintain order by order field and ID', async () => {
    // Create addons with different orders
    const addon1 = { ...testAddon1, order: 5 };
    const addon2 = { ...testAddon2, order: 1 };
    const addon3 = { ...testAddon3, order: 3 };

    const insertResults = await db.insert(addonsTable).values([
      {
        ...addon1,
        price: addon1.price.toString()
      },
      {
        ...addon2,
        price: addon2.price.toString()
      },
      {
        ...addon3,
        price: addon3.price.toString()
      }
    ]).returning().execute();

    const ids = insertResults.map(r => r.id);
    const results = await getAddonsByIds(ids);

    expect(results).toHaveLength(3);
    expect(results[0].order).toEqual(1); // wax-polish
    expect(results[1].order).toEqual(3); // hidden-addon
    expect(results[2].order).toEqual(5); // interior-cleaning
  });
});