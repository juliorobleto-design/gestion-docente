import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fbncwutobgbkparudssw.supabase.co';
const supabaseAnonKey = 'sb_publishable_E81DHILIJ0qNYJUsjq1YAA_BXsPEqLA';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: students, error: sErr } = await supabase
    .from("students")
    .select("id, name, group_id")
    .limit(5);

  if (sErr) {
    console.error(sErr);
    return;
  }

  const { data: scores, error: gErr } = await supabase
    .from("daily_work_scores")
    .select("*")
    .limit(10);

  console.log("STUDENTS:", students);
  console.log("SCORES:", scores);
}

run();
