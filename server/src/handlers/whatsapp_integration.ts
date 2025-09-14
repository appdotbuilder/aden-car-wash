import { db } from '../db';
import { whatsappTemplatesTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface WhatsAppMessage {
    to: string;
    template: string;
    variables: Record<string, string>;
}

export interface WhatsAppResponse {
    message_id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
}

export interface WhatsAppTemplate {
    id: number;
    key: string;
    body_ar: string;
    body_en: string;
}

// Helper function to format phone number to WhatsApp format
function formatPhoneNumber(phone: string): string {
    // Remove any non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Add country code if not present (assuming Saudi Arabia +966)
    if (digits.length === 9 && digits.startsWith('5')) {
        return `966${digits}`;
    }
    if (digits.length === 10 && digits.startsWith('05')) {
        return `966${digits.substring(1)}`;
    }
    if (digits.length === 12 && digits.startsWith('966')) {
        return digits;
    }
    if (digits.length === 13 && digits.startsWith('9665')) {
        return digits.substring(1); // Remove leading 9
    }
    
    return digits;
}

// Helper function to replace template variables in message body
function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    
    // Replace variables in format {{variable_name}}
    Object.entries(variables).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        result = result.replace(new RegExp(placeholder, 'g'), value);
    });
    
    return result;
}

