document.addEventListener("DOMContentLoaded", async () => {
  const statusEl = document.getElementById("status");
  const enderecoEl = document.getElementById("endereco");
  const restaurantsContainer = document.getElementById("restaurants-container");
  const restaurantSection = document.getElementById("restaurants-section");
  const ipInfoContainer = document.getElementById("ip-info-container");

  const IMAGE_CACHE = {};
  let lastImageRequestTime = 0;

  if (!navigator.geolocation) {
    statusEl.innerHTML = "<i class='fas fa-exclamation-triangle'></i> Geolocalização não suportada.";
    return;
  }

  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      });
    });

    const { latitude, longitude } = position.coords;
    statusEl.innerHTML = `<i class='fas fa-check-circle'></i> Localização: <strong>Lat:</strong> ${latitude.toFixed(5)}, <strong>Lng:</strong> ${longitude.toFixed(5)}`;

    const [addressData, restaurants] = await Promise.all([
      fetchAddress(latitude, longitude),
      fetchNearbyRestaurants(latitude, longitude)
    ]);

    enderecoEl.innerHTML = `<i class='fas fa-map-marked-alt'></i> <strong>Endereço:</strong> ${addressData.display_name || "Não disponível"}`;

    restaurantSection.style.display = 'block';
    displayRestaurants(restaurants);

  } catch (error) {
    console.error("Erro:", error);
    statusEl.innerHTML = `<i class='fas fa-times-circle'></i> ${
      error.message.includes("permission") 
        ? "Permissão de localização negada."
        : "Erro ao obter localização: " + error.message
    }`;
  }

  fetchIPInfo(ipInfoContainer);
});

async function fetchAddress(lat, lng) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pt-BR`);
    if (!response.ok) throw new Error("Erro ao buscar endereço");
    return await response.json();
  } catch (error) {
    console.error("Erro no fetchAddress:", error);
    return { display_name: "Endereço não disponível" };
  }
}

async function fetchNearbyRestaurants(lat, lng, radius = 1000) {
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

    const restaurants = [];
    for (const el of elements) {
      if (el.tags?.name) {
        const restaurant = {
          id: el.id,
          name: el.tags.name,
          rating: parseFloat(el.tags["smiley:rating"] || (3.5 + Math.random() * 1.5).toFixed(1)),
          cuisine: el.tags.cuisine || "Variada",
          address: formatAddress(el.tags),
          website: el.tags.website || null,
          lat: el.lat || el.center?.lat,
          lon: el.lon || el.center?.lon
        };

        restaurant.image = await fetchRestaurantImage(restaurant.name, restaurant.cuisine);
        restaurants.push(restaurant);
      }
    }

    return restaurants.sort((a, b) => b.rating - a.rating).slice(0, 10);
  } catch (error) {
    console.error("Erro no fetchNearbyRestaurants:", error);
    return [];
  }
}

function formatAddress(tags) {
  if (tags["addr:full"]) return tags["addr:full"];
  if (tags["addr:street"]) {
    return `${tags["addr:street"]} ${tags["addr:housenumber"] || ''}, ${tags["addr:city"] || ''}`.trim();
  }
  return "Endereço não encontrado";
}

async function fetchRestaurantImage(name, cuisine) {
  const cacheKey = `${name}-${cuisine}`;
  if (IMAGE_CACHE[cacheKey]) return IMAGE_CACHE[cacheKey];

  const now = Date.now();
  if (now - lastImageRequestTime < 300) {
    await new Promise(resolve => setTimeout(resolve, 300 - (now - lastImageRequestTime)));
  }
  lastImageRequestTime = now;

  try {
    const unsplashUrl = `https://source.unsplash.com/random/300x200/?restaurant,${cuisine.split(',')[0]}`;
    const loaded = await loadImage(unsplashUrl);
    if (loaded) {
      IMAGE_CACHE[cacheKey] = unsplashUrl;
      return unsplashUrl;
    }

    const wikiUrl = await fetchWikimediaImage(name, cuisine);
    if (wikiUrl) {
      IMAGE_CACHE[cacheKey] = wikiUrl;
      return wikiUrl;
    }

    return null;
  } catch {
    return null;
  }
}

function loadImage(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

async function fetchWikimediaImage(name, cuisine) {
  try {
    const searchTerm = `${name} ${cuisine}`.replace(/\s+/g, '+');
    const response = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&generator=images&titles=${searchTerm}&prop=imageinfo&iiprop=url&format=json&origin=*`
    );
    const data = await response.json();
    const pages = data.query?.pages;
    if (pages) {
      for (const pageId in pages) {
        const img = pages[pageId].imageinfo?.[0]?.url;
        if (img) return img;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function displayRestaurants(restaurants) {
  const container = document.getElementById("restaurants-container");

  if (!restaurants.length) {
    container.innerHTML = `
      <div class="no-restaurants">
        <i class="fas fa-utensils fa-3x"></i>
        <h3>Nenhum restaurante encontrado</h3>
        <p>Tente aumentar o raio de busca ou verificar sua conexão.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="restaurants-grid">
      ${restaurants.map(r => `
        <div class="restaurant-card">
          <div class="restaurant-image-container">
            ${r.image ? `
              <div class="restaurant-image" style="background-image: url('${r.image}')"></div>
            ` : `
              <div class="restaurant-image placeholder">
                <i class="fas fa-utensils fa-3x"></i>
              </div>
            `}
            <div class="rating-badge">
              <i class="fas fa-star"></i> ${r.rating.toFixed(1)}
            </div>
          </div>
          <div class="restaurant-info">
            <h3>${r.name}</h3>
            <p class="cuisine"><i class="fas fa-utensils"></i> ${r.cuisine}</p>
            <p class="address"><i class="fas fa-map-marker-alt"></i> ${r.address}</p>
            ${r.website ? `
              <a href="${r.website.startsWith("http") ? r.website : 'https://' + r.website}" target="_blank" class="website-btn">
                <i class="fas fa-external-link-alt"></i> Visitar Site
              </a>` : ''}
            <a href="https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lon}#map=18/${r.lat}/${r.lon}" 
              target="_blank" class="map-link">
              <i class="fas fa-map"></i> Ver no Mapa
            </a>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="attribution"><p>Dados obtidos do OpenStreetMap</p></div>
  `;
}

async function fetchIPInfo(container) {
  try {
    const response = await fetch("https://ipapi.co/json/").catch(() => fetch("https://ipwhois.app/json/"));
    if (response.status === 429) throw new Error("Limite excedido");
    const data = await response.json();

    container.innerHTML = `
      <h2><i class="fas fa-network-wired"></i> Informações da Conexão</h2>
      <div class="ip-info-grid">
        <div class="ip-info-item">
          <i class="fas fa-globe"></i>
          <div><h3>IP Público</h3><p>${data.ip || "N/A"}</p></div>
        </div>
        <div class="ip-info-item">
          <i class="fas fa-map-marker-alt"></i>
          <div><h3>Localização Aproximada</h3><p>${data.city || "N/A"}, ${data.region || "N/A"}</p></div>
        </div>
        <div class="ip-info-item">
          <i class="fas fa-server"></i>
          <div><h3>Provedor</h3><p>${data.org || data.isp || "N/A"}</p></div>
        </div>
      </div>
    `;
  } catch {
    container.innerHTML = `
      <p class="ip-error">
        <i class="fas fa-info-circle"></i> Informações de conexão indisponíveis
      </p>
    `;
  }
}
