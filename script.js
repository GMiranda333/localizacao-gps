document.addEventListener("DOMContentLoaded", () => {
  const statusEl = document.getElementById("status");
  const enderecoEl = document.getElementById("endereco");

  // Verifica suporte à geolocalização
  if (!navigator.geolocation) {
    statusEl.textContent = "Geolocalização não suportada.";
    return;
  }

  // Obtém coordenadas GPS
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

  // 🔽 Adiciona bloco de IP e conexão
  fetch("https://ipinfo.io/json?token=atualize_se_necessario")
    .then((response) => response.json())
    .then((data) => {
      const ipContainer = document.createElement("div");
      ipContainer.style.marginTop = "30px";
      ipContainer.innerHTML = `
        <h2>Dados da Con
