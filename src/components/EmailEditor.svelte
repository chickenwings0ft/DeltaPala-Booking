<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase';
  import Quill from 'quill';
  import 'quill/dist/quill.snow.css';
  import { Save, Loader2, Mail } from 'lucide-svelte';

  export let restaurantId: string = '00000000-0000-0000-0000-000000000000';

  let editorContainer: HTMLElement;
  let quill: Quill;
  let loading = true;
  let saving = false;
  let saveSuccess = false;
  let testEmail = '';
  let sendingTest = false;

  const TEMPLATES = [
    { id: 'confirmacion', name: 'Confirmación de Reserva' },
    { id: 'cancelacion', name: 'Cancelación' },
    { id: 'recordatorio', name: 'Recordatorio (24h antes)' },
    { id: 'lista_espera', name: 'Aviso Lista de Espera' },
  ];

  const VARIABLES = [
    { id: '{{client_name}}', label: 'Nombre Cliente' },
    { id: '{{date}}', label: 'Fecha' },
    { id: '{{time}}', label: 'Hora' },
    { id: '{{pax}}', label: 'Comensales' },
    { id: '{{restaurant_name}}', label: 'Nombre Restaurante' },
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

  async function loadSettings() {
    loading = true;
    try {
      const { data, error } = await supabase
        .from('business_settings')
        .select('plantillas_email')
        .eq('restaurant_id', restaurantId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data && data.plantillas_email && Object.keys(data.plantillas_email).length > 0) {
        plantillas = { ...plantillas, ...data.plantillas_email };
      }

      if (!plantillas.confirmacion || plantillas.confirmacion.trim() === '') {
        plantillas.confirmacion = defaultConfirmacion;
      }
      if (!plantillas.cancelacion || plantillas.cancelacion.trim() === '') {
        plantillas.cancelacion = defaultCancelacion;
      }
      if (!plantillas.recordatorio || plantillas.recordatorio.trim() === '') {
        plantillas.recordatorio = defaultRecordatorio;
      }
      if (!plantillas.lista_espera || plantillas.lista_espera.trim() === '') {
        plantillas.lista_espera = defaultListaEspera;
      }
    } catch (err) {
      console.error('Error cargando plantillas:', err);
    } finally {
      loading = false;
      initEditor();
    }
  }

  function initEditor() {
    if (quill) {
      // Si ya está inicializado, solo actualizamos el contenido
      quill.root.innerHTML = plantillas[selectedTemplateId] || '';
      return;
    }

    // Inicializar Quill
    quill = new Quill(editorContainer, {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ 'header': [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          [{ 'color': [] }, { 'background': [] }],
          ['link'],
          ['clean']
        ]
      },
      placeholder: 'Escribe aquí tu plantilla de correo...'
    });

    quill.root.innerHTML = plantillas[selectedTemplateId] || '';

    // Escuchar cambios para actualizar el state
    quill.on('text-change', () => {
      plantillas[selectedTemplateId] = quill.root.innerHTML;
    });
  }

  function changeTemplate(id: string) {
    selectedTemplateId = id;
    if (quill) {
      quill.root.innerHTML = plantillas[selectedTemplateId] || '';
    }
  }

  function insertVariable(variable: string) {
    if (!quill) return;
    const range = quill.getSelection(true);
    let index = range ? range.index : quill.getLength();
    quill.insertText(index, variable, 'bold', true);
    quill.setSelection(index + variable.length, 0);
  }

  async function saveSettings() {
    saving = true;
    saveSuccess = false;
    try {
      const { error } = await supabase
        .from('business_settings')
        .upsert({ 
          restaurant_id: restaurantId, 
          plantillas_email: plantillas 
        }, { onConflict: 'restaurant_id' });

      if (error) throw error;
      
      saveSuccess = true;
      setTimeout(() => saveSuccess = false, 3000);
      
      // Intentamos mostrar el toast global (inyectado en AdminLayout)
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast('Plantillas guardadas con éxito', 'success');
      }
    } catch (err) {
      console.error('Error guardando plantillas:', err);
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast('Hubo un error al guardar las plantillas.', 'error');
      } else {
        alert('Hubo un error al guardar las plantillas.');
      }
    } finally {
      saving = false;
    }
  }

  async function sendTestEmail() {
    if (!testEmail || !testEmail.includes('@')) {
      if (window.showToast) window.showToast('Por favor, ingresa un email válido', 'warning');
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
          subject: `Prueba: ${TEMPLATES.find(t => t.id === selectedTemplateId)?.name}`,
          html: htmlContent
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Error enviando el correo');
      }
      
      if (window.showToast) window.showToast('Correo de prueba enviado con éxito', 'success');
    } catch (err: any) {
      console.error('Error al enviar prueba:', err);
      if (window.showToast) {
        window.showToast(err.message, 'error');
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
    loadSettings();
  });
