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

  const TEMPLATES = [
    { id: 'confirmacion', name: 'Confirmación de Reserva' },
    { id: 'cancelacion', name: 'Cancelación' },
    { id: 'recordatorio', name: 'Recordatorio (24h antes)' },
  ];

  const VARIABLES = [
    { id: '{{client_name}}', label: 'Nombre Cliente' },
    { id: '{{date}}', label: 'Fecha' },
    { id: '{{time}}', label: 'Hora' },
    { id: '{{pax}}', label: 'Comensales' },
    { id: '{{restaurant_name}}', label: 'Nombre Restaurante' },
  ];

  let selectedTemplateId = 'confirmacion';
  let plantillas: Record<string, string> = {
    confirmacion: `
<h2>¡Tu reserva está confirmada, <strong>{{client_name}}</strong>! 🎉</h2>
<p>Nos alegra comunicarte que tu mesa en <strong>{{restaurant_name}}</strong> ha sido reservada con éxito.</p>
<br>
<h3>📋 Detalles de la Reserva:</h3>
<ul>
  <li><strong>Fecha:</strong> {{date}}</li>
  <li><strong>Hora:</strong> {{time}}</li>
  <li><strong>Comensales:</strong> {{pax}} personas</li>
  <li><strong>Lugar:</strong> {{restaurant_name}}</li>
</ul>
<br>
<p>Guarda la fecha en tu calendario para no olvidarlo:</p>
<p>
  <a href="#" style="background-color: #4285F4; color: white; padding: 10px 16px; border-radius: 6px; text-decoration: none; display: inline-block; margin-right: 8px; font-weight: bold;">📅 Google Calendar</a>
  <a href="#" style="background-color: #000000; color: white; padding: 10px 16px; border-radius: 6px; text-decoration: none; display: inline-block; margin-right: 8px; font-weight: bold;">🍎 Apple Calendar</a>
  <a href="#" style="background-color: #000000; color: white; padding: 10px 16px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold;">💳 Apple Wallet (Próximamente)</a>
</p>
<br>
<p>Si necesitas modificar o cancelar tu reserva, por favor contáctanos lo antes posible.</p>
<p><em>¡Te esperamos pronto!</em></p>
    `,
    cancelacion: 'Hola {{client_name}}, tu reserva ha sido cancelada.',
    recordatorio: 'Hola {{client_name}}, recuerda tu reserva mañana a las {{time}}.'
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
    quill.insertText(range.index, variable, 'bold', true);
    quill.setSelection(range.index + variable.length, 0);
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
    } catch (err) {
      console.error('Error guardando plantillas:', err);
      alert('Hubo un error al guardar las plantillas.');
    } finally {
      saving = false;
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
        </div>
      </div>
    {/if}
  </div>
</div>
