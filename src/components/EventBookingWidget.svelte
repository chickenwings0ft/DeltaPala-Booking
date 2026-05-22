<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase';
  import { CalendarDays, Clock, Users, CreditCard, CheckCircle, Loader2 } from 'lucide-svelte';

  export let eventId: string;
  export let eventData: any = null;

  let step = 1;
  let loading = !eventData;
  let event: any = eventData;
  
  // Form fields
  let pax = 2;
  let nombre = '';
  let email = '';
  let telefono = '';

  let processing = false;
  let soldOut = false;
  let remaining = 0;
  let errorMsg = '';

  async function loadEvent() {
    if (!eventId) return;
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`*, event_bookings(comensales)`)
        .eq('id', eventId)
        .single();
      
      if (error) throw error;
      
      const booked = data.event_bookings.reduce((sum: number, b: any) => sum + b.comensales, 0);
      remaining = data.capacidad_maxima - booked;
      soldOut = remaining <= 0;
      
      event = data;
    } catch (e) {
      console.error(e);
      errorMsg = 'No se ha podido cargar el evento o ya no existe.';
    } finally {
      loading = false;
    }
  }

  $: total = pax * (event?.precio_persona || 0);

  async function handlePayment() {
    if (!nombre || !email || !telefono) {
      errorMsg = "Por favor, completa todos tus datos personales.";
      return;
    }
    if (pax > remaining) {
      errorMsg = `Lo sentimos, solo quedan ${remaining} plazas disponibles.`;
      return;
    }
    
    errorMsg = '';
    processing = true;

    // Simulate Stripe Payment for MVP
    try {
      // In a real app, you would create a Stripe Checkout Session here 
      // and redirect to Stripe. For this MVP, we simulate a direct success.
      
      // Fake delay for realism
      await new Promise(r => setTimeout(r, 2000));

      const { error } = await supabase.from('event_bookings').insert([{
        event_id: event.id,
        nombre_cliente: nombre,
        email_cliente: email,
        telefono,
        comensales: pax,
        total_pago: total,
        estado_pago: 'pagado',
        stripe_payment_id: 'sim_pay_' + Date.now()
      }]);

      if (error) throw error;

      step = 2; // Success screen

    } catch (err) {
      console.error(err);
      errorMsg = "Ha ocurrido un error al procesar la compra.";
    } finally {
      processing = false;
    }
  }

  onMount(() => {
    if (!eventData) loadEvent();
    else {
      const booked = eventData.event_bookings?.reduce((sum: number, b: any) => sum + b.comensales, 0) || 0;
      remaining = eventData.capacidad_maxima - booked;
      soldOut = remaining <= 0;
    }
  });
</script>

