const fs = require('fs');

const envContent = fs.readFileSync('c:/Proyectos/gestion-docente/frontend/.env', 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const cfgUrl = supabaseUrl + '/rest/v1/cotidiano_columns_config?select=*&apikey=' + supabaseKey;
const scoresUrl = supabaseUrl + '/rest/v1/daily_work_scores?select=*&apikey=' + supabaseKey;

async function checkData() {
  try {
     const cfgRes = await fetch(cfgUrl);
     const cfgData = await cfgRes.json();
     console.log("=== CONFIG TABLE ===");
     console.log(JSON.stringify(cfgData, null, 2));

     const scoresRes = await fetch(scoresUrl);
     const scoresData = await scoresRes.json();
     console.log("\n=== SCORES TABLE ===");
     console.log(JSON.stringify(scoresData, null, 2));
  } catch(e) {
     console.log(e);
  }
}

checkData();
