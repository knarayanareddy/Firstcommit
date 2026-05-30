import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const env = await load();
const supabaseUrl = env["VITE_SUPABASE_URL"] || env["SUPABASE_URL"] || "http://127.0.0.1:54321";
const supabaseKey = env["SUPABASE_SERVICE_ROLE_KEY"];

const supabase = createClient(supabaseUrl, supabaseKey);

const { data, error } = await supabase.from('knowledge_chunks').select('path').limit(30);
console.log("Data length:", data?.length);
console.log("Error:", error);
if (data && data.length > 0) {
  console.log("Paths:", data.map(d => d.path).slice(0, 10));
} else {
  console.log("No chunks found!");
}
