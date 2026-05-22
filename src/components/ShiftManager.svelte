<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase';
  import { Clock, Plus, Trash2, Edit2, Loader2, Save, Calendar as CalendarIcon } from 'lucide-svelte';

  export let restaurantId: string = '00000000-0000-0000-0000-000000000000';

  let shifts: any[] = [];
  let overrides: any[] = [];
  let loading = true;
  let processing = false;

  // Formulario Turno
  let newShiftName = '';
  let newShiftStart = '13:00';
  let newShiftEnd = '16:00';
  let newShiftCapacity = 50;
  let newShiftDuration = 90;

  // Formulario Excepciones
  let newOverrideDate = '';
  let newOverrideCapacity = 50;
  let selectedShiftIdForOverride = '';

  async function loadData() {
    loading = true;
    try {
      const [shiftsRes, overridesRes] = await Promise.all([
        supabase.from('shifts').select('*').eq('restaurant_id', restaurantId).order('start_time'),
        supabase.from('shift_overrides')
          .select('*, shifts!inner(restaurant_id, name)')
          .eq('shifts.restaurant_id', restaurantId)
          .order('date', { ascending: false })
      ]);

      if (shiftsRes.error) throw shiftsRes.error;
      if (overridesRes.error) throw overridesRes.error;

      shifts = shiftsRes.data || [];
      overrides = overridesRes.data || [];
      if (shifts.length > 0 && !selectedShiftIdForOverride) {
        selectedShiftIdForOverride = shifts[0].id;
      }
    } catch (err) {
      console.error('Error cargando turnos:', err);
    } finally {
      loading = false;
    }
  }

  async function addShift() {
    if (!newShiftName.trim()) return;
    processing = true;
    try {
      const { data, error } = await supabase.from('shifts').insert([{
        restaurant_id: restaurantId,
        name: newShiftName,
        start_time: newShiftStart,
        end_time: newShiftEnd,
        default_capacity: newShiftCapacity,
        duration_minutes: newShiftDuration
      }]).select().single();

      if (error) throw error;
      shifts = [...shifts, data];
      newShiftName = '';
      if (!selectedShiftIdForOverride) selectedShiftIdForOverride = data.id;
    } catch (err) {
      console.error('Error añadiendo turno:', err);
      alert('Error al añadir turno');
    } finally {
      processing = false;
    }
  }

  async function deleteShift(id: string) {
    if (!confirm('Eliminar este turno también eliminará sus excepciones. ¿Continuar?')) return;
    processing = true;
    try {
      const { error } = await supabase.from('shifts').delete().eq('id', id);
      if (error) throw error;
      shifts = shifts.filter(s => s.id !== id);
      overrides = overrides.filter(o => o.shift_id !== id);
    } catch (err) {
      console.error('Error eliminando turno:', err);
      alert('Error al eliminar turno');
    } finally {
      processing = false;
    }
  }

  async function addOverride() {
    if (!newOverrideDate || !selectedShiftIdForOverride) return;
    processing = true;
    try {
      const { data, error } = await supabase.from('shift_overrides').insert([{
        shift_id: selectedShiftIdForOverride,
        date: newOverrideDate,
        capacity_override: newOverrideCapacity
      }]).select('*, shifts!inner(restaurant_id, name)').single();

      if (error) {
        if (error.code === '23505') { // Unique violation
            alert('Ya existe una excepción para este turno y fecha. Elimínala primero si quieres cambiarla.');
        } else throw error;
      } else {
        overrides = [data, ...overrides];
        newOverrideDate = '';
      }
    } catch (err) {
      console.error('Error añadiendo excepción:', err);
      alert('Error al añadir excepción');
    } finally {
      processing = false;
    }
  }

  async function deleteOverride(id: string) {
    processing = true;
    try {
      const { error } = await supabase.from('shift_overrides').delete().eq('id', id);
      if (error) throw error;
      overrides = overrides.filter(o => o.id !== id);
    } catch (err) {
      console.error('Error eliminando excepción:', err);
      alert('Error al eliminar excepción');
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

<div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
  <div class="p-6 border-b border-gray-100 bg-gray-50">
    <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
      <Clock class="w-5 h-5 text-brand" /> Gestor de Turnos (Shifts)
    </h2>
    <p class="text-sm text-gray-500 mt-1">Configura turnos, duraciones y aforos base.</p>
  </div>

  <div class="p-6">
    <form on:submit|preventDefault={addShift} class="flex flex-col md:flex-row gap-3 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
      <input type="text" bind:value={newShiftName} placeholder="Nombre (Ej. Comida)" required class="border border-gray-300 rounded p-2 text-sm flex-1" />
      <input type="time" bind:value={newShiftStart} required class="border border-gray-300 rounded p-2 text-sm w-32" />
      <input type="time" bind:value={newShiftEnd} required class="border border-gray-300 rounded p-2 text-sm w-32" />
      <input type="number" bind:value={newShiftDuration} placeholder="Duración (min)" required class="border border-gray-300 rounded p-2 text-sm w-32" title="Duración de la reserva en minutos" />
      <input type="number" bind:value={newShiftCapacity} placeholder="Aforo Base" required class="border border-gray-300 rounded p-2 text-sm w-32" />
      <button type="submit" disabled={processing || !newShiftName} class="bg-brand text-white px-4 py-2 rounded text-sm font-bold flex items-center justify-center gap-1 hover:bg-brand-hover disabled:opacity-50">
        <Plus class="w-4 h-4"/> Añadir
      </button>
    </form>

    {#if loading}
      <div class="flex justify-center"><Loader2 class="w-8 h-8 animate-spin text-brand" /></div>
    {:else if shifts.length === 0}
      <div class="text-center py-6 text-gray-400">No hay turnos configurados. Añade uno.</div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {#each shifts as shift}
          <div class="border border-gray-200 rounded-lg p-4 flex justify-between items-start group">
            <div>
              <h4 class="font-bold text-gray-900">{shift.name}</h4>
              <p class="text-xs text-gray-500 mt-1">{shift.start_time.slice(0,5)} - {shift.end_time.slice(0,5)}</p>
              <div class="flex gap-3 mt-2 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded inline-block">
                <span>⏱ {shift.duration_minutes} min</span>
                <span>👥 {shift.default_capacity} pax</span>
              </div>
            </div>
            <button on:click={() => deleteShift(shift.id)} class="text-gray-400 hover:text-red-500 transition opacity-0 group-hover:opacity-100 p-1">
              <Trash2 class="w-4 h-4"/>
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
  <div class="p-6 border-b border-gray-100 bg-orange-50/50">
    <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
      <CalendarIcon class="w-5 h-5 text-orange-500" /> Calendario de Excepciones (Overrides)
    </h2>
    <p class="text-sm text-gray-500 mt-1">Cambia el aforo de un turno en un día específico (Ej. Nochevieja o Cierre por reformas -> aforo 0).</p>
  </div>

  <div class="p-6">
    <form on:submit|preventDefault={addOverride} class="flex flex-col md:flex-row gap-3 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
      <input type="date" bind:value={newOverrideDate} required class="border border-gray-300 rounded p-2 text-sm w-40" />
      <select bind:value={selectedShiftIdForOverride} required class="border border-gray-300 rounded p-2 text-sm flex-1">
        <option value="" disabled>Selecciona un turno...</option>
        {#each shifts as shift}
          <option value={shift.id}>{shift.name} ({shift.start_time.slice(0,5)})</option>
        {/each}
      </select>
      <input type="number" bind:value={newOverrideCapacity} placeholder="Nuevo Aforo" required class="border border-gray-300 rounded p-2 text-sm w-32" />
      <button type="submit" disabled={processing || !newOverrideDate || !selectedShiftIdForOverride} class="bg-orange-500 text-white px-4 py-2 rounded text-sm font-bold flex items-center justify-center gap-1 hover:bg-orange-600 disabled:opacity-50">
        <Plus class="w-4 h-4"/> Excepción
      </button>
    </form>

    {#if !loading}
        <div class="space-y-2">
            {#each overrides as override}
            <div class="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                <div class="flex items-center gap-4">
                    <span class="font-bold text-sm text-gray-800">{new Date(override.date).toLocaleDateString('es-ES')}</span>
                    <span class="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">{override.shifts.name}</span>
                    <span class="text-sm font-medium {override.capacity_override === 0 ? 'text-red-500' : 'text-orange-600'}">
                        Aforo: {override.capacity_override}
                    </span>
                </div>
                <button on:click={() => deleteOverride(override.id)} class="text-gray-400 hover:text-red-500 p-1"><Trash2 class="w-4 h-4"/></button>
            </div>
            {/each}
        </div>
    {/if}
  </div>
</div>
