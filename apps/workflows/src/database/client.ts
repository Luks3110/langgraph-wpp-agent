import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Database } from "../types/supabase.js";

const supabaseUrl = process.env.SUPABASE_URL;
console.log("🚀 ~ supabaseUrl:", supabaseUrl);

// Use service role key for system operations, fallback to anon key for backward compatibility
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
console.log(
  "🚀 ~ using key type:",
  process.env.SUPABASE_SERVICE_ROLE_KEY ? "service_role" : "anon"
);

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) environment variables."
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    headers: {
      "X-Client-Info": "workflow-engine@1.0.0"
    }
  }
});

// Test connection on startup
export async function testConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from("workflows").select("count").limit(1);
    if (error) {
      console.error("Supabase connection test failed:", error.message);
      return false;
    }
    console.log("✅ Supabase connection successful");
    return true;
  } catch (error) {
    console.error("Supabase connection test error:", error);
    return false;
  }
}
