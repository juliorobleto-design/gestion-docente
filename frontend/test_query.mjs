import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) env[k.trim()] = v.trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);

async function main() {
  // Try to find ANY records for a specific group of students. We don't have their IDs directly,
  // but we can just query ALL daily_work_scores to see the distribution of periods and student_ids.
  const { data, error } = await supabase
    .from('daily_work_scores')
    .select('student_id, period, score, matrix_cells');
    
  if (error) {
    console.error("Error querying daily_work_scores:", error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log("No data found! RLS might be blocking this since we are using anon_key.");
    return;
  }
  
  const periods = {};
  data.forEach(r => {
    periods[r.period] = (periods[r.period] || 0) + 1;
  });
  console.log("Distribution of periods in DB:", periods);
  
  const emptyMatrix = data.filter(r => !r.matrix_cells || Object.keys(r.matrix_cells).length === 0);
  console.log(`Rows with empty matrix_cells: ${emptyMatrix.length} out of ${data.length}`);
}
main();
