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
    displayRestaurants(restaurants);
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
        lon: el.lon || el.center?.lon
      };
    })
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 10);

  return restaurantes;
}

function displayRestaurants(restaurants) {
  const container = document.getElementById("restaurants-container");

  if (!restaurants.length) {
    container.innerHTML = `
      <div class="no-restaurants">
        <i class="fas fa-utensils fa-3x"></i>
        <h3>Nenhum restaurante encontrado próximo a você</h3>
        <p>Tente aumentar o raio de busca ou verificar a conexão.</p>
      </div>
    `;
    return;
  }

  const grid = document.createElement("div");
  grid.className = "restaurants-grid";

  restaurants.forEach(rest => {
    const card = document.createElement("div");
    card.className = "restaurant-card";

    const imageUrl = `https://source.unsplash.com/300x200/?restaurant,${rest.tipo}`;

    card.innerHTML = `
      <div class="restaurant-image" style="background-image: url('${imageUrl}')"></div>
      <div class="restaurant-info">
        <h3>${rest.nome}</h3>
        <p class="cuisine"><i class="fas fa-utensils"></i> ${rest.tipo}</p>
        <p class="address"><i class="fas fa-map-marker-alt"></i> 
          <a href="https://www.openstreetmap.org/?mlat=${rest.lat}&mlon=${rest.lon}" target="_blank">Ver no mapa</a>
        </p>
        <span class="rating-badge"><i class="fas fa-star"></i> ${rest.rating.toFixed(1)}</span>
      </div>
    `;
    grid.appendChild(card);
  });

  container.innerHTML = "";
  container.appendChild(grid);
}
