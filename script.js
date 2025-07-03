document.addEventListener("DOMContentLoaded", async () => {
  const statusEl = document.getElementById("status");
  const enderecoEl = document.getElementById("endereco");
  const restaurantsContainer = document.getElementById("restaurants-container");
  const restaurantSection = document.getElementById("restaurants-section");
  const ipInfoContainer = document.getElementById("ip-info-container");

  const IMAGE_CACHE = {};
  let lastImageRequestTime = 0;

  if (!navigator.geolocation) {
    statusEl.innerHTML = "<i class='fas fa-exclamation-triangle'></i> Geolocalização não suportada pelo seu navegador.";
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
    statusEl.innerHTML = `<i class='fas fa-check-circle'></i> Localização obtida: <strong>Lat:</strong> ${latitude.toFixed(5)}, <strong>Lng:</strong> ${longitude.toFixed(5)}`;

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
        ? "Permissão de localização negada. Por favor, permita o acesso à localização para usar este serviço."
        : "Erro ao obter localização: " + error.message
    }`;
  }

  fetchIPInfo(ipInfoContainer);
});

async function fetchAddress(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pt-BR`);
    return res.ok ? await res.json() : { display_name: "Erro ao buscar endereço" };
  } catch {
    return { display_name: "Erro ao buscar endereço" };
  }
}

async function fetchNearbyRestaurants(lat, lng, radius = 1000) {
  try {
    const query = `
      [out:json];
      (
        node["amenity"="restaurant"](around:${radius},${lat},${lng});
        way["amenity"="restaurant"](around:${radius},${lat},${lng});
        relation["amenity"="restaurant"](around:${radius},${lat},${lng});
      );
      out center;
    `;

    const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error("Erro na Overpass API");
    const data = await res.json();

    const restaurants = [];

    for (const el of data.elements) {
      if (el.tags?.name && (el.lat || el.center?.lat)) {
        const restaurant = {
          id: el.id,
          name: el.tags.name,
          cuisine: el.tags.cuisine || "Variada",
          rating: parseFloat(el.tags["smiley:rating"] || (3.5 + Math.random() * 1.5).toFixed(1)),
          address: formatAddress(el.tags),
          lat: el.lat || el.center?.lat,
          lon: el.lon || el.center?.lon,
          website: el.tags.website || null
        };

        restaurant.image = await fetchRestaurantImage(restaurant.name, restaurant.cuisine);
        restaurants.push(restaurant);
      }
    }

    return restaurants.sort((a, b) => b.rating - a.rating).slice(0, 5);
  } catch (err) {
    console.error("Erro no fetchNearbyRestaurants:", err);
    return [];
  }
}

function formatAddress(tags) {
  if (tags["addr:full"]) return tags["addr:full"];
  if (tags["addr:street"]) {
    return `${tags["addr:street"]} ${tags["addr:housenumber"] || ''}, ${tags["addr:city"] || ''}`;
  }
  return "Endereço não informado";
}

async function fetchRestaurantImage(name, cuisine) {
  const key = `${name}-${cuisine}`;
  if (IMAGE_CACHE[key]) return IMAGE_CACHE[key];

  const now = Date.now();
  if (now - lastImageRequestTime < 300) {
    await new Promise(res => setTimeout(res, 300 - (now - lastImageRequestTime)));
  }
  lastImageRequestTime = Date.now();

  const search = cuisine.split(',')[0].trim().replace(/\s/g, '+');
  const unsplashURL = `https://source.unsplash.com/random/300x200/?restaurant,${search}`;

  if (await loadImage(unsplashURL)) {
    IMAGE_CACHE[key] = unsplashURL;
    return unsplashURL;
  }

  const wikiImage = await fetchWikimediaImage(name, cuisine);
  if (wikiImage) {
    IMAGE_CACHE[key] = wikiImage;
    return wikiImage;
  }

  return null;
}

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

async function fetchWikimediaImage(name, cuisine) {
  try {
    const search = `${name} ${cuisine}`.replace(/\s+/g, '+');
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&generator=images&titles=${search}&prop=imageinfo&iiprop=url&format=json&origin=*`);
    const data = await res.json();
    const pages = data.query?.pages;
    for (const pageId in pages) {
      const imageUrl = pages[pageId]?.imageinfo?.[0]?.url;
      if (imageUrl) return imageUrl;
    }
    return null;
  } catch {
    return null;
  }
}

function displayRestaurants(restaurants) {
  const el = document.getElementById("restaurants-container");

  if (!restaurants.length) {
    el.innerHTML = `
      <div class="no-restaurants">
        <i class="fas fa-utensils fa-3x"></i>
        <h3>Nenhum restaurante encontrado</h3>
        <p>Verifique sua conexão ou tente mais tarde.</p>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="restaurants-grid">
      ${restaurants.map(rest => `
        <div class="restaurant-card">
          <div class="restaurant-image-container">
            ${rest.image ? `<div class="restaurant-image" style="background-image:url('${rest.image}')"></div>` :
              `<div class="restaurant-image placeholder"><i class="fas fa-utensils fa-3x"></i></div>`}
            <div class="rating-badge"><i class="fas fa-star"></i> ${rest.rating.toFixed(1)}</div>
          </div>
          <div class="restaurant-info">
            <h3>${rest.name}</h3>
            <p><i class="fas fa-utensils"></i> ${rest.cuisine}</p>
            <p><i class="fas fa-map-marker-alt"></i> ${rest.address}</p>
            ${rest.website ? `<a href="${rest.website}" target="_blank" class="website-btn"><i class="fas fa-external-link-alt"></i> Site</a>` : ''}
            <a href="https://www.openstreetmap.org/?mlat=${rest.lat}&mlon=${rest.lon}#map=18/${rest.lat}/${rest.lon}" target="_blank" class="map-link">
              <i class="fas fa-map"></i> Ver no Mapa
            </a>
          </div>
        </div>`).join('')}
    </div>
    <div class="attribution"><p>Dados: OpenStreetMap, Unsplash, Wikimedia</p></div>
  `;
}

async function fetchIPInfo(container) {
  try {
    const response = await fetch("https://ipapi.co/json/");
    const data = await response.json();
    container.innerHTML = `
      <h2><i class="fas fa-network-wired"></i> Informações da Conexão</h2>
      <div class="ip-info-grid">
        <div class="ip-info-item"><i class="fas fa-globe"></i><h3>IP Público</h3><p>${data.ip}</p></div>
        <div class="ip-info-item"><i class="fas fa-map-marker-alt"></i><h3>Localização</h3><p>${data.city}, ${data.region}</p></div>
        <div class="ip-info-item"><i class="fas fa-server"></i><h3>Provedor</h3><p>${data.org}</p></div>
      </div>`;
  } catch {
    container.innerHTML = `<p><i class="fas fa-info-circle"></i> IP não disponível</p>`;
  }
}
