<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase';
  import { Settings2, Save, Loader2 } from 'lucide-svelte';

  export let restaurantId: string = '00000000-0000-0000-0000-000000000000';

  let configuracion: Record<string, any> = {
    mensaje_peticiones: '¿Alguna alergia o petición especial? (Opcional)'
  };
  
  let loading = true;
  let saving = false;
  let saveSuccess = false;

  async function loadSettings() {
    loading = true;
    try {
      const { data, error } = await supabase
        .from('business_settings')
        .select('configuracion_formulario')
        .eq('restaurant_id', restaurantId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data && data.configuracion_formulario) {
        configuracion = { ...configuracion, ...data.configuracion_formulario };
      }
    } catch (err) {
      console.error('Error cargando configuración del formulario:', err);
    } finally {
      loading = false;
    }
  }

  async function saveSettings() {
    saving = true;
    saveSuccess = false;
    try {
      // Necesitamos hacer upsert del campo JSONB entero.
      // Para no pisar otros campos de la tabla, idealmente deberíamos leer antes todo el registro o usar update.
      // Como upsert requiere todos los campos required o default, y nuestro schema tiene DEFAULTs, 
      // lo mejor es actualizar solo ese campo usando update. Pero update fallará si la fila no existe.
      // Por simplicidad, leeremos toda la fila actual si existe, y actualizaremos.
      
      const { data: existing } = await supabase.from('business_settings').select('*').eq('restaurant_id', restaurantId).single();
      
      const { error } = await supabase
        .from('business_settings')
        .upsert({ 
          restaurant_id: restaurantId, 
          configuracion_formulario: configuracion,
          horarios_apertura: existing?.horarios_apertura || {},
          plantillas_email: existing?.plantillas_email || {},
          dias_especiales: existing?.dias_especiales || {}
        }, { onConflict: 'restaurant_id' });

      if (error) throw error;
      
      saveSuccess = true;
      setTimeout(() => saveSuccess = false, 3000);
    } catch (err) {
      console.error('Error guardando configuración:', err);
      alert('Hubo un error al guardar la configuración.');
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

<div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-8">
  <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
    <div>
      <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
        <Settings2 class="w-5 h-5 text-brand" />
        Ajustes del Formulario de Reservas
      </h2>
      <p class="text-sm text-gray-500 mt-1">Personaliza los campos y mensajes que ven tus clientes al reservar.</p>
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
      <div class="flex justify-center py-6">
        <Loader2 class="w-8 h-8 animate-spin text-brand" />
      </div>
    {:else}
      <div class="space-y-4 max-w-2xl">
        <div>
          <label class="block text-sm font-bold text-gray-700 mb-2">Mensaje del campo de "Peticiones Especiales"</label>
          <p class="text-xs text-gray-500 mb-3">Este es el texto que aparecerá dentro de la caja de texto (Placeholder) en el último paso del widget de reservas.</p>
          <input 
            type="text" 
            bind:value={configuracion.mensaje_peticiones} 
            placeholder="Ej. ¿Alguna alergia o petición especial? (Opcional)" 
            class="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-brand outline-none transition shadow-sm" 
          />
        </div>
      </div>
    {/if}
  </div>
</div>
