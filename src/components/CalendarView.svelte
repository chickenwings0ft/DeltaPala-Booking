<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase';
  import { CalendarDays, ChevronLeft, ChevronRight, Settings, Loader2, Save, X } from 'lucide-svelte';

  export let restaurantId: string = '00000000-0000-0000-0000-000000000000';

  let currentDate = new Date();
  let loading = true;
  let processing = false;

  // Datos
  let maxDailyCapacity = 50; // Fallback
  let bookingsByDate: Record<string, number> = {};
  let diasEspeciales: Record<string, any> = {};
  let horariosHabituales: Record<string, any> = {};

  // Estado del Modal
  let selectedDate: string | null = null;
  let showModal = false;
  let specialDayConfig = { isOpen: true, note: '' };

  $: currentMonthStr = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

  // Calendario Helpers
  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year: number, month: number) {
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Ajuste para que Lunes sea 0
  }

  async function loadData() {
    loading = true;
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
      const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];

      // 1. Cargar Aforo Máximo Diario desde Turnos
      const { data: shifts } = await supabase.from('shifts').select('default_capacity').eq('restaurant_id', restaurantId);
      if (shifts && shifts.length > 0) {
        maxDailyCapacity = shifts.reduce((acc, curr) => acc + (curr.default_capacity || 0), 0);
      } else {
        maxDailyCapacity = 50; // Fallback seguro
      }

      // 2. Cargar Settings (Días especiales y horarios)
      const { data: settings } = await supabase.from('business_settings').select('dias_especiales, horarios_apertura').eq('restaurant_id', restaurantId).single();
      if (settings) {
        diasEspeciales = settings.dias_especiales || {};
        horariosHabituales = settings.horarios_apertura || {};
      }

      // 3. Cargar Reservas del mes
      const { data: bookings } = await supabase
        .from('bookings')
        .select('fecha, comensales')
        .eq('restaurant_id', restaurantId)
        .gte('fecha', firstDay)
        .lte('fecha', lastDay)
        .neq('estado', 'cancelada');

      // Agrupar pax por día
      let grouped: Record<string, number> = {};
      if (bookings) {
        bookings.forEach(b => {
          grouped[b.fecha] = (grouped[b.fecha] || 0) + b.comensales;
        });
      }
      bookingsByDate = grouped;

    } catch (err) {
      console.error('Error cargando calendario:', err);
    } finally {
      loading = false;
    }
  }

  function changeMonth(offset: number) {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    loadData();
  }

  function getDayColor(dateStr: string) {
    const pax = bookingsByDate[dateStr] || 0;
    
    // Verificar si está cerrado por configuración habitual o especial
    const dayOfWeek = new Date(dateStr).getDay().toString(); // 0 es Domingo
    let isOpen = false;

    if (diasEspeciales[dateStr]) {
      isOpen = diasEspeciales[dateStr].isOpen;
    } else if (horariosHabituales[dayOfWeek]) {
      isOpen = horariosHabituales[dayOfWeek].isOpen;
    }

    if (!isOpen) {
      return 'bg-gray-100 text-gray-400 border-gray-200 opacity-60'; // Cerrado
    }

    if (pax === 0) {
      return 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100'; // 0%
    } else if (pax >= maxDailyCapacity) {
      return 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100'; // 100%
    } else {
      return 'bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100'; // 1-99%
    }
  }

  function openSpecialDayModal(dateStr: string) {
    selectedDate = dateStr;
    if (diasEspeciales[dateStr]) {
      specialDayConfig = { ...diasEspeciales[dateStr] };
    } else {
      // Default a abierto si es que lo está activando
      specialDayConfig = { isOpen: true, note: 'Día especial activado' };
    }
    showModal = true;
  }

  async function saveSpecialDay() {
    if (!selectedDate) return;
    processing = true;

    try {
      const newEspeciales = { ...diasEspeciales, [selectedDate]: specialDayConfig };

      const { error } = await supabase
        .from('business_settings')
        .upsert({ 
          restaurant_id: restaurantId, 
          dias_especiales: newEspeciales 
        }, { onConflict: 'restaurant_id' });

      if (error) throw error;
      
      diasEspeciales = newEspeciales;
      showModal = false;
      loadData(); // Recargar colores
    } catch (err) {
      console.error('Error guardando día especial:', err);
      alert('Error al guardar la configuración.');
    } finally {
      processing = false;
    }
  }

  onMount(() => {
    const savedId = localStorage.getItem('admin_restaurant_id');
    if (savedId) restaurantId = savedId;
    loadData();
  });
