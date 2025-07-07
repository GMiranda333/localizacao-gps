document.addEventListener("DOMContentLoaded", async () => {
  const statusEl = document.getElementById("status");
  const enderecoEl = document.getElementById("endereco");
  const restaurantsSection = document.getElementById("restaurants-section");
  const restaurantsContainer = document.getElementById("restaurants-container");

  if (!navigator.geolocation) {
    statusEl.innerHTML = "<i class='fas fa-exclamation-triangle'></i> Geolocalização não suportada.";
    return;
  }

  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 20000
      });
    });

    const { latitude, longitude } = pos.coords;
    statusEl.innerHTML = `<i class="fas fa-check-circle"></i> Localização obtida com sucesso`;

    // Obter endereço (opcional)
    try {
      const address = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pt-BR`)
        .then(res => res.json());
      enderecoEl.innerHTML = `<i class="fas fa-map-marked-alt"></i> ${address.display_name || "Sua localização atual"}`;
    } catch (e) {
      enderecoEl.innerHTML = `<i class="fas fa-map-marked-alt"></i> Localização: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }

    // Buscar restaurantes com fallback
    let restaurants = await fetchRestaurants(latitude, longitude, 5000);
    
    // Se não encontrou, tenta com raio maior
    if (restaurants.length === 0) {
      restaurants = await fetchRestaurants(latitude, longitude, 10000);
    }
    
    displayRestaurants(restaurants, latitude, longitude);
    restaurantsSection.style.display = "block";

  } catch (err) {
    statusEl.innerHTML = `<i class="fas fa-times-circle"></i> Erro: ${err.message}`;
    console.error("Erro:", err);
  }
});

async function fetchRestaurants(lat, lon, radius = 5000) {
  try {
    const query = `
      [out:json][timeout:45];
      (
        node["amenity"="restaurant"](around:${radius},${lat},${lon});
        way["amenity"="restaurant"](around:${radius},${lat},${lon});
        relation["amenity"="restaurant"](around:${radius},${lat},${lon});
      );
      out body;
      >;
      out skel qt;
    `;
    
    const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    return data.elements
      .filter(el => el.tags?.name) // Filtra apenas elementos com nome
      .map(el => ({
        nome: el.tags.name,
        tipo: el.tags.cuisine || "Restaurante",
        rating: parseFloat(el.tags.rating || el.tags["smiley:rating"] || (3.5 + Math.random() * 1.5)).toFixed(1),
        lat: el.lat || (el.center && el.center.lat),
        lon: el.lon || (el.center && el.center.lon),
        endereco: buildAddress(el.tags)
      }))
      .sort((a, b) => b.rating - a.rating);
      
  } catch (error) {
    console.error("Erro na API:", error);
    return [];
  }
}

function buildAddress(tags) {
  if (tags["addr:street"]) {
    return `${tags["addr:street"]}${tags["addr:housenumber"] ? ', ' + tags["addr:housenumber"] : ''}`;
  }
  return tags["addr:full"] || "Endereço disponível no mapa";
}

function displayRestaurants(restaurants, userLat, userLon) {
  const container = document.getElementById("restaurants-container");
  container.innerHTML = "";

  if (!restaurants || restaurants.length === 0) {
    container.innerHTML = `
      <div class="no-restaurants">
        <i class="fas fa-info-circle"></i>
        <p>Não encontramos restaurantes no raio de busca.</p>
        <p>Tente novamente em uma área urbana ou aumente o raio de busca.</p>
      </div>
    `;
    return;
  }

  const grid = document.createElement("div");
  grid.className = "restaurants-grid";

  restaurants.forEach(rest => {
    const distance = calculateDistance(userLat, userLon, rest.lat, rest.lon);
    const card = document.createElement("div");
    card.className = "restaurant-card";
    const stars = '★'.repeat(Math.round(rest.rating)) + '☆'.repeat(5 - Math.round(rest.rating));

    card.innerHTML = `
      <div class="restaurant-image" style="background-image: url('https://source.unsplash.com/300x200/?restaurant,${rest.tipo.replace(/\s+/g, '-')}')">
        <span class="distance-badge"><i class="fas fa-location-arrow"></i> ${distance.toFixed(1)} km</span>
      </div>
      <div class="restaurant-info">
        <h3>${rest.nome}</h3>
        <p class="cuisine"><i class="fas fa-utensils"></i> ${rest.tipo}</p>
        <p class="address"><i class="fas fa-map-marker-alt"></i> ${rest.endereco}</p>
        <div class="rating-container">
          <span class="stars">${stars}</span>
          <span class="rating-value">${rest.rating}</span>
        </div>
        <a href="https://www.openstreetmap.org/?mlat=${rest.lat}&mlon=${rest.lon}" target="_blank" class="map-link">
          <i class="fas fa-external-link-alt"></i> Ver no mapa
        </a>
      </div>
    `;
    grid.appendChild(card);
  });

  container.appendChild(grid);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
