<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '../lib/supabase';
  import { CalendarDays, Users, Clock, MoreVertical, Search, CheckCircle, XCircle } from 'lucide-svelte';

  export let restaurantId: string = 'rest-id-placeholder';

  let bookings: any[] = [];
  let loading = true;
  let selectedDate = new Date().toISOString().split('T')[0];
  let selectedBooking: any = null;
  let subscription: any;

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
      
      // Update selected booking reference if it exists
      if (selectedBooking) {
        const updatedSelected = bookings.find(b => b.id === selectedBooking.id);
        if (updatedSelected) selectedBooking = updatedSelected;
      }
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
      
      // Local state is updated via Realtime anyway, but we can keep optimistic UI
    } catch (e) {
      console.error('Error actualizando estado:', e);
    }
  }

  onMount(() => {
    const savedId = localStorage.getItem('admin_restaurant_id');
    if (savedId) restaurantId = savedId;
    fetchBookings();

    // Suscripción en tiempo real a cambios en reservas
    subscription = supabase
      .channel('dashboard-bookings')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'bookings',
        filter: `restaurant_id=eq.${restaurantId}` 
      }, () => {
        // Al recibir cualquier cambio de este restaurante, recargamos
        fetchBookings();
      })
      .subscribe();
  });

  onDestroy(() => {
    if (subscription) {
      supabase.removeChannel(subscription);
    }
  });

  // Modal de Nueva Reserva Manual
  let showNewBookingModal = false;
  let newBooking = {
    nombre: '',
    telefono: '',
    email: '',
    hora: '14:00',
    comensales: 2,
    duration: 90
  };
  let savingBooking = false;

  async function createManualBooking() {
    if (!newBooking.nombre || !newBooking.telefono) {
      alert("Nombre y teléfono son obligatorios");
      return;
    }
    savingBooking = true;
    try {
      // 1. Upsert Client (using phone or email as key is complex, we'll try email if exists, else just insert)
      let clientId;
      if (newBooking.email) {
        const { data: clientData } = await supabase.from('clients').select('id').eq('email', newBooking.email).single();
        if (clientData) {
          clientId = clientData.id;
          await supabase.from('clients').update({ nombre: newBooking.nombre, telefono: newBooking.telefono }).eq('id', clientId);
        }
      }
      
      if (!clientId) {
        const { data: newClient, error: clientErr } = await supabase.from('clients')
          .insert([{ nombre: newBooking.nombre, telefono: newBooking.telefono, email: newBooking.email || null }])
          .select().single();
        if (clientErr) throw clientErr;
        clientId = newClient.id;
      }

      // Calculate end time
      const d = new Date(`1970-01-01T${newBooking.hora}:00`);
      d.setMinutes(d.getMinutes() + newBooking.duration);
      const endTime = d.toTimeString().slice(0, 5);

      // 2. Insert Booking
      const { error: bookingErr } = await supabase.from('bookings').insert([{
        restaurant_id: restaurantId,
        client_id: clientId,
        fecha: selectedDate,
        hora: newBooking.hora,
        end_time: endTime,
        comensales: newBooking.comensales,
        estado: 'reconfirmada', // Admin manual booking is usually confirmed
        origen: 'telefono'
      }]);

      if (bookingErr) throw bookingErr;
      
      showNewBookingModal = false;
      newBooking = { nombre: '', telefono: '', email: '', hora: '14:00', comensales: 2, duration: 90 };
      fetchBookings(); // Refresh

    } catch (err) {
      console.error(err);
      alert("Error al crear la reserva");
    } finally {
      savingBooking = false;
    }
  }

  $: selectedDate, fetchBookings();