</script>

<div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
  <!-- Header Calendario -->
  <div class="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center bg-gray-50 gap-4">
    <div class="flex items-center gap-2">
      <CalendarDays class="w-6 h-6 text-brand" />
      <h2 class="text-xl font-bold text-gray-900 capitalize">{currentMonthStr}</h2>
    </div>

    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2 text-xs font-medium text-gray-600 mr-4">
        <span class="w-3 h-3 rounded-full bg-green-400"></span> Libre
        <span class="w-3 h-3 rounded-full bg-yellow-400 ml-2"></span> Parcial
        <span class="w-3 h-3 rounded-full bg-red-400 ml-2"></span> Completo
      </div>
      <div class="flex gap-2">
        <button on:click={() => changeMonth(-1)} class="p-2 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition"><ChevronLeft class="w-5 h-5 text-gray-600" /></button>
        <button on:click={() => changeMonth(1)} class="p-2 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition"><ChevronRight class="w-5 h-5 text-gray-600" /></button>
      </div>
    </div>
  </div>

  <!-- Grid del mes -->
  <div class="p-6">
    {#if loading}
      <div class="flex justify-center py-20">
        <Loader2 class="w-10 h-10 animate-spin text-brand" />
      </div>
    {:else}
      <div class="grid grid-cols-7 gap-2 mb-2">
        {#each ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as day}
          <div class="text-center text-xs font-bold text-gray-400 uppercase">{day}</div>
        {/each}
      </div>
      
      <div class="grid grid-cols-7 gap-2">
        <!-- Espacios en blanco -->
        {#each Array(getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth())) as _}
          <div class="h-24 bg-transparent"></div>
        {/each}

        <!-- Días -->
        {#each Array(getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth())) as _, i}
          {@const day = i + 1}
          {@const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`}
          {@const colorClass = getDayColor(dateStr)}
          {@const isSpecial = diasEspeciales[dateStr] !== undefined}
          
          <button 
            on:click={() => openSpecialDayModal(dateStr)}
            class="h-24 rounded-lg border flex flex-col p-2 transition-all relative {colorClass}"
          >
            <span class="font-bold text-sm">{day}</span>
            
            {#if !colorClass.includes('opacity-60')}
              <div class="mt-auto text-xs font-medium">
                {bookingsByDate[dateStr] || 0} / {maxDailyCapacity} pax
              </div>
            {/if}

            {#if isSpecial}
              <div class="absolute top-1 right-1" title="Día Especial Configurado">
                <Settings class="w-3 h-3" />
              </div>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Modal Día Especial -->
{#if showModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
      <div class="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <h3 class="font-bold text-gray-900">Configurar Día Especial</h3>
        <button on:click={() => showModal = false} class="text-gray-400 hover:text-gray-600">
          <X class="w-5 h-5" />
        </button>
      </div>
      
      <div class="p-6 space-y-4">
        <div>
          <p class="text-sm text-gray-500 mb-4">
            Fecha seleccionada: <strong class="text-gray-800">{selectedDate}</strong>
          </p>
          <p class="text-xs text-gray-500 mb-4 bg-blue-50 p-3 rounded text-blue-800">
            Utiliza esto para abrir reservas en un día que habitualmente está cerrado, o para forzar el cierre de un día abierto (ej. Festivo o Evento Privado).
          </p>
        </div>

        <div class="flex items-center gap-3">
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" bind:checked={specialDayConfig.isOpen} class="sr-only peer">
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
          </label>
          <span class="font-medium text-gray-700">Aceptar reservas este día</span>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1 mt-4">Nota Interna (Opcional)</label>
          <input type="text" bind:value={specialDayConfig.note} placeholder="Ej. Evento privado, Festivo especial..." class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand outline-none" />
        </div>
      </div>

      <div class="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
        <button on:click={() => showModal = false} class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium">Cancelar</button>
        <button on:click={saveSpecialDay} disabled={processing} class="flex items-center gap-2 bg-brand text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-hover transition disabled:opacity-50">
          {#if processing}
            <Loader2 class="w-4 h-4 animate-spin" />
          {:else}
            <Save class="w-4 h-4" /> Guardar
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
