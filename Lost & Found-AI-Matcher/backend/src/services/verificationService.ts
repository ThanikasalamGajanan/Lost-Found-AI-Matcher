import OpenAI from 'openai';
import { config } from '../config/index.js';
import { queryOne } from '../db/pool.js';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

/**
 * Generate a verification question from a found item's private details.
 * The question is designed so only the true owner would know the answer.
 */
export async function generateVerificationQuestion(
  matchId: string,
  privateDetails: Record<string, string>
): Promise<{ id: string; question_text: string }> {
  const fields = Object.entries(privateDetails);

  if (fields.length === 0) {
    throw new Error('No private details available for question generation');
  }

  // Pick a random field to base the question on
  const [fieldKey, correctAnswer] = fields[Math.floor(Math.random() * fields.length)];

  // Use LLM to generate a natural-sounding question
  const humanReadableField = fieldKey.replace(/_/g, ' ');

  let questionText = `What was the ${humanReadableField} of the item?`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You generate verification questions for a lost-and-found system.
The question should be answerable only by the true owner of the item.
Generate a clear, specific question about one detail of the item.
Return ONLY the question text, nothing else. No quotes, no JSON wrapper.`,
        },
        {
          role: 'user',
          content: `Generate a verification question about this item detail: "${humanReadableField}".
The question should ask the claimant to identify this specific attribute of their lost item.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    questionText = response.choices[0].message.content?.trim() || questionText;
  } catch (err) {
    console.warn('OpenAI question generation failed, using fallback question:', err);
  }

  // Store in database
  const result = await queryOne<{ id: string; question_text: string }>(
    `INSERT INTO verification_questions (match_id, question_text, correct_answer, field_source)
     VALUES ($1, $2, $3, $4)
     RETURNING id, question_text`,
    [matchId, questionText, correctAnswer, fieldKey]
  );

  if (!result) {
    throw new Error('Failed to create verification question');
  }

  return result;
}

/**
 * Check an answer against the correct answer (fuzzy comparison).
 * Uses LLM for semantic matching when exact match fails.
 */
export async function verifyAnswer(
  submittedAnswer: string,
  correctAnswer: string
): Promise<boolean> {
  // Quick exact match (case-insensitive, trimmed)
  if (submittedAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()) {
    return true;
  }

  // Use LLM for semantic comparison
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are judging whether a submitted answer matches the correct answer for a lost-and-found verification question.
Allow for minor variations in wording, spelling, or format.
For example: "dark blue" matches "navy blue", "iPhone 14" matches "iphone 14 pro".
Return ONLY "true" or "false".`,
        },
        {
          role: 'user',
          content: `Correct answer: "${correctAnswer}"\nSubmitted answer: "${submittedAnswer}"\n\nDo they refer to the same thing?`,
        },
      ],
      temperature: 0,
      max_tokens: 5,
    });

    const result = response.choices[0].message.content?.trim().toLowerCase();
    return result === 'true';
  } catch {
    // Fallback: contains check
    return submittedAnswer.toLowerCase().includes(correctAnswer.toLowerCase()) ||
           correctAnswer.toLowerCase().includes(submittedAnswer.toLowerCase());
  }
}
