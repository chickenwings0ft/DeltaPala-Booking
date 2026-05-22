<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { supabase } from '../lib/supabase';
  import { Users, Calendar as CalendarIcon, Clock, ArrowRight, User, Phone, Mail, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-svelte';

  export let restaurantId: string = '00000000-0000-0000-0000-000000000000';

  let step = 1; // 1: Pax & Date, 2: Time, 3: Contact, 4: Success, 5: Waitlist
  
  // Settings
  let diasEspeciales: Record<string, any> = {};
  let horariosHabituales: Record<string, any> = {};
  let formPlaceholder: string = '¿Alguna alergia o petición especial? (Opcional)';
  
  // State
  let pax = 2;
  let selectedDate: string = '';
  let selectedTime: string = '';
  
  // Time Slots
  let timeSlots: { hora: string; disponible: boolean; shiftName: string; duration: number }[] = [];
  let checkingAvailability = false;
  let isWaitlist = false;
  let selectedShiftDuration = 90;

  // Contact Info
  let nombre = '';
  let telefono = '';
  let email = '';
  let alergenos = '';
  let isSubmitting = false;
  let errorMsg = '';
  
  let currentWaitlistId: string | null = null;
  let isCancellingWaitlist = false;

  async function cancelWaitlist() {
    if (!currentWaitlistId) return;
    isCancellingWaitlist = true;
    try {
      await supabase.from('waitlist').delete().eq('id', currentWaitlistId);
      step = 1;
      nombre = ''; email = ''; telefono = ''; alergenos = ''; selectedDate = ''; selectedTime = '';
      currentWaitlistId = null;
    } catch (e) {
      console.error('Error canceling waitlist', e);
    } finally {
      isCancellingWaitlist = false;
    }
  }

  // Calendar State
  let calDate = new Date();
  
  // Obtener fecha de hoy en zona horaria local, no UTC
  const today = new Date();
  let todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

  $: currentMonthStr = calDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  $: calendarDays = generateCalendar(calDate);

  onMount(async () => {
    // Leer ID de restaurante desde la URL (ej: ?id=11111111...)
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('id');
    if (idFromUrl) restaurantId = idFromUrl;

    // Load Settings
    try {
      const { data: settings } = await supabase.from('business_settings').select('dias_especiales, horarios_apertura, configuracion_formulario').eq('restaurant_id', restaurantId).single();
      if (settings) {
        diasEspeciales = settings.dias_especiales || {};
        horariosHabituales = settings.horarios_apertura || {};
        if (settings.configuracion_formulario && settings.configuracion_formulario.mensaje_peticiones) {
          formPlaceholder = settings.configuracion_formulario.mensaje_peticiones;
        }
      }
    } catch (e) {
      console.error('Error load settings', e);
    }
  });

  function generateCalendar(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; // Lunes = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let days = [];
    for (let i = 0; i < adjustedFirstDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  }

  function changeMonth(offset: number) {
    calDate = new Date(calDate.getFullYear(), calDate.getMonth() + offset, 1);
  }

  function isDateSelectable(d: Date | null) {
    if (!d) return false;
    const dStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    if (dStr < todayStr) return false; // Pasado

    const dayOfWeek = d.getDay().toString();
    let isOpen = false;

    if (diasEspeciales[dStr]) {
      isOpen = diasEspeciales[dStr].isOpen;
    } else if (horariosHabituales[dayOfWeek]) {
      isOpen = horariosHabituales[dayOfWeek].isOpen;
    } else {
      isOpen = true; // Por defecto si no hay config
    }

    return isOpen;
  }

  function selectDate(d: Date | null) {
    if (!d || !isDateSelectable(d)) return;
    selectedDate = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    selectedTime = '';
    isWaitlist = false;
  }

  // Función auxiliar para generar rangos de 30 minutos
  function generateTimeSlots(openStr: string, closeStr: string) {
    const slots = [];
    let current = new Date(`1970-01-01T${openStr}:00`);
    const end = new Date(`1970-01-01T${closeStr}:00`);
    
    while (current < end) {
      const h = current.getHours().toString().padStart(2, '0');
      const m = current.getMinutes().toString().padStart(2, '0');
      slots.push(`${h}:${m}`);
      current.setMinutes(current.getMinutes() + 30);
    }
    return slots;
  }

  async function checkAvailability() {
    if (!selectedDate || !pax) return;
    
    checkingAvailability = true;
    step = 2; // Move to Time step
    timeSlots = [];

    try {
      // 1. Obtener los turnos (shifts) del restaurante
      const { data: shiftData, error: shiftError } = await supabase
        .from('shifts')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('start_time');
      
      if (shiftError) throw shiftError;

      if (!shiftData || shiftData.length === 0) {
        timeSlots = [];
        checkingAvailability = false;
        return;
      }

      // 2. Generar slots por turno y verificar disponibilidad en paralelo
      const promises: Promise<{ hora: string, disponible: boolean, shiftName: string, duration: number }>[] = [];

      for (const shift of shiftData) {
        const slots = generateTimeSlots(shift.start_time.slice(0,5), shift.end_time.slice(0,5));
        
        for (const hora of slots) {
           promises.push(
             supabase.rpc('check_availability', {
               p_restaurant_id: restaurantId,
               p_fecha: selectedDate,
               p_hora: hora + ':00',
               p_pax: pax,
               p_duration_minutes: shift.duration_minutes
             }).then(({ data, error }) => {
               if (error) console.error(error);
               return { 
                 hora, 
                 disponible: data === true, 
                 shiftName: shift.name,
                 duration: shift.duration_minutes 
               };
             })
           );
        }
      }
      
      timeSlots = await Promise.all(promises);

    } catch (err) {
      console.error('Error fetching availability:', err);
      timeSlots = [];
    } finally {
      checkingAvailability = false;
    }
  }

  function calculateEndTime(start: string, duration: number) {
     const d = new Date(`1970-01-01T${start}:00`);
     d.setMinutes(d.getMinutes() + duration);
     return d.toTimeString().slice(0, 5);
  }

  async function handleBooking() {
    isSubmitting = true;
    errorMsg = '';
    try {
      let clientId;
      // 1. Upsert Client
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('email', email)
        .single();
      
      if (clientError && clientError.code !== 'PGRST116') throw clientError;
      
      if (clientData) {
        clientId = clientData.id;
        await supabase.from('clients').update({ nombre, telefono, etiquetas_crm: alergenos ? [alergenos] : [] }).eq('id', clientId);
      } else {
        const { data: newClient, error: insertError } = await supabase
          .from('clients')
          .insert([{ nombre, email, telefono, etiquetas_crm: alergenos ? [alergenos] : [] }])
          .select()
          .single();
        if (insertError) throw insertError;
        clientId = newClient.id;
      }

      if (isWaitlist) {
        // 2a. Crear Lista de Espera
        const { data: waitlistData, error: waitlistError } = await supabase
          .from('waitlist')
          .insert([{
            restaurant_id: restaurantId,
            client_id: clientId,
            fecha: selectedDate,
            comensales: pax,
            flexibilidad_horaria: { nota: alergenos }
          }])
          .select()
          .single();
        if (waitlistError) throw waitlistError;
        if (waitlistData) currentWaitlistId = waitlistData.id;
        step = 5; // Mostrar success waitlist
      } else {
        // 2b. Crear Reserva
        const { error: bookingError } = await supabase
          .from('bookings')
          .insert([{
            restaurant_id: restaurantId,
            client_id: clientId,
            fecha: selectedDate,
            hora: selectedTime,
            end_time: calculateEndTime(selectedTime, selectedShiftDuration),
            comensales: pax,
            estado: 'pendiente'
          }]);

        if (bookingError) throw bookingError;
        step = 4; // Éxito
      }
    } catch (err) {
      console.error(err);
      errorMsg = 'Hubo un error al procesar tu reserva. Inténtalo de nuevo.';
      step = 5; // Waitlist/Error fallback
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="max-w-md mx-auto w-full bg-white shadow-xl rounded-2xl overflow-hidden flex flex-col font-sans transition-all duration-300">
  <div class="pt-6 px-6 pb-6">
    <!-- Paso 1: Comensales y Fecha -->
    {#if step === 1}
      <div in:fade={{ duration: 200 }}>
        <h2 class="text-xl font-extrabold text-gray-900 text-center mb-6">Reserva tu mesa</h2>
        
        <!-- Selector Fecha (Custom Calendar) -->
        <div class="mb-6">
          <label class="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
            <CalendarIcon class="w-4 h-4 text-brand" /> Fecha
          </label>
          <div class="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div class="flex justify-between items-center mb-4">
              <button on:click={() => changeMonth(-1)} class="p-1 hover:bg-gray-200 rounded-full transition"><ChevronLeft class="w-5 h-5 text-gray-600"/></button>
              <span class="font-bold text-gray-800 capitalize">{currentMonthStr}</span>
              <button on:click={() => changeMonth(1)} class="p-1 hover:bg-gray-200 rounded-full transition"><ChevronRight class="w-5 h-5 text-gray-600"/></button>
            </div>
            
            <div class="grid grid-cols-7 gap-1 text-center mb-2">
              {#each ['L','M','X','J','V','S','D'] as day}
                <div class="text-xs font-bold text-gray-400">{day}</div>
              {/each}
            </div>
            <div class="grid grid-cols-7 gap-1">
              {#each calendarDays as d}
                {#if d}
                  {@const isSelectable = isDateSelectable(d)}
                  {@const dLocalStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`}
                  {@const isSelected = selectedDate === dLocalStr}
                  <button 
                    on:click={() => selectDate(d)}
                    disabled={!isSelectable}
                    class="h-10 w-full rounded-lg font-medium text-sm flex items-center justify-center transition-all {isSelected ? 'bg-brand text-white shadow-md' : isSelectable ? 'text-gray-700 hover:bg-gray-200 bg-white' : 'text-gray-300 cursor-not-allowed'}"
                  >
                    {d.getDate()}
                  </button>
                {:else}
                  <div class="h-10"></div>
                {/if}
              {/each}
            </div>
          </div>
        </div>

        <!-- Selector Pax -->
        <div class="mb-6">
          <label class="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
            <Users class="w-4 h-4 text-brand" /> Comensales
          </label>
          <div class="relative">
            <select bind:value={pax} class="w-full h-12 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 text-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none appearance-none transition-all cursor-pointer">
              {#each [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as num}
                <option value={num}>{num} {num === 1 ? 'persona' : 'personas'}</option>
              {/each}
            </select>
            <div class="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>

        <button 
          on:click={checkAvailability}
          disabled={!selectedDate || !pax}
          class="w-full h-14 bg-brand text-white rounded-xl font-bold text-lg hover:bg-brand-hover transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-brand/30"
        >
          Ver Disponibilidad <ArrowRight class="w-5 h-5" />
        </button>
      </div>
    {/if}

    <!-- Paso 2: Horarios -->
    {#if step === 2}
      <div in:fade={{ duration: 200 }}>
        <button on:click={() => step = 1} class="text-gray-500 text-sm hover:text-gray-800 mb-4 flex items-center gap-1">
          <ChevronLeft class="w-4 h-4"/> Volver
        </button>

        <div class="mb-4 text-center">
          <p class="text-gray-500 text-sm">Disponibilidad para el</p>
          <h3 class="text-lg font-bold text-gray-900">{selectedDate} <span class="text-brand font-medium">({pax} pax)</span></h3>
        </div>

        {#if checkingAvailability}
          <div class="grid grid-cols-3 gap-3 py-6">
            {#each Array(6) as _}
              <div class="h-12 bg-gray-200 rounded-xl animate-pulse"></div>
            {/each}
          </div>
          <p class="text-center text-sm text-gray-400">Comprobando aforo...</p>
        {:else if timeSlots.length === 0}
          <div class="text-center py-8">
            <AlertCircle class="w-12 h-12 text-yellow-500 mx-auto mb-3" />
            <p class="font-bold text-gray-800">No hay turnos configurados</p>
            <button on:click={() => { isWaitlist = true; step = 3; }} class="mt-4 w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition">Apúntate a la lista de espera</button>
          </div>
        {:else}
          <div class="space-y-6 mb-6">
            {#each Array.from(new Set(timeSlots.map(s => s.shiftName))) as shiftName}
              <div>
                <h4 class="text-sm font-bold text-gray-700 mb-3 border-b border-gray-100 pb-2">{shiftName}</h4>
                <div class="grid grid-cols-3 gap-3">
                  {#each timeSlots.filter(s => s.shiftName === shiftName) as slot}
                    <button 
                      on:click={() => { selectedTime = slot.hora; selectedShiftDuration = slot.duration; step = 3; }}
                      disabled={!slot.disponible}
                      class="h-12 rounded-xl font-bold text-sm transition-all border-2 {slot.disponible ? 'border-brand/20 bg-white text-gray-800 hover:border-brand hover:text-brand shadow-sm' : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'}"
                    >
                      {slot.hora}
                    </button>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
          
          {#if !timeSlots.some(s => s.disponible)}
            <div class="mt-2 text-center">
              <p class="text-red-500 font-bold mb-3 text-sm">No quedan mesas para este día</p>
              <button on:click={() => { isWaitlist = true; step = 3; }} class="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-lg">Apúntate a la lista de espera</button>
            </div>
          {/if}
        {/if}
      </div>
    {/if}

    <!-- Paso 3: Contacto -->
    {#if step === 3}
      <div in:slide={{ duration: 300 }}>
        <div class="flex justify-between items-center mb-6">
          <button on:click={() => step = 2} class="text-gray-500 text-sm hover:text-gray-800 flex items-center gap-1">
            <ChevronLeft class="w-4 h-4"/> Atrás
          </button>
          <div class="text-xs bg-brand/10 text-brand px-3 py-1 rounded-full font-bold">
            {selectedDate} {selectedTime ? `a las ${selectedTime}` : ''}
          </div>
        </div>

        <h2 class="text-xl font-extrabold text-gray-900 mb-4">{isWaitlist ? 'Lista de Espera' : 'Tus Datos'}</h2>

        <form on:submit|preventDefault={handleBooking} class="space-y-4">
          <div class="relative">
            <User class="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
            <input type="text" bind:value={nombre} placeholder="Nombre completo" required class="w-full pl-12 pr-4 h-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent outline-none bg-gray-50 font-medium transition" />
          </div>
          
          <div class="relative">
            <Phone class="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
            <input type="tel" bind:value={telefono} placeholder="Teléfono (ej. +34...)" required class="w-full pl-12 pr-4 h-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent outline-none bg-gray-50 font-medium transition" />
          </div>

          <div class="relative">
            <Mail class="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
            <input type="email" bind:value={email} placeholder="Email para la confirmación" required class="w-full pl-12 pr-4 h-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent outline-none bg-gray-50 font-medium transition" />
          </div>

          <div class="pt-2">
            <textarea bind:value={alergenos} placeholder={formPlaceholder} class="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent outline-none bg-gray-50 text-sm transition resize-none h-24"></textarea>
          </div>

          <button 
            type="submit"
            disabled={isSubmitting || !nombre || !telefono || !email}
            class="w-full h-14 mt-4 bg-brand text-white rounded-xl font-bold text-lg hover:bg-brand-hover transition flex items-center justify-center gap-2 shadow-lg shadow-brand/30 disabled:opacity-50"
          >
            {#if isSubmitting}
              <Loader2 class="w-5 h-5 animate-spin" /> Procesando...
            {:else}
              {isWaitlist ? 'Apuntarme a la lista' : 'Confirmar Reserva'}
            {/if}
          </button>
        </form>
      </div>
    {/if}

    <!-- Paso 4: Éxito -->
    {#if step === 4}
      <div in:fade class="text-center py-6">
        <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 class="w-10 h-10 text-green-600" />
        </div>
        <h2 class="text-2xl font-extrabold text-gray-900 mb-2">¡Reserva Confirmada!</h2>
        <p class="text-gray-500 mb-6 text-sm">
          Te esperamos el <strong>{selectedDate}</strong> a las <strong>{selectedTime}</strong>.<br>
          Hemos enviado los detalles a tu email.
        </p>
        
        <div class="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
          <div class="flex justify-between items-center text-sm border-b border-gray-200 pb-2 mb-2">
            <span class="text-gray-500">Nombre</span>
            <span class="font-bold text-gray-800">{nombre}</span>
          </div>
          <div class="flex justify-between items-center text-sm border-b border-gray-200 pb-2 mb-2">
            <span class="text-gray-500">Comensales</span>
            <span class="font-bold text-gray-800">{pax} pax</span>
          </div>
          <div class="flex justify-between items-center text-sm">
            <span class="text-gray-500">Código</span>
            <span class="font-bold text-brand uppercase">{Math.random().toString(36).substr(2, 6)}</span>
          </div>
        </div>

        <button on:click={() => { step = 1; nombre = ''; email = ''; telefono = ''; alergenos = ''; selectedDate = ''; selectedTime = ''; }} class="text-brand font-bold text-sm hover:underline">
          Hacer otra reserva
        </button>
      </div>
    {/if}

    <!-- Paso 5: Fallback / Lista de Espera -->
    {#if step === 5}
      <div in:fade class="py-6">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock class="w-8 h-8 text-yellow-600" />
          </div>
          <h2 class="text-2xl font-extrabold text-gray-900 mb-2">Te has apuntado a la lista de espera</h2>
        </div>

        <p class="text-gray-900 mb-2 text-sm font-bold">¿Cómo funciona?</p>
        <p class="text-gray-600 mb-6 text-sm leading-relaxed">
          Si otra mesa cancela o no confirma su asistencia en las próximas horas (algo que ocurre habitualmente), el sistema nos avisará. En ese mismo instante te llamaremos directamente por teléfono o te enviaremos un WhatsApp para ofrecerte el hueco.
        </p>

        <div class="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
          <p class="text-gray-600 text-sm leading-relaxed">
            Si tus planes cambian y prefieres cancelar tu solicitud, por favor haz clic aquí:
          </p>
          <button on:click={cancelWaitlist} disabled={isCancellingWaitlist} class="mt-4 w-full h-11 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {#if isCancellingWaitlist}
              <Loader2 class="w-4 h-4 animate-spin" /> Cancelando...
            {:else}
              Cancelar solicitud
            {/if}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
