import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

// Verifica que el request traiga el JWT de un usuario autenticado con
// rol 'admin' en la tabla profiles. Devuelve el cliente "admin" (service
// role, bypassa RLS) listo para usar, o lanza un Response de error.
export async function requireAdmin(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) {
    throw new Response(JSON.stringify({ error: 'Falta el token de autenticación.' }), { status: 401 });
  }

  const { data: userData, error: userErr } = await adminClient.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    throw new Response(JSON.stringify({ error: 'Token inválido.' }), { status: 401 });
  }

  const { data: profile, error: profErr } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single();

  if (profErr || !profile || profile.role !== 'admin') {
    throw new Response(JSON.stringify({ error: 'Solo un Administrador puede hacer esto.' }), { status: 403 });
  }

  return { adminClient, callerId: userData.user.id };
}
