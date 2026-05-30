import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); // Or wherever it is
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Use service role if available to bypass RLS, or anon key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials from .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching a user to test with...");
  const { data: users, error: userError } = await supabase.from('profiles').select('id').limit(1);
  if (userError || !users?.length) {
    console.error("Cannot find any user profiles to test:", userError);
    return;
  }
  const userId = users[0].id;
  console.log("Testing with user:", userId);

  const payload = {
    user_id: userId,
    audience: 'technical',
    depth: 'deep',
    pack_id: '00000000-0000-0000-0000-000000000002', // DEFAULT_PACK_ID
    updated_at: new Date().toISOString(),
    learning_style: 'visual',
    framework_familiarity: 'React',
    tone_preference: 'standard'
  };

  console.log("Upserting audience_preferences:", payload);
  const { data, error } = await supabase
    .from('audience_preferences')
    .upsert(payload, { onConflict: 'user_id' })
    .select();

  if (error) {
    console.error("UPSERT FAILED:", error);
  } else {
    console.log("UPSERT SUCCEEDED:", data);
  }
}

run();