</script>

<style>
  /* Personalización para adaptar Quill a nuestro diseño Tailwind */
  :global(.ql-toolbar.ql-snow) {
    border-color: #f3f4f6 !important;
    border-top-left-radius: 0.5rem;
    border-top-right-radius: 0.5rem;
    background-color: #f9fafb;
    padding: 12px !important;
  }
  :global(.ql-container.ql-snow) {
    border-color: #f3f4f6 !important;
    border-bottom-left-radius: 0.5rem;
    border-bottom-right-radius: 0.5rem;
    min-height: 250px;
    font-size: 1rem;
    font-family: inherit;
  }
  :global(.ql-editor) {
    padding: 1.5rem !important;
  }
</style>

<div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
  <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
    <div>
      <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
        <Mail class="w-5 h-5 text-brand" />
        Plantillas de Email
      </h2>
      <p class="text-sm text-gray-500 mt-1">Personaliza los correos que reciben tus clientes.</p>
    </div>
    <button 
      on:click={saveSettings} 
      disabled={saving || loading}
      class="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-hover transition disabled:opacity-50"
    >
      {#if saving}
        <Loader2 class="w-4 h-4 animate-spin" /> Guardando...
      {:else if saveSuccess}
        <span class="text-green-300">¡Guardado!</span>
      {:else}
        <Save class="w-4 h-4" /> Guardar Cambios
      {/if}
    </button>
  </div>

  <div class="p-6">
    {#if loading}
      <div class="flex justify-center py-12">
        <Loader2 class="w-8 h-8 animate-spin text-brand" />
      </div>
    {:else}
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
          
          <div class="pt-6">
            <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Variables Dinámicas</h3>
            <p class="text-xs text-gray-500 mb-3">Haz clic para insertar en el texto:</p>
            <div class="flex flex-wrap gap-2">
              {#each VARIABLES as v}
                <button 
                  on:click={() => insertVariable(v.id)}
                  class="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded border border-gray-200 transition"
                >
                  {v.label}
                </button>
              {/each}
            </div>
          </div>
        </div>

        <!-- Editor Rich Text -->
        <div class="lg:col-span-3">
          <div class="mb-2 flex justify-between items-end">
            <h3 class="text-sm font-medium text-gray-700">Contenido del correo</h3>
            <span class="text-xs text-gray-400">El formato HTML se guardará automáticamente</span>
          </div>
          <!-- Contenedor para Quill -->
          <div bind:this={editorContainer}></div>

          <!-- Enviar Prueba -->
          <div class="mt-6 border-t border-gray-100 pt-6">
            <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Enviar Prueba</h3>
            <div class="flex gap-3">
              <input 
                type="email" 
                bind:value={testEmail} 
                placeholder="tu@email.com" 
                class="flex-1 bg-white border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-brand focus:border-brand block p-2.5"
              />
              <button 
                on:click={sendTestEmail} 
                disabled={sendingTest || !testEmail}
                class="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2.5 rounded-lg font-medium transition disabled:opacity-50"
              >
                {#if sendingTest}
                  <Loader2 class="w-4 h-4 animate-spin" /> Enviando...
                {:else}
                  <Mail class="w-4 h-4" /> Enviar Prueba
                {/if}
              </button>
            </div>
            <p class="text-xs text-gray-500 mt-2">Se enviará el correo con datos ficticios para que veas cómo luce.</p>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
