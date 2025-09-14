import { db } from '../db';
import { bookingsTable, customersTable, servicesTable, zonesTable, kpisDailyTable } from '../db/schema';
import { type AdminOverviewResponse, type Booking } from '../schema';
import { eq, gte, lte, and, count, sum, avg, desc, sql, type SQL } from 'drizzle-orm';

export async function getAdminOverview(): Promise<AdminOverviewResponse> {
  try {
    // Get today's date range (start and end of day)
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Get today's booking statistics
    const todayStatsResult = await db
      .select({
        total_bookings: count(),
        confirmed: sum(sql`CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END`),
        on_the_way: sum(sql`CASE WHEN status = 'on_the_way' THEN 1 ELSE 0 END`),
        completed: sum(sql`CASE WHEN status = 'finished' THEN 1 ELSE 0 END`),
        revenue: sum(bookingsTable.price_total)
      })
      .from(bookingsTable)
      .where(
        and(
          gte(bookingsTable.created_at, startOfDay),
          lte(bookingsTable.created_at, endOfDay)
        )
      )
      .execute();

    // Get upcoming bookings (next 24 hours from now)
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const upcomingBookingsResult = await db
      .select({
        id: bookingsTable.id,
        customer_id: bookingsTable.customer_id,
        service_id: bookingsTable.service_id,
        addons: bookingsTable.addons,
        car_type: bookingsTable.car_type,
        zone_id: bookingsTable.zone_id,
        address_text: bookingsTable.address_text,
        geo_point: bookingsTable.geo_point,
        scheduled_window_start: bookingsTable.scheduled_window_start,
        scheduled_window_end: bookingsTable.scheduled_window_end,
        status: bookingsTable.status,
        price_total: bookingsTable.price_total,
        is_solo: bookingsTable.is_solo,
        distance_fee: bookingsTable.distance_fee,
        created_at: bookingsTable.created_at,
        customer_name: customersTable.name,
        customer_phone: customersTable.phone,
        service_name_en: servicesTable.name_en,
        zone_name_en: zonesTable.name_en
      })
      .from(bookingsTable)
      .innerJoin(customersTable, eq(bookingsTable.customer_id, customersTable.id))
      .innerJoin(servicesTable, eq(bookingsTable.service_id, servicesTable.id))
      .innerJoin(zonesTable, eq(bookingsTable.zone_id, zonesTable.id))
      .where(
        and(
          gte(bookingsTable.scheduled_window_start, today),
          lte(bookingsTable.scheduled_window_start, tomorrow),
          eq(bookingsTable.status, 'confirmed')
        )
      )
      .orderBy(bookingsTable.scheduled_window_start)
      .limit(10)
      .execute();

    // Get recent KPIs (last 7 days average for better accuracy)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoString = sevenDaysAgo.toISOString().split('T')[0];

    const kpisResult = await db
      .select({
        avg_complaints_rate: avg(kpisDailyTable.complaints_rate),
        avg_addons_ratio: avg(kpisDailyTable.addons_ratio)
      })
      .from(kpisDailyTable)
      .where(gte(kpisDailyTable.date, sevenDaysAgoString))
      .execute();

    // Calculate on-time percentage from recent bookings
    const recentBookingsResult = await db
      .select({
        total_finished: count(),
        on_time_count: sum(sql`CASE WHEN status = 'finished' AND scheduled_window_start >= created_at THEN 1 ELSE 0 END`)
      })
      .from(bookingsTable)
      .where(
        and(
          gte(bookingsTable.created_at, sevenDaysAgo),
          eq(bookingsTable.status, 'finished')
        )
      )
      .execute();

    // Calculate average service time from finished bookings
    const avgServiceTimeResult = await db
      .select({
        avg_est_minutes: avg(servicesTable.est_minutes)
      })
      .from(bookingsTable)
      .innerJoin(servicesTable, eq(bookingsTable.service_id, servicesTable.id))
      .where(
        and(
          gte(bookingsTable.created_at, sevenDaysAgo),
          eq(bookingsTable.status, 'finished')
        )
      )
      .execute();

    // Process results with proper type conversions
    const todayStats = todayStatsResult[0];
    const kpis = kpisResult[0];
    const recentBookings = recentBookingsResult[0];
    const avgServiceTime = avgServiceTimeResult[0];

    // Convert upcoming bookings to proper format
    const upcomingBookings: Booking[] = upcomingBookingsResult.map(result => ({
      id: result.id,
      customer_id: result.customer_id,
      service_id: result.service_id,
      addons: result.addons,
      car_type: result.car_type as 'sedan' | 'suv' | 'pickup',
      zone_id: result.zone_id,
      address_text: result.address_text,
      geo_point: result.geo_point,
      scheduled_window_start: result.scheduled_window_start,
      scheduled_window_end: result.scheduled_window_end,
      status: result.status as 'confirmed' | 'on_the_way' | 'started' | 'finished' | 'postponed' | 'canceled',
      price_total: parseFloat(result.price_total),
      is_solo: result.is_solo,
      distance_fee: parseFloat(result.distance_fee),
      created_at: result.created_at
    }));

    // Calculate KPI values with fallbacks
    const totalFinished = Number(recentBookings.total_finished) || 1;
    const onTimeCount = Number(recentBookings.on_time_count) || 0;
    const onTimePercentage = onTimeCount / totalFinished;

    return {
      today_stats: {
        total_bookings: Number(todayStats.total_bookings) || 0,
        confirmed: Number(todayStats.confirmed) || 0,
        on_the_way: Number(todayStats.on_the_way) || 0,
        completed: Number(todayStats.completed) || 0,
        revenue: parseFloat(todayStats.revenue || '0')
      },
      upcoming_bookings: upcomingBookings,
      kpis: {
        on_time_percentage: onTimePercentage,
        complaints_rate: parseFloat(kpis?.avg_complaints_rate || '0'),
        avg_service_time: parseFloat(avgServiceTime?.avg_est_minutes || '0')
      }
    };
  } catch (error) {
    console.error('Admin overview failed:', error);
    throw error;
  }
}