</script>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-[800px] pb-10">
  <!-- Lista de reservas -->
  <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[500px] lg:h-full overflow-hidden">
    <div class="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50">
      <h2 class="font-bold text-brand text-lg flex items-center gap-2 shrink-0">
        <CalendarDays class="w-5 h-5 text-gray-500"/>
        Reservas del día
      </h2>
      <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
        <input type="date" bind:value={selectedDate} class="border border-gray-300 rounded-md p-1.5 text-sm focus:ring-2 focus:ring-brand outline-none flex-grow sm:flex-grow-0" />
        <button on:click={() => showNewBookingModal = true} class="bg-brand text-white px-3 py-1.5 text-sm rounded-lg font-bold hover:bg-brand-hover transition flex items-center justify-center gap-2 flex-grow sm:flex-grow-0">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Nueva Reserva
        </button>
      </div>
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
  <div class="bg-white rounded-xl shadow-sm border border-gray-100 h-auto lg:h-full overflow-hidden flex flex-col min-h-[400px]">
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
          {#if selectedBooking.client?.etiquetas_crm && selectedBooking.client.etiquetas_crm.length > 0}
            <div class="flex flex-col gap-2 mb-4">
              {#each selectedBooking.client.etiquetas_crm as tag}
                <div class="bg-indigo-50 text-indigo-800 text-sm px-3 py-2 rounded-lg border border-indigo-100 whitespace-pre-wrap leading-relaxed">
                  {tag}
                </div>
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
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button on:click={() => updateStatus(selectedBooking.id, 'reconfirmada')} class="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2.5 rounded-lg font-medium transition">
            <CheckCircle class="w-4 h-4 shrink-0"/> Reconfirmar
          </button>
          <button on:click={() => updateStatus(selectedBooking.id, 'completada')} class="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm py-2.5 rounded-lg font-medium transition">
            <CheckCircle class="w-4 h-4 shrink-0"/> Completar
          </button>
          <button on:click={() => updateStatus(selectedBooking.id, 'cancelada')} class="sm:col-span-2 flex items-center justify-center gap-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 text-sm py-2.5 rounded-lg font-medium transition">
            <XCircle class="w-4 h-4 shrink-0"/> Cancelar Reserva
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

<!-- Modal Nueva Reserva -->
{#if showNewBookingModal}
  <div class="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
      <div class="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
        <h3 class="font-bold text-lg text-gray-900">Nueva Reserva (Admin)</h3>
        <button on:click={() => showNewBookingModal = false} class="text-gray-400 hover:text-gray-700 transition">
          <XCircle class="w-6 h-6" />
        </button>
      </div>
      <div class="p-6 space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-1">Hora</label>
            <input type="time" bind:value={newBooking.hora} class="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-1">Comensales</label>
            <input type="number" min="1" bind:value={newBooking.comensales} class="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand" />
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-bold text-gray-700 mb-1">Nombre Cliente <span class="text-red-500">*</span></label>
          <input type="text" bind:value={newBooking.nombre} class="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand" placeholder="Ej. Juan Pérez" />
        </div>
        
        <div>
          <label class="block text-sm font-bold text-gray-700 mb-1">Teléfono <span class="text-red-500">*</span></label>
          <input type="tel" bind:value={newBooking.telefono} class="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand" placeholder="600 123 456" />
        </div>
        
        <div>
          <label class="block text-sm font-bold text-gray-700 mb-1">Email (Opcional)</label>
          <input type="email" bind:value={newBooking.email} class="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand" placeholder="juan@email.com" />
        </div>

        <div>
          <label class="block text-sm font-bold text-gray-700 mb-1">Duración (minutos)</label>
          <input type="number" step="15" bind:value={newBooking.duration} class="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand" />
        </div>
      </div>
      <div class="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
        <button on:click={() => showNewBookingModal = false} class="flex-1 bg-white border border-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-50 transition">Cancelar</button>
        <button on:click={createManualBooking} disabled={savingBooking || !newBooking.nombre || !newBooking.telefono} class="flex-1 bg-brand text-white font-bold py-3 rounded-xl hover:bg-brand-hover transition disabled:opacity-50 flex items-center justify-center gap-2">
          {#if savingBooking}
            <Loader2 class="w-5 h-5 animate-spin" /> Guardando...
          {:else}
            Guardar Reserva
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
