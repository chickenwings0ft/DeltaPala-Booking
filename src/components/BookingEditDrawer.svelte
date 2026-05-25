<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { supabase } from '../lib/supabase';
  import { X, Save, Loader2, Clock, CalendarDays, Users, Phone, Mail, Tag, FileText, MessageSquare, StickyNote, AlertCircle, CheckCircle2, Trash2 } from 'lucide-svelte';

  export let booking: any = null;
  export let restaurantId: string = '00000000-0000-0000-0000-000000000000';
  export let onClose: () => void = () => {};
  export let onSaved: () => void = () => {};

  // ── Editable fields ────────────────────────────────────────────────────────
  let editFecha     = '';
  let editHora      = '';
  let editEndTime   = '';
  let editComensales = 2;
  let editEstado    = '';
  let editOrigen    = '';
  let editDuracion  = 90; // minutes
  let editNombre    = '';
  let editTelefono  = '';
  let editEmail     = '';
  let editNotas     = '';

  // ── UI state ───────────────────────────────────────────────────────────────
  let saving = false;
  let saveError = '';
  let saveSuccess = false;
  let activeTab: 'nota' | 'mensaje' = 'nota';
  let notaInterna = '';
  let mensajeCliente = '';
  let sendingMsg = false;
  let tables: any[] = [];
  let editTableId: string = '';
  let clientHistory: any[] = [];

  const ESTADOS = ['pendiente', 'confirmada', 'reconfirmada', 'completada', 'cancelada'];
  const ORIGENES = ['web', 'telefono', 'email', 'whatsapp', 'presencial'];
  const DURACIONES = [30, 45, 60, 75, 90, 105, 120, 150, 180];

  // ── Activity log (derived from booking timestamps) ─────────────────────────
  $: activityLog = booking ? buildActivityLog(booking) : [];

  function buildActivityLog(b: any) {
    const log = [];
    if (b.created_at) log.push({ label: 'Reserva creada', time: b.created_at, icon: '📋' });
    if (b.estado === 'confirmada')   log.push({ label: 'Estado: Confirmada',   time: b.updated_at || b.created_at, icon: '✓' });
    if (b.estado === 'reconfirmada') log.push({ label: 'Reconfirmada por admin', time: b.updated_at || b.created_at, icon: '✓✓' });
    if (b.estado === 'completada')   log.push({ label: 'Marcada como completada', time: b.updated_at || b.created_at, icon: '★' });
    if (b.estado === 'cancelada')    log.push({ label: 'Reserva cancelada', time: b.updated_at || b.created_at, icon: '✗' });
    return log;
  }

  function formatRelative(ts: string) {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'hace un momento';
    if (mins < 60) return `hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `hace ${hrs}h`;
    return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  function formatDateTime(ts: string) {
    if (!ts) return '';
    return new Date(ts).toLocaleString('es-ES', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  }

  function recalcEndTime() {
    if (!editHora) return;
    const [h, m] = editHora.split(':').map(Number);
    const total = h * 60 + m + editDuracion;
    const eh = String(Math.floor(total / 60) % 24).padStart(2, '0');
    const em = String(total % 60).padStart(2, '0');
    editEndTime = `${eh}:${em}`;
  }

  function statusColor(estado: string) {
    const map: Record<string, string> = {
      pendiente: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-900/60',
      confirmada: 'bg-brand/10 text-brand border-brand/30 dark:bg-brand/20 dark:text-brand dark:border-brand/40',
      reconfirmada: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/60',
      completada: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900/60',
      cancelada: 'bg-red-100 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60',
    };
    return map[estado] || 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-slate-400';
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  async function init() {
    if (!booking) return;
    editFecha      = booking.fecha || '';
    editHora       = booking.hora?.substring(0, 5) || '';
    editEndTime    = booking.end_time?.substring(0, 5) || '';
    editComensales = booking.comensales || 2;
    editEstado     = booking.estado || 'pendiente';
    editOrigen     = booking.origen || 'web';
    editNombre     = booking.client?.nombre || '';
    editTelefono   = booking.client?.telefono || '';
    editEmail      = booking.client?.email || '';
    editNotas      = booking.notas_cliente || '';
    editTableId    = booking.table_id || '';

    // Calcular duración a partir de hora y end_time
    if (booking.hora && booking.end_time) {
      const [sh, sm] = booking.hora.split(':').map(Number);
      const [eh, em] = booking.end_time.split(':').map(Number);
      editDuracion = (eh * 60 + em) - (sh * 60 + sm);
      if (editDuracion <= 0) editDuracion = 90;
    }

    // Cargar mesas del restaurante
    const { data: tableData } = await supabase
      .from('tables')
      .select('id, zona, capacidad')
      .eq('restaurant_id', restaurantId)
      .order('zona');
    tables = tableData || [];

    // Historial del cliente
    if (booking.client_id) {
      const { data: hist } = await supabase
        .from('bookings')
        .select('id, fecha, hora, comensales, estado')
        .eq('client_id', booking.client_id)
        .order('fecha', { ascending: false })
        .limit(5);
      clientHistory = (hist || []).filter((b: any) => b.id !== booking.id);
    }
  }

  $: if (booking) init();

  // ── Save ───────────────────────────────────────────────────────────────────
  async function saveBooking() {
    saving = true;
    saveError = '';
    saveSuccess = false;
    try {
      recalcEndTime();

      // Update client
      if (booking.client_id) {
        await supabase.from('clients').update({
          nombre: editNombre,
          telefono: editTelefono,
          email: editEmail || null,
        }).eq('id', booking.client_id);
      }

      // Update booking
      const { error } = await supabase.from('bookings').update({
        fecha:          editFecha,
        hora:           editHora,
        end_time:       editEndTime,
        comensales:     editComensales,
        estado:         editEstado,
        origen:         editOrigen,
        table_id:       editTableId || null,
        notas_cliente:  editNotas,
      }).eq('id', booking.id);

      if (error) throw error;

      saveSuccess = true;
      setTimeout(() => saveSuccess = false, 3000);
      onSaved();
    } catch (e: any) {
      saveError = e.message || 'Error al guardar';
    } finally {
      saving = false;
    }
  }

  async function cancelBooking() {
    if (!confirm('¿Seguro que quieres cancelar esta reserva?')) return;
    saving = true;
    try {
      await supabase.from('bookings').update({ estado: 'cancelada' }).eq('id', booking.id);
      onSaved();
      onClose();
    } catch (e) { console.error(e); }
    finally { saving = false; }
  }

  async function sendMessage() {
    const msg = activeTab === 'nota' ? notaInterna : mensajeCliente;
    if (!msg.trim()) return;
    sendingMsg = true;
    try {
      if (activeTab === 'nota') {
        const newNota = editNotas ? `${editNotas}\n[Nota interna] ${msg}` : `[Nota interna] ${msg}`;
        await supabase.from('bookings').update({ notas_cliente: newNota }).eq('id', booking.id);
        editNotas = newNota;
        notaInterna = '';
      } else {
        mensajeCliente = '';
        alert('Mensaje enviado al cliente (integración pendiente).');
      }
    } finally { sendingMsg = false; }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- Overlay -->
<div
  transition:fade={{ duration: 150 }}
  class="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40"
  on:click={onClose}
  role="presentation"
></div>

<!-- Drawer -->
<div
  transition:fly={{ x: 600, duration: 280 }}
  class="fixed right-0 top-0 bottom-0 z-50 w-full max-w-3xl bg-white dark:bg-slate-800 shadow-2xl flex flex-col border-l dark:border-slate-700 transition-colors duration-300"
  role="dialog"
  aria-label="Editar reserva"
>

  <!-- ─── HEADER ─── -->
  <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/60 shrink-0 transition-colors duration-300">
    <div>
      <h2 class="text-xl font-extrabold text-gray-900 dark:text-slate-100">Editar reserva</h2>
      <p class="text-xs text-gray-500 dark:text-slate-400 mt-0.5">ID: {booking?.id?.substring(0,8)}…</p>
    </div>
    <div class="flex items-center gap-3">
      <!-- Badge de estado -->
      <span class="px-3 py-1 rounded-full text-xs font-bold uppercase border {statusColor(editEstado)}">
        {editEstado}
      </span>
      <button on:click={onClose} class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition text-gray-500 dark:text-slate-400">
        <X class="w-5 h-5" />
      </button>
    </div>
  </div>

  <!-- ─── BODY ─── -->
  <div class="flex-1 overflow-hidden flex text-gray-800 dark:text-slate-200">

    <!-- LEFT: formulario principal -->
    <div class="flex-1 overflow-y-auto p-6 space-y-5 border-r border-gray-100 dark:border-slate-700">

      <!-- Fecha / Hora / Personas -->
      <div class="grid grid-cols-3 gap-4">
        <div>
          <label class="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Fecha</label>
          <input
            type="date"
            bind:value={editFecha}
            class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand text-gray-900 dark:text-slate-100"
          />
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Hora</label>
          <input
            type="time"
            bind:value={editHora}
            on:change={recalcEndTime}
            class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand text-gray-900 dark:text-slate-100"
          />
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Personas</label>
          <div class="flex items-center gap-2">
            <button type="button"
              on:click={() => editComensales = Math.max(1, editComensales - 1)}
              class="w-9 h-9 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-600 dark:text-slate-300 font-bold transition">−</button>
            <span class="flex-1 text-center font-bold text-gray-900 dark:text-slate-100 text-lg">{editComensales}</span>
            <button type="button"
              on:click={() => editComensales = editComensales + 1}
              class="w-9 h-9 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-600 dark:text-slate-300 font-bold transition">+</button>
          </div>
        </div>
      </div>

      <!-- Duración / Mesa -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Duración</label>
          <select bind:value={editDuracion} on:change={recalcEndTime}
            class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand text-gray-900 dark:text-slate-100 appearance-none">
            {#each DURACIONES as d}
              <option value={d}>{d} min ({Math.floor(d/60)}h{d%60 > 0 ? ` ${d%60}min` : ''})</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Mesa asignada</label>
          <select bind:value={editTableId}
            class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand text-gray-900 dark:text-slate-100 appearance-none">
            <option value="">Sin asignar</option>
            {#each tables as t}
              <option value={t.id}>{t.zona} (Mesa {t.id.substring(0,4)} · {t.capacidad} pax)</option>
            {/each}
          </select>
        </div>
      </div>

      <hr class="border-gray-100 dark:border-slate-700" />

      <!-- Datos del cliente -->
      <div>
        <h3 class="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Users class="w-3.5 h-3.5" /> Datos del cliente
        </h3>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1">Nombre completo</label>
            <input type="text" bind:value={editNombre}
              class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand text-gray-900 dark:text-slate-100" />
            {#if clientHistory.length > 0}
              <p class="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                🕐 {clientHistory.length + 1} reservas en total · Último: {new Date(clientHistory[0].fecha).toLocaleDateString('es-ES')}
              </p>
            {/if}
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Phone class="w-3 h-3" /> Teléfono</label>
              <input type="tel" bind:value={editTelefono}
                class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand text-gray-900 dark:text-slate-100" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Mail class="w-3 h-3" /> Email</label>
              <input type="email" bind:value={editEmail}
                class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand text-gray-900 dark:text-slate-100" />
            </div>
          </div>
        </div>
      </div>

      <hr class="border-gray-100 dark:border-slate-700" />

      <!-- Estado / Origen -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Estado</label>
          <select bind:value={editEstado}
            class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand text-gray-900 dark:text-slate-100 appearance-none capitalize">
            {#each ESTADOS as e}
              <option value={e}>{e}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Fuente</label>
          <select bind:value={editOrigen}
            class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand text-gray-900 dark:text-slate-100 appearance-none capitalize">
            {#each ORIGENES as o}
              <option value={o}>{o}</option>
            {/each}
          </select>
        </div>
      </div>

      <!-- Notas / Peticiones -->
      <div>
        <label class="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Peticiones especiales / Notas</label>
        <textarea bind:value={editNotas} rows="3"
          class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand text-gray-900 dark:text-slate-100 resize-none placeholder-gray-400 dark:placeholder-gray-500"
          placeholder="Alergias, peticiones especiales, ocasión especial..."></textarea>
      </div>

      <!-- Enlace de cancelación -->
      <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900/30 rounded-lg border border-gray-100 dark:border-slate-700 text-xs text-gray-500">
        <span class="font-semibold dark:text-slate-400">Enlace de cancelación:</span>
        <code class="flex-1 truncate text-brand dark:text-brand text-[11px]">
          {`/cancelar/${booking?.id}`}
        </code>
        <button
          on:click={() => navigator.clipboard.writeText(`https://delta-pala-booking-seven.vercel.app/cancelar/${booking?.id}`)}
          class="px-2 py-1 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-650 transition font-medium">
          Copiar
        </button>
      </div>

      <!-- Historial de reservas del cliente -->
      {#if clientHistory.length > 0}
        <div>
          <h3 class="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">Historial del cliente</h3>
          <div class="space-y-1.5">
            {#each clientHistory as h}
              <div class="flex items-center justify-between text-xs bg-gray-50 dark:bg-slate-900/30 rounded-lg px-3 py-2 border border-gray-100 dark:border-slate-700">
                <span class="text-gray-600 dark:text-slate-300">{new Date(h.fecha).toLocaleDateString('es-ES')} · {h.hora?.substring(0,5)}</span>
                <span class="text-gray-500 dark:text-slate-400">{h.comensales} pax</span>
                <span class="px-1.5 py-0.5 rounded-full font-bold uppercase {statusColor(h.estado)} text-[9px]">{h.estado}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

    </div>

    <!-- RIGHT: Actividad + mensajes -->
    <div class="w-72 shrink-0 flex flex-col overflow-hidden bg-gray-50/60 dark:bg-slate-900/10">

      <!-- Actividad -->
      <div class="p-4 border-b border-gray-100 dark:border-slate-700">
        <h3 class="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3">Actividad</h3>
        <div class="space-y-2.5">
          {#each activityLog as entry}
            <div class="flex items-start gap-2">
              <div class="w-6 h-6 rounded-full bg-brand/10 dark:bg-brand/20 text-brand flex items-center justify-center text-[10px] shrink-0 font-bold">
                {entry.icon}
              </div>
              <div>
                <p class="text-xs font-medium text-gray-700 dark:text-slate-300">{entry.label}</p>
                <p class="text-[10px] text-gray-400 dark:text-slate-500">{formatRelative(entry.time)}</p>
              </div>
            </div>
          {/each}
          {#if activityLog.length === 0}
            <p class="text-xs text-gray-400 italic">Sin actividad registrada.</p>
          {/if}
        </div>
      </div>

      <!-- Tabs: Nota / Mensaje -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <div class="flex border-b border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800">
          <button
            on:click={() => activeTab = 'nota'}
            class="flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition {activeTab === 'nota' ? 'text-brand border-b-2 border-brand bg-white dark:bg-slate-800' : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'}">
            <StickyNote class="w-3.5 h-3.5 inline mr-1" />Nota interna
          </button>
          <button
            on:click={() => activeTab = 'mensaje'}
            class="flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition {activeTab === 'mensaje' ? 'text-brand border-b-2 border-brand bg-white dark:bg-slate-800' : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'}">
            <MessageSquare class="w-3.5 h-3.5 inline mr-1" />Mensaje
          </button>
        </div>

        <div class="flex-1 p-4 flex flex-col gap-3">
          {#if activeTab === 'nota'}
            <p class="text-[10px] text-gray-400 dark:text-slate-500">Las notas internas no se envían al cliente.</p>
            <textarea bind:value={notaInterna} rows="5"
              class="flex-1 w-full bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-brand text-gray-900 dark:text-slate-100 resize-none"
              placeholder="Escribe una nota interna..."></textarea>
          {:else}
            <p class="text-[10px] text-gray-400 dark:text-slate-500">El mensaje se enviará al email del cliente.</p>
            <textarea bind:value={mensajeCliente} rows="5"
              class="flex-1 w-full bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-brand text-gray-900 dark:text-slate-100 resize-none"
              placeholder="Mensaje para {editNombre}..."></textarea>
          {/if}
          <button on:click={sendMessage} disabled={sendingMsg}
            class="w-full bg-brand text-white text-xs font-bold py-2 rounded-lg hover:bg-brand-hover transition flex items-center justify-center gap-1.5 disabled:opacity-50">
            {#if sendingMsg}
              <Loader2 class="w-3.5 h-3.5 animate-spin" />
            {/if}
            {activeTab === 'nota' ? 'Guardar nota' : 'Enviar mensaje'}
          </button>
        </div>
      </div>
    </div>

  </div>

  <!-- ─── FOOTER ─── -->
  <div class="px-6 py-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/60 flex items-center justify-between shrink-0 transition-colors duration-300">
    <!-- Cancelar reserva -->
    <button on:click={cancelBooking} disabled={saving || editEstado === 'cancelada'}
      class="flex items-center gap-2 text-red-600 bg-white dark:bg-slate-700 border border-red-200 dark:border-slate-650 hover:bg-red-50 dark:hover:bg-red-950/20 px-4 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-40">
      <Trash2 class="w-4 h-4" /> Cancelar reserva
    </button>

    <div class="flex items-center gap-3">
      {#if saveError}
        <span class="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle class="w-3.5 h-3.5" /> {saveError}
        </span>
      {/if}
      {#if saveSuccess}
        <span class="text-xs text-green-600 flex items-center gap-1">
          <CheckCircle2 class="w-3.5 h-3.5" /> ¡Guardado!
        </span>
      {/if}

      <button on:click={onClose}
        class="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-600 transition">
        Cerrar
      </button>
      <button on:click={saveBooking} disabled={saving}
        class="flex items-center gap-2 bg-brand text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-brand-hover transition shadow-sm shadow-brand/20 disabled:opacity-50">
        {#if saving}
          <Loader2 class="w-4 h-4 animate-spin" /> Guardando...
        {:else}
          <Save class="w-4 h-4" /> Actualizar reserva
        {/if}
      </button>
    </div>
  </div>

</div>
