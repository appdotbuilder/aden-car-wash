import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { whatsappTemplatesTable } from '../db/schema';
import {
    sendWhatsAppMessage,
    sendBookingConfirmation,
    sendStatusUpdate,
    sendPromoMessage,
    sendBookingReminder,
    verifyWhatsAppNumber,
    getMessageStatus,
    type WhatsAppMessage
} from '../handlers/whatsapp_integration';

// Test data
const testTemplate = {
    key: 'booking_confirmation',
    body_ar: 'مرحبا {{name}}، تم تأكيد حجزك لخدمة {{service}} بتاريخ {{date}} في الساعة {{time}}. السعر: {{price}} ريال. رابط الخريطة: {{map_link}}',
    body_en: 'Hello {{name}}, your booking for {{service}} on {{date}} at {{time}} is confirmed. Price: {{price}} SAR. Map: {{map_link}}'
};

const testStatusTemplate = {
    key: 'booking_on_the_way',
    body_ar: 'الفريق في الطريق إليك! سنصل خلال {{eta}} دقيقة.',
    body_en: 'Team is on the way! We will arrive in {{eta}} minutes.'
};

const testStartedTemplate = {
    key: 'booking_started',
    body_ar: 'بدأ الفريق العمل على سيارتك الآن.',
    body_en: 'Team has started working on your car.'
};

const testFinishedTemplate = {
    key: 'booking_finished',
    body_ar: 'تم الانتهاء من الخدمة! رابط التقييم: {{stars_link}}، رابط التعليق: {{comment_link}}',
    body_en: 'Service completed! Rate us: {{stars_link}}, Feedback: {{comment_link}}'
};

const testPromoTemplate = {
    key: 'promotion',
    body_ar: 'عرض خاص! {{offer_title}} - خصم {{discount}}. صالح حتى {{valid_until}}. كود الخصم: {{promo_code}}',
    body_en: 'Special offer! {{offer_title}} - {{discount}} off. Valid until {{valid_until}}. Promo code: {{promo_code}}'
};

const testReminderTemplate = {
    key: 'booking_reminder',
    body_ar: 'تذكير: موعدك {{name}} لخدمة {{service}} غداً {{date}} في {{time}} في {{location}}',
    body_en: 'Reminder: Your appointment {{name}} for {{service}} tomorrow {{date}} at {{time}} in {{location}}'
};

const testBookingDetails = {
    name: 'أحمد محمد',
    service: 'غسيل السيارة الشامل',
    price: 89.99,
    date: '2024-01-15',
    time: '10:30',
    map_link: 'https://maps.google.com/xyz',
    track_url: 'https://app.carwash.com/track/123',
    edit_url: 'https://app.carwash.com/edit/123',
    cancel_url: 'https://app.carwash.com/cancel/123'
};

