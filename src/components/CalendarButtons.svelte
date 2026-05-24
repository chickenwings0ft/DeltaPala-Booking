<script lang="ts">
  // Props: pasar los datos del evento/reserva
  export let title: string = '';        // Nombre del evento / "Reserva en {restaurante}"
  export let date: string = '';         // YYYY-MM-DD
  export let time: string = '';         // HH:MM
  export let description: string = '';  // Texto libre

  // Genera la cadena de fecha/hora en formato iCal: YYYYMMDDTHHMMSS
  function toIcalDate(dateStr: string, timeStr: string, endMinutes = 90) {
    const clean = dateStr.replace(/-/g, '');
    const t = timeStr ? timeStr.replace(/:/g, '').slice(0, 4) + '00' : '000000';
    const startDt = `${clean}T${t}`;

    // Calcular end time
    if (timeStr) {
      const [h, m] = timeStr.split(':').map(Number);
      const totalMins = h * 60 + m + endMinutes;
      const eh = String(Math.floor(totalMins / 60) % 24).padStart(2, '0');
      const em = String(totalMins % 60).padStart(2, '0');
      return { start: startDt, end: `${clean}T${eh}${em}00` };
    }
    return { start: startDt, end: startDt };
  }

  function getGoogleCalendarUrl() {
    const { start, end } = toIcalDate(date, time);
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${start}/${end}`,
      details: description,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function getIcsContent() {
    const { start, end } = toIcalDate(date, time);
    const uid = `${Date.now()}@reservas`;
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//DeltaPala Booking//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${description}`,
      `UID:${uid}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
  }

  function downloadIcs() {
    const content = getIcsContent();
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-z0-9]/gi, '_')}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function openAppleWalletInfo() {
    alert('La integración con Apple Wallet requiere certificados de Apple Developer. Esta función estará disponible en la versión de producción. Por ahora, puedes usar el archivo .ics para añadir el evento a tu calendario de Apple.');
  }

  function openAndroidWalletInfo() {
    alert('La integración con Google Wallet requiere una cuenta de Google Pay & Wallet Console. Esta función estará disponible en la versión de producción. Por ahora, puedes usar Google Calendar para guardar el evento.');
  }
</script>

<div class="w-full space-y-2.5 mt-4">
  <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Añadir a tu calendario</p>

  <!-- Google Calendar -->
  <a
    href={getGoogleCalendarUrl()}
    target="_blank"
    rel="noopener noreferrer"
    class="w-full bg-white border border-gray-200 text-gray-700 font-bold py-3 px-4 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition flex items-center gap-3 shadow-sm group"
  >
    <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.5 12.28c0-.79-.07-1.54-.19-2.28H12v4.3h6.44c-.28 1.4-1.04 2.58-2.18 3.34v2.77h3.52c2.06-1.9 3.25-4.69 3.25-8.13z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.52-2.77c-1.08.72-2.46 1.15-4.41 1.15-3.4 0-6.28-2.29-7.31-5.37H1.05v2.85C3.04 20.91 7.18 24 12 24z"/>
      <path fill="#FBBC05" d="M4.69 14.1c-.26-.78-.41-1.61-.41-2.46s.15-1.68.41-2.46V6.33H1.05C.38 7.77 0 9.35 0 11.02s.38 3.25 1.05 4.69l3.64-2.85z"/>
      <path fill="#EA4335" d="M12 4.93c1.76 0 3.34.61 4.59 1.79l3.43-3.43C17.95 1.25 15.24 0 12 0 7.18 0 3.04 3.09 1.05 7.04l3.64 2.85C5.72 7.22 8.6 4.93 12 4.93z"/>
    </svg>
    <span class="flex-1 text-left text-sm">Añadir a Google Calendar</span>
    <svg class="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
  </a>

  <!-- Apple / Outlook (ICS download) -->
  <button
    on:click={downloadIcs}
    class="w-full bg-white border border-gray-200 text-gray-700 font-bold py-3 px-4 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition flex items-center gap-3 shadow-sm group"
  >
    <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#FA0F00"/>
      <rect x="3" y="5" width="18" height="16" rx="2" fill="white"/>
      <path d="M7 3v4M17 3v4M3 9h18" stroke="#FA0F00" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M8 13h2m-2 3h2m4-3h2m-2 3h2" stroke="#FA0F00" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <span class="flex-1 text-left text-sm">Añadir a Apple / Outlook (.ics)</span>
    <svg class="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
  </button>


</div>
