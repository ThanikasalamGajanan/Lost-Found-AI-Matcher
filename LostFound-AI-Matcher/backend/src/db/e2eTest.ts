import { pool, queryOne } from './pool.js';
import { supabaseAdmin } from './supabase.js';
import { runMatchingEngine } from '../services/matchingEngine.js';
import { generateVerificationQuestion } from '../services/verificationService.js';
import { generateEmbedding } from '../services/llmService.js';

const TEST_EMAIL = 'admin@test.com';
const TEST_PASSWORD = 'TestPassword123!';

function logStep(step: number, message: string): void {
  console.log(`\n[${step}] ${message}`);
  console.log('-'.repeat(60));
}

function formatVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

async function mirrorAuthUserLocally(userId: string, email: string, fullName: string): Promise<void> {
  // When running against local Postgres, Supabase Auth lives in the cloud so the
  // auth.users row referenced by public.users(id) does not exist locally. Mirror
  // the cloud user into the local auth schema so the FK trigger can fire.
  await pool.query(
    `INSERT INTO auth.users (id, email, raw_user_meta_data)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email,
           raw_user_meta_data = EXCLUDED.raw_user_meta_data`,
    [userId, email, JSON.stringify({ full_name: fullName })]
  );
}

async function findAuthUserByEmail(email: string): Promise<{ id: string; user_metadata?: Record<string, unknown> } | undefined> {
  let page = 1;
  const perPage = 100;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`);
    }
    if (!data.users.length) {
      return undefined;
    }
    const found = data.users.find((u) => u.email === email);
    if (found) {
      return { id: found.id, user_metadata: found.user_metadata as Record<string, unknown> };
    }
    if (data.users.length < perPage) {
      return undefined;
    }
    page++;
  }
}

async function ensureTestUser(email: string): Promise<string> {
  let existingUser = await findAuthUserByEmail(email);

  let userId: string;
  let fullName = 'E2E Test User';
  if (existingUser) {
    userId = existingUser.id;
    fullName = (existingUser.user_metadata?.full_name as string | undefined) ?? fullName;
    console.log(`Using existing auth user: ${email} (${userId})`);
  } else {
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    // If a race or previous run left the user in auth but not in public.users,
    // listUsers may have missed it; look again before giving up.
    if (createError?.message?.includes('already been registered')) {
      existingUser = await findAuthUserByEmail(email);
      if (!existingUser) {
        throw new Error(`Failed to create auth user: ${createError.message}`);
      }
      userId = existingUser.id;
      fullName = (existingUser.user_metadata?.full_name as string | undefined) ?? fullName;
      console.log(`Found existing auth user after create conflict: ${email} (${userId})`);
    } else if (createError || !createData.user) {
      throw new Error(`Failed to create auth user: ${createError?.message ?? 'unknown error'}`);
    } else {
      userId = createData.user.id;
      console.log(`Created auth user: ${email} (${userId})`);
    }
  }

  await mirrorAuthUserLocally(userId, email, fullName);

  await pool.query(
    `INSERT INTO users (id, email, full_name, role)
     VALUES ($1, $2, 'E2E Test User', 'admin')
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       full_name = EXCLUDED.full_name,
       role = EXCLUDED.role`,
    [userId, email]
  );

  return userId;
}

async function createSecondUser(): Promise<string> {
  const email = 'finder@test.com';
  let existingUser = await findAuthUserByEmail(email);

  let userId: string;
  let fullName = 'E2E Finder User';
  if (existingUser) {
    userId = existingUser.id;
    fullName = (existingUser.user_metadata?.full_name as string | undefined) ?? fullName;
    console.log(`Using existing finder auth user: ${email} (${userId})`);
  } else {
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError?.message?.includes('already been registered')) {
      existingUser = await findAuthUserByEmail(email);
      if (!existingUser) {
        throw new Error(`Failed to create finder user: ${createError.message}`);
      }
      userId = existingUser.id;
      fullName = (existingUser.user_metadata?.full_name as string | undefined) ?? fullName;
      console.log(`Found existing finder auth user after create conflict: ${email} (${userId})`);
    } else if (createError || !createData.user) {
      throw new Error(`Failed to create finder user: ${createError?.message ?? 'unknown error'}`);
    } else {
      userId = createData.user.id;
      console.log(`Created finder auth user: ${email} (${userId})`);
    }
  }

  await mirrorAuthUserLocally(userId, email, fullName);

  await pool.query(
    `INSERT INTO users (id, email, full_name, role)
     VALUES ($1, $2, 'E2E Finder User', 'user')
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       full_name = EXCLUDED.full_name,
       role = EXCLUDED.role`,
    [userId, email]
  );

  return userId;
}

async function insertLostItem(userId: string): Promise<string> {
  const description = 'Silver Toyota car keys with a small leather keychain and a gym membership tag';
  let embedding: number[] | null = null;

  try {
    embedding = await generateEmbedding(description);
    console.log('Generated OpenAI embedding for lost item.');
  } catch (err) {
    console.warn(`Embedding generation failed: ${(err as Error).message}. Inserting without embedding.`);
  }

  const result = await queryOne<{ id: string }>(
    `INSERT INTO lost_items (
       user_id, category, brand, colour, description,
       location, latitude, longitude, lost_at, description_embedding
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ${embedding ? '$10::vector' : 'NULL'})
     RETURNING id`,
    embedding
      ? [userId, 'keys', 'Toyota', 'silver', description, 'Colombo Fort Railway Station', 6.9355, 79.8487, '2024-12-15T08:30:00Z', formatVector(embedding)]
      : [userId, 'keys', 'Toyota', 'silver', description, 'Colombo Fort Railway Station', 6.9355, 79.8487, '2024-12-15T08:30:00Z']
  );

  if (!result) {
    throw new Error('Failed to insert lost item');
  }

  return result.id;
}

async function insertFoundItem(userId: string): Promise<string> {
  const description = 'Found a set of car keys near the ticket counter. Has a leather keychain and some tags attached.';
  const privateDetails = { keychain_material: 'leather', gym_tag: 'yes', number_of_keys: '3' };
  let embedding: number[] | null = null;

  try {
    embedding = await generateEmbedding(description);
    console.log('Generated OpenAI embedding for found item.');
  } catch (err) {
    console.warn(`Embedding generation failed: ${(err as Error).message}. Inserting without embedding.`);
  }

  const result = await queryOne<{ id: string }>(
    `INSERT INTO found_items (
       user_id, category, brand, colour, description,
       location, latitude, longitude, found_at, private_details, description_embedding
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, ${embedding ? '$11::vector' : 'NULL'})
     RETURNING id`,
    embedding
      ? [userId, 'keys', 'Toyota', 'silver', description, 'Colombo Fort Railway Station', 6.9356, 79.8490, '2024-12-15T09:15:00Z', JSON.stringify(privateDetails), formatVector(embedding)]
      : [userId, 'keys', 'Toyota', 'silver', description, 'Colombo Fort Railway Station', 6.9356, 79.8490, '2024-12-15T09:15:00Z', JSON.stringify(privateDetails)]
  );

  if (!result) {
    throw new Error('Failed to insert found item');
  }

  return result.id;
}

async function generateOrCreateQuestion(
  matchId: string,
  privateDetails: Record<string, string>
): Promise<{ id: string; question_text: string; correct_answer: string; field_source: string }> {
  try {
    // generateVerificationQuestion randomly picks a field and stores the matching
    // correct_answer/field_source in the DB. Fetch the full row so the test data
    // stays consistent (don't force it to the first field).
    const { id } = await generateVerificationQuestion(matchId, privateDetails);
    const question = await queryOne<{ id: string; question_text: string; correct_answer: string; field_source: string }>(
      `SELECT id, question_text, correct_answer, field_source
       FROM verification_questions
       WHERE id = $1`,
      [id]
    );
    if (!question) {
      throw new Error('Failed to retrieve generated verification question');
    }
    return question;
  } catch (err) {
    console.warn(`OpenAI question generation failed: ${(err as Error).message}. Falling back to direct DB insert.`);
    const fields = Object.entries(privateDetails);
    const [fieldKey, correctAnswer] = fields[0];
    const result = await queryOne<{ id: string; question_text: string; correct_answer: string; field_source: string }>(
      `INSERT INTO verification_questions (match_id, question_text, correct_answer, field_source)
       VALUES ($1, $2, $3, $4)
       RETURNING id, question_text, correct_answer, field_source`,
      [matchId, `What was the ${fieldKey.replace(/_/g, ' ')} of the item?`, correctAnswer, fieldKey]
    );

    if (!result) {
      throw new Error('Failed to create verification question fallback');
    }

    return result;
  }
}

async function simulateJudgment(matchId: string, finderId: string, attemptId: string): Promise<void> {
  await pool.query(
    `UPDATE verification_attempts
     SET is_correct = true, judged_by = $1, judged_at = now()
     WHERE id = $2`,
    [finderId, attemptId]
  );

  await pool.query(`UPDATE matches SET status = 'approved' WHERE id = $1`, [matchId]);
  await pool.query(`UPDATE lost_items SET status = 'verified' WHERE id = (SELECT lost_item_id FROM matches WHERE id = $1)`, [matchId]);
  await pool.query(`UPDATE found_items SET status = 'verified' WHERE id = (SELECT found_item_id FROM matches WHERE id = $1)`, [matchId]);
}

async function cleanupTestData(lostId: string, foundId: string, matchId: string | null): Promise<void> {
  console.log('\n[Cleanup] Removing test data...');
  if (matchId) {
    await pool.query('DELETE FROM verification_attempts WHERE match_id = $1', [matchId]);
    await pool.query('DELETE FROM verification_questions WHERE match_id = $1', [matchId]);
    await pool.query('DELETE FROM matches WHERE id = $1', [matchId]);
  }
  await pool.query('DELETE FROM lost_items WHERE id = $1', [lostId]);
  await pool.query('DELETE FROM found_items WHERE id = $1', [foundId]);
  console.log('Test data cleaned up.');
}

async function runE2ETest(): Promise<void> {
  console.log('Starting end-to-end test flow...');

  let lostId: string | null = null;
  let foundId: string | null = null;
  let matchId: string | null = null;

  try {
    // Step 1: Ensure users exist
    logStep(1, 'Ensuring test users exist');
    const lostUserId = await ensureTestUser(TEST_EMAIL);
    const foundUserId = await createSecondUser();
    console.log(`Lost-item owner: ${lostUserId}`);
    console.log(`Found-item owner: ${foundUserId}`);

    // Step 2: Create lost item report via direct DB insert
    logStep(2, 'Creating lost item report via direct DB insert');
    lostId = await insertLostItem(lostUserId);
    console.log(`Created lost item: ${lostId}`);

    // Step 3: Create found item report via direct DB insert
    logStep(3, 'Creating found item report via direct DB insert');
    foundId = await insertFoundItem(foundUserId);
    console.log(`Created found item: ${foundId}`);

    // Step 4: Run the matching engine
    logStep(4, 'Running the matching engine on the lost item');
    const matches = await runMatchingEngine(lostId, 'lost');

    if (matches.length === 0) {
      console.log('No matches found. The test cannot continue without a match.');
      return;
    }

    const topMatch = matches[0];

    // The matching engine returns the full row; we need the actual match id from DB
    const matchRow = await queryOne<{ id: string }>(
      'SELECT id FROM matches WHERE lost_item_id = $1 AND found_item_id = $2',
      [lostId, foundId]
    );
    if (!matchRow) {
      throw new Error('Match row not found after running matching engine');
    }
    matchId = matchRow.id;

    // Step 5: Print match scores
    logStep(5, 'Match scores');
    console.log(`Total matches: ${matches.length}`);
    console.log(`Top match total score: ${topMatch.total_score}`);
    console.log(`  Description score: ${topMatch.desc_score}`);
    console.log(`  Image score:       ${topMatch.image_score}`);
    console.log(`  Location score:    ${topMatch.location_score}`);
    console.log(`  Time score:        ${topMatch.time_score}`);
    console.log(`  Attribute score:   ${topMatch.attr_score}`);

    // Step 6: Generate verification question
    logStep(6, 'Generating verification question');
    const privateDetails = { keychain_material: 'leather', gym_tag: 'yes', number_of_keys: '3' };
    const question = await generateOrCreateQuestion(matchId, privateDetails);
    console.log(`Question ID: ${question.id}`);
    console.log(`Question: ${question.question_text}`);
    console.log(`Correct answer: ${question.correct_answer}`);
    console.log(`Field source: ${question.field_source}`);

    // Step 7: Simulate correct answer judgment
    logStep(7, 'Simulating correct answer judgment');
    const attempt = await queryOne<{ id: string }>(
      `INSERT INTO verification_attempts (question_id, match_id, claimant_id, answer_text, attempt_number)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [question.id, matchId, lostUserId, question.correct_answer, 1]
    );

    if (!attempt) {
      throw new Error('Failed to create verification attempt');
    }

    console.log(`Created verification attempt: ${attempt.id}`);
    await simulateJudgment(matchId, foundUserId, attempt.id);
    console.log('Finder judged the answer as correct.');

    // Step 8: Verify match status changed to approved
    logStep(8, 'Verifying match status changed to "approved"');
    const updatedMatch = await queryOne<{ status: string }>(
      'SELECT status FROM matches WHERE id = $1',
      [matchId]
    );

    if (!updatedMatch) {
      throw new Error('Match not found after judgment');
    }

    console.log(`Match status: ${updatedMatch.status}`);

    if (updatedMatch.status === 'approved') {
      console.log('\n✅ E2E test passed: match approved successfully.');
    } else {
      console.log(`\n❌ E2E test failed: expected status "approved" but got "${updatedMatch.status}".`);
    }
  } catch (err) {
    console.error('\nE2E test failed:', err);
  } finally {
    // Cleanup
    if (lostId && foundId) {
      await cleanupTestData(lostId, foundId, matchId);
    }
    await pool.end();
  }
}

runE2ETest().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