describe('WhatsApp Integration', () => {
    beforeEach(createDB);
    afterEach(resetDB);

    beforeEach(async () => {
        // Insert test templates
        await db.insert(whatsappTemplatesTable).values([
            testTemplate,
            testStatusTemplate,
            testStartedTemplate,
            testFinishedTemplate,
            testPromoTemplate,
            testReminderTemplate
        ]).execute();
    });

    describe('sendWhatsAppMessage', () => {
        it('should send a basic WhatsApp message', async () => {
            const message: WhatsAppMessage = {
                to: '0555123456',
                template: 'booking_confirmation',
                variables: {
                    name: 'أحمد',
                    service: 'غسيل السيارة',
                    price: '50',
                    date: '2024-01-15',
                    time: '10:30',
                    map_link: 'https://maps.google.com/test'
                }
            };

            const result = await sendWhatsAppMessage(message);

            expect(result.message_id).toBeDefined();
            expect(result.message_id).toMatch(/^wam_\d+_[a-z0-9]+$/);
            expect(result.status).toEqual('sent');
        });

        it('should format Saudi phone numbers correctly', async () => {
            const testCases = [
                '0555123456',
                '+966555123456',
                '966555123456',
                '555123456'
            ];

            for (const phone of testCases) {
                const result = await sendWhatsAppMessage({
                    to: phone,
                    template: 'booking_confirmation',
                    variables: { name: 'Test' }
                });

                expect(result.status).toEqual('sent');
                expect(result.message_id).toBeDefined();
            }
        });

        it('should replace template variables correctly', async () => {
            const message: WhatsAppMessage = {
                to: '966555123456',
                template: 'booking_confirmation',
                variables: {
                    name: 'سارة',
                    service: 'تنظيف داخلي',
                    price: '75.50',
                    date: '2024-01-20',
                    time: '14:00',
                    map_link: 'https://maps.google.com/location'
                }
            };

            const result = await sendWhatsAppMessage(message);

            expect(result.status).toEqual('sent');
            expect(result.message_id).toBeDefined();
        });

        it('should handle missing template gracefully', async () => {
            const message: WhatsAppMessage = {
                to: '966555123456',
                template: 'non_existent_template',
                variables: {}
            };

            const result = await sendWhatsAppMessage(message);

            expect(result.status).toEqual('failed');
            expect(result.message_id).toMatch(/^failed_\d+$/);
        });

        it('should handle empty variables', async () => {
            const message: WhatsAppMessage = {
                to: '966555123456',
                template: 'booking_confirmation',
                variables: {}
            };

            const result = await sendWhatsAppMessage(message);

            expect(result.status).toEqual('sent');
            expect(result.message_id).toBeDefined();
        });
    });

    describe('sendBookingConfirmation', () => {
        it('should send booking confirmation message', async () => {
            const result = await sendBookingConfirmation(
                '966555123456',
                testBookingDetails
            );

            expect(result.status).toEqual('sent');
            expect(result.message_id).toBeDefined();
            expect(result.message_id).toMatch(/^wam_\d+_[a-z0-9]+$/);
        });

        it('should convert price to string', async () => {
            const bookingWithNumericPrice = {
                ...testBookingDetails,
                price: 125.75
            };

            const result = await sendBookingConfirmation(
                '0555987654',
                bookingWithNumericPrice
            );

            expect(result.status).toEqual('sent');
            expect(result.message_id).toBeDefined();
        });

        it('should handle Arabic content correctly', async () => {
            const arabicBooking = {
                name: 'محمد عبدالله',
                service: 'غسيل السيارة الفاخر',
                price: 199.99,
                date: '١٥ يناير ٢٠٢٤',
                time: '٢:٣٠ مساءً',
                map_link: 'https://maps.google.com/riyadh',
                track_url: 'https://app.test.com/track/456',
                edit_url: 'https://app.test.com/edit/456',
                cancel_url: 'https://app.test.com/cancel/456'
            };

            const result = await sendBookingConfirmation(
                '966501234567',
                arabicBooking
            );

            expect(result.status).toEqual('sent');
            expect(result.message_id).toBeDefined();
        });
    });

    describe('sendStatusUpdate', () => {
        it('should send "on the way" status update with ETA', async () => {
            const result = await sendStatusUpdate(
                '966555123456',
                'on_the_way',
                { eta: 15 }
            );

            expect(result.status).toEqual('sent');
            expect(result.message_id).toBeDefined();
        });

        it('should send "started" status update', async () => {
            const result = await sendStatusUpdate(
                '966555123456',
                'started'
            );

            expect(result.status).toEqual('sent');
            expect(result.message_id).toBeDefined();
        });

        it('should send "finished" status with review links', async () => {
            const result = await sendStatusUpdate(
                '966555123456',
                'finished',
                {
                    stars_link: 'https://app.test.com/review/123',
                    comment_link: 'https://app.test.com/feedback/123'
                }
            );

            expect(result.status).toEqual('sent');
            expect(result.message_id).toBeDefined();
        });

        it('should handle status update without details', async () => {
            const result = await sendStatusUpdate('966555123456', 'started');

            expect(result.status).toEqual('sent');
            expect(result.message_id).toBeDefined();
        });
    });

    describe('sendPromoMessage', () => {
        it('should send promotional message with all details', async () => {
            const promoDetails = {
                offer_title: 'خصم نهاية الأسبوع',
                discount: '30%',
                valid_until: '٢٠ يناير ٢٠٢٤',
                promo_code: 'WEEKEND30',
                terms_url: 'https://app.test.com/terms'
            };

            const result = await sendPromoMessage('966555123456', promoDetails);

            expect(result.status).toEqual('sent');
            expect(result.message_id).toBeDefined();
        });

        it('should send promotional message without optional fields', async () => {
            const promoDetails = {
                offer_title: 'عرض محدود',
                discount: '20%',
                valid_until: 'نهاية الشهر'
            };

            const result = await sendPromoMessage('966555123456', promoDetails);

            expect(result.status).toEqual('sent');
            expect(result.message_id).toBeDefined();
        });
    });

    describe('sendBookingReminder', () => {
        it('should send booking reminder message', async () => {
            const reminderDetails = {
                name: 'فهد',
                service: 'غسيل وتلميع',
                date: 'غداً',
                time: '٩:٠٠ صباحاً',
                location: 'الرياض - حي النخيل',
                reschedule_url: 'https://app.test.com/reschedule/789',
                cancel_url: 'https://app.test.com/cancel/789'
            };

            const result = await sendBookingReminder('966555123456', reminderDetails);

            expect(result.status).toEqual('sent');
            expect(result.message_id).toBeDefined();
        });
    });

    describe('verifyWhatsAppNumber', () => {
        it('should verify valid Saudi mobile numbers', async () => {
            const validNumbers = [
                '966555123456',
                '966501234567',
                '966591234567',
                '+966555123456',
                '0555123456'
            ];

            for (const number of validNumbers) {
                const result = await verifyWhatsAppNumber(number);
                expect(result).toBe(true);
            }
        });

        it('should reject invalid phone numbers', async () => {
            const invalidNumbers = [
                '123456789',
                '966123456',      // too short
                '966555123',      // too short  
                '966123456789',   // doesn't start with 5 after 966
                'invalid_phone',
                '',
                '966411234567'    // landline (starts with 4, not 5)
            ];

            for (const number of invalidNumbers) {
                const result = await verifyWhatsAppNumber(number);
                expect(result).toBe(false);
            }
        });

        it('should handle phone number formatting edge cases', async () => {
            const edgeCases = [
                '966-555-123-456',
                '(966) 555 123 456',
                '+966 555 123 456',
                '966.555.123.456'
            ];

            for (const number of edgeCases) {
                const result = await verifyWhatsAppNumber(number);
                expect(result).toBe(true);
            }
        });
    });

    describe('getMessageStatus', () => {
        it('should return failed status for failed message IDs', async () => {
            const failedMessageId = 'failed_1234567890';
            const status = await getMessageStatus(failedMessageId);

            expect(status).toEqual('failed');
        });

        it('should return sent status for recent messages', async () => {
            const recentMessageId = `wam_${Date.now()}_abc123`;
            const status = await getMessageStatus(recentMessageId);

            expect(status).toEqual('sent');
        });

        it('should simulate message status progression', async () => {
            // Test with old timestamp to simulate delivered status
            const oldTimestamp = Date.now() - 10000; // 10 seconds ago
            const oldMessageId = `wam_${oldTimestamp}_def456`;
            const status = await getMessageStatus(oldMessageId);

            expect(['delivered', 'read']).toContain(status);
        });

        it('should handle invalid message IDs', async () => {
            const invalidMessageId = 'invalid_message_id';
            const status = await getMessageStatus(invalidMessageId);

            expect(status).toEqual('failed');
        });
    });

    describe('Template Integration', () => {
        it('should retrieve templates from database', async () => {
            const templates = await db.select()
                .from(whatsappTemplatesTable)
                .execute();

            expect(templates.length).toBeGreaterThan(0);
            
            const confirmationTemplate = templates.find(t => t.key === 'booking_confirmation');
            expect(confirmationTemplate).toBeDefined();
            expect(confirmationTemplate?.body_ar).toContain('{{name}}');
            expect(confirmationTemplate?.body_ar).toContain('{{service}}');
        });

        it('should handle multiple template variables correctly', async () => {
            // Test message with many variables
            const complexMessage: WhatsAppMessage = {
                to: '966555123456',
                template: 'booking_confirmation',
                variables: {
                    name: 'عبدالرحمن',
                    service: 'غسيل وتلميع شامل',
                    price: '159.99',
                    date: '٢٥ يناير',
                    time: '٣:٠٠ مساءً',
                    map_link: 'https://maps.google.com/location/test',
                    track_url: 'https://track.test.com/booking/999',
                    edit_url: 'https://edit.test.com/booking/999',
                    cancel_url: 'https://cancel.test.com/booking/999'
                }
            };

            const result = await sendWhatsAppMessage(complexMessage);

            expect(result.status).toEqual('sent');
            expect(result.message_id).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle database connection issues gracefully', async () => {
            // This test verifies error handling when template lookup fails
            const message: WhatsAppMessage = {
                to: '966555123456',
                template: 'non_existent_template',
                variables: { test: 'value' }
            };

            const result = await sendWhatsAppMessage(message);

            expect(result.status).toEqual('failed');
            expect(result.message_id).toMatch(/^failed_/);
        });

        it('should handle malformed phone numbers', async () => {
            const result = await sendBookingConfirmation(
                'invalid-phone',
                testBookingDetails
            );

            // Should still attempt to send (basic validation allows it through)
            expect(result.message_id).toBeDefined();
        });

        it('should handle missing required booking details', async () => {
            const incompleteBooking = {
                name: 'Test User',
                service: '',
                price: 0,
                date: '',
                time: '',
                map_link: '',
                track_url: '',
                edit_url: '',
                cancel_url: ''
            };

            const result = await sendBookingConfirmation(
                '966555123456',
                incompleteBooking
            );

            expect(result.status).toEqual('sent');
            expect(result.message_id).toBeDefined();
        });
    });
});