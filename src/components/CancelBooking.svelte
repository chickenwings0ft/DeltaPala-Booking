<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase';
  import { AlertCircle, CalendarX2, CheckCircle2, Loader2, ArrowLeft } from 'lucide-svelte';

  export let bookingId: string = '';

  let loading = true;
  let cancelling = false;
  let status: 'loading' | 'confirm' | 'success' | 'error' | 'not_found' | 'already_cancelled' = 'loading';
  let bookingDetails: any = null;
  let errorMessage = '';

  onMount(async () => {
    if (!bookingId) {
      status = 'error';
      loading = false;
      return;
    }

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          client:client_id ( nombre, email ),
          restaurant:restaurant_id ( id )
        `)
        .eq('id', bookingId)
        .single();

      if (error || !data) {
        status = 'not_found';
        return;
      }

      bookingDetails = data;

      if (data.estado === 'cancelada') {
        status = 'already_cancelled';
      } else {
        status = 'confirm';
      }
    } catch (err) {
      console.error(err);
      status = 'error';
    } finally {
      loading = false;
    }
  });

  async function cancelBooking() {
    cancelling = true;
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ estado: 'cancelada' })
        .eq('id', bookingId);

      if (error) throw error;
      
      status = 'success';
    } catch (err: any) {
      console.error(err);
      errorMessage = err.message || 'Error al cancelar la reserva.';
      status = 'error';
    } finally {
      cancelling = false;
    }
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('es-ES', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    }).format(date);
  }
</script>

<div class="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 text-center max-w-md w-full mx-auto">
  {#if loading}
    <div class="py-12 flex flex-col items-center justify-center space-y-4">
      <Loader2 class="w-10 h-10 animate-spin text-brand" />
      <p class="text-gray-500 font-medium">Buscando tu reserva...</p>
    </div>
  
  {:else if status === 'not_found'}
    <div class="py-8 flex flex-col items-center justify-center space-y-4">
      <div class="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-2">
        <AlertCircle class="w-8 h-8" />
      </div>
      <h2 class="text-2xl font-bold text-gray-900">Reserva no encontrada</h2>
      <p class="text-gray-500 text-center">El enlace parece ser incorrecto o la reserva ya no existe en el sistema.</p>
    </div>

  {:else if status === 'already_cancelled'}
    <div class="py-8 flex flex-col items-center justify-center space-y-4">
      <div class="w-16 h-16 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center mb-2">
        <CheckCircle2 class="w-8 h-8" />
      </div>
      <h2 class="text-2xl font-bold text-gray-900">Reserva ya cancelada</h2>
      <p class="text-gray-500 text-center">No te preocupes, esta reserva ya figuraba como cancelada en nuestro sistema.</p>
    </div>

  {:else if status === 'confirm' && bookingDetails}
    <div class="py-4 flex flex-col items-center justify-center space-y-6">
      <div class="w-16 h-16 bg-brand/10 text-brand rounded-full flex items-center justify-center mb-2">
        <CalendarX2 class="w-8 h-8" />
      </div>
      
      <div>
        <h2 class="text-2xl font-bold text-gray-900 mb-2">Cancelar Reserva</h2>
        <p class="text-gray-500">¿Estás seguro de que deseas cancelar esta reserva?</p>
      </div>

      <div class="bg-gray-50 rounded-xl p-5 w-full text-left space-y-3 border border-gray-100">
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-500">A nombre de:</span>
          <span class="text-sm font-bold text-gray-900">{bookingDetails.client?.nombre}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-500">Fecha:</span>
          <span class="text-sm font-bold text-gray-900 capitalize">{formatDate(bookingDetails.fecha)}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-500">Hora:</span>
          <span class="text-sm font-bold text-gray-900">{bookingDetails.hora}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-500">Comensales:</span>
          <span class="text-sm font-bold text-gray-900">{bookingDetails.comensales} personas</span>
        </div>
      </div>

      <div class="w-full space-y-3 pt-4">
        <button 
          on:click={cancelBooking}
          disabled={cancelling}
          class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-sm flex justify-center items-center gap-2 disabled:opacity-70"
        >
          {#if cancelling}
            <Loader2 class="w-5 h-5 animate-spin" /> Cancelando...
          {:else}
            Sí, cancelar mi reserva
          {/if}
        </button>
        <p class="text-xs text-gray-400">Esta acción no se puede deshacer.</p>
      </div>
    </div>

  {:else if status === 'success'}
    <div class="py-8 flex flex-col items-center justify-center space-y-4">
      <div class="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-4">
        <CheckCircle2 class="w-10 h-10" />
      </div>
      <h2 class="text-2xl font-bold text-gray-900">Reserva cancelada</h2>
      <p class="text-gray-500 text-center">Tu reserva ha sido cancelada correctamente. Hemos avisado al restaurante.</p>
      <p class="text-sm text-gray-400 mt-4">Esperamos poder atenderte en otra ocasión.</p>
    </div>

  {:else if status === 'error'}
    <div class="py-8 flex flex-col items-center justify-center space-y-4">
      <div class="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-2">
        <AlertCircle class="w-8 h-8" />
      </div>
      <h2 class="text-2xl font-bold text-gray-900">Ocurrió un error</h2>
      <p class="text-gray-500 text-center">{errorMessage || 'No pudimos procesar tu solicitud. Por favor contacta con el restaurante.'}</p>
    </div>
  {/if}
</div>
