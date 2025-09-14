import { db } from '../db';
import { customersTable } from '../db/schema';
import { type CreateCustomerInput, type Customer } from '../schema';
import { eq } from 'drizzle-orm';

export const createCustomer = async (input: CreateCustomerInput): Promise<Customer> => {
  try {
    // Check if customer already exists with this phone number
    const existingCustomer = await findCustomerByPhone(input.phone);
    if (existingCustomer) {
      // Return existing customer instead of creating duplicate
      return existingCustomer;
    }

    // Insert new customer record
    const result = await db.insert(customersTable)
      .values({
        name: input.name,
        phone: input.phone,
        whatsapp_verified: input.whatsapp_verified // Uses default false if not provided
      })
      .returning()
      .execute();

    const customer = result[0];
    return {
      ...customer
    };
  } catch (error) {
    console.error('Customer creation failed:', error);
    throw error;
  }
};

export const findCustomerByPhone = async (phone: string): Promise<Customer | null> => {
  try {
    const customers = await db.select()
      .from(customersTable)
      .where(eq(customersTable.phone, phone))
      .execute();

    return customers.length > 0 ? customers[0] : null;
  } catch (error) {
    console.error('Customer lookup failed:', error);
    throw error;
  }
};

export const verifyCustomerWhatsApp = async (phone: string): Promise<boolean> => {
  try {
    // Find customer by phone number
    const customer = await findCustomerByPhone(phone);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Update customer's WhatsApp verification status
    await db.update(customersTable)
      .set({ whatsapp_verified: true })
      .where(eq(customersTable.id, customer.id))
      .execute();

    return true;
  } catch (error) {
    console.error('WhatsApp verification failed:', error);
    throw error;
  }
};