import { db } from '../db';
import { fleetLeadsTable } from '../db/schema';
import { type CreateFleetLeadInput, type FleetLead } from '../schema';
import { eq, desc } from 'drizzle-orm';

export async function createFleetLead(input: CreateFleetLeadInput): Promise<FleetLead> {
  try {
    // Insert fleet lead record
    const result = await db.insert(fleetLeadsTable)
      .values({
        company_name: input.company_name,
        contact_person: input.contact_person,
        phone: input.phone,
        status: input.status || 'new',
        notes: input.notes || null
      })
      .returning()
      .execute();

    const fleetLead = result[0];
    return {
      id: fleetLead.id,
      company_name: fleetLead.company_name,
      contact_person: fleetLead.contact_person,
      phone: fleetLead.phone,
      status: fleetLead.status as FleetLead['status'],
      notes: fleetLead.notes,
      created_at: fleetLead.created_at
    };
  } catch (error) {
    console.error('Fleet lead creation failed:', error);
    throw error;
  }
}

export async function getFleetLeads(): Promise<FleetLead[]> {
  try {
    // Fetch all fleet leads ordered by creation date (newest first)
    const results = await db.select()
      .from(fleetLeadsTable)
      .orderBy(desc(fleetLeadsTable.created_at))
      .execute();

    return results.map(lead => ({
      id: lead.id,
      company_name: lead.company_name,
      contact_person: lead.contact_person,
      phone: lead.phone,
      status: lead.status as FleetLead['status'],
      notes: lead.notes,
      created_at: lead.created_at
    }));
  } catch (error) {
    console.error('Fleet leads retrieval failed:', error);
    throw error;
  }
}

export async function updateFleetLeadStatus(
    id: number, 
    status: FleetLead['status'],
    notes?: string
): Promise<FleetLead> {
  try {
    // First check if the fleet lead exists
    const existingLeads = await db.select()
      .from(fleetLeadsTable)
      .where(eq(fleetLeadsTable.id, id))
      .execute();

    if (existingLeads.length === 0) {
      throw new Error(`Fleet lead with id ${id} not found`);
    }

    // Update fleet lead status and notes
    const updateData: any = { status };
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const result = await db.update(fleetLeadsTable)
      .set(updateData)
      .where(eq(fleetLeadsTable.id, id))
      .returning()
      .execute();

    const updatedLead = result[0];
    return {
      id: updatedLead.id,
      company_name: updatedLead.company_name,
      contact_person: updatedLead.contact_person,
      phone: updatedLead.phone,
      status: updatedLead.status as FleetLead['status'],
      notes: updatedLead.notes,
      created_at: updatedLead.created_at
    };
  } catch (error) {
    console.error('Fleet lead status update failed:', error);
    throw error;
  }
}

export async function generateFleetLOI(leadId: number): Promise<string> {
  try {
    // First verify the fleet lead exists
    const leads = await db.select()
      .from(fleetLeadsTable)
      .where(eq(fleetLeadsTable.id, leadId))
      .execute();

    if (leads.length === 0) {
      throw new Error(`Fleet lead with id ${leadId} not found`);
    }

    const lead = leads[0];
    
    // Generate LOI filename with lead info and timestamp
    // In a real implementation, this would generate an actual PDF document
    // For now, we return a structured filename that could be used to identify the document
    const timestamp = Date.now();
    const companySlug = lead.company_name.toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    const filename = `loi_${leadId}_${companySlug}_${timestamp}.pdf`;
    
    return filename;
  } catch (error) {
    console.error('Fleet LOI generation failed:', error);
    throw error;
  }
}