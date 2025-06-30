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

  // Busca IP e informações da conexão
  fetch("https://ipinfo.io/json?token=SEU_TOKEN_AQUI") // ou remova ?token=... se estiver usando sem conta
    .then((response) => response.json())
    .then((data) => {
      const ipInfo = document.createElement("div");
      ipInfo.id = "ip-info";
      ipInfo.innerHTML = `
        <h2>Dados da Conexão</h2>
        <p><strong>IP:</strong> ${data.ip}</p>
        <p><strong>Local:</strong> ${data.city}, ${data.region} - ${data.country}</p>
        <p><strong>Provedor:</strong> ${data.org}</p>
      `;
      document.body.appendChild(ipInfo);
    })
    .catch((err) => {
      console.warn("Erro ao obter IP:", err);
    });
});
