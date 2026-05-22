<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase';
  import { LayoutGrid, Plus, Trash2, Edit2, Loader2, Save } from 'lucide-svelte';

  export let restaurantId: string = '00000000-0000-0000-0000-000000000000';

  let rooms: any[] = [];
  let loading = true;
  let processing = false;

  let newRoomName = '';
  let newRoomCapacity: number | null = null;
  let editingRoomId: string | null = null;

  async function loadRooms() {
    loading = true;
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      rooms = data || [];
    } catch (err) {
      console.error('Error cargando salas:', err);
    } finally {
      loading = false;
    }
  }

  async function addRoom() {
    if (!newRoomName.trim()) return;
    
    processing = true;
    try {
      const { data, error } = await supabase
        .from('rooms')
        .insert([{
          restaurant_id: restaurantId,
          nombre: newRoomName,
          capacidad_maxima: newRoomCapacity
        }])
        .select()
        .single();

      if (error) throw error;
      
      rooms = [...rooms, data];
      newRoomName = '';
      newRoomCapacity = null;
    } catch (err) {
      console.error('Error añadiendo sala:', err);
      alert('Error al añadir la sala.');
    } finally {
      processing = false;
    }
  }

  async function deleteRoom(id: string) {
    if (!confirm('¿Estás seguro de eliminar esta sala?')) return;
    
    processing = true;
    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      rooms = rooms.filter(r => r.id !== id);
    } catch (err) {
      console.error('Error eliminando sala:', err);
      alert('Error al eliminar la sala.');
    } finally {
      processing = false;
    }
  }

  async function saveEdit(room: any) {
    processing = true;
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ 
          nombre: room.nombre, 
          capacidad_maxima: room.capacidad_maxima 
        })
        .eq('id', room.id);

      if (error) throw error;
      
      editingRoomId = null;
    } catch (err) {
      console.error('Error actualizando sala:', err);
      alert('Error al actualizar la sala.');
    } finally {
      processing = false;
    }
  }

  onMount(() => {
    const savedId = localStorage.getItem('admin_restaurant_id');
    if (savedId) restaurantId = savedId;
    loadRooms();
  });
</script>

<div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
  <div class="p-6 border-b border-gray-100 bg-gray-50">
    <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
      <LayoutGrid class="w-5 h-5 text-brand" />
      Gestor de Espacios / Salas
    </h2>
    <p class="text-sm text-gray-500 mt-1">Define las diferentes zonas de tu restaurante (Ej. Terraza, Comedor Principal, Reservado).</p>
  </div>

  <div class="p-6">
    <!-- Formulario Nueva Sala -->
    <div class="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-8">
      <h3 class="text-sm font-bold text-gray-700 mb-3">Añadir nueva sala</h3>
      <form on:submit|preventDefault={addRoom} class="flex flex-col sm:flex-row gap-3">
        <input 
          type="text" 
          bind:value={newRoomName} 
          placeholder="Nombre de la zona" 
          required
          class="flex-1 border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand outline-none" 
        />
        <input 
          type="number" 
          bind:value={newRoomCapacity} 
          placeholder="Capacidad Max (pax)" 
          class="w-full sm:w-48 border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand outline-none" 
        />
        <button 
          type="submit" 
          disabled={processing || !newRoomName}
          class="flex items-center justify-center gap-2 bg-brand text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-hover transition disabled:opacity-50"
        >
          {#if processing}
            <Loader2 class="w-4 h-4 animate-spin" />
          {:else}
            <Plus class="w-4 h-4" /> Añadir
          {/if}
        </button>
      </form>
    </div>

    <!-- Lista de Salas -->
    <div>
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Salas Actuales</h3>
      
      {#if loading}
        <div class="flex justify-center py-8">
          <Loader2 class="w-8 h-8 animate-spin text-brand" />
        </div>
      {:else if rooms.length === 0}
        <div class="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          No tienes ninguna sala configurada.
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {#each rooms as room}
            <div class="border border-gray-200 rounded-lg p-4 flex flex-col gap-3 group hover:border-brand/30 transition">
              {#if editingRoomId === room.id}
                <!-- Modo Edición -->
                <input type="text" bind:value={room.nombre} class="border border-brand rounded p-1.5 text-sm w-full outline-none" />
                <div class="flex items-center gap-2 text-sm text-gray-500">
                  <span>Capacidad:</span>
                  <input type="number" bind:value={room.capacidad_maxima} class="border border-brand rounded p-1 text-sm w-20 outline-none" />
                </div>
                <div class="flex justify-end gap-2 mt-2">
                  <button on:click={() => { editingRoomId = null; loadRooms(); }} class="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
                  <button on:click={() => saveEdit(room)} class="flex items-center gap-1 text-xs bg-brand text-white px-3 py-1.5 rounded hover:bg-brand-hover"><Save class="w-3 h-3"/> Guardar</button>
                </div>
              {:else}
                <!-- Modo Vista -->
                <div class="flex justify-between items-start">
                  <div>
                    <h4 class="font-bold text-gray-900">{room.nombre}</h4>
                    <p class="text-sm text-gray-500 mt-1">Capacidad: {room.capacidad_maxima || 'Ilimitada'} pax</p>
                  </div>
                  <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button on:click={() => editingRoomId = room.id} class="p-1.5 text-gray-400 hover:text-brand hover:bg-blue-50 rounded transition">
                      <Edit2 class="w-4 h-4" />
                    </button>
                    <button on:click={() => deleteRoom(room.id)} class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition">
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
