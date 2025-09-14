import { db } from '../db';
import { bookingsTable, customersTable, servicesTable, zonesTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type Booking } from '../schema';

export async function getBookings(): Promise<Booking[]> {
  try {
    const results = await db.select()
      .from(bookingsTable)
      .execute();

    // Convert numeric fields back to numbers and ensure proper types
    return results.map(booking => ({
      ...booking,
      price_total: parseFloat(booking.price_total),
      distance_fee: parseFloat(booking.distance_fee),
      status: booking.status as 'confirmed' | 'on_the_way' | 'started' | 'finished' | 'postponed' | 'canceled',
      car_type: booking.car_type as 'sedan' | 'suv' | 'pickup'
    }));
  } catch (error) {
    console.error('Failed to fetch bookings:', error);
    throw error;
  }
}

export async function getBookingById(id: number): Promise<Booking | null> {
  try {
    const results = await db.select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const booking = results[0];
    return {
      ...booking,
      price_total: parseFloat(booking.price_total),
      distance_fee: parseFloat(booking.distance_fee),
      status: booking.status as 'confirmed' | 'on_the_way' | 'started' | 'finished' | 'postponed' | 'canceled',
      car_type: booking.car_type as 'sedan' | 'suv' | 'pickup'
    };
  } catch (error) {
    console.error('Failed to fetch booking by ID:', error);
    throw error;
  }
}