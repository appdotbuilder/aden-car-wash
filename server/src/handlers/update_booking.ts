import { db } from '../db';
import { bookingsTable } from '../db/schema';
import { type UpdateBookingInput, type Booking } from '../schema';
import { eq } from 'drizzle-orm';

export const updateBooking = async (input: UpdateBookingInput): Promise<Booking> => {
  try {
    // First verify the booking exists
    const existingBookings = await db.select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, input.id))
      .execute();

    if (existingBookings.length === 0) {
      throw new Error(`Booking with ID ${input.id} not found`);
    }

    const existingBooking = existingBookings[0];

    // Prepare update values - only include fields that are provided
    const updateValues: any = {};

    if (input.status !== undefined) {
      updateValues.status = input.status;
    }

    if (input.scheduled_window_start !== undefined) {
      updateValues.scheduled_window_start = input.scheduled_window_start;
    }

    if (input.scheduled_window_end !== undefined) {
      updateValues.scheduled_window_end = input.scheduled_window_end;
    }

    if (input.address_text !== undefined) {
      updateValues.address_text = input.address_text;
    }

    if (input.geo_point !== undefined) {
      updateValues.geo_point = input.geo_point;
    }

    // If no updates provided, return existing booking
    if (Object.keys(updateValues).length === 0) {
      return {
        ...existingBooking,
        price_total: parseFloat(existingBooking.price_total),
        distance_fee: parseFloat(existingBooking.distance_fee),
        status: existingBooking.status as any,
        car_type: existingBooking.car_type as any
      };
    }

    // Update the booking
    const result = await db.update(bookingsTable)
      .set(updateValues)
      .where(eq(bookingsTable.id, input.id))
      .returning()
      .execute();

    const updatedBooking = result[0];

    // Convert numeric fields back to numbers before returning
    return {
      ...updatedBooking,
      price_total: parseFloat(updatedBooking.price_total),
      distance_fee: parseFloat(updatedBooking.distance_fee),
      status: updatedBooking.status as any,
      car_type: updatedBooking.car_type as any
    };
  } catch (error) {
    console.error('Booking update failed:', error);
    throw error;
  }
};