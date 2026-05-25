<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '../lib/supabase';
  import { CalendarDays, Users, Clock, MoreVertical, Search, CheckCircle, XCircle, Loader2 } from 'lucide-svelte';
  import BookingEditDrawer from './BookingEditDrawer.svelte';

  let drawerBooking: any = null;

  export let restaurantId: string = 'rest-id-placeholder';

  let bookings: any[] = [];
  let loading = true;
  
  const today = new Date();
  let selectedDate = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  
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
      alert('No se pudo actualizar el estado.');
    }
  }

  onMount(() => {
    // Get restaurant_id from localStorage if not provided or placeholder
    if (restaurantId === 'rest-id-placeholder' || restaurantId === '00000000-0000-0000-0000-000000000000') {
      const savedId = localStorage.getItem('admin_restaurant_id');
      if (savedId) {
        restaurantId = savedId;
      }
    }

    if (restaurantId && restaurantId !== 'rest-id-placeholder') {
      fetchBookings();
    }

    // Subscribe to realtime changes on bookings table
    subscription = supabase
      .channel('admin-dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchBookings();
      })
      .subscribe();
      
    // Listen for storage events (restaurant switcher)
    window.addEventListener('storage', (e) => {
      if (e.key === 'admin_restaurant_id' && e.newValue) {
        restaurantId = e.newValue;
        fetchBookings();
      }
    });
  });

  onDestroy(() => {
    if (subscription) subscription.unsubscribe();
  });

  // Modal / New Booking
  let showNewBookingModal = false;
  let savingBooking = false;
  let newBooking = {
    hora: '14:00',
    comensales: 2,
    nombre: '',
    telefono: '',
    email: '',
    duration: 90
  };

  async function createManualBooking() {
    if (!newBooking.nombre || !newBooking.telefono) {
      alert("Por favor rellena los datos del cliente");
      return;
    }

    savingBooking = true;
    try {
      // 1. Create client first
      const { data: clientData, error: clientErr } = await supabase
        .from('clients')
        .insert({
          nombre: newBooking.nombre,
          telefono: newBooking.telefono,
          email: newBooking.email || null
        })
        .select()
        .single();

      if (clientErr) throw clientErr;

      // Calculate end time
      const [h, m] = newBooking.hora.split(':').map(Number);
      const totalMins = h * 60 + m + newBooking.duration;
      const eh = String(Math.floor(totalMins / 60) % 24).padStart(2, '0');
      const em = String(totalMins % 60).padStart(2, '0');
      const endTime = `${eh}:${em}:00`;

      // 2. Create booking
      const { error: bookingErr } = await supabase
        .from('bookings')
        .insert({
          restaurant_id: restaurantId,
          client_id: clientData.id,
          fecha: selectedDate,
          hora: newBooking.hora + ':00',
          end_time: endTime,
          comensales: newBooking.comensales,
          estado: 'confirmada', // Auto-confirmed when created by admin
          origen: 'telefono' // Default to phone for internal
        });

      if (bookingErr) throw bookingErr;

      showNewBookingModal = false;
      // Reset form
      newBooking = {
        hora: '14:00',
        comensales: 2,
        nombre: '',
        telefono: '',
        email: '',
        duration: 90
      };
      
      fetchBookings();
    } catch (err) {
      console.error(err);
      alert("Error al crear la reserva");
    } finally {
      savingBooking = false;
    }
  }

  $: if (selectedDate && restaurantId && restaurantId !== 'rest-id-placeholder') {
    fetchBookings();
  }
