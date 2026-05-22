export const emailTemplates = {
  confirmacion: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #004aad; padding: 24px; text-align: center;">
    <img src="https://delta-pala-booking-seven.vercel.app/assets/logo-pequeno.png" alt="Logo" style="width: 50px; height: 50px; border-radius: 50%; background-color: white; padding: 4px;" />
  </div>
  <div style="padding: 32px 24px;">
    <h2 style="color: #111827; margin-top: 0; font-size: 22px;">Reserva confirmada, <strong>{{client_name}}</strong></h2>
    <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">Nos alegra comunicarte que tu mesa en <strong>{{restaurant_name}}</strong> ha sido reservada con éxito.</p>
    
    <div style="background-color: #f8f9fc; border-left: 4px solid #004aad; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; color: #6b7280; letter-spacing: 1px;">Detalles de la Reserva</h3>
      <ul style="list-style: none; padding: 0; margin: 0; color: #111827;">
        <li style="margin-bottom: 8px;"><strong>Fecha:</strong> {{date}}</li>
        <li style="margin-bottom: 8px;"><strong>Hora:</strong> {{time}}</li>
        <li style="margin-bottom: 8px;"><strong>Comensales:</strong> {{pax}} personas</li>
        <li style="margin-bottom: 0;"><strong>Lugar:</strong> {{restaurant_name}}</li>
      </ul>
    </div>

    <p style="color: #4b5563; font-size: 16px;">Guarda la fecha en tu calendario para no olvidarlo:</p>
    <div style="margin-top: 16px; margin-bottom: 24px;">
      <a href="#" style="background-color: #004aad; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; display: inline-block; margin-right: 8px; font-weight: bold; font-size: 14px;">Google Calendar</a>
      <a href="#" style="background-color: #111827; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: bold; font-size: 14px;">Apple Calendar</a>
    </div>

    <hr style="border: none; border-top: 1px solid #eaeaea; margin: 24px 0;" />
    <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0;">Si tus planes cambian y necesitas cancelar tu reserva, puedes hacerlo haciendo clic en el siguiente enlace:</p>
    <div style="margin-top: 12px; margin-bottom: 24px;">
      <a href="https://delta-pala-booking-seven.vercel.app/cancelar/{{booking_id}}" style="background-color: #fce8e8; color: #dc2626; padding: 10px 16px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold; font-size: 13px; border: 1px solid #fecaca;">Cancelar Reserva</a>
    </div>
    <p style="color: #6b7280; font-size: 14px; margin-top: 8px;"><em>¡Te esperamos pronto!</em></p>
  </div>
</div>
  `,

  lista_espera: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #004aad; padding: 24px; text-align: center;">
    <img src="https://delta-pala-booking-seven.vercel.app/assets/logo-pequeno.png" alt="Logo" style="width: 50px; height: 50px; border-radius: 50%; background-color: white; padding: 4px;" />
  </div>
  <div style="padding: 32px 24px;">
    <h2 style="color: #111827; margin-top: 0; font-size: 22px;">Te has apuntado a la lista de espera</h2>
    <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">Hola <strong>{{client_name}}</strong>,</p>
    <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">Tu solicitud para el día {{date}} a las {{time}} ({{pax}} personas) está registrada en nuestra lista de espera.</p>

    <div style="background-color: #f8f9fc; border-left: 4px solid #004aad; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #111827;">¿Cómo funciona?</h3>
      <p style="margin: 0; color: #4b5563; font-size: 15px; line-height: 1.6;">
        Si otra mesa cancela o no confirma su asistencia en las próximas horas (algo que ocurre habitualmente), el sistema nos avisará. En ese mismo instante te llamaremos directamente por teléfono o te enviaremos un WhatsApp para ofrecerte el hueco.
      </p>
    </div>

    <p style="color: #4b5563; font-size: 15px; line-height: 1.5;">Si tus planes cambian y prefieres cancelar tu solicitud, por favor haz clic aquí:</p>
    
    <div style="margin-top: 24px; text-align: left;">
      <a href="#" style="background-color: #dc2626; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: bold; font-size: 14px;">Cancelar solicitud</a>
    </div>

  </div>
</div>
  `,

  cancelacion: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #dc2626; padding: 24px; text-align: center;">
    <img src="https://delta-pala-booking-seven.vercel.app/assets/logo-pequeno.png" alt="Logo" style="width: 50px; height: 50px; border-radius: 50%; background-color: white; padding: 4px;" />
  </div>
  <div style="padding: 32px 24px;">
    <h2 style="color: #111827; margin-top: 0; font-size: 22px;">Reserva Cancelada</h2>
    <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">Hola <strong>{{client_name}}</strong>,</p>
    <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">Te confirmamos que tu reserva en <strong>{{restaurant_name}}</strong> para el día {{date}} a las {{time}} ha sido cancelada correctamente.</p>
    <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">Esperamos poder atenderte en otra ocasión.</p>
    <div style="margin-top: 32px; text-align: center;">
      <a href="#" style="background-color: #004aad; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: bold; font-size: 14px;">Hacer una nueva reserva</a>
    </div>
  </div>
</div>
  `,

  recordatorio: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #004aad; padding: 24px; text-align: center;">
    <img src="https://delta-pala-booking-seven.vercel.app/assets/logo-pequeno.png" alt="Logo" style="width: 50px; height: 50px; border-radius: 50%; background-color: white; padding: 4px;" />
  </div>
  <div style="padding: 32px 24px;">
    <h2 style="color: #111827; margin-top: 0; font-size: 22px;">Recordatorio de Reserva</h2>
    <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">Hola <strong>{{client_name}}</strong>, ¡te esperamos muy pronto!</p>
    <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">Este es un recordatorio de tu reserva en <strong>{{restaurant_name}}</strong> para mañana.</p>
    
    <div style="background-color: #f8f9fc; border-left: 4px solid #004aad; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
      <ul style="list-style: none; padding: 0; margin: 0; color: #111827;">
        <li style="margin-bottom: 8px;"><strong>Fecha:</strong> {{date}}</li>
        <li style="margin-bottom: 8px;"><strong>Hora:</strong> {{time}}</li>
        <li style="margin-bottom: 0;"><strong>Comensales:</strong> {{pax}} personas</li>
      </ul>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0;">Te pedimos puntualidad. Si surge algún imprevisto, avísanos con antelación.</p>
  </div>
</div>
  `
};
