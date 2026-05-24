<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '../lib/supabase';
  import { ChevronLeft, ChevronRight, CalendarDays, Loader2 } from 'lucide-svelte';

  export let restaurantId: string = '11111111-1111-1111-1111-111111111111';

  let bookings: any[] = [];
  let tables: any[] = [];
  let loading = true;
  let subscription: any;

  const today = new Date();
  let selectedDate = localDateStr(today);

  // ── Timeline config (Compacted to 30-min intervals) ──────────────────────
  const START_HOUR = 9;
  const END_HOUR = 23;
  const SLOT_MINUTES = 30; // 30-minute intervals
  const SLOT_WIDTH = 60; // 60px per 30-min slot (120px per hour, highly compressed and readable)

  const slots: string[] = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    }
  }

  // ── Current time line ─────────────────────────────────────────────────────
  let currentTimeLeft = 0;
  let showCurrentTime = false;
  let clockInterval: any;

  function updateCurrentTimeLine() {
    const now = new Date();
    showCurrentTime = localDateStr(now) === selectedDate;
    const mins = (now.getHours() - START_HOUR) * 60 + now.getMinutes();
    currentTimeLeft = mins * (SLOT_WIDTH / SLOT_MINUTES);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function localDateStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function formatDateLabel(dateStr: string) {
    const [y, mo, da] = dateStr.split('-').map(Number);
    return new Date(y, mo-1, da).toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  function changeDay(delta: number) {
    const [y, mo, da] = selectedDate.split('-').map(Number);
    selectedDate = localDateStr(new Date(y, mo-1, da+delta));
  }

  function timeToMins(t: string) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  function getBlockStyle(b: any): string {
    const startMins = timeToMins(b.hora.substring(0, 5));
    // Default duration to 90 minutes if not specified
    const endMins   = b.end_time ? timeToMins(b.end_time.substring(0, 5)) : startMins + 90;
    const left  = (startMins - START_HOUR * 60) * (SLOT_WIDTH / SLOT_MINUTES);
    const width = Math.max((endMins - startMins) * (SLOT_WIDTH / SLOT_MINUTES) - 3, 20);
    return `left:${left}px; width:${width}px;`;
  }

  function statusStyle(estado: string) {
    const map: Record<string, string> = {
      pendiente:    'bg-yellow-100 border-yellow-400 text-yellow-800',
      confirmada:   'bg-brand/10 border-brand text-brand',
      reconfirmada: 'bg-blue-100 border-blue-400 text-blue-800',
      completada:   'bg-green-100 border-green-400 text-green-800',
      cancelada:    'bg-red-50 border-red-300 text-red-400 opacity-50',
    };
    return map[estado] || 'bg-gray-100 border-gray-300 text-gray-600';
  }

  function statusBadge(estado: string) {
    const map: Record<string, string> = {
      pendiente:    'bg-yellow-100 text-yellow-700',
      confirmada:   'bg-brand/10 text-brand',
      reconfirmada: 'bg-blue-100 text-blue-700',
      completada:   'bg-green-100 text-green-700',
      cancelada:    'bg-red-100 text-red-500',
    };
    return map[estado] || 'bg-gray-100 text-gray-600';
  }

  function statusIcon(estado: string) {
    return { pendiente: '⏳', confirmada: '✓', reconfirmada: '✓✓', completada: '★', cancelada: '✗' }[estado] || '?';
  }

  function bookingsForTable(tableId: string | null) {
    return tableId
      ? bookings.filter(b => b.table_id === tableId)
      : bookings.filter(b => !b.table_id);
  }

  // ── Metrics ───────────────────────────────────────────────────────────────
  $: gridWidth   = slots.length * SLOT_WIDTH;
  $: totalActive = bookings.filter(b => b.estado !== 'cancelada').length;
  $: totalPax    = bookings.filter(b => b.estado !== 'cancelada').reduce((s, b) => s + b.comensales, 0);
  $: pendientes  = bookings.filter(b => b.estado === 'pendiente').length;
  $: isToday     = selectedDate === localDateStr(today);

  // ── Data fetch ────────────────────────────────────────────────────────────
  async function fetchData() {
    loading = true;
    try {
      const rid = restaurantId;
      console.log('Planner fetching data for rid:', rid, 'date:', selectedDate);
      const [bRes, tRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('*, client:client_id(nombre, telefono, email), table:table_id(zona, nombre)')
          .eq('restaurant_id', rid)
          .eq('fecha', selectedDate)
          .order('hora', { ascending: true }),
        supabase
          .from('tables')
          .select('id, zona, nombre, capacidad_min, capacidad_max')
          .eq('restaurant_id', rid)
          .order('zona')
      ]);
      bookings = bRes.data || [];
      tables   = tRes.data || [];
      console.log('Planner bookings loaded:', bookings.length, 'tables:', tables.length);
    } catch(e) { console.error('Planner fetch error:', e); }
    finally   { loading = false; }
  }

  // Reactive block depends on selectedDate and restaurantId to handle Mount updates properly
  $: if (selectedDate && restaurantId) { 
    fetchData(); 
    updateCurrentTimeLine(); 
  }

  onMount(() => {
    const sid = localStorage.getItem('admin_restaurant_id');
    if (sid) {
      restaurantId = sid;
    } else {
      restaurantId = '11111111-1111-1111-1111-111111111111';
      localStorage.setItem('admin_restaurant_id', restaurantId);
    }
    
    updateCurrentTimeLine();
    clockInterval = setInterval(updateCurrentTimeLine, 30_000);
    
    subscription = supabase
      .channel('planner')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchData)
      .subscribe();
  });

  onDestroy(() => {
    clearInterval(clockInterval);
    if (subscription) subscription.unsubscribe();
  });

  let hoveredBooking: any = null;
