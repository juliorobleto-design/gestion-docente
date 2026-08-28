import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config({ path: '.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function diagnose() {
  const { data: scores, error } = await supabase.from('daily_work_scores').select('student_id, period, score, total_points, matrix_cells, updated_at').eq('period', 'semester1').order('student_id').limit(20);
  if (error) { console.error('Error:', error); return; }
  console.log('=== ' + scores.length + ' registros semester1 ===');
  for (const row of scores) {
    const cells = row.matrix_cells || {};
    const keys = typeof cells === 'object' ? Object.keys(cells) : [];
    const values = keys.map(k => { const v = cells[k]; return k + '=' + (typeof v === 'object' && v !== null ? v.value : v); }).join(', ');
    console.log('Student ' + row.student_id + ' | score=' + row.score + ' | total=' + row.total_points + ' | updated=' + row.updated_at);
    console.log('  Keys(' + keys.length + '): ' + (keys.join(', ') || '(vacio)'));
    console.log('  Values: ' + (values || '(sin datos)'));
  }
  const { data: configs } = await supabase.from('cotidiano_columns_config').select('group_id, period, columns_data').eq('period', 'semester1');
  console.log('\n=== CONFIGURACION COLUMNAS semester1 ===');
  for (const cfg of (configs || [])) {
    const cols = cfg.columns_data || [];
    console.log('Group ' + cfg.group_id + ':');
    cols.forEach((c, i) => console.log('  [' + i + '] id=' + c.id + ' name=' + c.name));
  }
}
diagnose();
