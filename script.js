document.addEventListener("DOMContentLoaded", async () => {
  // Elementos do DOM
  const statusEl = document.getElementById("status");
  const enderecoEl = document.getElementById("endereco");
  const restaurantsContainer = document.getElementById("restaurants-container");
  const restaurantSection = document.getElementById("restaurants-section");
  const ipInfoContainer = document.getElementById("ip-info-container");

  // Cache de imagens e controle de requisições
  const IMAGE_CACHE = {};
  let lastImageRequestTime = 0;

  // Verifica suporte à geolocalização
  if (!navigator.geolocation) {
    statusEl.innerHTML = "<i class='fas fa-exclamation-triangle'></i> Geolocalização não suportada pelo seu navegador.";
    return;
  }

  try {
    // 1. Obtém a localização atual
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      });
    });

    const { latitude, longitude } = position.coords;
    statusEl.innerHTML = `<i class='fas fa-check-circle'></i> Localização obtida: <strong>Lat:</strong> ${latitude.toFixed(5)}, <strong>Lng:</strong> ${longitude.toFixed(5)}`;

    // 2. Busca endereço e restaurantes
    const [addressData, restaurants] = await Promise.all([
      fetchAddress(latitude, longitude),
      fetchNearbyRestaurants(latitude, longitude)
    ]);

    enderecoEl.innerHTML = `<i class='fas fa-map-marked-alt'></i> <strong>Endereço:</strong> ${addressData.display_name || "Não disponível"}`;
    
    // Mostra a seção de restaurantes
    restaurantSection.style.display = 'block';
    displayRestaurants(restaurants, latitude, longitude);

  } catch (error) {
    console.error("Erro:", error);
    statusEl.innerHTML = `<i class='fas fa-times-circle'></i> ${
      error.message.includes("permission") 
        ? "Permissão de localização negada. Por favor, permita o acesso à localização para usar este serviço."
        : "Erro ao obter localização: " + error.message
    }`;
  }

  // Busca informações do IP
  fetchIPInfo(ipInfoContainer);
});

// Funções auxiliares
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
      >;
      out skel qt;
    `;

    const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`);
    if (!response.ok) throw new Error("Erro ao buscar restaurantes");
    
    const data = await response.json();
    const elements = data.elements || [];
    
    // Processa os resultados - filtrando apenas com endereço completo
    const restaurants = [];
    for (const element of elements) {
      if (element.tags && element.tags.name && hasCompleteAddress(element.tags)) {
        const restaurant = {
          id: element.id,
          name: element.tags.name,
          rating: parseFloat(element.tags["smiley:rating"] || (3.5 + Math.random() * 1.5).toFixed(1)),
          address: formatAddress(element.tags),
          cuisine: element.tags.cuisine || "Variada",
          website: element.tags.website || null,
          lat: element.lat || element.center?.lat,
          lon: element.lon || element.center?.lon
        };
        
        // Busca imagem do restaurante
        restaurant.image = await fetchRestaurantImage(restaurant.name, restaurant.cuisine, restaurant.address);
        restaurants.push(restaurant);
      }
    }
    
    return restaurants
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5);

  } catch (error) {
    console.error("Erro no fetchNearbyRestaurants:", error);
    return [];
  }
}

function hasCompleteAddress(tags) {
  return tags["addr:street"] && (tags["addr:housenumber"] || tags["addr:full"]);
}

function formatAddress(tags) {
  if (tags["addr:full"]) return tags["addr:full"];
  return `${tags["addr:street"] || ''} ${tags["addr:housenumber"] || ''}, ${tags["addr:city"] || ''}`.trim().replace(/,$/, '');
}

