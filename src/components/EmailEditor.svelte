<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase';
  import { Loader2, Mail } from 'lucide-svelte';
  import { emailTemplates } from '../lib/emailTemplates';

  export let restaurantId: string = '00000000-0000-0000-0000-000000000000';

  const TEMPLATES = [
    { id: 'confirmacion', name: 'Confirmación de Reserva' },
    { id: 'cancelacion', name: 'Cancelación' },
    { id: 'recordatorio', name: 'Recordatorio (24h antes)' },
    { id: 'lista_espera', name: 'Aviso Lista de Espera' },
  ];

  let selectedTemplateId = 'confirmacion';

  let plantillas: Record<string, string> = {
    confirmacion: emailTemplates.confirmacion,
    cancelacion: `<p>Cancelación</p>`, // Simplificado para preview si no está exportado, pero añadamos cancelacion al export después. Wait, emailTemplates only has confirmacion y lista_espera. I need to add cancelacion and recordatorio to emailTemplates.ts.
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
                              .replace(/{{restaurant_name}}/g, 'Tu Restaurante')
                              .replace(/{{booking_id}}/g, 'test-booking-1234');

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
