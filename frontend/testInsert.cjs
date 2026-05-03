const fs = require('fs');

const envContent = fs.readFileSync('c:/Proyectos/gestion-docente/frontend/.env', 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const url = supabaseUrl + '/rest/v1/daily_work_scores?apikey=' + supabaseKey;

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    period: 'semester1',
    score: 10,
    total_points: 40,
    matrix_cells: {}
  })
})
  .then(res => res.json().then(data => ({status: res.status, data})))
  .then(res => {
    console.log("INSERT RESULT:", JSON.stringify(res, null, 2));
  })
  .catch(console.error);
