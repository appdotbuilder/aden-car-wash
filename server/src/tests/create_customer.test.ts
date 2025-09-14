import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { customersTable } from '../db/schema';
import { type CreateCustomerInput } from '../schema';
import { createCustomer, findCustomerByPhone, verifyCustomerWhatsApp } from '../handlers/create_customer';
import { eq } from 'drizzle-orm';

// Test input with all fields
const testInput: CreateCustomerInput = {
  name: 'Ahmed Mohammed',
  phone: '+966501234567',
  whatsapp_verified: false
};

// Test input with defaults
const testInputDefaults = {
  name: 'Sara Ali',
  phone: '+966507654321'
  // whatsapp_verified will use default false
} as CreateCustomerInput;

describe('createCustomer', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a customer with all fields', async () => {
    const result = await createCustomer(testInput);

    // Basic field validation
    expect(result.name).toEqual('Ahmed Mohammed');
    expect(result.phone).toEqual('+966501234567');
    expect(result.whatsapp_verified).toEqual(false);
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a customer with default whatsapp_verified', async () => {
    const result = await createCustomer(testInputDefaults);

    expect(result.name).toEqual('Sara Ali');
    expect(result.phone).toEqual('+966507654321');
    expect(result.whatsapp_verified).toEqual(false); // Should use default
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save customer to database', async () => {
    const result = await createCustomer(testInput);

    // Query database directly to verify
    const customers = await db.select()
      .from(customersTable)
      .where(eq(customersTable.id, result.id))
      .execute();

    expect(customers).toHaveLength(1);
    expect(customers[0].name).toEqual('Ahmed Mohammed');
    expect(customers[0].phone).toEqual('+966501234567');
    expect(customers[0].whatsapp_verified).toEqual(false);
    expect(customers[0].created_at).toBeInstanceOf(Date);
  });

  it('should return existing customer if phone already exists', async () => {
    // Create first customer
    const firstCustomer = await createCustomer(testInput);

    // Try to create another customer with same phone
    const duplicateInput: CreateCustomerInput = {
      name: 'Different Name',
      phone: '+966501234567', // Same phone
      whatsapp_verified: true
    };

    const secondCustomer = await createCustomer(duplicateInput);

    // Should return the first customer, not create new one
    expect(secondCustomer.id).toEqual(firstCustomer.id);
    expect(secondCustomer.name).toEqual('Ahmed Mohammed'); // Original name
    expect(secondCustomer.whatsapp_verified).toEqual(false); // Original status

    // Verify only one record exists in database
    const allCustomers = await db.select()
      .from(customersTable)
      .where(eq(customersTable.phone, '+966501234567'))
      .execute();

    expect(allCustomers).toHaveLength(1);
  });

  it('should create customer with whatsapp_verified true', async () => {
    const verifiedInput: CreateCustomerInput = {
      name: 'Verified User',
      phone: '+966509876543',
      whatsapp_verified: true
    };

    const result = await createCustomer(verifiedInput);

    expect(result.whatsapp_verified).toEqual(true);
    expect(result.name).toEqual('Verified User');
    expect(result.phone).toEqual('+966509876543');
  });
});

describe('findCustomerByPhone', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should find existing customer by phone', async () => {
    // Create a customer first
    const createdCustomer = await createCustomer(testInput);

    // Find by phone
    const foundCustomer = await findCustomerByPhone('+966501234567');

    expect(foundCustomer).not.toBeNull();
    expect(foundCustomer!.id).toEqual(createdCustomer.id);
    expect(foundCustomer!.name).toEqual('Ahmed Mohammed');
    expect(foundCustomer!.phone).toEqual('+966501234567');
    expect(foundCustomer!.whatsapp_verified).toEqual(false);
    expect(foundCustomer!.created_at).toBeInstanceOf(Date);
  });

  it('should return null for non-existent phone', async () => {
    const foundCustomer = await findCustomerByPhone('+966500000000');

    expect(foundCustomer).toBeNull();
  });

  it('should find customer with exact phone match', async () => {
    // Create multiple customers
    await createCustomer({
      name: 'Customer 1',
      phone: '+966501111111',
      whatsapp_verified: false
    });

    await createCustomer({
      name: 'Customer 2',
      phone: '+966502222222',
      whatsapp_verified: true
    });

    // Find specific customer
    const foundCustomer = await findCustomerByPhone('+966502222222');

    expect(foundCustomer).not.toBeNull();
    expect(foundCustomer!.name).toEqual('Customer 2');
    expect(foundCustomer!.phone).toEqual('+966502222222');
    expect(foundCustomer!.whatsapp_verified).toEqual(true);
  });
});

describe('verifyCustomerWhatsApp', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should verify WhatsApp for existing customer', async () => {
    // Create unverified customer
    const customer = await createCustomer({
      name: 'Test Customer',
      phone: '+966501111111',
      whatsapp_verified: false
    });

    expect(customer.whatsapp_verified).toEqual(false);

    // Verify WhatsApp
    const verificationResult = await verifyCustomerWhatsApp('+966501111111');

    expect(verificationResult).toEqual(true);

    // Check that customer is now verified in database
    const verifiedCustomer = await findCustomerByPhone('+966501111111');
    expect(verifiedCustomer).not.toBeNull();
    expect(verifiedCustomer!.whatsapp_verified).toEqual(true);
  });

  it('should throw error for non-existent customer', async () => {
    await expect(verifyCustomerWhatsApp('+966500000000')).rejects.toThrow(/customer not found/i);
  });

  it('should verify already verified customer', async () => {
    // Create already verified customer
    const customer = await createCustomer({
      name: 'Already Verified',
      phone: '+966502222222',
      whatsapp_verified: true
    });

    expect(customer.whatsapp_verified).toEqual(true);

    // Verify again - should still work
    const verificationResult = await verifyCustomerWhatsApp('+966502222222');

    expect(verificationResult).toEqual(true);

    // Customer should still be verified
    const stillVerifiedCustomer = await findCustomerByPhone('+966502222222');
    expect(stillVerifiedCustomer!.whatsapp_verified).toEqual(true);
  });

  it('should update database record correctly', async () => {
    // Create unverified customer
    await createCustomer({
      name: 'Database Test',
      phone: '+966503333333',
      whatsapp_verified: false
    });

    // Verify WhatsApp
    await verifyCustomerWhatsApp('+966503333333');

    // Query database directly to verify update
    const updatedCustomers = await db.select()
      .from(customersTable)
      .where(eq(customersTable.phone, '+966503333333'))
      .execute();

    expect(updatedCustomers).toHaveLength(1);
    expect(updatedCustomers[0].whatsapp_verified).toEqual(true);
    expect(updatedCustomers[0].name).toEqual('Database Test'); // Other fields unchanged
  });
});