</script>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-[800px] pb-10">
  <!-- Lista de reservas -->
  <div class="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col h-[500px] lg:h-full overflow-hidden transition-all duration-300">
    <div class="p-4 border-b border-gray-100 dark:border-slate-700/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50 dark:bg-slate-900/50 transition-colors duration-300">
      <h2 class="font-bold text-brand dark:text-slate-200 text-lg flex items-center gap-2 shrink-0">
        <CalendarDays class="w-5 h-5 text-gray-500 dark:text-slate-400"/>
        Reservas del día
      </h2>
      <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
        <input type="date" bind:value={selectedDate} class="border border-gray-300 dark:border-slate-600 rounded-md p-1.5 text-sm focus:ring-2 focus:ring-brand bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 outline-none flex-grow sm:flex-grow-0" />
        <button on:click={() => showNewBookingModal = true} class="bg-brand text-white px-3 py-1.5 text-sm rounded-lg font-bold hover:bg-brand-hover transition flex items-center justify-center gap-2 flex-grow sm:flex-grow-0">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Nueva Reserva
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-2">
      {#if loading}
        <div class="flex justify-center p-8 text-gray-400 dark:text-slate-500">Cargando reservas...</div>
      {:else if bookings.length === 0}
        <div class="flex justify-center p-8 text-gray-400 dark:text-slate-500">No hay reservas para esta fecha.</div>
      {:else}
        <div class="space-y-2">
          {#each bookings as booking}
            <div
              role="button"
              tabindex="0"
              class="w-full text-left p-4 rounded-lg border flex items-center justify-between transition-all cursor-pointer {selectedBooking?.id === booking.id ? 'border-brand bg-brand/5 dark:bg-slate-900/60 dark:border-brand/60 shadow-sm' : 'border-gray-100 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'}"
              on:click={() => selectedBooking = booking}
              on:keydown={(e) => e.key === 'Enter' && (selectedBooking = booking)}
            >
              <div class="flex items-center gap-4 flex-1 min-w-0">
                <div class="w-16 text-center font-semibold text-brand dark:text-slate-200 border-r border-gray-200 dark:border-slate-700 pr-4 shrink-0">
                  {booking.hora.substring(0,5)}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-gray-900 dark:text-slate-100 truncate">{booking.client?.nombre || 'Sin nombre'}</div>
                  <div class="flex items-center text-xs text-gray-500 dark:text-slate-400 gap-3 mt-1">
                    <span class="flex items-center gap-1"><Users class="w-3 h-3"/> {booking.comensales} pax</span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold 
                      {booking.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' : 
                       booking.estado === 'reconfirmada' ? 'bg-blue-100 text-blue-700' : 
                       booking.estado === 'completada' ? 'bg-green-100 text-green-700' : 
                       booking.estado === 'confirmada' ? 'bg-brand/10 text-brand' :
                       'bg-red-100 text-red-700'}">
                      {booking.estado}
                    </span>
                  </div>
                </div>
              </div>
              <button
                on:click|stopPropagation={() => drawerBooking = booking}
                class="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition shrink-0 ml-2 text-gray-500 dark:text-slate-400"
                title="Editar reserva"
              >
                <MoreVertical class="w-5 h-5 text-gray-400 dark:text-slate-500" />
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Detalle / CRM -->
  <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 h-auto lg:h-full overflow-hidden flex flex-col min-h-[400px] transition-all duration-300">
    {#if selectedBooking}
      <div class="p-6 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 transition-colors duration-300">
        <h3 class="font-bold text-xl text-gray-900 dark:text-slate-100 mb-1">{selectedBooking.client?.nombre}</h3>
        <p class="text-sm text-gray-500 dark:text-slate-400">{selectedBooking.client?.telefono} • {selectedBooking.client?.email || 'sin email'}</p>
      </div>
      
      <div class="p-6 flex-1 overflow-y-auto space-y-6 text-gray-800 dark:text-slate-200">
        <div>
          <h4 class="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">Detalles Reserva</h4>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-gray-500 dark:text-slate-400 block mb-1">Hora</span>
              <span class="font-medium text-gray-900 dark:text-slate-200">{selectedBooking.hora.substring(0,5)}</span>
            </div>
            <div>
              <span class="text-gray-500 dark:text-slate-400 block mb-1">Personas</span>
              <span class="font-medium text-gray-900 dark:text-slate-200">{selectedBooking.comensales} pax</span>
            </div>
            <div>
              <span class="text-gray-500 dark:text-slate-400 block mb-1">Zona</span>
              <span class="font-medium text-gray-900 dark:text-slate-200">{selectedBooking.table?.zona || 'Sin asignar'}</span>
            </div>
            <div>
              <span class="text-gray-500 dark:text-slate-400 block mb-1">Origen</span>
              <span class="font-medium capitalize text-gray-900 dark:text-slate-200">{selectedBooking.origen}</span>
            </div>
          </div>
        </div>

        <div class="pt-4 border-t border-gray-100 dark:border-slate-700">
          <h4 class="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">CRM Info</h4>
          {#if selectedBooking.client?.etiquetas_crm && selectedBooking.client.etiquetas_crm.length > 0}
            <div class="flex flex-col gap-2 mb-4">
              {#each selectedBooking.client.etiquetas_crm as tag}
                <div class="bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300 text-sm px-3 py-2 rounded-lg border border-indigo-100 dark:border-indigo-900/60 whitespace-pre-wrap leading-relaxed">
                  {tag}
                </div>
              {/each}
            </div>
          {/if}
          <div class="text-sm text-gray-600 dark:text-slate-300 bg-yellow-50 dark:bg-yellow-950/30 p-3 rounded-lg border border-yellow-100 dark:border-yellow-900/60">
            <strong>Valoración Interna:</strong> {selectedBooking.client?.valoracion_interna || 5} / 5
          </div>
        </div>
      </div>

      <div class="p-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex flex-col gap-2 transition-colors duration-300">
        <h4 class="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">Acciones</h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {#if selectedBooking.estado === 'pendiente'}
            <button on:click={() => updateStatus(selectedBooking.id, 'confirmada')} class="flex items-center justify-center gap-2 bg-brand hover:bg-brand-hover text-white text-sm py-2.5 rounded-lg font-medium transition">
              <CheckCircle class="w-4 h-4 shrink-0"/> Confirmar Reserva
            </button>
          {:else}
            <button on:click={() => updateStatus(selectedBooking.id, 'reconfirmada')} class="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2.5 rounded-lg font-medium transition">
              <CheckCircle class="w-4 h-4 shrink-0"/> Reconfirmar
            </button>
          {/if}
          <button on:click={() => updateStatus(selectedBooking.id, 'completada')} class="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm py-2.5 rounded-lg font-medium transition">
            <CheckCircle class="w-4 h-4 shrink-0"/> Completar
          </button>
          <button on:click={() => updateStatus(selectedBooking.id, 'cancelada')} class="sm:col-span-2 flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 text-sm py-2.5 rounded-lg font-medium transition">
            <XCircle class="w-4 h-4 shrink-0"/> Cancelar Reserva
          </button>
        </div>
      </div>
    {:else}
      <div class="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-slate-500 p-8 text-center">
        <Users class="w-12 h-12 mb-4 text-gray-200 dark:text-slate-700" />
        <p>Selecciona una reserva para ver los detalles del cliente y gestionar su estado.</p>
      </div>
    {/if}
  </div>
</div>

<!-- Modal Nueva Reserva -->
{#if showNewBookingModal}
  <div class="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border dark:border-slate-700 transition-all duration-300">
      <div class="flex justify-between items-center p-6 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
        <h3 class="font-bold text-lg text-gray-900 dark:text-slate-100">Nueva Reserva (Admin)</h3>
        <button on:click={() => showNewBookingModal = false} class="text-gray-400 hover:text-gray-700 dark:hover:text-slate-300 transition">
          <XCircle class="w-6 h-6" />
        </button>
      </div>
      <div class="p-6 space-y-4 text-gray-800 dark:text-slate-200">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Hora</label>
            <input type="time" bind:value={newBooking.hora} class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand text-gray-900 dark:text-slate-100" />
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Comensales</label>
            <input type="number" min="1" bind:value={newBooking.comensales} class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand text-gray-900 dark:text-slate-100" />
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Nombre Cliente <span class="text-red-500">*</span></label>
          <input type="text" bind:value={newBooking.nombre} class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand text-gray-900 dark:text-slate-100" placeholder="Ej. Juan Pérez" />
        </div>
        
        <div>
          <label class="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Teléfono <span class="text-red-500">*</span></label>
          <input type="tel" bind:value={newBooking.telefono} class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand text-gray-900 dark:text-slate-100" placeholder="600 123 456" />
        </div>
        
        <div>
          <label class="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Email (Opcional)</label>
          <input type="email" bind:value={newBooking.email} class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand text-gray-900 dark:text-slate-100" placeholder="juan@email.com" />
        </div>

        <div>
          <label class="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Duración (minutos)</label>
          <input type="number" step="15" bind:value={newBooking.duration} class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand text-gray-900 dark:text-slate-100" />
        </div>
      </div>
      <div class="p-6 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex gap-3">
        <button on:click={() => showNewBookingModal = false} class="flex-1 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 font-bold py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-650 transition">Cancelar</button>
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

<!-- Drawer de edición de reserva -->
{#if drawerBooking}
  <BookingEditDrawer
    booking={drawerBooking}
    restaurantId={restaurantId}
    onClose={() => drawerBooking = null}
    onSaved={() => { fetchBookings(); }}
  />
{/if}
