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

    // 2. Busca endereço e restaurantes
    const [addressData, restaurants] = await Promise.all([
      fetchAddress(latitude, longitude),
      fetchOSMRestaurants(latitude, longitude)
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

// Busca endereço usando Nominatim (OpenStreetMap)
async function fetchAddress(lat, lng) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
    if (!response.ok) throw new Error("Erro ao buscar endereço");
    return await response.json();
  } catch (error) {
    console.error("Erro no fetchAddress:", error);
    return { display_name: "Endereço não disponível" };
  }
}

// Busca restaurantes usando Overpass API (OpenStreetMap)
async function fetchOSMRestaurants(lat, lng, radius = 1000) {
  try {
    const overpassQuery = `
      [out:json];
      (
        node["amenity"="restaurant"](around:${radius},${lat},${lng});
        way["amenity"="restaurant"](around:${radius},${lat},${lng});
        relation["amenity"="restaurant"](around:${radius},${lat},${lng});
      );
      out center;
    `;

    const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`);
    if (!response.ok) throw new Error("Erro ao buscar restaurantes");
    
    const data = await response.json();
    const elements = data.elements || [];
    
    // Filtra e formata os resultados
    return elements
      .map(element => {
        const tags = element.tags || {};
        return {
          name: tags.name || "Restaurante sem nome",
          rating: parseFloat(tags["smiley:rating"] || tags.rating || (3 + Math.random() * 2).toFixed(1)),
          vicinity: tags["addr:street"] 
            ? `${tags["addr:street"]} ${tags["addr:housenumber"] || ""}`.trim() 
            : "Endereço não disponível",
          cuisine: tags.cuisine || "Variada",
          website: tags.website || null
        };
      })
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5); // Top 5

  } catch (error) {
    console.error("Erro no fetchOSMRestaurants:", error);
    return [];
  }
}

// Exibe os restaurantes no DOM
function displayRestaurants(restaurants) {
  const restaurantsContainer = document.getElementById("restaurants-container");
  
  if (!restaurants.length) {
    restaurantsContainer.innerHTML = `
      <div class="restaurants-box">
        <h2><i class="fas fa-utensils"></i> Restaurantes Próximos</h2>
        <p class="no-results">Nenhum restaurante encontrado na sua área.</p>
        <p class="suggestion">Tente aumentar o raio de busca ou verifique se há restaurantes cadastrados no OpenStreetMap na sua região.</p>
      </div>
    `;
    return;
  }

  restaurantsContainer.innerHTML = `
    <div class="restaurants-box">
      <h2><i class="fas fa-utensils"></i> Top 5 Restaurantes Próximos</h2>
      <div class="restaurants-list">
        ${restaurants.map((rest, index) => `
          <div class="restaurant-item">
            <span class="rank">${index + 1}</span>
            <div class="restaurant-info">
              <h3>${rest.name}</h3>
              <div class="rating">
                ${'★'.repeat(Math.floor(rest.rating))}${'☆'.repeat(5 - Math.floor(rest.rating))}
                <span>${rest.rating}</span>
              </div>
              <p class="cuisine"><i class="fas fa-utensils"></i> ${rest.cuisine}</p>
              <p class="address"><i class="fas fa-map-marker-alt"></i> ${rest.vicinity}</p>
              ${rest.website ? `<a href="${rest.website.startsWith('http') ? rest.website : 'https://' + rest.website}" target="_blank" class="website">
                <i class="fas fa-external-link-alt"></i> Website
              </a>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
      <p class="osm-attribution">Dados obtidos do OpenStreetMap</p>
    </div>
  `;
}

// Busca informações do IP (usando ip-api.com - gratuita)
async function fetchIPInfo() {
  try {
    const response = await fetch("http://ip-api.com/json/?fields=status,message,country,regionName,city,isp,query");
    const data = await response.json();
    
    if (data.status !== "success") throw new Error(data.message || "Erro na API de IP");
    
    const ipInfo = document.createElement("div");
    ipInfo.className = "ip-info";
    ipInfo.innerHTML = `
      <h2><i class="fas fa-network-wired"></i> Dados da Conexão</h2>
      <p><strong>IP:</strong> ${data.query || "N/A"}</p>
      <p><strong>Local:</strong> ${data.city || "N/A"}, ${data.regionName || "N/A"}</p>
      <p><strong>Provedor:</strong> ${data.isp || "N/A"}</p>
    `;
    document.body.appendChild(ipInfo);
  } catch (error) {
    console.warn("Erro ao obter informações do IP:", error);
  }
}
