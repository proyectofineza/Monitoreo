// Crea los 15 usuarios demo (1 admin, 10 monitoreo, 2 supervisor, 2 RRHH)
// usando la Admin API de Supabase — es la forma correcta y soportada de
// crear usuarios con contraseña (nunca insertes filas a mano en el
// esquema auth.*).
//
// Uso:
//   cd scripts
//   npm install @supabase/supabase-js
//   SUPABASE_URL=https://tu-proyecto.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key \
//   node seed-demo-users.mjs
//
// La Service Role key está en Project Settings -> API -> service_role.
// NUNCA la pongas en el frontend ni la subas a git — solo se usa acá,
// en tu máquina, una vez.

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY como variables de entorno.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

const PASSWORD = 'Demo1234!';

const users = [
  { email: 'aduarte@fineza.demo', full_name: 'Ana Duarte', role: 'admin' },
  { email: 'jperez@fineza.demo', full_name: 'Juan Pérez', role: 'monitoreo' },
  { email: 'pgonzalez@fineza.demo', full_name: 'Pedro González', role: 'monitoreo' },
  { email: 'sbenitez@fineza.demo', full_name: 'Sofía Benítez', role: 'monitoreo' },
  { email: 'dcabrera@fineza.demo', full_name: 'Diego Cabrera', role: 'monitoreo' },
  { email: 'layala@fineza.demo', full_name: 'Lucía Ayala', role: 'monitoreo' },
  { email: 'mortiz@fineza.demo', full_name: 'Marcos Ortiz', role: 'monitoreo' },
  { email: 'vrojas@fineza.demo', full_name: 'Valentina Rojas', role: 'monitoreo' },
  { email: 'avillalba@fineza.demo', full_name: 'Andrés Villalba', role: 'monitoreo' },
  { email: 'rfleitas@fineza.demo', full_name: 'Rosa Fleitas', role: 'monitoreo' },
  { email: 'gmendoza@fineza.demo', full_name: 'Gustavo Mendoza', role: 'monitoreo' },
  { email: 'mlopez@fineza.demo', full_name: 'María López', role: 'supervisor' },
  { email: 'cramirez@fineza.demo', full_name: 'Carlos Ramírez', role: 'supervisor' },
  { email: 'crios@fineza.demo', full_name: 'Carla Ríos', role: 'rrhh' },
  { email: 'rfranco@fineza.demo', full_name: 'Ricardo Franco', role: 'rrhh' },
];

const run = async () => {
  for (const u of users) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.full_name, role: u.role },
    });
    if (error) {
      if (error.message && error.message.toLowerCase().includes('already been registered')) {
        console.log(`⏭  ${u.email} ya existía, se omite.`);
      } else {
        console.error(`✗  ${u.email}:`, error.message);
      }
      continue;
    }
    console.log(`✓  ${u.email} (${u.role}) — id ${data.user.id}`);
  }
  console.log('\nListo. Todos los usuarios demo usan la contraseña:', PASSWORD);
  console.log('Cambiala (o borrá estos usuarios) antes de usar el sistema en producción real.');
};

run();
