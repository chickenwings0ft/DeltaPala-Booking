<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase';
  import { Clock, Save, Loader2 } from 'lucide-svelte';

  export let restaurantId: string = '00000000-0000-0000-0000-000000000000';

  const DIAS = [
    { id: '1', nombre: 'Lunes' },
    { id: '2', nombre: 'Martes' },
    { id: '3', nombre: 'Miércoles' },
    { id: '4', nombre: 'Jueves' },
    { id: '5', nombre: 'Viernes' },
    { id: '6', nombre: 'Sábado' },
    { id: '0', nombre: 'Domingo' }
  ];

  // Estructura: { "1": { isOpen: true, ranges: [{open: "13:00", close: "16:00"}] }, ... }
  let horarios: any = {};
  let loading = true;
  let saving = false;
  let saveSuccess = false;

  // Inicializar estado por defecto
  DIAS.forEach(dia => {
    horarios[dia.id] = { isOpen: false, ranges: [{ open: '13:00', close: '16:00' }] };
  });

  async function loadSettings() {
    loading = true;
    try {
      const { data, error } = await supabase
        .from('business_settings')
        .select('horarios_apertura')
        .eq('restaurant_id', restaurantId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
        throw error;
      }

      if (data && data.horarios_apertura && Object.keys(data.horarios_apertura).length > 0) {
        // Merge fetched settings with defaults
        horarios = { ...horarios, ...data.horarios_apertura };
      }
    } catch (err) {
      console.error('Error cargando horarios:', err);
    } finally {
      loading = false;
    }
  }

  async function saveSettings() {
    saving = true;
    saveSuccess = false;
    try {
      // Usar upsert porque la configuración podría no existir aún
      const { error } = await supabase
        .from('business_settings')
        .upsert({ 
          restaurant_id: restaurantId, 
          horarios_apertura: horarios 
        }, { onConflict: 'restaurant_id' });

      if (error) throw error;
      
      saveSuccess = true;
      setTimeout(() => saveSuccess = false, 3000);
    } catch (err) {
      console.error('Error guardando horarios:', err);
      alert('Hubo un error al guardar los horarios.');
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

<div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
  <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
    <div>
      <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
        <Clock class="w-5 h-5 text-brand" />
        Horarios de Apertura
      </h2>
      <p class="text-sm text-gray-500 mt-1">Configura los días y turnos en los que aceptas reservas.</p>
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
      <div class="space-y-4">
        {#each DIAS as dia}
          <div class="flex items-center gap-4 p-4 rounded-lg border {horarios[dia.id].isOpen ? 'border-brand/20 bg-blue-50/30' : 'border-gray-100 bg-gray-50/50'} transition-colors">
            <!-- Toggle Abierto/Cerrado -->
            <div class="w-40 flex items-center gap-3">
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" bind:checked={horarios[dia.id].isOpen} class="sr-only peer">
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
              </label>
              <span class="font-medium text-gray-700 {horarios[dia.id].isOpen ? 'text-gray-900' : 'text-gray-400'}">{dia.nombre}</span>
            </div>

            <!-- Estado -->
            <div class="flex-1 flex items-center">
              {#if horarios[dia.id].isOpen}
                <span class="text-sm font-bold text-brand">Abierto</span>
              {:else}
                <span class="text-sm font-medium text-red-500">Cerrado</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
