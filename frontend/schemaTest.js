import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load variables from gestion-docente env
dotenv.config({ path: 'c:/Proyectos/gestion-docente/frontend/.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  // Let's deliberately insert a dummy to trigger an error, or just do a generic query 
  // with a weird column to see the full list of valid columns if PostgREST returns it.
  const { data, error } = await supabase.from('daily_work_scores').select('*').limit(1);
  console.log("DATA:", data);
  console.log("ERROR:", error);

  // Intentional failure to get column definitions
  const { error: insertErr } = await supabase.from('daily_work_scores').insert({ non_existent_column: "1" });
  console.log("INSERT SCHEMA ERROR:", insertErr);
}

checkSchema();
