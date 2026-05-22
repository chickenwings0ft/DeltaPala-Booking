<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase';
  import { Loader2, Mail } from 'lucide-svelte';

  export let restaurantId: string = '00000000-0000-0000-0000-000000000000';

  const TEMPLATES = [
    { id: 'confirmacion', name: 'Confirmación de Reserva' },
    { id: 'cancelacion', name: 'Cancelación' },
    { id: 'recordatorio', name: 'Recordatorio (24h antes)' },
    { id: 'lista_espera', name: 'Aviso Lista de Espera' },
  ];

  let selectedTemplateId = 'confirmacion';

  let defaultConfirmacion = `
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
    <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0;">Si necesitas modificar o cancelar tu reserva, por favor contáctanos lo antes posible.</p>
    <p style="color: #6b7280; font-size: 14px; margin-top: 8px;"><em>¡Te esperamos pronto!</em></p>
  </div>
</div>
  `;

  let defaultCancelacion = `
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
  `;

  let defaultRecordatorio = `
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
  `;

  let defaultListaEspera = `
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
  `;

  let plantillas: Record<string, string> = {
    confirmacion: defaultConfirmacion,
    cancelacion: defaultCancelacion,
    recordatorio: defaultRecordatorio,
    lista_espera: defaultListaEspera
  };

  function changeTemplate(id: string) {
    selectedTemplateId = id;
  }

  let sendingTest = false;
  let testEmail = '';

  async function sendTestEmail() {
    if (!testEmail || !testEmail.includes('@')) {
      if (typeof window !== 'undefined' && (window as any).showToast) (window as any).showToast('Por favor, ingresa un email válido', 'warning');
      return;
    }
    
    sendingTest = true;
    try {
      let htmlContent = plantillas[selectedTemplateId] || '';
      
      // Reemplazar variables con datos ficticios para la prueba
      htmlContent = htmlContent.replace(/{{client_name}}/g, 'Carlos García')
                              .replace(/{{date}}/g, '25/05/2026')
                              .replace(/{{time}}/g, '21:30')
                              .replace(/{{pax}}/g, '4')
                              .replace(/{{restaurant_name}}/g, 'Tu Restaurante');

      const response = await fetch('/api/send-test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testEmail,
          subject: \`Prueba: \${TEMPLATES.find(t => t.id === selectedTemplateId)?.name}\`,
          html: htmlContent
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Error enviando el correo');
      }
      
      if (typeof window !== 'undefined' && (window as any).showToast) (window as any).showToast('Correo de prueba enviado con éxito', 'success');
    } catch (err: any) {
      console.error('Error al enviar prueba:', err);
      if (typeof window !== 'undefined' && (window as any).showToast) {
        (window as any).showToast(err.message, 'error');
      } else {
        alert(err.message);
      }
    } finally {
      sendingTest = false;
    }
  }

  onMount(() => {
    const savedId = localStorage.getItem('admin_restaurant_id');
    if (savedId) restaurantId = savedId;
  });
</script>

<div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
  <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
    <div>
      <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
        <Mail class="w-5 h-5 text-brand" />
        Plantillas de Email Automáticas
      </h2>
      <p class="text-sm text-gray-500 mt-1">Tus comunicaciones ya tienen un diseño premium corporativo integrado.</p>
    </div>
  </div>

  <div class="p-6">
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <!-- Selector de Plantillas -->
      <div class="lg:col-span-1 space-y-2">
        <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tipo de Email</h3>
        {#each TEMPLATES as template}
          <button 
            on:click={() => changeTemplate(template.id)}
            class="w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors border {selectedTemplateId === template.id ? 'bg-blue-50 border-brand/30 text-brand' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}"
          >
            {template.name}
          </button>
        {/each}
      </div>

      <!-- Preview Box -->
      <div class="lg:col-span-3">
        <div class="mb-4">
          <h3 class="text-sm font-medium text-gray-700">Diseño predefinido (Solo visualización)</h3>
          <p class="text-xs text-gray-400 mt-1">Hemos configurado automáticamente un diseño premium para todos los correos. No necesitas editar nada.</p>
        </div>
        
        <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 min-h-[300px] flex items-center justify-center overflow-auto shadow-inner">
          <div class="w-full pointer-events-none">
            {@html plantillas[selectedTemplateId]}
          </div>
        </div>

        <!-- Enviar Prueba -->
        <div class="mt-6 border-t border-gray-100 pt-6">
          <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Enviar Prueba a mi Correo</h3>
          <div class="flex gap-3">
            <input 
              type="email" 
              bind:value={testEmail} 
              placeholder="tu@email.com" 
              class="flex-1 bg-white border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-2 focus:ring-brand focus:border-brand block p-2.5 outline-none"
            />
            <button 
              on:click={sendTestEmail} 
              disabled={sendingTest || !testEmail}
              class="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-lg font-bold transition disabled:opacity-50"
            >
              {#if sendingTest}
                <Loader2 class="w-4 h-4 animate-spin" /> Enviando...
              {:else}
                <Mail class="w-4 h-4" /> Enviar Prueba
              {/if}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
