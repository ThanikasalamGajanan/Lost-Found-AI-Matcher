import { supabaseAdmin } from '../db/supabase.js';

async function createBucket(): Promise<void> {
  const { error: createError } = await supabaseAdmin.storage.createBucket('item-photos', {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024, // 5 MB
  });

  if (createError) {
    if (createError.message.includes('already exists') || createError.message.includes('Duplicate')) {
      console.log('Bucket "item-photos" already exists. Ensuring it is public...');
      const { error: updateError } = await supabaseAdmin.storage.updateBucket('item-photos', {
        public: true,
      });

      if (updateError) {
        throw new Error(`Failed to update bucket: ${updateError.message}`);
      }

      console.log('Bucket "item-photos" is now public.');
      return;
    }

    throw new Error(`Failed to create bucket: ${createError.message}`);
  }

  console.log('Created public bucket "item-photos".');
}

createBucket().catch((err) => {
  console.error('Bucket setup failed:', err);
  process.exit(1);
});
