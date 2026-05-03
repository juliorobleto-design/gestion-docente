import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: 'c:/Proyectos/gestion-docente/frontend/.env.local' });

const url = process.env.VITE_SUPABASE_URL + '/rest/v1/?apikey=' + process.env.VITE_SUPABASE_ANON_KEY;

fetch(url)
  .then(res => res.json())
  .then(data => {
    fs.writeFileSync('c:/Proyectos/gestion-docente/frontend/openapi.json', JSON.stringify(data, null, 2));
    console.log("Written openapi.json");
  })
  .catch(console.error);
