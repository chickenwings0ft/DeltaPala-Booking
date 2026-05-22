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
  let showImageModal = false;

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
    <div class="w-full md:w-5/12 bg-gray-900 text-white flex flex-col relative overflow-hidden">
      {#if event.imagen_url}
        <div class="relative h-48 w-full group overflow-hidden">
          <img src={event.imagen_url} alt={event.titulo} class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div class="absolute inset-0 bg-gray-900/20 group-hover:bg-gray-900/10 transition"></div>
          <button 
            on:click={() => showImageModal = true}
            class="absolute bottom-3 right-3 bg-black/60 hover:bg-black text-white text-xs font-bold px-3 py-1.5 rounded-lg backdrop-blur-sm transition flex items-center gap-1.5"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            Ver cartel
          </button>
        </div>
      {/if}
      <div class="p-8 flex-1 flex flex-col z-10 bg-gray-900">
        <div>
          <div class="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4" style="background-color: {event.color_evento}; color: white;">
            Evento Especial
          </div>
          <h2 class="text-3xl font-bold mb-4">{event.titulo}</h2>
          <p class="text-gray-300 text-sm mb-8 leading-relaxed">{event.descripcion}</p>
          
          <div class="space-y-4 font-medium bg-white/10 p-5 rounded-2xl border border-white/5">
            <div class="flex items-center gap-3">
              <CalendarDays class="w-5 h-5 text-gray-400"/>
              {new Date(event.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long'})}
            </div>
            <div class="flex items-center gap-3">
              <Clock class="w-5 h-5 text-gray-400"/>
              {event.hora.substring(0,5)}
            </div>
            <div class="flex items-center gap-3">
              <Users class="w-5 h-5 text-gray-400"/>
              {remaining} plazas libres
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
      {#if event.estado === 'borrador'}
        <div class="h-full flex flex-col items-center justify-center text-center py-12">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Clock class="w-8 h-8 text-gray-400" />
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-2">Evento próximamente</h3>
          <p class="text-gray-500 max-w-sm">Este evento aún no está disponible para la venta. Vuelve más tarde.</p>
        </div>
      {:else if event.estado === 'finalizado'}
        <div class="h-full flex flex-col items-center justify-center text-center py-12">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <CalendarDays class="w-8 h-8 text-gray-400" />
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-2">Evento Finalizado</h3>
          <p class="text-gray-500 max-w-sm">Este evento ya se ha celebrado. ¡Gracias a todos los asistentes!</p>
        </div>
      {:else if step === 1}
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
        <div class="text-center py-8 px-6 flex flex-col items-center">
          <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle class="w-10 h-10 text-green-600" />
          </div>
          <h2 class="text-3xl font-black text-gray-900 mb-2">¡Entradas confirmadas!</h2>
          <p class="text-gray-600 mb-6 max-w-md">Hemos enviado un email a <strong>{email}</strong> con los detalles de tu reserva.</p>
          
          <div class="w-full space-y-3 mb-8">
            <!-- Google Calendar -->
            <a 
              href="https://calendar.google.com/calendar/render?action=TEMPLATE&text={encodeURIComponent(event.titulo)}&dates={event.fecha.replace(/-/g, '')}T{event.hora.replace(/:/g, '')}00/{event.fecha.replace(/-/g, '')}T235900&details={encodeURIComponent('Entradas confirmadas para ' + pax + ' personas. ' + (event.descripcion || ''))}&location=Restaurante" 
              target="_blank" 
              class="w-full bg-white border border-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-50 transition flex items-center justify-center gap-2 shadow-sm"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.5 12.28c0-.79-.07-1.54-.19-2.28H12v4.3h6.44c-.28 1.4-1.04 2.58-2.18 3.34v2.77h3.52c2.06-1.9 3.25-4.69 3.25-8.13z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.52-2.77c-1.08.72-2.46 1.15-4.41 1.15-3.4 0-6.28-2.29-7.31-5.37H1.05v2.85C3.04 20.91 7.18 24 12 24z"/><path fill="#FBBC05" d="M4.69 14.1c-.26-.78-.41-1.61-.41-2.46s.15-1.68.41-2.46V6.33H1.05C.38 7.77 0 9.35 0 11.02s.38 3.25 1.05 4.69l3.64-2.85z"/><path fill="#EA4335" d="M12 4.93c1.76 0 3.34.61 4.59 1.79l3.43-3.43C17.95 1.25 15.24 0 12 0 7.18 0 3.04 3.09 1.05 7.04l3.64 2.85C5.72 7.22 8.6 4.93 12 4.93z"/></svg>
              Añadir a Google Calendar
            </a>

            <!-- Apple Calendar (ICS) -->
            <a 
              href="data:text/calendar;charset=utf8,BEGIN:VCALENDAR%0AVERSION:2.0%0ABEGIN:VEVENT%0ASUMMARY:{encodeURIComponent(event.titulo)}%0ADESCRIPTION:Entradas para {pax} personas.%0ADTSTART;VALUE=DATE:{event.fecha.replace(/-/g, '')}%0AEND:VEVENT%0AEND:VCALENDAR"
              download="{event.titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics"
              class="w-full bg-white border border-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-50 transition flex items-center justify-center gap-2 shadow-sm"
            >
              <CalendarDays class="w-5 h-5 text-red-500" />
              Añadir a Apple / Outlook
            </a>

            <!-- Apple Wallet (MVP Alert) -->
            <button 
              on:click={() => alert('¡El pase de Apple Wallet se descargará en producción cuando se conecten los certificados de Apple Developer! (MVP)')}
              class="w-full bg-black text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition flex items-center justify-center gap-2 shadow-sm"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-1-13h2v4h-2V7zm0 6h2v2h-2v-2z"/></svg>
              Añadir a Apple Wallet
            </button>
          </div>

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

  <!-- Modal Foto Expandida -->
  {#if showImageModal && event.imagen_url}
    <div class="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <button 
        on:click={() => showImageModal = false} 
        class="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition"
      >
        <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
      <img src={event.imagen_url} alt={event.titulo} class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
    </div>
  {/if}
{/if}
