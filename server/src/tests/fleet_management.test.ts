import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { fleetLeadsTable } from '../db/schema';
import { type CreateFleetLeadInput } from '../schema';
import { 
  createFleetLead, 
  getFleetLeads, 
  updateFleetLeadStatus, 
  generateFleetLOI 
} from '../handlers/fleet_management';
import { eq } from 'drizzle-orm';

// Test input data
const testFleetLeadInput: CreateFleetLeadInput = {
  company_name: 'ABC Transport LLC',
  contact_person: 'Ahmad Al-Rashid',
  phone: '+967777123456',
  status: 'new',
  notes: 'Interested in 10-vehicle trial package'
};

const minimalFleetLeadInput: CreateFleetLeadInput = {
  company_name: 'XYZ Logistics',
  contact_person: 'Sarah Mohammed',
  phone: '+967777654321',
  status: 'new' // Include default status
};

describe('fleet management handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createFleetLead', () => {
    it('should create a fleet lead with all fields', async () => {
      const result = await createFleetLead(testFleetLeadInput);

      // Verify basic field mapping
      expect(result.company_name).toEqual('ABC Transport LLC');
      expect(result.contact_person).toEqual('Ahmad Al-Rashid');
      expect(result.phone).toEqual('+967777123456');
      expect(result.status).toEqual('new');
      expect(result.notes).toEqual('Interested in 10-vehicle trial package');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should create a fleet lead with minimal fields and defaults', async () => {
      const result = await createFleetLead(minimalFleetLeadInput);

      // Verify minimal input with defaults applied
      expect(result.company_name).toEqual('XYZ Logistics');
      expect(result.contact_person).toEqual('Sarah Mohammed');
      expect(result.phone).toEqual('+967777654321');
      expect(result.status).toEqual('new'); // Default status
      expect(result.notes).toBeNull();
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should save fleet lead to database', async () => {
      const result = await createFleetLead(testFleetLeadInput);

      // Query database directly to verify persistence
      const leads = await db.select()
        .from(fleetLeadsTable)
        .where(eq(fleetLeadsTable.id, result.id))
        .execute();

      expect(leads).toHaveLength(1);
      expect(leads[0].company_name).toEqual('ABC Transport LLC');
      expect(leads[0].contact_person).toEqual('Ahmad Al-Rashid');
      expect(leads[0].phone).toEqual('+967777123456');
      expect(leads[0].status).toEqual('new');
      expect(leads[0].notes).toEqual('Interested in 10-vehicle trial package');
      expect(leads[0].created_at).toBeInstanceOf(Date);
    });

    it('should handle different status values', async () => {
      const contactedInput = {
        ...testFleetLeadInput,
        status: 'contacted' as const
      };

      const result = await createFleetLead(contactedInput);
      expect(result.status).toEqual('contacted');
    });
  });

  describe('getFleetLeads', () => {
    it('should return empty array when no leads exist', async () => {
      const result = await getFleetLeads();
      expect(result).toEqual([]);
    });

    it('should return all fleet leads', async () => {
      // Create multiple test leads
      await createFleetLead(testFleetLeadInput);
      await createFleetLead(minimalFleetLeadInput);
      await createFleetLead({
        company_name: 'DEF Services',
        contact_person: 'Omar Hassan',
        phone: '+967777999888',
        status: 'proposal_sent'
      });

      const results = await getFleetLeads();

      expect(results).toHaveLength(3);
      
      // Verify all leads are returned with proper fields
      results.forEach(lead => {
        expect(lead.id).toBeDefined();
        expect(lead.company_name).toBeDefined();
        expect(lead.contact_person).toBeDefined();
        expect(lead.phone).toBeDefined();
        expect(lead.status).toBeDefined();
        expect(lead.created_at).toBeInstanceOf(Date);
      });

      // Verify specific lead data
      const abcLead = results.find(lead => lead.company_name === 'ABC Transport LLC');
      expect(abcLead?.contact_person).toEqual('Ahmad Al-Rashid');
      expect(abcLead?.status).toEqual('new');
    });

    it('should return leads ordered by creation date (newest first)', async () => {
      // Create leads with slight delay to ensure different timestamps
      const firstLead = await createFleetLead({
        company_name: 'First Company',
        contact_person: 'First Contact',
        phone: '+967777111111',
        status: 'new'
      });

      // Small delay to ensure different created_at timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const secondLead = await createFleetLead({
        company_name: 'Second Company',
        contact_person: 'Second Contact',
        phone: '+967777222222',
        status: 'new'
      });

      const results = await getFleetLeads();

      expect(results).toHaveLength(2);
      // Newest should be first (second lead created later)
      expect(results[0].company_name).toEqual('Second Company');
      expect(results[1].company_name).toEqual('First Company');
      expect(results[0].created_at >= results[1].created_at).toBe(true);
    });
  });

  describe('updateFleetLeadStatus', () => {
    it('should update fleet lead status only', async () => {
      const originalLead = await createFleetLead(testFleetLeadInput);

      const updatedLead = await updateFleetLeadStatus(originalLead.id, 'contacted');

      // Verify status was updated
      expect(updatedLead.status).toEqual('contacted');
      expect(updatedLead.id).toEqual(originalLead.id);
      expect(updatedLead.company_name).toEqual(originalLead.company_name);
      expect(updatedLead.contact_person).toEqual(originalLead.contact_person);
      expect(updatedLead.phone).toEqual(originalLead.phone);
      expect(updatedLead.notes).toEqual(originalLead.notes);
    });

    it('should update both status and notes', async () => {
      const originalLead = await createFleetLead(testFleetLeadInput);
      const newNotes = 'Called on 2024-01-15, interested in premium package';

      const updatedLead = await updateFleetLeadStatus(
        originalLead.id, 
        'proposal_sent', 
        newNotes
      );

      expect(updatedLead.status).toEqual('proposal_sent');
      expect(updatedLead.notes).toEqual(newNotes);
      expect(updatedLead.id).toEqual(originalLead.id);
    });

    it('should persist changes to database', async () => {
      const originalLead = await createFleetLead(testFleetLeadInput);

      await updateFleetLeadStatus(originalLead.id, 'trial_active', 'Started 7-day trial');

      // Query database directly to verify persistence
      const leads = await db.select()
        .from(fleetLeadsTable)
        .where(eq(fleetLeadsTable.id, originalLead.id))
        .execute();

      expect(leads).toHaveLength(1);
      expect(leads[0].status).toEqual('trial_active');
      expect(leads[0].notes).toEqual('Started 7-day trial');
    });

    it('should handle all valid status transitions', async () => {
      const originalLead = await createFleetLead(testFleetLeadInput);
      const statuses: Array<'new' | 'contacted' | 'proposal_sent' | 'trial_active' | 'converted' | 'lost'> = 
        ['contacted', 'proposal_sent', 'trial_active', 'converted', 'lost'];

      for (const status of statuses) {
        const updatedLead = await updateFleetLeadStatus(originalLead.id, status);
        expect(updatedLead.status).toEqual(status);
      }
    });

    it('should throw error for non-existent fleet lead', async () => {
      const nonExistentId = 99999;

      expect(updateFleetLeadStatus(nonExistentId, 'contacted')).rejects.toThrow(/Fleet lead with id 99999 not found/i);
    });
  });

  describe('generateFleetLOI', () => {
    it('should generate LOI filename for existing fleet lead', async () => {
      const lead = await createFleetLead(testFleetLeadInput);

      const filename = await generateFleetLOI(lead.id);

      // Verify filename structure
      expect(filename).toMatch(/^loi_\d+_[a-z_]+_\d+\.pdf$/);
      expect(filename).toContain(`loi_${lead.id}_`);
      expect(filename).toContain('abc_transport_llc');
      expect(filename.endsWith('.pdf')).toBe(true);
    });

    it('should handle company names with special characters', async () => {
      const specialNameLead = await createFleetLead({
        company_name: 'Al-Rashid & Sons Co.!',
        contact_person: 'Ahmad Al-Rashid',
        phone: '+967777123456',
        status: 'new'
      });

      const filename = await generateFleetLOI(specialNameLead.id);

      // Verify special characters are handled properly (converted to underscores)
      expect(filename).toContain('al_rashid_sons_co');
      expect(filename).not.toContain('&');
      expect(filename).not.toContain('!');
      expect(filename).not.toContain(' ');
    });

    it('should generate unique filenames for same lead', async () => {
      const lead = await createFleetLead(testFleetLeadInput);

      const filename1 = await generateFleetLOI(lead.id);
      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      const filename2 = await generateFleetLOI(lead.id);

      expect(filename1).not.toEqual(filename2);
      expect(filename1).toContain(`loi_${lead.id}_`);
      expect(filename2).toContain(`loi_${lead.id}_`);
    });

    it('should throw error for non-existent fleet lead', async () => {
      const nonExistentId = 99999;

      expect(generateFleetLOI(nonExistentId)).rejects.toThrow(/Fleet lead with id 99999 not found/i);
    });

    it('should handle long company names', async () => {
      const longNameLead = await createFleetLead({
        company_name: 'Very Long Company Name With Many Words That Should Be Truncated Properly',
        contact_person: 'Test Person',
        phone: '+967777123456',
        status: 'new'
      });

      const filename = await generateFleetLOI(longNameLead.id);

      // Verify filename is generated successfully with long names
      expect(filename).toMatch(/^loi_\d+_[a-z_]+_\d+\.pdf$/);
      expect(filename).toContain(`loi_${longNameLead.id}_`);
    });
  });

  describe('error handling', () => {
    it('should handle database connection issues gracefully in createFleetLead', async () => {
      // This test would require mocking database failure, but since we don't use mocks,
      // we'll test with invalid data that might cause constraint violations
      const invalidInput = {
        ...testFleetLeadInput,
        phone: 'x'.repeat(25) // Exceeds varchar(20) limit
      };

      expect(createFleetLead(invalidInput)).rejects.toThrow();
    });

    it('should handle empty results gracefully in getFleetLeads', async () => {
      // Even with no data, should return empty array, not throw
      const result = await getFleetLeads();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });
});