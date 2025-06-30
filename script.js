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

  // Busca IP e informações da conexão via ipapi.co (sem token)
  fetch("https://ipapi.co/json/")
    .then((response) => response.json())
    .then((data) => {
      const ipInfo = document.createElement("div");
      ipInfo.id = "ip-info";
      ipInfo.style.marginTop = "30px";
      ipInfo.style.padding = "20px";
      ipInfo.style.borderRadius = "12px";
      ipInfo.style.backgroundColor = "#eaf6ff";
      ipInfo.style.maxWidth = "500px";
      ipInfo.style.marginLeft = "auto";
      ipInfo.style.marginRight = "auto";
      ipInfo.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)";
      ipInfo.innerHTML = `
        <h2 style="color: #0077cc">Dados da Conexão</h2>
        <p><strong>IP:</strong> ${data.ip || "N/A"}</p>
        <p><strong>Local:</strong> ${data.city || "N/A"}, ${data.region || "N/A"} - ${data.country_name || "N/A"}</p>
        <p><strong>Provedor:</strong> ${data.org || "N/A"}</p>
      `;
      document.body.appendChild(ipInfo);
    })
    .catch((err) => {
      console.warn("Erro ao obter IP:", err);
    });
});