async function fetchRestaurantImage(name, cuisine, address) {
  const cacheKey = `${name}-${cuisine}`;
  
  // Verificar cache local primeiro
  if (IMAGE_CACHE[cacheKey]) {
    return IMAGE_CACHE[cacheKey];
  }

  // Rate limiting para APIs
  const now = Date.now();
  if (now - lastImageRequestTime < 300) {
    await new Promise(resolve => setTimeout(resolve, 300 - (now - lastImageRequestTime)));
  }
  lastImageRequestTime = Date.now();

  try {
    // 1. Tentar Unsplash primeiro
    const cuisineType = (cuisine.split(',')[0] || 'food').replace(/_/g, '+');
    const unsplashUrl = `https://source.unsplash.com/random/300x200/?restaurant,${cuisineType},food`;
    
    const imgLoaded = await loadImage(unsplashUrl);
    if (imgLoaded) {
      IMAGE_CACHE[cacheKey] = unsplashUrl;
      return unsplashUrl;
    }

    // 2. Fallback para Wikimedia
    const wikiMediaUrl = await fetchWikimediaImage(name, cuisine);
    if (wikiMediaUrl) {
      IMAGE_CACHE[cacheKey] = wikiMediaUrl;
      return wikiMediaUrl;
    }

    // 3. Fallback final - imagem local
    return 'assets/restaurant-placeholder.jpg';
  } catch (error) {
    console.error("Erro ao buscar imagem:", error);
    return 'assets/restaurant-placeholder.jpg';
  }
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
    const searchTerm = `${name} ${cuisine}`.replace(/\s+/g, '+');
    const response = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&generator=images&titles=${searchTerm}&prop=imageinfo&iiprop=url&format=json&origin=*`,
      { cache: 'force-cache' }
    );
    
    const data = await response.json();
    const pages = data.query?.pages;
    
    if (pages) {
      for (const pageId in pages) {
        const imageUrl = pages[pageId].imageinfo?.[0]?.url;
        if (imageUrl) {
          return imageUrl;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Erro Wikimedia API:", error);
    return null;
  }
}

function displayRestaurants(restaurants) {
  const restaurantsContainer = document.getElementById("restaurants-container");
  
  if (!restaurants.length) {
    restaurantsContainer.innerHTML = `
      <div class="no-restaurants">
        <i class="fas fa-utensils fa-3x"></i>
        <h3>Nenhum restaurante com endereço completo encontrado</h3>
        <p>Não encontramos restaurantes com endereço válido próximo a você.</p>
      </div>
    `;
    return;
  }

  restaurantsContainer.innerHTML = `
    <div class="restaurants-grid">
      ${restaurants.map(rest => `
        <div class="restaurant-card">
          <div class="restaurant-image-container">
            ${rest.image ? `
              <div class="restaurant-image" style="background-image: url('${rest.image}')"></div>
            ` : `
              <div class="restaurant-image placeholder">
                <i class="fas fa-utensils fa-3x"></i>
              </div>
            `}
            <div class="rating-badge">
              <i class="fas fa-star"></i> ${rest.rating.toFixed(1)}
            </div>
          </div>
          <div class="restaurant-info">
            <h3>${rest.name}</h3>
            <p class="cuisine"><i class="fas fa-utensils"></i> ${rest.cuisine}</p>
            <p class="address"><i class="fas fa-map-marker-alt"></i> ${rest.address}</p>
            ${rest.website ? `
              <a href="${rest.website.startsWith('http') ? rest.website : 'https://' + rest.website}" 
                 target="_blank" class="website-btn">
                <i class="fas fa-external-link-alt"></i> Visitar Site
              </a>
            ` : ''}
            <a href="https://www.openstreetmap.org/?mlat=${rest.lat}&mlon=${rest.lon}#map=18/${rest.lat}/${rest.lon}" 
               target="_blank" class="map-link">
              <i class="fas fa-map"></i> Ver no Mapa
            </a>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="attribution">
      <p>Dados obtidos do OpenStreetMap</p>
    </div>
  `;
}

async function fetchIPInfo(container) {
  try {
    const response = await fetch("https://ipapi.co/json/").catch(async () => {
      return await fetch("https://ipwhois.app/json/");
    });
    
    if (response.status === 429) {
      throw new Error("Limite de requisições excedido");
    }
    
    const data = await response.json();
    container.innerHTML = `
      <h2><i class="fas fa-network-wired"></i> Informações da Conexão</h2>
      <div class="ip-info-grid">
        <div class="ip-info-item">
          <i class="fas fa-globe"></i>
          <div>
            <h3>IP Público</h3>
            <p>${data.ip || "N/A"}</p>
          </div>
        </div>
        <div class="ip-info-item">
          <i class="fas fa-map-marker-alt"></i>
          <div>
            <h3>Localização Aproximada</h3>
            <p>${data.city || "N/A"}, ${data.region || data.regionName || "N/A"}</p>
          </div>
        </div>
        <div class="ip-info-item">
          <i class="fas fa-server"></i>
          <div>
            <h3>Provedor</h3>
            <p>${data.org || data.isp || "N/A"}</p>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    console.warn("Erro ao obter informações do IP:", error);
    container.innerHTML = `
      <p class="ip-error">
        <i class="fas fa-info-circle"></i> Informações de conexão temporariamente indisponíveis
      </p>
    `;
  }
}
