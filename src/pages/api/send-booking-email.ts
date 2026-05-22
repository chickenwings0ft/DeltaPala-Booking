import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { emailTemplates } from '../../lib/emailTemplates';

const resend = new Resend(import.meta.env.RESEND_API_KEY || 're_placeholder');

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { 
      type, 
      to, 
      client_name, 
      date, 
      time, 
      pax, 
      restaurant_id, 
      booking_id 
    } = body;

    if (!type || !to || !client_name || !date || !pax || !restaurant_id) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros requeridos' }), { status: 400 });
    }

    if (!import.meta.env.RESEND_API_KEY) {
       console.error('Falta configurar RESEND_API_KEY en .env.local');
       return new Response(JSON.stringify({ error: 'Falta configurar RESEND_API_KEY' }), { status: 500 });
    }

    // Initialize Supabase admin or public client to read restaurant name
    // (We can just use a simple fetch or assuming the restaurant is named "Tu Restaurante" if not found)
    let restaurant_name = 'Nuestro Restaurante';
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data } = await supabase.from('restaurants').select('name').eq('id', restaurant_id).single();
        if (data?.name) {
          restaurant_name = data.name;
        }
      }
    } catch (e) {
      console.error('No se pudo obtener el nombre del restaurante', e);
    }

    let subject = '';
    let htmlTemplate = '';

    if (type === 'confirmacion') {
      subject = `Reserva Confirmada - ${restaurant_name || 'Restaurante'}`;
      htmlTemplate = emailTemplates.confirmacion;
    } else if (type === 'lista_espera') {
      subject = `Aviso Lista de Espera - ${restaurant_name || 'Restaurante'}`;
      htmlTemplate = emailTemplates.lista_espera;
    } else if (type === 'cancelacion') {
      subject = `Reserva Cancelada - ${restaurant_name || 'Restaurante'}`;
      htmlTemplate = emailTemplates.cancelacion;
    } else {
      return new Response(JSON.stringify({ error: 'Tipo de email inválido' }), { status: 400 });
    }

    const htmlContent = htmlTemplate
      .replace(/{{client_name}}/g, client_name || 'Cliente')
      .replace(/{{date}}/g, date || '')
      .replace(/{{time}}/g, time || '')
      .replace(/{{pax}}/g, pax?.toString() || '')
      .replace(/{{restaurant_name}}/g, restaurant_name || 'Nuestro Restaurante')
      .replace(/{{booking_id}}/g, booking_id || '');

    const data = await resend.emails.send({
      from: 'Reservas <onboarding@resend.dev>',
      to: [to],
      subject: subject,
      html: htmlContent,
    });

    return new Response(JSON.stringify({ success: true, data }), { status: 200 });
  } catch (error: any) {
    console.error('Error al enviar email de reserva:', error);
    return new Response(JSON.stringify({ error: error.message || 'Error interno' }), { status: 500 });
  }
};
