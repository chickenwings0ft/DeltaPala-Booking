import type { APIRoute } from 'astro';
import { Resend } from 'resend';

// Inicializar Resend con la API key del entorno
const resend = new Resend(import.meta.env.RESEND_API_KEY || 're_placeholder');

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { to, subject, html } = body;

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros (to, subject, html)' }), { status: 400 });
    }

    if (!import.meta.env.RESEND_API_KEY) {
       return new Response(JSON.stringify({ error: 'Falta configurar RESEND_API_KEY en .env.local' }), { status: 500 });
    }

    // Enviar correo con Resend
    const data = await resend.emails.send({
      from: 'Reservas <onboarding@resend.dev>', // Por defecto Resend permite usar su dominio de pruebas onboarding@resend.dev para pruebas a la cuenta verificada.
      to: [to],
      subject: subject,
      html: html,
    });

    return new Response(JSON.stringify({ success: true, data }), { status: 200 });
  } catch (error: any) {
    console.error('Error al enviar email de prueba:', error);
    return new Response(JSON.stringify({ error: error.message || 'Error interno' }), { status: 500 });
  }
};