{#if loading}
  <div class="flex justify-center p-12"><Loader2 class="w-10 h-10 animate-spin text-brand"/></div>
{:else if !event}
  <div class="text-center p-12 text-gray-500 font-bold bg-white rounded-2xl shadow-xl">{errorMsg}</div>
{:else}
  <div class="bg-white shadow-2xl rounded-2xl overflow-hidden max-w-4xl mx-auto flex flex-col md:flex-row">
    <!-- Image & Details Side -->
    <div class="w-full md:w-5/12 bg-gray-900 text-white relative">
      {#if event.imagen_url}
        <div class="absolute inset-0 opacity-40">
          <img src={event.imagen_url} alt={event.titulo} class="w-full h-full object-cover" />
        </div>
      {/if}
      <div class="relative p-8 h-full flex flex-col z-10 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent">
        <div class="mt-auto">
          <div class="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4" style="background-color: {event.color_evento}; color: white;">
            Evento Especial
          </div>
          <h2 class="text-3xl font-bold mb-4">{event.titulo}</h2>
          <p class="text-gray-300 text-sm mb-6 line-clamp-3">{event.descripcion}</p>
          
          <div class="space-y-3 font-medium">
            <div class="flex items-center gap-3">
              <CalendarDays class="w-5 h-5 text-gray-400"/>
              {new Date(event.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long'})}
            </div>
            <div class="flex items-center gap-3">
              <Clock class="w-5 h-5 text-gray-400"/>
              {event.hora.substring(0,5)}
            </div>
            <div class="flex items-center gap-3">
              <CreditCard class="w-5 h-5 text-gray-400"/>
              {event.precio_persona}€ / persona
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Booking Form Side -->
    <div class="w-full md:w-7/12 p-8">
      {#if step === 1}
        <h3 class="text-xl font-bold text-gray-900 mb-6">Reserva tu entrada</h3>
        
        {#if soldOut}
          <div class="bg-red-50 text-red-700 p-6 rounded-xl border border-red-200 text-center">
            <h4 class="font-bold text-lg mb-2">¡Entradas Agotadas!</h4>
            <p>Lo sentimos, este evento ya ha alcanzado su capacidad máxima.</p>
          </div>
        {:else}
          <div class="space-y-5">
            <div>
              <label class="block text-sm font-bold text-gray-700 mb-2">Número de entradas</label>
              <div class="flex items-center gap-4">
                <button type="button" on:click={() => pax = Math.max(1, pax - 1)} class="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition">-</button>
                <span class="text-xl font-bold w-8 text-center">{pax}</span>
                <button type="button" on:click={() => pax = Math.min(remaining, pax + 1)} class="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition">+</button>
                {#if remaining <= 10}
                  <span class="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-md ml-auto">¡Solo quedan {remaining}!</span>
                {/if}
              </div>
            </div>

            <hr class="border-gray-100" />

            <div>
              <label class="block text-sm font-bold text-gray-700 mb-2">Tus Datos</label>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" bind:value={nombre} placeholder="Nombre completo" class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand" />
                <input type="tel" bind:value={telefono} placeholder="Teléfono" class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand" />
                <input type="email" bind:value={email} placeholder="Correo electrónico" class="w-full md:col-span-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand" />
              </div>
            </div>

            {#if errorMsg}
              <div class="text-red-500 text-sm font-bold bg-red-50 p-3 rounded-lg">{errorMsg}</div>
            {/if}

            <div class="bg-gray-50 rounded-xl p-6 border border-gray-200 mt-6">
              <div class="flex justify-between items-center mb-4">
                <span class="text-gray-600 font-medium">Total a pagar</span>
                <span class="text-2xl font-black text-gray-900">{total}€</span>
              </div>
              <button 
                on:click={handlePayment} 
                disabled={processing || soldOut} 
                class="w-full bg-brand text-white font-bold py-4 rounded-xl hover:bg-brand-hover transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
              >
                {#if processing}
                  <Loader2 class="w-5 h-5 animate-spin" /> Procesando pago...
                {:else}
                  Pagar y Confirmar
                {/if}
              </button>
              <p class="text-center text-xs text-gray-400 mt-3 flex items-center justify-center gap-1">
                Pago 100% seguro simulado (MVP)
              </p>
            </div>
          </div>
        {/if}
      {:else}
        <div class="text-center py-12 px-6 flex flex-col items-center">
          <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle class="w-10 h-10 text-green-600" />
          </div>
          <h2 class="text-3xl font-black text-gray-900 mb-4">¡Entradas confirmadas!</h2>
          <p class="text-gray-600 mb-8 max-w-md">Hemos enviado un email a <strong>{email}</strong> con los detalles de tu reserva para el evento <strong>{event.titulo}</strong>.</p>
          <div class="bg-gray-50 p-6 rounded-2xl w-full border border-gray-200 text-left">
            <h4 class="font-bold text-sm uppercase text-gray-400 mb-4">Resumen</h4>
            <div class="space-y-3">
              <div class="flex justify-between"><span class="text-gray-600">Nombre</span><span class="font-bold text-gray-900">{nombre}</span></div>
              <div class="flex justify-between"><span class="text-gray-600">Entradas</span><span class="font-bold text-gray-900">{pax} pax</span></div>
              <div class="flex justify-between"><span class="text-gray-600">Total pagado</span><span class="font-bold text-green-600">{total}€</span></div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
