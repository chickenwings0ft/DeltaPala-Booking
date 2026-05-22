import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json();
    const { bookingId, status } = payload; // ej: status = 'reconfirmada' | 'cancelada'

    if (!bookingId || !status) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros' }), { status: 400 });
    }

    // Actualizamos el estado en Supabase
    const { error } = await supabase
      .from('bookings')
      .update({ estado: status })
      .eq('id', bookingId);

    if (error) throw error;

    // Podríamos emitir otro evento o log a un CRM externo aquí
    return new Response(JSON.stringify({ success: true, message: `Reserva ${status}` }), { status: 200 });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