</script>

<!-- ════════════════════════════════════════════════════════════════════════ -->
<!-- PLANIFICADOR — tema admin (blanco, gris, brand)                         -->
<!-- ════════════════════════════════════════════════════════════════════════ -->
<div class="flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-full">

  <!-- ─── HEADER ─── -->
  <div class="p-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">

    <!-- Navegación de fecha -->
    <div class="flex items-center gap-2">
      <button on:click={() => changeDay(-1)}
        class="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 transition text-gray-500">
        <ChevronLeft class="w-4 h-4" />
      </button>

      <h2 class="font-bold text-gray-900 capitalize text-base min-w-[220px] text-center">
        {formatDateLabel(selectedDate)}
        {#if isToday}
          <span class="ml-2 inline-block text-[10px] bg-brand text-white px-2 py-0.5 rounded-full font-bold uppercase">Hoy</span>
        {/if}
      </h2>

      <button on:click={() => changeDay(1)}
        class="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 transition text-gray-500">
        <ChevronRight class="w-4 h-4" />
      </button>

      {#if !isToday}
        <button on:click={() => selectedDate = localDateStr(today)}
          title="Ir a hoy"
          class="p-1.5 rounded-lg border border-brand/30 bg-brand/5 hover:bg-brand/10 transition text-brand">
          <CalendarDays class="w-4 h-4" />
        </button>
      {/if}
    </div>

    <!-- Métricas rápidas + leyenda -->
    <div class="flex items-center gap-3 flex-wrap">
      {#if loading}
        <Loader2 class="w-4 h-4 animate-spin text-gray-400" />
      {:else}
        <span class="text-sm text-gray-500 flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-brand inline-block"></span>
          <strong class="text-gray-900">{totalActive}</strong> reservas
        </span>
        <span class="text-sm text-gray-500 flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-purple-400 inline-block"></span>
          <strong class="text-gray-900">{totalPax}</strong> pax
        </span>
        {#if pendientes > 0}
          <span class="text-xs font-bold bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full">
            ⏳ {pendientes} pendiente{pendientes > 1 ? 's' : ''}
          </span>
        {/if}
      {/if}
    </div>
  </div>

  <!-- ─── LEYENDA ─── -->
  <div class="flex items-center gap-4 px-4 py-2 border-b border-gray-100 text-[11px] text-gray-500 shrink-0 bg-white flex-wrap">
    <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded border border-yellow-400 bg-yellow-100 inline-block"></span>Pendiente</span>
    <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded border border-brand bg-brand/10 inline-block"></span>Confirmada</span>
    <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded border border-blue-400 bg-blue-100 inline-block"></span>Reconfirmada</span>
    <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded border border-green-400 bg-green-100 inline-block"></span>Completada</span>
    <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded border border-red-300 bg-red-50 inline-block opacity-60"></span>Cancelada</span>
  </div>

  <!-- ─── GRID ─── -->
  <div class="flex-1 overflow-auto relative">
    {#if loading && bookings.length === 0 && tables.length === 0}
      <div class="flex justify-center items-center h-48 text-gray-400">
        <Loader2 class="w-6 h-6 animate-spin mr-2" /> Cargando...
      </div>
    {:else}
      <div class="flex">

        <!-- Columna izquierda sticky -->
        <div class="shrink-0 w-32 border-r border-gray-100 bg-white sticky left-0 z-20">
          <!-- Cabecera -->
          <div class="h-9 border-b border-gray-100 flex items-center px-3 bg-gray-50">
            <span class="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Mesa</span>
          </div>

          <!-- Sin mesa asignada -->
          {#if bookings.some(b => !b.table_id)}
            <div class="h-14 border-b border-gray-100 flex flex-col justify-center px-3 bg-gray-50/60">
              <span class="text-xs font-semibold text-gray-600">Sin mesa</span>
              <span class="text-[10px] text-gray-400">No asignada</span>
            </div>
          {/if}

          <!-- Mesas -->
          {#each tables as table, i}
            <div class="h-14 border-b border-gray-100 flex flex-col justify-center px-3 {i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}">
              <span class="text-xs font-semibold text-gray-700 truncate">{table.nombre || `Mesa ${table.id.slice(0,4)}`}</span>
              {#if table.capacidad_min !== undefined && table.capacidad_max !== undefined}
                <span class="text-[10px] text-gray-400">{table.capacidad_min}–{table.capacidad_max} pax</span>
              {:else if table.capacidad !== undefined}
                <span class="text-[10px] text-gray-400">{table.capacidad} pax</span>
              {/if}
            </div>
          {/each}

          {#if tables.length === 0 && !bookings.some(b => !b.table_id)}
            <div class="h-14 flex items-center px-3">
              <span class="text-[10px] text-gray-400 italic">Sin mesas</span>
            </div>
          {/if}
        </div>

        <!-- Zona scrollable -->
        <div class="overflow-x-auto flex-1">
          <div style="width:{gridWidth}px; min-width:{gridWidth}px;" class="relative">

            <!-- Cabecera de horas -->
            <div class="flex h-9 border-b border-gray-100 bg-gray-50 sticky top-0 z-10">
              {#each slots as slot, i}
                {@const isHour = slot.endsWith(':00')}
                <div
                  style="width:{SLOT_WIDTH}px; min-width:{SLOT_WIDTH}px;"
                  class="border-r {isHour ? 'border-gray-200' : 'border-gray-100/50'} flex items-end pb-1.5 shrink-0"
                >
                  <span class="text-[9px] {isHour ? 'text-gray-500 font-bold' : 'text-gray-400'} pl-1">
                    {slot}
                  </span>
                </div>
              {/each}
            </div>

            <!-- Filas + línea de tiempo -->
            <div class="relative">

              <!-- Línea hora actual -->
              {#if showCurrentTime && currentTimeLeft > 0 && currentTimeLeft < gridWidth}
                <div class="absolute top-0 bottom-0 z-30 pointer-events-none"
                     style="left:{currentTimeLeft}px; width:2px; background: var(--color-brand, #004aad);">
                  <div class="w-3 h-3 rounded-full -translate-x-[5px] -translate-y-1 shadow-sm animate-pulse"
                       style="background: var(--color-brand, #004aad);"></div>
                </div>
              {/if}

              <!-- Fila Sin Mesa -->
              {#if bookings.some(b => !b.table_id)}
                <div class="h-14 border-b border-gray-100 relative bg-gray-50/60">
                  {#each slots as slot, i}
                    <div class="absolute top-0 h-full border-r {slot.endsWith(':00') ? 'border-gray-200' : 'border-gray-100/50'}"
                         style="left:{i * SLOT_WIDTH}px; width:{SLOT_WIDTH}px;"></div>
                  {/each}
                  {#each bookingsForTable(null) as booking}
                    <button
                      class="absolute top-1.5 bottom-1.5 rounded border-l-2 px-1.5 text-left flex flex-col justify-center overflow-hidden transition-all hover:shadow-sm hover:brightness-95 cursor-pointer {statusStyle(booking.estado)}"
                      style={getBlockStyle(booking)}
                      on:mouseenter={() => hoveredBooking = booking}
                      on:mouseleave={() => hoveredBooking = null}
                    >
                      <span class="text-[10px] font-bold truncate">{statusIcon(booking.estado)} {booking.client?.nombre?.split(' ')[0] || '?'}</span>
                      <span class="text-[9px] opacity-70 truncate">{booking.comensales}p · {booking.hora.substring(0,5)}</span>
                    </button>
                  {/each}
                </div>
              {/if}

              <!-- Filas de mesas -->
              {#each tables as table, rowIdx}
                <div class="h-14 border-b border-gray-100 relative {rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}">
                  <!-- Columnas verticales de fondo -->
                  {#each slots as slot, i}
                    <div class="absolute top-0 h-full border-r {slot.endsWith(':00') ? 'border-gray-200' : 'border-gray-100/50'}"
                         style="left:{i * SLOT_WIDTH}px; width:{SLOT_WIDTH}px;"></div>
                  {/each}

                  <!-- Bloques de reservas -->
                  {#each bookingsForTable(table.id) as booking}
                    <button
                      class="absolute top-1.5 bottom-1.5 rounded border-l-2 px-1.5 text-left flex flex-col justify-center overflow-hidden transition-all hover:shadow-md hover:z-10 hover:brightness-95 cursor-pointer {statusStyle(booking.estado)}"
                      style={getBlockStyle(booking)}
                      on:mouseenter={() => hoveredBooking = booking}
                      on:mouseleave={() => hoveredBooking = null}
                    >
                      <span class="text-[10px] font-bold truncate">{statusIcon(booking.estado)} {booking.client?.nombre?.split(' ')[0] || '?'}</span>
                      <span class="text-[9px] opacity-60 truncate">{booking.comensales}p · {booking.hora.substring(0,5)}</span>
                    </button>
                  {/each}

                  {#if bookingsForTable(table.id).length === 0}
                    <div class="absolute inset-y-0 left-2 flex items-center pointer-events-none">
                      <span class="text-[9px] text-gray-300 italic">sin reservas</span>
                    </div>
                  {/if}
                </div>
              {/each}

              <!-- Empty state -->
              {#if tables.length === 0 && !bookings.some(b => !b.table_id)}
                <div class="h-40 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
                  <CalendarDays class="w-8 h-8 text-gray-200" />
                  <p>No hay mesas configuradas.</p>
                </div>
              {/if}

            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- ─── TOOLTIP ─── -->
  {#if hoveredBooking}
    <div class="border-t border-gray-100 bg-gray-50 px-5 py-3 flex items-center gap-6 text-sm shrink-0">
      <div>
        <p class="font-bold text-gray-900">{hoveredBooking.client?.nombre || 'Sin nombre'}</p>
        <p class="text-xs text-gray-500">{hoveredBooking.client?.telefono || '—'}</p>
      </div>
      <div>
        <p class="text-[10px] text-gray-400 uppercase tracking-wider">Hora</p>
        <p class="font-semibold text-gray-800">{hoveredBooking.hora?.substring(0,5)}</p>
      </div>
      <div>
        <p class="text-[10px] text-gray-400 uppercase tracking-wider">Pax</p>
        <p class="font-semibold text-gray-800">{hoveredBooking.comensales}</p>
      </div>
      <div>
        <p class="text-[10px] text-gray-400 uppercase tracking-wider">Estado</p>
        <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase {statusBadge(hoveredBooking.estado)}">
          {hoveredBooking.estado}
        </span>
      </div>
      {#if hoveredBooking.client?.email}
        <div class="ml-auto">
          <p class="text-[10px] text-gray-400 uppercase tracking-wider">Email</p>
          <p class="text-xs text-gray-600">{hoveredBooking.client.email}</p>
        </div>
      {/if}
    </div>
  {/if}

</div>