export async function getTodayBookings(): Promise<Booking[]> {
  try {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const bookingsResult = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          gte(bookingsTable.scheduled_window_start, startOfDay),
          lte(bookingsTable.scheduled_window_start, endOfDay)
        )
      )
      .orderBy(bookingsTable.scheduled_window_start)
      .execute();

    return bookingsResult.map(booking => ({
      ...booking,
      price_total: parseFloat(booking.price_total),
      distance_fee: parseFloat(booking.distance_fee),
      car_type: booking.car_type as 'sedan' | 'suv' | 'pickup',
      status: booking.status as 'confirmed' | 'on_the_way' | 'started' | 'finished' | 'postponed' | 'canceled'
    }));
  } catch (error) {
    console.error('Get today bookings failed:', error);
    throw error;
  }
}

export async function getBookingsByDateRange(startDate: Date, endDate: Date): Promise<Booking[]> {
  try {
    const bookingsResult = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          gte(bookingsTable.scheduled_window_start, startDate),
          lte(bookingsTable.scheduled_window_start, endDate)
        )
      )
      .orderBy(desc(bookingsTable.scheduled_window_start))
      .execute();

    return bookingsResult.map(booking => ({
      ...booking,
      price_total: parseFloat(booking.price_total),
      distance_fee: parseFloat(booking.distance_fee),
      car_type: booking.car_type as 'sedan' | 'suv' | 'pickup',
      status: booking.status as 'confirmed' | 'on_the_way' | 'started' | 'finished' | 'postponed' | 'canceled'
    }));
  } catch (error) {
    console.error('Get bookings by date range failed:', error);
    throw error;
  }
}