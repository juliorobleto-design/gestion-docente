const fs = require('fs');

const envContent = fs.readFileSync('c:/Proyectos/gestion-docente/frontend/.env', 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const url = supabaseUrl + '/rest/v1/?apikey=' + supabaseKey;

fetch(url)
  .then(res => res.json())
  .then(data => {
    fs.writeFileSync('c:/Proyectos/gestion-docente/frontend/openapi.json', JSON.stringify(data, null, 2));
    console.log("Written openapi.json");
  })
  .catch(console.error);
