<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase';
  import { CalendarDays, Users, Clock, MoreVertical, Search, CheckCircle, XCircle } from 'lucide-svelte';

  export let restaurantId: string = 'rest-id-placeholder';

  let bookings: any[] = [];
  let loading = true;
  let selectedDate = new Date().toISOString().split('T')[0];
  let selectedBooking: any = null;

  async function fetchBookings() {
    loading = true;
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          client:client_id ( * ),
          table:table_id ( zona )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('fecha', selectedDate)
        .order('hora', { ascending: true });

      if (error) throw error;
      bookings = data || [];
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ estado: status })
        .eq('id', id);

      if (error) throw error;
      
      // Update local state
      bookings = bookings.map(b => b.id === id ? { ...b, estado: status } : b);
      if (selectedBooking && selectedBooking.id === id) {
        selectedBooking.estado = status;
      }
    } catch (e) {
      console.error('Error actualizando estado:', e);
    }
  }

  onMount(() => {
    const savedId = localStorage.getItem('admin_restaurant_id');
    if (savedId) restaurantId = savedId;
    fetchBookings();
  });

  $: selectedDate, fetchBookings();
</script>

<div class="grid grid-cols-1 md:grid-cols-3 gap-6 h-[800px]">
  <!-- Lista de reservas -->
  <div class="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-full overflow-hidden">
    <div class="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
      <h2 class="font-bold text-brand text-lg flex items-center gap-2">
        <CalendarDays class="w-5 h-5 text-gray-500"/>
        Reservas del día
      </h2>
      <input type="date" bind:value={selectedDate} class="border border-gray-300 rounded-md p-1.5 text-sm focus:ring-2 focus:ring-brand outline-none" />
    </div>

    <div class="flex-1 overflow-y-auto p-2">
      {#if loading}
        <div class="flex justify-center p-8 text-gray-400">Cargando reservas...</div>
      {:else if bookings.length === 0}
        <div class="flex justify-center p-8 text-gray-400">No hay reservas para esta fecha.</div>
      {:else}
        <div class="space-y-2">
          {#each bookings as booking}
            <button 
              class="w-full text-left p-4 rounded-lg border flex items-center justify-between transition-colors {selectedBooking?.id === booking.id ? 'border-brand bg-gray-50' : 'border-gray-100 hover:border-gray-300'}"
              on:click={() => selectedBooking = booking}
            >
              <div class="flex items-center gap-4">
                <div class="w-16 text-center font-semibold text-brand border-r border-gray-200 pr-4">
                  {booking.hora.substring(0,5)}
                </div>
                <div>
                  <div class="font-medium text-gray-900">{booking.client?.nombre || 'Sin nombre'}</div>
                  <div class="flex items-center text-xs text-gray-500 gap-3 mt-1">
                    <span class="flex items-center gap-1"><Users class="w-3 h-3"/> {booking.comensales} pax</span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold 
                      {booking.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' : 
                       booking.estado === 'reconfirmada' ? 'bg-blue-100 text-blue-700' : 
                       booking.estado === 'completada' ? 'bg-green-100 text-green-700' : 
                       'bg-red-100 text-red-700'}">
                      {booking.estado}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <MoreVertical class="w-5 h-5 text-gray-400" />
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Detalle / CRM -->
  <div class="bg-white rounded-xl shadow-sm border border-gray-100 h-full overflow-hidden flex flex-col">
    {#if selectedBooking}
      <div class="p-6 border-b border-gray-100 bg-gray-50">
        <h3 class="font-bold text-xl text-gray-900 mb-1">{selectedBooking.client?.nombre}</h3>
        <p class="text-sm text-gray-500">{selectedBooking.client?.telefono} • {selectedBooking.client?.email}</p>
      </div>
      
      <div class="p-6 flex-1 overflow-y-auto space-y-6">
        <div>
          <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Detalles Reserva</h4>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-gray-500 block mb-1">Hora</span>
              <span class="font-medium">{selectedBooking.hora.substring(0,5)}</span>
            </div>
            <div>
              <span class="text-gray-500 block mb-1">Personas</span>
              <span class="font-medium">{selectedBooking.comensales} pax</span>
            </div>
            <div>
              <span class="text-gray-500 block mb-1">Zona</span>
              <span class="font-medium">{selectedBooking.table?.zona || 'Sin asignar'}</span>
            </div>
            <div>
              <span class="text-gray-500 block mb-1">Origen</span>
              <span class="font-medium capitalize">{selectedBooking.origen}</span>
            </div>
          </div>
        </div>

        <div class="pt-4 border-t border-gray-100">
          <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">CRM Info</h4>
          {#if selectedBooking.client?.etiquetas_crm}
            <div class="flex flex-wrap gap-2 mb-3">
              {#each selectedBooking.client.etiquetas_crm as tag}
                <span class="bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded-md">{tag}</span>
              {/each}
            </div>
          {/if}
          <div class="text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
            <strong>Valoración Interna:</strong> {selectedBooking.client?.valoracion_interna || 5} / 5
          </div>
        </div>
      </div>

      <div class="p-4 border-t border-gray-100 bg-gray-50 flex flex-col gap-2">
        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Acciones</h4>
        <div class="grid grid-cols-2 gap-2">
          <button on:click={() => updateStatus(selectedBooking.id, 'reconfirmada')} class="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 rounded-lg font-medium transition">
            <CheckCircle class="w-4 h-4"/> Reconfirmar
          </button>
          <button on:click={() => updateStatus(selectedBooking.id, 'completada')} class="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm py-2 rounded-lg font-medium transition">
             Completar
          </button>
          <button on:click={() => updateStatus(selectedBooking.id, 'cancelada')} class="col-span-2 flex items-center justify-center gap-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 text-sm py-2 rounded-lg font-medium transition">
            <XCircle class="w-4 h-4"/> Cancelar Reserva
          </button>
        </div>
      </div>
    {:else}
      <div class="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
        <Users class="w-12 h-12 mb-4 text-gray-200" />
        <p>Selecciona una reserva para ver los detalles del cliente y gestionar su estado.</p>
      </div>
    {/if}
  </div>
</div>
