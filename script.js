document.addEventListener("DOMContentLoaded", () => {
  const statusEl = document.getElementById("status");
  const enderecoEl = document.getElementById("endereco");

  if (!navigator.geolocation) {
    statusEl.textContent = "Geolocalização não suportada.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      statusEl.textContent = `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`;

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        );
        const data = await response.json();
        enderecoEl.textContent = data.display_name || "Endereço não encontrado.";
      } catch (err) {
        enderecoEl.textContent = "Erro ao buscar endereço.";
      }
    },
    (err) => {
      statusEl.textContent = "Erro ao obter localização: " + err.message;
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );
});
