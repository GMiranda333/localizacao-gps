document.addEventListener("DOMContentLoaded", async () => {
  const statusEl = document.getElementById("status");
  const enderecoEl = document.getElementById("endereco");
  const restaurantsSection = document.getElementById("restaurants-section");
  const restaurantsContainer = document.getElementById("restaurants-container");

  // Dados fictícios de fallback
  const fallbackRestaurants = [
    {
      nome: "Restaurante Bem Brasileiro",
      tipo: "Brasileira",
      rating: 4.5,
      lat: -23.5505,
      lon: -46.6333,
      endereco: "Rua da Quitanda, 86 - Centro"
    },
    {
      nome: "Pizzaria Forno de Minas",
      tipo: "Pizza",
      rating: 4.2,
      lat: -23.5510,
      lon: -46.6340,
      endereco: "Av. São João, 1000"
    }
  ];

  if (!navigator.geolocation) {
    statusEl.innerHTML = "<i class='fas fa-exclamation-triangle'></i> Geolocalização não suportada.";
    displayRestaurants(fallbackRestaurants, -23.5505, -46.6333);
    restaurantsSection.style.display = "block";
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

    try {
      const address = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pt-BR`)
        .then(res => res.json());
      enderecoEl.innerHTML = `<i class="fas fa-map-marked-alt"></i> ${address.display_name || "Sua localização atual"}`;
    } catch (e) {
      enderecoEl.innerHTML = `<i class="fas fa-map-marked-alt"></i> Localização: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }

    // Tenta buscar da API
    let restaurants = await fetchRestaurants(latitude, longitude, 5000);
    
    // Se não encontrou, usa fallback ajustando as coordenadas
    if (!restaurants || restaurants.length === 0) {
      restaurants = fallbackRestaurants.map(r => ({
        ...r,
        lat: latitude + (r.lat + 23.5505) * 0.01,
        lon: longitude + (r.lon + 46.6333) * 0.01
      }));
    }
    
    displayRestaurants(restaurants, latitude, longitude);
    restaurantsSection.style.display = "block";

  } catch (err) {
    statusEl.innerHTML = `<i class="fas fa-times-circle"></i> Erro: ${err.message}`;
    console.error("Erro:", err);
    // Usa fallback em caso de erro
    displayRestaurants(fallbackRestaurants, -23.5505, -46.6333);
    restaurantsSection.style.display = "block";
  }
});

async function fetchRestaurants(lat, lon, radius = 5000) {
  try {
    const query = `
      [out:json][timeout:30];
      (
        node["amenity"="restaurant"](around:${radius},${lat},${lon});
        way["amenity"="restaurant"](around:${radius},${lat},${lon});
        relation["amenity"="restaurant"](around:${radius},${lat},${lon});
      );
      out body;
      >;
      out skel qt;
    `;
    
    const response = await fetch(`https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    if (!data.elements || data.elements.length === 0) return [];
    
    return data.elements
      .filter(el => el.tags?.name)
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
    return null;
  }
}

// ... (mantenha as outras funções displayRestaurants, buildAddress e calculateDistance do código anterior)
