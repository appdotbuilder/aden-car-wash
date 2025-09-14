import { type Addon } from '../schema';

export async function getAddons(visible_only: boolean = true): Promise<Addon[]> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching all addons ordered by 'order' field
    // with option to filter by visibility for public vs admin views.
    
    return [];
}

export async function getAddonById(id: number): Promise<Addon | null> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching a single addon by ID
    // for booking wizard and admin editing.
    
    return null;
}

export async function getAddonsByIds(ids: number[]): Promise<Addon[]> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching multiple addons by their IDs
    // for booking price calculation and confirmation display.
    
    return [];
}