import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fbncwutobgbkparudssw.supabase.co'
const supabaseAnonKey = 'sb_publishable_E81DHILIJ0qNYJUsjq1YAA_BXsPEqLA'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function audit() {
  console.log('--- AUDITORÍA DE SUPABASE ---')
  
  const tables = [
    'groups',
    'students',
    'attendance_lessons',
    'anecdotal_records',
    'schedules',
    'users',
    'grades',
    'daily_work_scores',
    'evaluation_configs'
  ]

  for (const table of tables) {
    try {
      console.log(`Checking table: ${table}...`)
      const { data, error } = await supabase.from(table).select('*').limit(1)
      
      if (error) {
        if (error.code === '42P01') {
          console.log(`[ABSENT] No existe la tabla ${table}`)
        } else {
          console.log(`[ERROR] Error en ${table}:`, error.message)
        }
        continue
      }
      
      if (data && data.length > 0) {
        console.log(`[FOUND] Tabla ${table} activa. Columnas:`, Object.keys(data[0]).join(', '))
        if (table === 'users') {
          console.log(`[USER_DATA] Usuarios actuales:`, data.map(u => u.username).join(', '))
          const pass = data[0].password
          if (pass && pass.length < 20) {
            console.log(`[CRITICAL] La contraseña en la tabla users parece TEXTO PLANO: "${pass}"`)
          } else {
            console.log(`[OK] La contraseña parece estar hasheada.`)
          }
        }
        if (table === 'groups') {
          console.log(`[INFO] user_id en groups es: ${typeof data[0].user_id} (${data[0].user_id})`)
        }
      } else {
        console.log(`[FOUND] Tabla ${table} activa pero está VACÍA.`)
      }
    } catch (e) {
      console.log(`[PANIC] Falló consulta a ${table}:`, e.message)
    }
  }

  // Check Auth
  console.log('\n--- VERIFICACIÓN DE SESIÓN ---')
  const { data: { session } } = await supabase.auth.getSession()
  console.log('Sesión actual:', session ? 'Activa' : 'Inactiva')
}

audit()