// Core function to send WhatsApp message via Business API
export async function sendWhatsAppMessage(message: WhatsAppMessage): Promise<WhatsAppResponse> {
    try {
        // Format phone number
        const formattedPhone = formatPhoneNumber(message.to);
        
        // Retrieve template from database
        const templates = await db.select()
            .from(whatsappTemplatesTable)
            .where(eq(whatsappTemplatesTable.key, message.template))
            .execute();
            
        if (templates.length === 0) {
            throw new Error(`WhatsApp template '${message.template}' not found`);
        }
        
        const template = templates[0];
        
        // For now, use Arabic template (could be made configurable)
        const messageBody = replaceTemplateVariables(template.body_ar, message.variables);
        
        // In a real implementation, this would make an HTTP request to:
        // - Meta WhatsApp Business API (https://developers.facebook.com/docs/whatsapp/cloud-api)
        // - Twilio WhatsApp API (https://www.twilio.com/docs/whatsapp/api)
        // - Or another WhatsApp Business provider
        
        // Simulate API call delay and response
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Generate unique message ID
        const messageId = `wam_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        
        // Log the message for debugging (in production, this should be stored in a messages table)
        console.log(`WhatsApp message sent:`, {
            to: formattedPhone,
            template: message.template,
            body: messageBody,
            message_id: messageId
        });
        
        return {
            message_id: messageId,
            status: 'sent'
        };
        
    } catch (error) {
        console.error('WhatsApp message failed:', error);
        
        return {
            message_id: `failed_${Date.now()}`,
            status: 'failed'
        };
    }
}

// Send booking confirmation with all required details
export async function sendBookingConfirmation(
    phone: string,
    bookingDetails: {
        name: string;
        service: string;
        price: number;
        date: string;
        time: string;
        map_link: string;
        track_url: string;
        edit_url: string;
        cancel_url: string;
    }
): Promise<WhatsAppResponse> {
    try {
        return await sendWhatsAppMessage({
            to: phone,
            template: 'booking_confirmation',
            variables: {
                name: bookingDetails.name,
                service: bookingDetails.service,
                price: bookingDetails.price.toString(),
                date: bookingDetails.date,
                time: bookingDetails.time,
                map_link: bookingDetails.map_link,
                track_url: bookingDetails.track_url,
                edit_url: bookingDetails.edit_url,
                cancel_url: bookingDetails.cancel_url
            }
        });
    } catch (error) {
        console.error('Booking confirmation failed:', error);
        throw error;
    }
}

// Send status updates for booking progress
export async function sendStatusUpdate(
    phone: string,
    status: 'on_the_way' | 'started' | 'finished',
    details?: { eta?: number; stars_link?: string; comment_link?: string }
): Promise<WhatsAppResponse> {
    try {
        const variables: Record<string, string> = {};
        
        if (details) {
            if (details.eta !== undefined) {
                variables['eta'] = details.eta.toString();
            }
            if (details.stars_link) {
                variables['stars_link'] = details.stars_link;
            }
            if (details.comment_link) {
                variables['comment_link'] = details.comment_link;
            }
        }
        
        return await sendWhatsAppMessage({
            to: phone,
            template: `booking_${status}`,
            variables
        });
    } catch (error) {
        console.error(`Status update ${status} failed:`, error);
        throw error;
    }
}

// Send promotional or marketing messages
export async function sendPromoMessage(
    phone: string,
    promoDetails: {
        offer_title: string;
        discount: string;
        valid_until: string;
        promo_code?: string;
        terms_url?: string;
    }
): Promise<WhatsAppResponse> {
    try {
        const variables: Record<string, string> = {
            offer_title: promoDetails.offer_title,
            discount: promoDetails.discount,
            valid_until: promoDetails.valid_until
        };
        
        if (promoDetails.promo_code) {
            variables['promo_code'] = promoDetails.promo_code;
        }
        if (promoDetails.terms_url) {
            variables['terms_url'] = promoDetails.terms_url;
        }
        
        return await sendWhatsAppMessage({
            to: phone,
            template: 'promotion',
            variables
        });
    } catch (error) {
        console.error('Promo message failed:', error);
        throw error;
    }
}

// Send reminder messages for upcoming bookings
export async function sendBookingReminder(
    phone: string,
    reminderDetails: {
        name: string;
        service: string;
        date: string;
        time: string;
        location: string;
        reschedule_url: string;
        cancel_url: string;
    }
): Promise<WhatsAppResponse> {
    try {
        return await sendWhatsAppMessage({
            to: phone,
            template: 'booking_reminder',
            variables: {
                name: reminderDetails.name,
                service: reminderDetails.service,
                date: reminderDetails.date,
                time: reminderDetails.time,
                location: reminderDetails.location,
                reschedule_url: reminderDetails.reschedule_url,
                cancel_url: reminderDetails.cancel_url
            }
        });
    } catch (error) {
        console.error('Booking reminder failed:', error);
        throw error;
    }
}

// Verify WhatsApp number is valid and active
export async function verifyWhatsAppNumber(phone: string): Promise<boolean> {
    try {
        const formattedPhone = formatPhoneNumber(phone);
        
        // In a real implementation, this would check with WhatsApp Business API
        // to verify if the number is registered for WhatsApp
        
        // Simulate verification delay
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Basic validation: Saudi mobile numbers should be 12 digits starting with 966
        // and the next digit should be 5 (Saudi mobile numbers start with 05)
        const isValidFormat = formattedPhone.length === 12 && 
                             formattedPhone.startsWith('966') && 
                             formattedPhone.charAt(3) === '5';
        
        console.log(`WhatsApp verification for ${formattedPhone}: ${isValidFormat}`);
        
        return isValidFormat;
        
    } catch (error) {
        console.error('WhatsApp verification failed:', error);
        return false;
    }
}

// Get message delivery status
export async function getMessageStatus(messageId: string): Promise<WhatsAppResponse['status']> {
    try {
        // In a real implementation, this would query the WhatsApp Business API
        // or check a messages tracking table in the database
        
        // Simulate status check
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // For failed messages, return failed status
        if (messageId.startsWith('failed_')) {
            return 'failed';
        }
        
        // Validate message ID format
        if (!messageId.startsWith('wam_') || messageId.split('_').length < 2) {
            return 'failed';
        }
        
        // Simulate message progression
        const timestampStr = messageId.split('_')[1];
        const timestamp = parseInt(timestampStr);
        
        if (isNaN(timestamp)) {
            return 'failed';
        }
        
        const age = Date.now() - timestamp;
        
        if (age < 5000) return 'sent';
        if (age < 15000) return 'delivered';
        return 'read';
        
    } catch (error) {
        console.error('Status check failed:', error);
        return 'failed';
    }
}