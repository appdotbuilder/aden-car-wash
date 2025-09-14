import { db } from '../db';
import { customersTable, bookingsTable, servicesTable, addonsTable, zonesTable } from '../db/schema';
import { type CreateBookingInput, type CreateBookingResponse } from '../schema';
import { eq, inArray } from 'drizzle-orm';

export const createBooking = async (input: CreateBookingInput): Promise<CreateBookingResponse> => {
  try {
    // 1. Create or find customer by phone
    let customer;
    const existingCustomers = await db.select()
      .from(customersTable)
      .where(eq(customersTable.phone, input.customer.phone))
      .execute();

    if (existingCustomers.length > 0) {
      customer = existingCustomers[0];
    } else {
      const newCustomers = await db.insert(customersTable)
        .values({
          name: input.customer.name,
          phone: input.customer.phone,
          whatsapp_verified: false
        })
        .returning()
        .execute();
      customer = newCustomers[0];
    }

    // 2. Validate service exists
    const services = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.id, input.service_id))
      .execute();

    if (services.length === 0) {
      throw new Error(`Service with id ${input.service_id} not found`);
    }

    const service = services[0];

    // 3. Validate zone exists
    const zones = await db.select()
      .from(zonesTable)
      .where(eq(zonesTable.id, input.zone_id))
      .execute();

    if (zones.length === 0) {
      throw new Error(`Zone with id ${input.zone_id} not found`);
    }

    // 4. Validate addons exist (if any)
    let addons: any[] = [];
    if (input.addons.length > 0) {
      addons = await db.select()
        .from(addonsTable)
        .where(inArray(addonsTable.id, input.addons))
        .execute();

      if (addons.length !== input.addons.length) {
        throw new Error('One or more addons not found');
      }
    }

    // 5. Calculate total price
    const basePrice = input.is_solo 
      ? parseFloat(service.base_price_solo)
      : parseFloat(service.base_price_team);

    const addonsPrice = addons.reduce((sum, addon) => sum + parseFloat(addon.price), 0);
    const distanceFee = 0; // Default distance fee - could be calculated based on zone/location
    const totalPrice = basePrice + addonsPrice + distanceFee;

    // 6. Create booking record
    const bookingResult = await db.insert(bookingsTable)
      .values({
        customer_id: customer.id,
        service_id: input.service_id,
        addons: input.addons,
        car_type: input.car_type,
        zone_id: input.zone_id,
        address_text: input.address_text,
        geo_point: JSON.stringify(input.geo_point),
        scheduled_window_start: input.scheduled_window.start,
        scheduled_window_end: input.scheduled_window.end,
        status: 'confirmed',
        price_total: totalPrice.toString(),
        is_solo: input.is_solo,
        distance_fee: distanceFee.toString()
      })
      .returning()
      .execute();

    const booking = bookingResult[0];

    // 7. Generate WhatsApp message ID (placeholder for actual WhatsApp integration)
    const waMessageId = `wa_${booking.id}_${Date.now()}`;

    return {
      booking_id: booking.id.toString(),
      price_total: totalPrice,
      wa_message_id: waMessageId
    };
  } catch (error) {
    console.error('Booking creation failed:', error);
    throw error;
  }
};