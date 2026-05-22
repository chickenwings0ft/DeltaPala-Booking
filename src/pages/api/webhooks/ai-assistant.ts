import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

// Este endpoint está diseñado para ser llamado por una IA conversacional (ej: OpenAI Function Calling)
export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json();
    const { restaurantId, nombre, telefono, fecha, hora, comensales } = payload;

    if (!restaurantId || !nombre || !telefono || !fecha || !hora || !comensales) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros requeridos por la IA' }), { status: 400 });
    }

    // 1. Buscar o crear cliente
    let { data: clientData, error: clientError } = await supabase
      .from('clients')
      .insert([{ nombre, telefono }])
      .select()
      .single();

    if (clientError) {
      // Intenta recuperar si existe (basado en teléfono idealmente, pero para MVP obviamos complejidad)
      const { data: existing } = await supabase.from('clients').select().eq('telefono', telefono).single();
      if (existing) clientData = existing;
      else throw clientError;
    }

    // 2. Crear la reserva
    const { error: bookingError } = await supabase
      .from('bookings')
      .insert([{
        restaurant_id: restaurantId,
        client_id: clientData?.id,
        fecha,
        hora,
        comensales,
        origen: 'ia', // Origen marcado como IA
        estado: 'reconfirmada' // Las reservas telefónicas de la IA suelen estar ya reconfirmadas
      }]);

    if (bookingError) throw bookingError;

    return new Response(JSON.stringify({ success: true, message: 'Reserva completada con éxito' }), { status: 200 });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
