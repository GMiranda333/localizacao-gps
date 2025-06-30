document.addEventListener("DOMContentLoaded", async () => {
  // Elementos do DOM
  const statusEl = document.getElementById("status");
  const enderecoEl = document.getElementById("endereco");
  const restaurantsContainer = document.createElement("div");
  restaurantsContainer.id = "restaurants-container";
  document.body.appendChild(restaurantsContainer);

  // Verifica suporte à geolocalização
  if (!navigator.geolocation) {
    statusEl.textContent = "Geolocalização não suportada.";
    restaurantsContainer.innerHTML = "<p>Não foi possível acessar sua localização para buscar restaurantes próximos.</p>";
    return;
  }

  try {
    // 1. Obtém a localização atual
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });

    const { latitude, longitude } = position.coords;
    statusEl.textContent = `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`;

    // 2. Busca endereço e restaurantes em paralelo
    const [addressData, restaurants] = await Promise.all([
      fetchAddress(latitude, longitude),
      fetchNearbyRestaurants(latitude, longitude)
    ]);

    enderecoEl.textContent = addressData.display_name || "Endereço não encontrado.";
    displayRestaurants(restaurants);

  } catch (error) {
    console.error("Erro:", error);
    statusEl.textContent = error.message.includes("permission") 
      ? "Permissão de localização negada. Ative para ver restaurantes próximos."
      : "Erro ao obter localização: " + error.message;
    restaurantsContainer.innerHTML = "<p>Não foi possível carregar restaurantes próximos.</p>";
  }

  // Busca informações do IP (opcional)
  fetchIPInfo();
});

// Funções auxiliares
async function fetchAddress(lat, lng) {
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
  return await response.json();
}

async function fetchNearbyRestaurants(lat, lng) {
  // IMPLEMENTE COM API REAL (exemplo com Google Places):
  // const response = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?
  //   location=${lat},${lng}&radius=500&type=restaurant&key=SUA_CHAVE_API`);
  // const data = await response.json();
  // return data.results.sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5);

  // Mock data - substitua pelo código acima em produção
  return [
    { name: "Restaurante Gourmet", rating: 4.9, vicinity: "Av. Principal, 100", open_now: true },
    { name: "Cozinha Caseira", rating: 4.7, vicinity: "Rua das Flores, 200", open_now: true },
    { name: "Sabor Natural", rating: 4.5, vicinity: "Alameda Santos, 300", open_now: false },
    { name: "Pizzaria Top", rating: 4.3, vicinity: "Praça Central, 400", open_now: true },
    { name: "Lanchonete Boa", rating: 4.2, vicinity: "Travessa dos Sabores, 500", open_now: true }
  ];
}

function displayRestaurants(restaurants) {
  const restaurantsContainer = document.getElementById("restaurants-container");
  restaurantsContainer.innerHTML = `
    <div class="restaurants-box">
      <h2><i class="fas fa-utensils"></i> Top 5 Restaurantes Próximos</h2>
      ${restaurants.length ? `
        <div class="restaurants-list">
          ${restaurants.map((rest, index) => `
            <div class="restaurant-item">
              <span class="rank">${index + 1}</span>
              <div class="restaurant-info">
                <h3>${rest.name}</h3>
                <div class="rating">
                  ${'★'.repeat(Math.floor(rest.rating))}${'☆'.repeat(5 - Math.floor(rest.rating))}
                  <span>${rest.rating.toFixed(1)}</span>
                </div>
                <p class="address"><i class="fas fa-map-marker-alt"></i> ${rest.vicinity}</p>
                <p class="status ${rest.open_now ? 'open' : 'closed'}">
                  ${rest.open_now ? '🟢 Aberto agora' : '🔴 Fechado'}
                </p>
              </div>
            </div>
          `).join('')}
        </div>
      ` : '<p class="no-results">Nenhum restaurante encontrado próximo a você.</p>'}
    </div>
  `;
}

async function fetchIPInfo() {
  try {
    const response = await fetch("https://ipapi.co/json/");
    const data = await response.json();
    
    const ipInfo = document.createElement("div");
    ipInfo.className = "ip-info";
    ipInfo.innerHTML = `
      <h2><i class="fas fa-network-wired"></i> Dados da Conexão</h2>
      <p><strong>IP:</strong> ${data.ip || "N/A"}</p>
      <p><strong>Local:</strong> ${data.city || "N/A"}, ${data.region || "N/A"}</p>
      <p><strong>Provedor:</strong> ${data.org || "N/A"}</p>
    `;
    document.body.appendChild(ipInfo);
  } catch (error) {
    console.warn("Erro ao obter informações do IP:", error);
  }
}
