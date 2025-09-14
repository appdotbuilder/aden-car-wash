import { type Service } from '../schema';

export async function getServices(visible_only: boolean = true): Promise<Service[]> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching all services ordered by 'order' field
    // with option to filter by visibility for public vs admin views.
    
    return [];
}

export async function getServiceById(id: number): Promise<Service | null> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching a single service by ID
    // for booking wizard and admin editing.
    
    return null;
}

export async function getServiceBySlug(slug: string): Promise<Service | null> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching a single service by slug
    // for SEO-friendly URLs and deep linking.
    
    return null;
}