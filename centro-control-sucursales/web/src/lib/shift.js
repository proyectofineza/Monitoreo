// Turnos de Monitoreo — el "día" de control arranca cuando entra el
// turno, no a la medianoche calendario:
//   Domingo y sábado: arranca a las 10:00
//   Lunes a viernes:  arranca a las 16:00
// Mismo criterio que la función current_shift_start() en Supabase
// (ver supabase/migrations/0006_views.sql) — si cambia el horario de
// turnos, ajustar shiftStartHour() acá y su equivalente en esa
// migración.

function shiftStartHour(dayOfWeek) {
  // dayOfWeek: 0 = domingo … 6 = sábado (igual que Date#getDay())
  return dayOfWeek === 0 || dayOfWeek === 6 ? 10 : 16;
}

// Devuelve el inicio (Date) del turno de Monitoreo vigente en este momento.
export function currentShiftStart() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(shiftStartHour(now.getDay()), 0, 0, 0);

  if (now >= todayStart) return todayStart;

  // Todavía no arrancó el turno de "hoy" — seguimos dentro del turno
  // que empezó ayer (ej.: 00:30 del martes es la madrugada del turno
  // del lunes, que arrancó el lunes a las 16:00).
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(shiftStartHour(yesterdayStart.getDay()), 0, 0, 0);
  return yesterdayStart;
}
