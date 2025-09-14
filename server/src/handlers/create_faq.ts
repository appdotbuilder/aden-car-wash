import { db } from '../db';
import { faqsTable } from '../db/schema';
import { type CreateFaqInput, type FAQ } from '../schema';

export const createFaq = async (input: CreateFaqInput): Promise<FAQ> => {
  try {
    // Insert FAQ record
    const result = await db.insert(faqsTable)
      .values({
        q_ar: input.q_ar,
        q_en: input.q_en,
        a_ar: input.a_ar,
        a_en: input.a_en,
        order: input.order,
        tags: input.tags,
        visible: input.visible
      })
      .returning()
      .execute();

    const faq = result[0];
    return faq;
  } catch (error) {
    console.error('FAQ creation failed:', error);
    throw error;
  }
};