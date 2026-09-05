// Edge Function: admin-set-role
// Cambia el rol y/o el estado activo/inactivo de un usuario existente.
// Solo un Admin puede invocarla. Desactivar un usuario además lo
// "banea" en Supabase Auth para que no pueda iniciar sesión.

import { corsHeaders } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/requireAdmin.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { adminClient } = await requireAdmin(req);
    const { user_id, role, active } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'Falta user_id.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (role && !['admin', 'supervisor', 'monitoreo', 'rrhh'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Rol inválido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const patch: Record<string, unknown> = {};
    if (role) patch.role = role;
    if (typeof active === 'boolean') patch.active = active;

    if (Object.keys(patch).length > 0) {
      const { error: updErr } = await adminClient.from('profiles').update(patch).eq('id', user_id);
      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (typeof active === 'boolean') {
      // Además de marcarlo inactivo en profiles, lo bloqueamos en Auth
      // para que no pueda volver a iniciar sesión.
      await adminClient.auth.admin.updateUserById(user_id, {
        ban_duration: active ? 'none' : '876000h', // ~100 años = "desactivado"
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    if (e instanceof Response) return new Response(e.body, { status: e.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
