import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Database } from "../types/supabase.js";

const supabaseUrl = process.env.SUPABASE_URL;
console.log("🚀 ~ supabaseUrl:", supabaseUrl);
const supabaseKey = process.env.SUPABASE_ANON_KEY;
console.log("🚀 ~ supabaseKey:", supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables."
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
