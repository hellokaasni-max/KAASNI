// src/utils/storage.js
// Supabase Storage helper for product and banner images.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;

// Support the current Supabase secret-key environment variable.
// Keep the old variable as a fallback during the transition.
const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const BUCKET =
  process.env.SUPABASE_PRODUCT_BUCKET || 'product-images';

if (!SUPABASE_URL) {
  throw new Error('SUPABASE_URL is not configured in .env');
}

if (!SUPABASE_SECRET_KEY) {
  throw new Error(
    'SUPABASE_SECRET_KEY is not configured in .env'
  );
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

function publicUrl(storagePath) {
  const {
    data: { publicUrl },
  } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  return publicUrl;
}

async function uploadBuffer(buffer, storagePath, contentType) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  return {
    storagePath,
    publicUrl: publicUrl(storagePath),
  };
}

async function deleteFile(storagePath) {
  if (!storagePath) return;

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath]);

  if (error) {
    throw new Error(`Supabase delete failed: ${error.message}`);
  }
}

module.exports = {
  BUCKET,
  uploadBuffer,
  deleteFile,
  publicUrl,
};
