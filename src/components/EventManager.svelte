<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase';
  import { Ticket, Plus, Edit, Trash2, Loader2, Link, Save, X, Eye, CreditCard, ChevronRight } from 'lucide-svelte';

  export let restaurantId: string = 'rest-id-placeholder';

  let events: any[] = [];
  let loading = true;
  let processing = false;

  let showModal = false;
  let showStatsModal = false;
  let editingEvent: any = null;
  let selectedEventForStats: any = null;
  let eventStats: any = null;
  let statsLoading = false;
  let selectedImageFile: File | null = null;
  let uploadingImage = false;

  const defaultEvent = {
    titulo: '',
    descripcion: '',
    imagen_url: '',
    fecha: new Date().toISOString().split('T')[0],
    hora: '21:00',
    precio_persona: 0.0,
    capacidad_maxima: 50,
    estado: 'borrador',
    color_evento: '#3B82F6'
  };

  async function fetchEvents() {
    loading = true;
    try {
      // Usamos una consulta que también nos diga la ocupación actual si fuera posible,
      // pero como está en otra tabla, podemos cargar eventos y luego las reservas.
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          event_bookings ( comensales, total_pago, estado_pago )
        `)
        .eq('restaurant_id', restaurantId)
        .order('fecha', { ascending: false });

      if (error) throw error;
      
      // Calculate occupancy
      events = (data || []).map(ev => {
        const booked = ev.event_bookings.reduce((sum: number, b: any) => sum + b.comensales, 0);
        const revenue = ev.event_bookings.reduce((sum: number, b: any) => b.estado_pago === 'pagado' ? sum + b.total_pago : sum, 0);
        return { ...ev, ocupacion: booked, ingresos: revenue };
      });
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function openCreateModal() {
    editingEvent = { ...defaultEvent, restaurant_id: restaurantId };
    selectedImageFile = null;
    showModal = true;
  }

  function openEditModal(ev: any) {
    editingEvent = { ...ev };
    selectedImageFile = null;
    showModal = true;
  }

  async function handleImageUpload(e: any) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Preview immediate
    selectedImageFile = file;
    editingEvent.imagen_url = URL.createObjectURL(file); // Temporary preview
  }

  async function uploadImageToSupabase(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `events/${fileName}`;

    const { data, error } = await supabase.storage
      .from('event-images')
      .upload(filePath, file);

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('event-images')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  }

  async function saveEvent() {
    if (!editingEvent.titulo || !editingEvent.fecha || !editingEvent.hora) {
      alert("Por favor rellena el título, la fecha y la hora.");
      return;
    }
    processing = true;
    try {
      // Si hay una nueva imagen, subirla primero
      if (selectedImageFile) {
        try {
          const publicUrl = await uploadImageToSupabase(selectedImageFile);
          editingEvent.imagen_url = publicUrl;
        } catch (imgErr) {
          console.error("Error subiendo imagen:", imgErr);
          if (typeof window !== 'undefined' && window.showToast) window.showToast('Error subiendo la imagen. Comprueba el bucket de Supabase.', 'error');
          processing = false;
          return;
        }
      }

      const { ocupacion, ingresos, event_bookings, ...saveData } = editingEvent;
      
      if (editingEvent.id) {
        const { error } = await supabase.from('events').update(saveData).eq('id', editingEvent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('events').insert([saveData]);
        if (error) throw error;
      }
      
      showModal = false;
      if (typeof window !== 'undefined' && window.showToast) window.showToast('Evento guardado correctamente', 'success');
      fetchEvents();
    } catch (e) {
      console.error(e);
      if (typeof window !== 'undefined' && window.showToast) window.showToast('Error al guardar el evento.', 'error');
    } finally {
      processing = false;
    }
  }

  async function deleteEvent(id: string) {
    if (!confirm('¿Estás seguro de que quieres eliminar este evento?')) return;
    try {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      if (typeof window !== 'undefined' && window.showToast) window.showToast('Evento eliminado', 'warning');
      fetchEvents();
    } catch (e) {
      console.error(e);
      if (typeof window !== 'undefined' && window.showToast) window.showToast('Error al eliminar el evento.', 'error');
    }
  }

  async function viewStats(ev: any) {
    selectedEventForStats = ev;
    showStatsModal = true;
    statsLoading = true;
    try {
      const { data, error } = await supabase
        .from('event_bookings')
        .select('*')
        .eq('event_id', ev.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      eventStats = data || [];
    } catch (e) {
      console.error(e);
    } finally {
      statsLoading = false;
    }
  }

  function copyEventLink(ev: any) {
    const url = `${window.location.origin}/eventos/${ev.id}`;
    navigator.clipboard.writeText(url);
    if (typeof window !== 'undefined' && window.showToast) window.showToast('¡Enlace copiado! Pégalo en Instagram o en tu web.', 'info');
  }

  onMount(() => {
    const savedId = localStorage.getItem('admin_restaurant_id');
    if (savedId) restaurantId = savedId;
    fetchEvents();
  });
</script>

<div class="w-full space-y-6">
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Eventos y Experiencias</h1>
      <p class="text-gray-500">Crea eventos especiales con venta de entradas anticipada.</p>
    </div>
    <button on:click={openCreateModal} class="bg-brand text-white px-5 py-2.5 rounded-xl font-bold hover:bg-brand-hover transition flex items-center gap-2 shadow-sm w-full sm:w-auto justify-center">
      <Plus class="w-5 h-5"/> Crear Evento
    </button>
  </div>

  {#if loading}
    <div class="flex justify-center p-12 text-gray-400">
      <Loader2 class="w-8 h-8 animate-spin" />
    </div>
  {:else if events.length === 0}
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center flex flex-col items-center">
      <Ticket class="w-16 h-16 text-gray-200 mb-4" />
      <h3 class="text-xl font-bold text-gray-900 mb-2">No tienes eventos creados</h3>
      <p class="text-gray-500 mb-6 max-w-md">Organiza catas de vino, cenas maridaje, Nochevieja o menús especiales cobrando por adelantado de forma segura.</p>
      <button on:click={openCreateModal} class="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition">Crear mi primer evento</button>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each events as ev}
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div class="h-40 bg-gray-100 relative overflow-hidden group">
            {#if ev.imagen_url}
              <img src={ev.imagen_url} alt={ev.titulo} class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            {:else}
              <div class="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <Ticket class="w-10 h-10 text-gray-300" />
              </div>
            {/if}
            <div class="absolute top-3 right-3 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider backdrop-blur-md {ev.estado === 'activo' ? 'bg-green-500/90 text-white' : ev.estado === 'borrador' ? 'bg-yellow-500/90 text-white' : 'bg-gray-900/90 text-white'}">
              {ev.estado}
            </div>
            {#if ev.color_evento}
              <div class="absolute bottom-0 left-0 w-full h-1" style="background-color: {ev.color_evento};"></div>
            {/if}
          </div>
          <div class="p-5 flex-1 flex flex-col">
            <h3 class="font-bold text-lg text-gray-900 mb-1">{ev.titulo}</h3>
            <p class="text-sm text-gray-500 mb-4 flex items-center gap-2">
              <span class="font-medium">{new Date(ev.fecha).toLocaleDateString('es-ES')}</span> • {ev.hora.substring(0,5)}
            </p>
            
            <div class="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100 grid grid-cols-2 gap-4">
              <div>
                <span class="block text-xs font-bold text-gray-400 uppercase mb-1">Aforo</span>
                <span class="font-bold text-gray-900">{ev.ocupacion} / {ev.capacidad_maxima}</span>
                <div class="w-full bg-gray-200 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div class="h-full bg-brand rounded-full" style="width: {Math.min((ev.ocupacion/ev.capacidad_maxima)*100, 100)}%;"></div>
                </div>
              </div>
              <div>
                <span class="block text-xs font-bold text-gray-400 uppercase mb-1">Precio</span>
                <span class="font-bold text-gray-900">{ev.precio_persona} €</span>
                <span class="block text-xs text-gray-500 mt-1">/ persona</span>
              </div>
            </div>

            <div class="mt-auto flex gap-2">
              <button on:click={() => copyEventLink(ev)} class="flex-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5">
                <Link class="w-4 h-4"/> Copiar Link
              </button>
              <button on:click={() => viewStats(ev)} class="flex-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center gap-1.5">
                <Eye class="w-4 h-4"/> Entradas
              </button>
            </div>
          </div>
          <div class="p-3 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
            <button on:click={() => openEditModal(ev)} class="p-2 text-gray-400 hover:text-brand transition rounded-lg hover:bg-white"><Edit class="w-4 h-4"/></button>
            <button on:click={() => deleteEvent(ev.id)} class="p-2 text-gray-400 hover:text-red-500 transition rounded-lg hover:bg-white"><Trash2 class="w-4 h-4"/></button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Modal Creación/Edición -->
{#if showModal}
  <div class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
      <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 sticky top-0 rounded-t-2xl z-10">
        <h3 class="font-bold text-xl text-gray-900">{editingEvent.id ? 'Editar Evento' : 'Crear Nuevo Evento'}</h3>
        <button on:click={() => showModal = false} class="text-gray-400 hover:text-gray-700"><X class="w-6 h-6" /></button>
      </div>
      
      <div class="p-6 overflow-y-auto space-y-6">
        <div>
          <label class="block text-sm font-bold text-gray-700 mb-2">Título del Evento <span class="text-red-500">*</span></label>
          <input type="text" bind:value={editingEvent.titulo} placeholder="Ej. Cena Maridaje Rioja" class="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand font-medium" />
        </div>
        
        <div>
          <label class="block text-sm font-bold text-gray-700 mb-2">Descripción Corta</label>
          <textarea bind:value={editingEvent.descripcion} rows="3" placeholder="Describe la experiencia..." class="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand"></textarea>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="col-span-2">
            <label class="block text-sm font-bold text-gray-700 mb-2">Fecha <span class="text-red-500">*</span></label>
            <input type="date" bind:value={editingEvent.fecha} class="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div class="col-span-2">
            <label class="block text-sm font-bold text-gray-700 mb-2">Hora <span class="text-red-500">*</span></label>
            <input type="time" bind:value={editingEvent.hora} class="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Precio por Persona (€) <span class="text-red-500">*</span></label>
            <div class="relative">
              <span class="absolute left-4 top-3 text-gray-400 font-bold">€</span>
              <input type="number" step="0.5" min="0" bind:value={editingEvent.precio_persona} class="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-3 outline-none focus:ring-2 focus:ring-brand font-bold text-lg" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Capacidad Máxima (Aforo) <span class="text-red-500">*</span></label>
            <input type="number" min="1" bind:value={editingEvent.capacidad_maxima} class="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand font-bold text-lg" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Estado</label>
            <select bind:value={editingEvent.estado} class="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand font-medium">
              <option value="borrador">Borrador (Oculto)</option>
              <option value="activo">Activo (A la venta)</option>
              <option value="finalizado">Finalizado</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Imagen del Evento</label>
            {#if editingEvent.imagen_url}
              <div class="relative h-40 bg-gray-100 rounded-xl overflow-hidden mb-2 border border-gray-200">
                <img src={editingEvent.imagen_url} alt="Preview" class="w-full h-full object-cover" />
                <button on:click={() => {editingEvent.imagen_url = ''; selectedImageFile = null;}} class="absolute top-2 right-2 bg-white/90 p-2 rounded-lg text-red-500 hover:bg-white shadow-md transition"><Trash2 class="w-4 h-4"/></button>
              </div>
            {/if}
            {#if !editingEvent.imagen_url}
              <div class="w-full relative bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl px-4 py-6 flex flex-col items-center justify-center hover:bg-gray-100 transition cursor-pointer">
                <input type="file" accept="image/*" on:change={handleImageUpload} class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <svg class="w-6 h-6 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                <span class="text-xs font-bold text-gray-500">Haz clic para subir imagen</span>
              </div>
            {/if}
          </div>
        </div>
      </div>
      
      <div class="p-6 border-t border-gray-100 bg-gray-50 flex gap-3 sticky bottom-0 rounded-b-2xl">
        <button on:click={() => showModal = false} class="flex-1 bg-white border border-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-50 transition">Cancelar</button>
        <button on:click={saveEvent} disabled={processing} class="flex-1 bg-brand text-white font-bold py-3 rounded-xl hover:bg-brand-hover transition disabled:opacity-50 flex justify-center items-center gap-2">
          {#if processing} <Loader2 class="w-5 h-5 animate-spin"/> {/if}
          Guardar Evento
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal de Entradas Vendidas -->
{#if showStatsModal && selectedEventForStats}
  <div class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
      <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <div>
          <h3 class="font-bold text-xl text-gray-900">Ventas: {selectedEventForStats.titulo}</h3>
          <p class="text-sm text-gray-500">Recaudación total: <span class="font-bold text-green-600">{selectedEventForStats.ingresos}€</span></p>
        </div>
        <button on:click={() => showStatsModal = false} class="text-gray-400 hover:text-gray-700"><X class="w-6 h-6" /></button>
      </div>
      
      <div class="flex-1 overflow-y-auto p-0 bg-gray-50">
        {#if statsLoading}
          <div class="flex justify-center p-12"><Loader2 class="w-8 h-8 animate-spin text-brand" /></div>
        {:else if !eventStats || eventStats.length === 0}
          <div class="p-12 text-center text-gray-500">
            <Ticket class="w-12 h-12 mx-auto mb-3 opacity-20"/>
            Aún no hay entradas vendidas para este evento.
          </div>
        {:else}
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-white border-b border-gray-200 text-xs uppercase text-gray-500 tracking-wider">
                <th class="p-4 font-bold">Cliente</th>
                <th class="p-4 font-bold">Pax</th>
                <th class="p-4 font-bold">Total</th>
                <th class="p-4 font-bold">Estado Pago</th>
                <th class="p-4 font-bold">Fecha Compra</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              {#each eventStats as b}
                <tr class="bg-white hover:bg-gray-50 transition">
                  <td class="p-4">
                    <div class="font-bold text-gray-900">{b.nombre_cliente}</div>
                    <div class="text-xs text-gray-500">{b.email_cliente} • {b.telefono}</div>
                  </td>
                  <td class="p-4 font-bold">{b.comensales}</td>
                  <td class="p-4 font-medium text-gray-900">{b.total_pago}€</td>
                  <td class="p-4">
                    <span class="px-2 py-1 rounded-md text-[10px] uppercase font-bold {b.estado_pago === 'pagado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                      {b.estado_pago}
                    </span>
                  </td>
                  <td class="p-4 text-xs text-gray-500">
                    {new Date(b.created_at).toLocaleString('es-ES')}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </div>
  </div>
{/if}
