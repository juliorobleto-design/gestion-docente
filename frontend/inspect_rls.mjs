import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rjtvzhsqmvctvscfivnk.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqdHZ6aHNxbXZjdHZzY2Zpdm5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMyNDUyNDcsImV4cCI6MjA1ODgyMTI0N30.8Y_pWwN4G6Uj_0G3_0G3_0G3_0G3_0G3_0G3_0G3_0G3"; // Anon key from previous logs
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectPolicies() {
  console.log("--- INSPECCIÓN DE POLÍTICAS RLS ---");
  
  // Note: We cannot easily list policies via standard anon client RPC unless there's a custom function.
  // But we can check if RLS is effectively blocking us or if we have access.
  
  const tables = ["groups", "students", "attendance_lessons", "anecdotal_records", "schedules"];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select("*").limit(1);
    if (error) {
      console.log(`[RLS ACTIVE?] ${table}: ${error.message}`);
    } else {
      console.log(`[PREMISSIVE?] ${table}: Acceso público permitido (${data.length} registros visibles)`);
    }
  }
}

inspectPolicies();
