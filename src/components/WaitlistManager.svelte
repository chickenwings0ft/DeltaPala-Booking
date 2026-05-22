<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase';
  import { Clock, User, Phone, CheckCircle, Trash2, Loader2, Calendar as CalendarIcon } from 'lucide-svelte';

  export let restaurantId: string = '00000000-0000-0000-0000-000000000000';

  let waitlist: any[] = [];
  let loading = true;

  async function loadWaitlist() {
    loading = true;
    try {
      const { data, error } = await supabase
        .from('waitlist')
        .select(`
          id,
          fecha,
          comensales,
          estado,
          flexibilidad_horaria,
          created_at,
          clients (
            nombre,
            telefono,
            email
          )
        `)
        .eq('restaurant_id', restaurantId)
        .order('fecha', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      waitlist = data || [];
    } catch (err) {
      console.error('Error loading waitlist:', err);
    } finally {
      loading = false;
    }
  }

  async function updateStatus(id: string, newStatus: string) {
    try {
      const { error } = await supabase
        .from('waitlist')
        .update({ estado: newStatus })
        .eq('id', id);

      if (error) throw error;
      
      // Actualizar estado local
      waitlist = waitlist.map(w => w.id === id ? { ...w, estado: newStatus } : w);
    } catch (err) {
      console.error('Error updating waitlist status:', err);
      alert('Error al actualizar el estado.');
    }
  }

  onMount(() => {
    const savedId = localStorage.getItem('admin_restaurant_id');
    if (savedId) restaurantId = savedId;
    loadWaitlist();
  });
</script>

<div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
  <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
    <div>
      <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
        <Clock class="w-5 h-5 text-brand" />
        Lista de Espera
      </h2>
      <p class="text-sm text-gray-500 mt-1">Gestiona los clientes que no pudieron reservar por falta de aforo.</p>
    </div>
    <button on:click={loadWaitlist} class="text-sm bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">
      Actualizar
    </button>
  </div>

  {#if loading}
    <div class="flex justify-center items-center p-12">
      <Loader2 class="w-8 h-8 animate-spin text-brand" />
    </div>
  {:else if waitlist.length === 0}
    <div class="p-12 text-center">
      <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Clock class="w-8 h-8 text-gray-400" />
      </div>
      <h3 class="text-lg font-bold text-gray-800 mb-1">Lista de espera vacía</h3>
      <p class="text-gray-500 text-sm">No hay clientes esperando mesa en este momento.</p>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-white border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500">
            <th class="p-4 font-semibold">Cliente</th>
            <th class="p-4 font-semibold">Fecha Deseada</th>
            <th class="p-4 font-semibold">Pax</th>
            <th class="p-4 font-semibold">Notas</th>
            <th class="p-4 font-semibold">Estado</th>
            <th class="p-4 font-semibold text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="text-sm divide-y divide-gray-100">
          {#each waitlist as item}
            <tr class="hover:bg-gray-50 transition-colors">
              <td class="p-4">
                <div class="font-bold text-gray-900">{item.clients?.nombre}</div>
                <div class="text-gray-500 flex items-center gap-1 text-xs mt-1">
                  <Phone class="w-3 h-3" /> {item.clients?.telefono || 'Sin teléfono'}
                </div>
              </td>
              <td class="p-4">
                <div class="flex items-center gap-2 text-gray-800 font-medium">
                  <CalendarIcon class="w-4 h-4 text-brand" /> {item.fecha}
                </div>
              </td>
              <td class="p-4">
                <span class="bg-gray-100 text-gray-800 font-bold px-2 py-1 rounded">
                  {item.comensales}
                </span>
              </td>
              <td class="p-4 text-gray-500 whitespace-pre-wrap">
                {item.flexibilidad_horaria?.nota || '-'}
              </td>
              <td class="p-4">
                {#if item.estado === 'esperando'}
                  <span class="inline-flex items-center gap-1 bg-yellow-50 text-yellow-700 text-xs font-bold px-2.5 py-1 rounded-full border border-yellow-200">
                    Esperando
                  </span>
                {:else if item.estado === 'contactado'}
                  <span class="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full border border-green-200">
                    Contactado
                  </span>
                {:else}
                  <span class="inline-flex items-center gap-1 bg-gray-50 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full border border-gray-200">
                    Cancelado
                  </span>
                {/if}
              </td>
              <td class="p-4 text-right">
                <div class="flex items-center justify-end gap-2">
                  {#if item.estado === 'esperando'}
                    <button 
                      on:click={() => updateStatus(item.id, 'contactado')}
                      class="text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 p-2 rounded transition"
                      title="Marcar como contactado"
                    >
                      <CheckCircle class="w-4 h-4" />
                    </button>
                    <button 
                      on:click={() => updateStatus(item.id, 'cancelado')}
                      class="text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 p-2 rounded transition"
                      title="Cancelar"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
