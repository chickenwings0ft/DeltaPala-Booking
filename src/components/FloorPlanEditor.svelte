<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '../lib/supabase';
  import Konva from 'konva';
  import { Save, Plus, Square, Circle, Edit, Trash2, Loader2, GripHorizontal } from 'lucide-svelte';

  export let restaurantId: string = '00000000-0000-0000-0000-000000000000';
  export let selectedDate: string = new Date().toISOString().split('T')[0];
  export let viewModeOnly: boolean = false; // true en el dashboard general, false en editor

  let container: HTMLDivElement;
  let stage: Konva.Stage;
  let layer: Konva.Layer;
  let transformer: Konva.Transformer;

  let rooms: any[] = [];
  let selectedRoomId: string = '';
  let elements: any[] = [];
  let occupiedTableIds: string[] = [];

  let loading = true;
  let saving = false;

  // Floating Editor State
  let selectedElementId: string | null = null;
  let selectedElementData: any = null;
  let floatingMenuPos = { x: 0, y: 0 };

  async function loadRoomsAndBookings() {
    loading = true;
    try {
      // 1. Cargar Salas
      const { data: roomsData } = await supabase.from('rooms').select('*').eq('restaurant_id', restaurantId);
      if (roomsData) {
        rooms = roomsData;
        if (rooms.length > 0 && !selectedRoomId) {
          selectedRoomId = rooms[0].id;
        }
      }

      await loadLayoutAndBookings();
    } catch (err) {
      console.error(err);
    } finally {
      loading = false;
    }
  }

  async function loadLayoutAndBookings() {
    if (!selectedRoomId) return;
    
    // Cargar layout de la sala seleccionada
    const room = rooms.find(r => r.id === selectedRoomId);
    elements = (room?.layout_config?.elements) || [];

    // Cargar reservas para la fecha seleccionada
    const { data: bookings } = await supabase
      .from('bookings')
      .select('table_id')
      .eq('restaurant_id', restaurantId)
      .eq('fecha', selectedDate)
      .neq('estado', 'cancelada');

    occupiedTableIds = (bookings || []).map(b => b.table_id);
    
    drawCanvas();
  }

  function drawCanvas() {
    if (!stage) return;
    layer.destroyChildren();

    // Fondo / Grid opcional
    const background = new Konva.Rect({
      x: 0, y: 0, width: stage.width(), height: stage.height(),
      fill: '#f8fafc',
      listening: false
    });
    layer.add(background);

    elements.forEach(el => {
      let node: Konva.Group;
      const isOccupied = occupiedTableIds.includes(el.id);
      // Colores basados en ocupación
      const fillColor = el.type === 'wall' ? '#cbd5e1' : (isOccupied ? '#fee2e2' : '#e0f2fe');
      const strokeColor = el.type === 'wall' ? '#94a3b8' : (isOccupied ? '#ef4444' : '#004aad');

      node = new Konva.Group({
        x: el.x,
        y: el.y,
        id: el.id,
        draggable: !viewModeOnly
      });

      let shape;
      if (el.type === 'round') {
        shape = new Konva.Circle({ radius: 30, fill: fillColor, stroke: strokeColor, strokeWidth: 2 });
      } else if (el.type === 'square') {
        shape = new Konva.Rect({ width: 60, height: 60, offsetX: 30, offsetY: 30, fill: fillColor, stroke: strokeColor, strokeWidth: 2, cornerRadius: 4 });
      } else if (el.type === 'wall') {
        shape = new Konva.Rect({ width: el.width || 100, height: el.height || 20, offsetX: 50, offsetY: 10, fill: fillColor, stroke: strokeColor, strokeWidth: 1 });
      }

      node.add(shape!);

      // Texto de nombre o capacidad
      if (el.type !== 'wall') {
        const capacityText = el.capacity ? `${el.capacity} px` : '4 px';
        const nameText = `Nº ${el.name || '1'}`;
        const text = new Konva.Text({
          text: `${nameText}\n${capacityText}`,
          fontSize: 12,
          fontStyle: 'bold',
          fill: strokeColor,
          align: 'center',
          verticalAlign: 'middle',
          offsetX: 30,
          offsetY: 14,
          lineHeight: 1.2,
          width: 60
        });
        node.add(text);
      }

      node.on('dragend', (e) => {
        const id = e.target.id();
        const elIdx = elements.findIndex(e => e.id === id);
        if (elIdx > -1) {
          elements[elIdx].x = e.target.x();
          elements[elIdx].y = e.target.y();
        }
      });

      node.on('click tap', (e) => {
        if (viewModeOnly) return;
        e.cancelBubble = true;
        
        selectedElementId = node.id();
        selectedElementData = elements.find(el => el.id === selectedElementId);
        
        // Mostrar menú flotante cerca del nodo
        const pos = node.getAbsolutePosition();
        floatingMenuPos = { x: pos.x + 40, y: pos.y };
      });

      layer.add(node);
    });

    layer.draw();
  }

  function addElement(type: string) {
    const newEl = {
      id: crypto.randomUUID(), // Simulando el table_id real o un id de canvas
      type,
      x: 100,
      y: 100,
      name: type === 'wall' ? '' : 'Nueva',
      capacity: 4,
      width: type === 'wall' ? 100 : undefined,
      height: type === 'wall' ? 20 : undefined
    };
    elements = [...elements, newEl];
    drawCanvas();
  }

  function deleteSelected() {
    elements = elements.filter(e => e.id !== selectedElementId);
    selectedElementId = null;
    drawCanvas();
  }

  function updateSelected() {
    const idx = elements.findIndex(e => e.id === selectedElementId);
    if (idx > -1 && selectedElementData) {
      elements[idx] = { ...selectedElementData };
      drawCanvas();
    }
  }

  async function savePlan() {
    if (!selectedRoomId) return;
    saving = true;
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ layout_config: { elements } })
        .eq('id', selectedRoomId);

      if (error) throw error;
      alert('Plano guardado correctamente.');
    } catch (err) {
      console.error(err);
      alert('Error guardando plano.');
    } finally {
      saving = false;
    }
  }

  // Click en el fondo deselecciona
  function handleStageClick(e: any) {
    if (e.target === stage || e.target.name() === 'background') {
      selectedElementId = null;
    }
  }

  $: {
    if (selectedDate && stage) {
      loadLayoutAndBookings();
    }
  }

  onMount(() => {
    const savedId = localStorage.getItem('admin_restaurant_id');
    if (savedId) restaurantId = savedId;

    // Inicializar Konva
    stage = new Konva.Stage({
      container: container,
      width: container.offsetWidth,
      height: 500
    });
    
    layer = new Konva.Layer();
    stage.add(layer);

    stage.on('click tap', handleStageClick);

    // Ajustar tamaño al redimensionar ventana
    window.addEventListener('resize', () => {
      if (container && stage) {
        stage.width(container.offsetWidth);
        drawCanvas();
      }
    });

    loadRoomsAndBookings();
  });

  onDestroy(() => {
    if (stage) stage.destroy();
  });
