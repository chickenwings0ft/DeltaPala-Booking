<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '../lib/supabase';
  import { ChevronLeft, ChevronRight, CalendarDays, Loader2 } from 'lucide-svelte';

  export let restaurantId: string = '00000000-0000-0000-0000-000000000000';

  // ── Estado ────────────────────────────────────────────────────────────────
  let bookings: any[] = [];
  let tables: any[] = [];
  let loading = true;
  let subscription: any;

  const today = new Date();
  let selectedDate = localDateStr(today);

  // ── Configuración de la línea de tiempo ───────────────────────────────────
  // Horas de apertura: 9:00 → 23:00, en intervalos de 15 min
  const START_HOUR = 9;
  const END_HOUR = 23;
  const SLOT_MINUTES = 15;
  const SLOT_WIDTH = 48; // px por slot de 15min

  const slots: string[] = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    }
  }

  // ── Línea de tiempo actual ─────────────────────────────────────────────────
  let currentTimeLeft = 0;
  let showCurrentTime = false;
  let clockInterval: any;

  function updateCurrentTimeLine() {
    const now = new Date();
    const nowDateStr = localDateStr(now);
    showCurrentTime = nowDateStr === selectedDate;

    const minutesSinceStart = (now.getHours() - START_HOUR) * 60 + now.getMinutes();
    const slotWidthPerMin = SLOT_WIDTH / SLOT_MINUTES;
    currentTimeLeft = minutesSinceStart * slotWidthPerMin;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function localDateStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function formatDateLabel(dateStr: string) {
    const [y, mo, da] = dateStr.split('-').map(Number);
    const d = new Date(y, mo - 1, da);
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function changeDay(delta: number) {
    const [y, mo, da] = selectedDate.split('-').map(Number);
    const d = new Date(y, mo - 1, da + delta);
    selectedDate = localDateStr(d);
  }

  function jumpToToday() {
    selectedDate = localDateStr(new Date());
  }

  function timeToMinutes(t: string) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  // Calcula posición y ancho de un bloque de reserva en el grid
  function getBlockStyle(booking: any): string {
    const startMins = timeToMinutes(booking.hora.substring(0, 5));
    const endStr = booking.end_time ? booking.end_time.substring(0, 5) : null;
    const endMins = endStr ? timeToMinutes(endStr) : startMins + 90; // Default 90min

    const gridStart = START_HOUR * 60;
    const leftPx = (startMins - gridStart) * (SLOT_WIDTH / SLOT_MINUTES);
    const widthPx = (endMins - startMins) * (SLOT_WIDTH / SLOT_MINUTES);

    return `left:${leftPx}px; width:${Math.max(widthPx - 4, 20)}px;`;
  }

  function getStatusColor(estado: string) {
    const map: Record<string, string> = {
      pendiente:    'bg-amber-500/20 border-amber-500 text-amber-200',
      confirmada:   'bg-brand/20 border-brand text-brand-light',
      reconfirmada: 'bg-blue-500/20 border-blue-400 text-blue-300',
      completada:   'bg-green-500/20 border-green-500 text-green-300',
      cancelada:    'bg-red-500/20 border-red-500 text-red-300 opacity-40',
    };
    return map[estado] || 'bg-gray-500/20 border-gray-500 text-gray-300';
  }

  function getStatusLabel(estado: string) {
    const map: Record<string, string> = {
      pendiente:    '⏳',
      confirmada:   '✓',
      reconfirmada: '✓✓',
      completada:   '★',
      cancelada:    '✗',
    };
    return map[estado] || '?';
  }

  // Reservas de una mesa concreta
  function bookingsForTable(tableId: string | null) {
    if (tableId) return bookings.filter(b => b.table_id === tableId);
    return bookings.filter(b => !b.table_id);
  }

  // Métricas del día
  $: totalPax    = bookings.filter(b => b.estado !== 'cancelada').reduce((s, b) => s + b.comensales, 0);
  $: totalActive = bookings.filter(b => !['cancelada'].includes(b.estado)).length;
  $: pendientes  = bookings.filter(b => b.estado === 'pendiente').length;
  $: isToday     = selectedDate === localDateStr(today);

  // ── Carga de datos ────────────────────────────────────────────────────────
  async function fetchData() {
    loading = true;
    try {
      const restaurantId_ = localStorage.getItem('admin_restaurant_id') || restaurantId;

      const [bookingsRes, tablesRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('*, client:client_id(nombre, telefono), table:table_id(zona, nombre)')
          .eq('restaurant_id', restaurantId_)
          .eq('fecha', selectedDate)
          .order('hora', { ascending: true }),

        supabase
          .from('tables')
          .select('id, zona, nombre, capacidad_min, capacidad_max')
          .eq('restaurant_id', restaurantId_)
          .order('zona')
      ]);

      bookings = bookingsRes.data || [];
      tables   = tablesRes.data   || [];
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  // ── Reactive: recargar cuando cambia la fecha ─────────────────────────────
  $: if (selectedDate) {
    fetchData();
    updateCurrentTimeLine();
  }

  // ── Ciclo de vida ─────────────────────────────────────────────────────────
  onMount(() => {
    const savedId = localStorage.getItem('admin_restaurant_id');
    if (savedId) restaurantId = savedId;

    updateCurrentTimeLine();
    clockInterval = setInterval(updateCurrentTimeLine, 30_000); // cada 30s

    subscription = supabase
      .channel('planner-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchData)
      .subscribe();
  });

  onDestroy(() => {
    clearInterval(clockInterval);
    if (subscription) subscription.unsubscribe();
  });

  // ── Tooltip de reserva seleccionada ──────────────────────────────────────
  let hoveredBooking: any = null;
  let tooltipStyle = '';
</script>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SHELL OSCURO (tema idéntico a la captura de referencia)                -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="flex flex-col h-full bg-[#1a1625] text-white rounded-xl overflow-hidden shadow-2xl border border-white/5">

  <!-- ─── HEADER ─── -->
  <div class="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#1e1a2e] shrink-0">
    <!-- Fecha y navegación -->
    <div class="flex items-center gap-3">
      <button on:click={() => changeDay(-1)} class="p-1.5 rounded-lg hover:bg-white/10 transition text-gray-400 hover:text-white">
        <ChevronLeft class="w-5 h-5" />
      </button>
      <h2 class="font-bold text-base capitalize min-w-[200px] text-center">{formatDateLabel(selectedDate)}</h2>
      <button on:click={() => changeDay(1)} class="p-1.5 rounded-lg hover:bg-white/10 transition text-gray-400 hover:text-white">
        <ChevronRight class="w-5 h-5" />
      </button>
      <button on:click={jumpToToday} title="Hoy" class="p-1.5 rounded-lg hover:bg-white/10 transition text-gray-400 hover:text-white {isToday ? 'text-brand' : ''}">
        <CalendarDays class="w-5 h-5" />
      </button>
    </div>

    <!-- Métricas rápidas -->
    <div class="flex items-center gap-4">
      {#if loading}
        <Loader2 class="w-4 h-4 animate-spin text-gray-500" />
      {:else}
        <div class="flex items-center gap-3 text-sm">
          <span class="flex items-center gap-1.5 text-gray-400">
            <span class="w-2 h-2 rounded-full bg-brand"></span>
            <span><strong class="text-white">{totalActive}</strong> reservas</span>
          </span>
          <span class="flex items-center gap-1.5 text-gray-400">
            <span class="w-2 h-2 rounded-full bg-purple-400"></span>
            <span><strong class="text-white">{totalPax}</strong> comensales</span>
          </span>
          {#if pendientes > 0}
            <span class="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full text-xs font-bold">
              ⏳ {pendientes} pendiente{pendientes > 1 ? 's' : ''}
            </span>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- ─── LEYENDA ─── -->
  <div class="flex items-center gap-4 px-5 py-2 border-b border-white/5 bg-[#1a1625]/80 text-xs text-gray-500 shrink-0">
    <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-amber-500/60 border border-amber-500"></span>Pendiente</span>
    <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-brand/60 border border-brand"></span>Confirmada</span>
    <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-blue-500/60 border border-blue-400"></span>Reconfirmada</span>
    <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-green-500/60 border border-green-500"></span>Completada</span>
    <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-red-500/40 border border-red-500 opacity-60"></span>Cancelada</span>
  </div>

  <!-- ─── GRID ─── -->
  <div class="flex-1 overflow-auto relative">
    {#if loading && bookings.length === 0}
      <div class="flex justify-center items-center h-64">
        <Loader2 class="w-8 h-8 animate-spin text-brand" />
      </div>
    {:else}
      <!-- Wrapper: fila izquierda fija + área de scroll horizontal -->
      <div class="flex">

        <!-- Columna izquierda: nombres de mesa (sticky) -->
        <div class="shrink-0 w-28 border-r border-white/10 bg-[#1a1625] sticky left-0 z-20">
          <!-- Cabecera vacía alineada con la fila de horas -->
          <div class="h-10 border-b border-white/10 flex items-center px-3">
            <span class="text-[10px] text-gray-600 uppercase tracking-widest font-bold">Mesa</span>
          </div>

          <!-- Sin mesa asignada -->
          {#if bookings.some(b => !b.table_id)}
            <div class="h-14 border-b border-white/5 flex flex-col justify-center px-3 bg-[#211d31]">
              <span class="text-xs font-bold text-gray-300">Sin mesa</span>
              <span class="text-[10px] text-gray-600">No asignada</span>
            </div>
          {/if}

          <!-- Mesas -->
          {#each tables as table}
            <div class="h-14 border-b border-white/5 flex flex-col justify-center px-3 hover:bg-white/5 transition">
              <span class="text-xs font-bold text-gray-200">{table.nombre || `Mesa ${table.id.slice(0,4)}`}</span>
              {#if table.capacidad_min !== undefined && table.capacidad_max !== undefined}
                <span class="text-[10px] text-gray-600">{table.capacidad_min}–{table.capacidad_max} pax</span>
              {/if}
            </div>
          {/each}

          <!-- Fila vacía si no hay mesas ni sin-mesa -->
          {#if tables.length === 0 && !bookings.some(b => !b.table_id)}
            <div class="h-14 border-b border-white/5 flex items-center px-3">
              <span class="text-[10px] text-gray-600 italic">Sin mesas</span>
            </div>
          {/if}
        </div>

        <!-- Área scrollable horizontal -->
        <div class="overflow-x-auto flex-1">
          <!-- Total width del grid -->
          {@const gridWidth = slots.length * SLOT_WIDTH}

          <div style="width:{gridWidth}px; min-width:{gridWidth}px;" class="relative">

            <!-- Fila de cabecera de horas -->
            <div class="flex h-10 border-b border-white/10 bg-[#1a1625] sticky top-0 z-10">
              {#each slots as slot, i}
                {@const isHour = slot.endsWith(':00')}
                <div
                  style="width:{SLOT_WIDTH}px; min-width:{SLOT_WIDTH}px;"
                  class="border-r border-white/{isHour ? '15' : '5'} flex items-end pb-1.5 shrink-0"
                >
                  {#if isHour || slot.endsWith(':30')}
                    <span class="text-[9px] text-gray-{isHour ? '400' : '600'} font-{isHour ? 'bold' : 'normal'} pl-1.5 uppercase">
                      {slot}
                    </span>
                  {/if}
                </div>
              {/each}
            </div>

            <!-- Contenedor de filas de mesas + línea de tiempo actual -->
            <div class="relative">

              <!-- Línea de tiempo actual -->
              {#if showCurrentTime && currentTimeLeft > 0 && currentTimeLeft < gridWidth}
                <div
                  class="absolute top-0 bottom-0 w-0.5 bg-green-400 z-30 pointer-events-none"
                  style="left:{currentTimeLeft}px;"
                >
                  <div class="w-2 h-2 rounded-full bg-green-400 -translate-x-[3px] -translate-y-1"></div>
                </div>
              {/if}

              <!-- Fila: Sin mesa asignada -->
              {#if bookings.some(b => !b.table_id)}
                <div class="h-14 border-b border-white/5 relative flex items-center bg-[#211d31]">
                  <!-- Columnas de fondo -->
                  {#each slots as slot}
                    {@const isHour = slot.endsWith(':00')}
                    <div
                      style="width:{SLOT_WIDTH}px; min-width:{SLOT_WIDTH}px;"
                      class="h-full border-r border-white/{isHour ? '10' : '5'} shrink-0 absolute"
                      style:left="{slots.indexOf(slot) * SLOT_WIDTH}px"
                    ></div>
                  {/each}

                  <!-- Bloques de reservas -->
                  {#each bookingsForTable(null) as booking}
                    <button
                      class="absolute top-2 bottom-2 rounded-md border-l-2 px-2 text-left flex flex-col justify-center overflow-hidden transition hover:brightness-110 hover:scale-y-105 cursor-pointer {getStatusColor(booking.estado)}"
                      style={getBlockStyle(booking)}
                      on:mouseenter={(e) => { hoveredBooking = booking; }}
                      on:mouseleave={() => hoveredBooking = null}
                      title="{booking.client?.nombre || 'Sin nombre'} · {booking.comensales} pax · {booking.hora.substring(0,5)}"
                    >
                      <span class="text-[10px] font-bold truncate">{getStatusLabel(booking.estado)} {booking.client?.nombre?.split(' ')[0] || '?'}</span>
                      <span class="text-[9px] opacity-70 truncate">{booking.comensales}p · {booking.hora.substring(0,5)}</span>
                    </button>
                  {/each}
                </div>
              {/if}

              <!-- Filas de mesas -->
              {#each tables as table, rowIdx}
                {@const rowBookings = bookingsForTable(table.id)}
                <div class="h-14 border-b border-white/5 relative flex items-center {rowIdx % 2 === 0 ? 'bg-[#1a1625]' : 'bg-[#1d1928]'}">

                  <!-- Columnas de fondo -->
                  {#each slots as slot, i}
                    {@const isHour = slot.endsWith(':00')}
                    <div
                      class="absolute top-0 h-full border-r border-white/{isHour ? '10' : '5'}"
                      style="left:{i * SLOT_WIDTH}px; width:{SLOT_WIDTH}px;"
                    ></div>
                  {/each}

                  <!-- Bloques de reservas -->
                  {#each rowBookings as booking}
                    <button
                      class="absolute top-2 bottom-2 rounded-md border-l-2 px-2 text-left flex flex-col justify-center overflow-hidden transition hover:brightness-125 hover:z-10 cursor-pointer {getStatusColor(booking.estado)}"
                      style={getBlockStyle(booking)}
                      on:mouseenter={() => { hoveredBooking = booking; }}
                      on:mouseleave={() => hoveredBooking = null}
                      title="{booking.client?.nombre || 'Sin nombre'} · {booking.comensales} pax · {booking.hora.substring(0,5)}"
                    >
                      <span class="text-[10px] font-bold truncate">{getStatusLabel(booking.estado)} {booking.client?.nombre?.split(' ')[0] || '?'}</span>
                      <span class="text-[9px] opacity-70 truncate">{booking.comensales}p · {booking.hora.substring(0,5)}</span>
                    </button>
                  {/each}

                  <!-- Placeholder si no hay reservas -->
                  {#if rowBookings.length === 0}
                    <div class="absolute inset-0 flex items-center" style="left:4px;">
                      <span class="text-[9px] text-gray-700 italic">sin reservas</span>
                    </div>
                  {/if}
                </div>
              {/each}

              <!-- Si no hay mesas configuradas -->
              {#if tables.length === 0 && !bookings.some(b => !b.table_id)}
                <div class="h-32 flex items-center justify-center text-gray-600 text-sm">
                  No hay mesas configuradas para este restaurante.
                </div>
              {/if}

            </div><!-- /relative -->
          </div><!-- /gridWidth -->
        </div><!-- /overflow-x-auto -->
      </div><!-- /flex -->
    {/if}
  </div>

  <!-- ─── TOOLTIP FLOTANTE ─── -->
  {#if hoveredBooking}
    <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#2a243f] border border-white/15 rounded-xl px-5 py-3 shadow-2xl flex items-center gap-6 text-sm pointer-events-none">
      <div>
        <p class="font-bold text-white">{hoveredBooking.client?.nombre || 'Sin nombre'}</p>
        <p class="text-gray-400 text-xs">{hoveredBooking.client?.telefono || '—'}</p>
      </div>
      <div class="text-center">
        <p class="text-xs text-gray-500 uppercase tracking-wider">Hora</p>
        <p class="font-bold text-white">{hoveredBooking.hora?.substring(0,5)}</p>
      </div>
      <div class="text-center">
        <p class="text-xs text-gray-500 uppercase tracking-wider">Pax</p>
        <p class="font-bold text-white">{hoveredBooking.comensales}</p>
      </div>
      <div class="text-center">
        <p class="text-xs text-gray-500 uppercase tracking-wider">Estado</p>
        <p class="font-bold capitalize text-white">{hoveredBooking.estado}</p>
      </div>
      {#if hoveredBooking.notas_cliente}
        <div class="max-w-[180px]">
          <p class="text-xs text-gray-500 uppercase tracking-wider">Nota</p>
          <p class="text-xs text-gray-300 truncate">{hoveredBooking.notas_cliente}</p>
        </div>
      {/if}
    </div>
  {/if}

</div>
