export interface WhatsAppMessage {
    to: string;
    template: string;
    variables: Record<string, string>;
}

export interface WhatsAppResponse {
    message_id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
}

export async function sendWhatsAppMessage(message: WhatsAppMessage): Promise<WhatsAppResponse> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is sending WhatsApp messages via Business API:
    // 1. Format message using template and variables
    // 2. Send via Meta/Twilio WhatsApp Business API
    // 3. Store message record for tracking
    // 4. Return message ID for status tracking
    
    return Promise.resolve({
        message_id: `wam_${Date.now()}`,
        status: 'sent'
    });
}

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
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is sending booking confirmation message
    // with all required details and self-service links.
    
    return sendWhatsAppMessage({
        to: phone,
        template: 'booking_confirmation',
        variables: {
            ...bookingDetails,
            price: bookingDetails.price.toString()
        }
    });
}

export async function sendStatusUpdate(
    phone: string,
    status: 'on_the_way' | 'started' | 'finished',
    details?: { eta?: number; stars_link?: string; comment_link?: string }
): Promise<WhatsAppResponse> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is sending booking status updates
    // including "on the way" with ETA and review requests after completion.
    
    const variables: Record<string, string> = {};
    if (details) {
        if (details.eta !== undefined) variables['eta'] = details.eta.toString();
        if (details.stars_link) variables['stars_link'] = details.stars_link;
        if (details.comment_link) variables['comment_link'] = details.comment_link;
    }
    
    return sendWhatsAppMessage({
        to: phone,
        template: `booking_${status}`,
        variables
    });
}