</script>

<div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full relative">
  
  <!-- Toolbar -->
  <div class="p-4 border-b border-gray-100 bg-gray-50 flex flex-wrap justify-between items-center gap-4">
    <div class="flex items-center gap-4">
      <select 
        bind:value={selectedRoomId} 
        on:change={loadLayoutAndBookings}
        class="border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-brand outline-none font-medium"
      >
        <option value="" disabled>Selecciona una sala...</option>
        {#each rooms as room}
          <option value={room.id}>{room.nombre}</option>
        {/each}
      </select>

      {#if !viewModeOnly}
        <div class="h-6 w-px bg-gray-300"></div>
        <button on:click={() => addElement('square')} class="flex items-center gap-1 text-sm bg-white border border-gray-200 px-3 py-1.5 rounded hover:bg-gray-50 transition"><Square class="w-4 h-4"/> Mesa Cuadrada</button>
        <button on:click={() => addElement('round')} class="flex items-center gap-1 text-sm bg-white border border-gray-200 px-3 py-1.5 rounded hover:bg-gray-50 transition"><Circle class="w-4 h-4"/> Mesa Redonda</button>
        <button on:click={() => addElement('wall')} class="flex items-center gap-1 text-sm bg-white border border-gray-200 px-3 py-1.5 rounded hover:bg-gray-50 transition"><GripHorizontal class="w-4 h-4"/> Obstáculo</button>
      {/if}
    </div>

    {#if !viewModeOnly}
      <button 
        on:click={savePlan} 
        disabled={saving || !selectedRoomId}
        class="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-hover transition disabled:opacity-50"
      >
        {#if saving}
          <Loader2 class="w-4 h-4 animate-spin" />
        {:else}
          <Save class="w-4 h-4" /> Guardar Plano
        {/if}
      </button>
    {/if}
  </div>

  <!-- Legend -->
  <div class="px-4 py-2 bg-white border-b border-gray-100 flex gap-4 text-xs font-medium text-gray-500">
    <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-[#e0f2fe] border border-[#004aad]"></span> Libre</span>
    <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-[#fee2e2] border border-[#ef4444]"></span> Ocupada (Día {selectedDate})</span>
    <span class="flex items-center gap-1"><span class="w-3 h-3 bg-[#cbd5e1] border border-[#94a3b8]"></span> Pared/Obstáculo</span>
  </div>

  <!-- Canvas Container -->
  <div class="flex-1 bg-gray-100 overflow-hidden relative">
    <div bind:this={container} class="w-full h-full cursor-crosshair"></div>

    <!-- Floating Form Editor -->
    {#if selectedElementId && selectedElementData && !viewModeOnly}
      <div 
        class="absolute bg-white shadow-xl border border-gray-200 rounded-lg p-4 w-64 z-10"
        style="top: {floatingMenuPos.y}px; left: {floatingMenuPos.x}px;"
      >
        <div class="flex justify-between items-center mb-3">
          <h4 class="font-bold text-gray-800 text-sm">{selectedElementData.type === 'wall' ? 'Editar Obstáculo' : 'Editar Mesa'}</h4>
          <button on:click={() => selectedElementId = null} class="text-gray-400 hover:text-gray-600">&times;</button>
        </div>

        {#if selectedElementData.type !== 'wall'}
          <div class="space-y-3">
            <div>
              <label class="block text-xs text-gray-500 mb-1">Nombre / Número</label>
              <input type="text" bind:value={selectedElementData.name} on:input={updateSelected} class="w-full border border-gray-300 rounded p-1.5 text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Capacidad (pax)</label>
              <input type="number" bind:value={selectedElementData.capacity} on:input={updateSelected} class="w-full border border-gray-300 rounded p-1.5 text-sm" />
            </div>
            <div class="flex items-center gap-2 mt-2">
              <input type="checkbox" bind:checked={selectedElementData.isCombinable} on:change={updateSelected} id="combinable" class="accent-brand" />
              <label for="combinable" class="text-xs text-gray-600">Es combinable</label>
            </div>
          </div>
        {:else}
           <div class="space-y-3">
            <div>
              <label class="block text-xs text-gray-500 mb-1">Ancho</label>
              <input type="number" bind:value={selectedElementData.width} on:input={updateSelected} class="w-full border border-gray-300 rounded p-1.5 text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Alto</label>
              <input type="number" bind:value={selectedElementData.height} on:input={updateSelected} class="w-full border border-gray-300 rounded p-1.5 text-sm" />
            </div>
          </div>
        {/if}

        <div class="mt-4 pt-3 border-t border-gray-100 flex justify-end">
          <button on:click={deleteSelected} class="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium">
            <Trash2 class="w-3 h-3" /> Eliminar
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
