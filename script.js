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
        timeout: 15000
      });
    });

    const { latitude, longitude } = pos.coords;
    statusEl.innerHTML = `<i class="fas fa-check-circle"></i> Localização obtida: Lat ${latitude.toFixed(5)}, Lon ${longitude.toFixed(5)}`;

    // Endereço
    const address = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pt-BR`)
      .then(res => res.json());
    enderecoEl.innerHTML = `<i class="fas fa-map-marked-alt"></i> ${address.display_name || "Endereço não encontrado"}`;

    // Restaurantes
    const restaurants = await fetchRestaurants(latitude, longitude);
    displayRestaurants(restaurants, latitude, longitude);
    restaurantsSection.style.display = "block";

  } catch (err) {
    statusEl.innerHTML = `<i class="fas fa-times-circle"></i> Erro ao obter localização: ${err.message}`;
  }
});

async function fetchRestaurants(lat, lon, radius = 1200) {
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="restaurant"](around:${radius},${lat},${lon});
      way["amenity"="restaurant"](around:${radius},${lat},${lon});
      relation["amenity"="restaurant"](around:${radius},${lat},${lon});
    );
    out center;
  `;
  const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
  const data = await res.json();

  const restaurantes = data.elements
    .filter(el => el.tags?.name)
    .map(el => {
      return {
        nome: el.tags.name,
        tipo: el.tags.cuisine || "Diverso",
        rating: parseFloat((el.tags["smiley:rating"] || (3.5 + Math.random() * 1.5)).toFixed(1)),
        lat: el.lat || el.center?.lat,
        lon: el.lon || el.center?.lon,
        endereco: el.tags["addr:street"] ? `${el.tags["addr:street"]}, ${el.tags["addr:housenumber"] || ''}`.trim() : "Endereço não disponível"
      };
    })
    .sort((a, b) => b.rating - a.rating);

  return restaurantes;
}

function displayRestaurants(restaurants, userLat, userLon) {
  const container = document.getElementById("restaurants-container");
  container.innerHTML = "";

  if (!restaurants.length) return; // Não mostra mensagem quando não há restaurantes

  const grid = document.createElement("div");
  grid.className = "restaurants-grid";

  // Adiciona cálculo de distância e ordena por rating (já está vindo ordenado do fetch)
  restaurants.forEach(rest => {
    const distance = calculateDistance(userLat, userLon, rest.lat, rest.lon);
    const card = document.createElement("div");
    card.className = "restaurant-card";

    const imageUrl = `https://source.unsplash.com/300x200/?restaurant,${rest.tipo}`;
    const stars = '★'.repeat(Math.round(rest.rating)) + '☆'.repeat(5 - Math.round(rest.rating));

    card.innerHTML = `
      <div class="restaurant-image" style="background-image: url('${imageUrl}')"></div>
      <div class="restaurant-info">
        <h3>${rest.nome}</h3>
        <p class="cuisine"><i class="fas fa-utensils"></i> ${rest.tipo}</p>
        <p class="address"><i class="fas fa-map-marker-alt"></i> ${rest.endereco}</p>
        <p class="distance"><i class="fas fa-location-arrow"></i> ${distance.toFixed(1)} km</p>
        <div class="rating-container">
          <span class="stars">${stars}</span>
          <span class="rating-value">${rest.rating.toFixed(1)}</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  container.appendChild(grid);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
