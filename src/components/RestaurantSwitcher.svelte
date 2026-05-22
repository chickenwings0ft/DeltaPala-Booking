<script lang="ts">
  import { onMount } from 'svelte';
  import { MapPin } from 'lucide-svelte';

  let selectedId = '';
  // Usaremos UUIDs de ejemplo. Cuando subas a Supabase, reemplázalos por los UUIDs reales de tu tabla `restaurants`.
  const restaurants = [
    { id: '11111111-1111-1111-1111-111111111111', name: 'Roots Logroño' },
    { id: '22222222-2222-2222-2222-222222222222', name: 'Roots Haro' }
  ];

  onMount(() => {
    const saved = localStorage.getItem('admin_restaurant_id');
    if (saved) {
      selectedId = saved;
    } else {
      selectedId = restaurants[0].id;
      localStorage.setItem('admin_restaurant_id', selectedId);
    }
  });

  function handleChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    localStorage.setItem('admin_restaurant_id', target.value);
    window.location.reload(); // Recargar la página para que todos los componentes carguen el nuevo ID
  }
</script>

<div class="px-4 py-4 mt-auto border-t border-gray-200">
  <div class="flex items-center gap-2 mb-2 text-xs font-bold text-gray-500 uppercase">
    <MapPin class="w-3 h-3" /> Restaurante Activo
  </div>
  <select 
    bind:value={selectedId} 
    on:change={handleChange}
    class="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-brand focus:border-brand block p-2 font-medium"
  >
    {#each restaurants as r}
      <option value={r.id}>{r.name}</option>
    {/each}
  </select>
</div>
