document.addEventListener("DOMContentLoaded", async () => {
  const statusEl = document.getElementById("status");
  const enderecoEl = document.getElementById("endereco");
  const restaurantsContainer = document.getElementById("restaurants-container");
  const restaurantSection = document.getElementById("restaurants-section");
  const ipInfoContainer = document.getElementById("ip-info-container");

  if (!navigator.geolocation) {
    statusEl.innerHTML = "<i class='fas fa-exclamation-triangle'></i> Geolocalização não suportada pelo seu navegador.";
    return;
  }

  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0
      });
    });

    const { latitude, longitude } = position.coords;
    statusEl.innerHTML = `<i class='fas fa-check-circle'></i> Localização obtida: <strong>Lat:</strong> ${latitude.toFixed(5)}, <strong>Lng:</strong> ${longitude.toFixed(5)}`;

    const [addressData, places] = await Promise.all([
      fetchAddress(latitude, longitude),
      fetchNearbyPlaces(latitude, longitude)
    ]);

    enderecoEl.innerHTML = `<i class='fas fa-map-marked-alt'></i> <strong>Endereço:</strong> ${addressData.display_name || "Não disponível"}`;
    
    restaurantSection.style.display = 'block';
    displayPlaces(places);

  } catch (error) {
    console.error("Erro:", error);
    statusEl.innerHTML = `<i class='fas fa-times-circle'></i> ${
      error.message.includes("permission") 
        ? "Permissão de localização negada. Por favor, permita o acesso à localização."
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

async function fetchNearbyPlaces(lat, lng, radius = 1500) {
  try {
    const overpassQuery = `
      [out:json];
      (
        node["amenity"~"restaurant|bar|cafe|fast_food"](around:${radius},${lat},${lng});
        way["amenity"~"restaurant|bar|cafe|fast_food"](around:${radius},${lat},${lng});
        relation["amenity"~"restaurant|bar|cafe|fast_food"](around:${radius},${lat},${lng});
      );
      out center;
      >;
      out skel qt;
    `;

    const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`);
    if (!response.ok) throw new Error("Erro ao buscar estabelecimentos");
    
    const data = await response.json();
    return processPlacesData(data.elements || []);
  } catch (error) {
    console.error("Erro no fetchNearbyPlaces:", error);
    return [];
  }
}

function processPlacesData(elements) {
  return elements
    .filter(element => element.tags && element.tags.name)
    .map(element => ({
      id: element.id,
      name: element.tags.name,
      type: getPlaceType(element.tags),
      rating: parseFloat(element.tags["smiley:rating"] || (3 + Math.random() * 2).toFixed(1)),
      address: formatAddress(element.tags),
      cuisine: element.tags.cuisine || "Variada",
      website: element.tags.website || null,
      lat: element.lat || element.center?.lat,
      lon: element.lon || element.center?.lon,
      hasCompleteAddress: hasCompleteAddress(element.tags)
    }))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 10);
}

function getPlaceType(tags) {
  if (tags.amenity === "restaurant") return "Restaurante";
  if (tags.amenity === "cafe") return "Café";
  if (tags.amenity === "bar") return "Bar";
  if (tags.amenity === "fast_food") return "Fast Food";
  return "Estabelecimento";
}

function hasCompleteAddress(tags) {
  return tags["addr:street"] && (tags["addr:housenumber"] || tags["addr:full"]);
}

function formatAddress(tags) {
  if (tags["addr:full"]) return tags["addr:full"];
  
  const parts = [
    tags["addr:street"],
    tags["addr:housenumber"],
    tags["addr:city"]
  ].filter(Boolean);
  
  return parts.length > 0 ? parts.join(", ") : "Localização aproximada";
}

function displayPlaces(places) {
  const restaurantsContainer = document.getElementById("restaurants-container");
  
  if (!places.length) {
    restaurantsContainer.innerHTML = `
      <div class="no-restaurants">
        <i class="fas fa-utensils fa-3x"></i>
        <h3>Nenhum estabelecimento encontrado próximo a você</h3>
        <p>Tente aumentar o raio de busca ou verifique sua conexão com a internet.</p>
      </div>
    `;
    return;
  }

  restaurantsContainer.innerHTML = `
    <div class="restaurants-grid">
      ${places.map(place => `
        <div class="restaurant-card ${!place.hasCompleteAddress ? 'incomplete-address' : ''}">
          <div class="restaurant-image-container">
            <div class="restaurant-image placeholder">
              <i class="fas ${getPlaceIcon(place.type)} fa-3x"></i>
            </div>
            <div class="rating-badge">
              <i class="fas fa-star"></i> ${place.rating.toFixed(1)}
            </div>
            ${!place.hasCompleteAddress ? `
              <div class="address-warning">
                <i class="fas fa-exclamation-triangle"></i> Endereço aproximado
              </div>
            ` : ''}
          </div>
          <div class="restaurant-info">
            <div class="place-type">${place.type}</div>
            <h3>${place.name}</h3>
            <p class="cuisine"><i class="fas fa-utensils"></i> ${place.cuisine}</p>
            <p class="address"><i class="fas fa-map-marker-alt"></i> ${place.address}</p>
            ${place.website ? `
              <a href="${place.website.startsWith('http') ? place.website : 'https://' + place.website}" 
                 target="_blank" class="website-btn">
                <i class="fas fa-external-link-alt"></i> Site
              </a>
            ` : ''}
            <a href="https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=18/${place.lat}/${place.lon}" 
               target="_blank" class="map-link">
              <i class="fas fa-map"></i> Mapa
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

function getPlaceIcon(type) {
  switch(type) {
    case "Restaurante": return "fa-utensils";
    case "Café": return "fa-coffee";
    case "Bar": return "fa-glass-martini-alt";
    case "Fast Food": return "fa-hamburger";
    default: return "fa-store";
  }
}

async function fetchIPInfo(container) {
  try {
    const response = await fetch("https://ipapi.co/json/").catch(async () => {
      return await fetch("https://ipwhois.app/json/");
    });
    
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
            <h3>Localização</h3>
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
        <i class="fas fa-info-circle"></i> Informações de conexão indisponíveis
      </p>
    `;
  }
}
