// Variáveis globais
let map;
let userMarker;
let placesService;
const statusElement = document.getElementById('status');
const findMeButton = document.getElementById('find-me');
const restaurantsList = document.getElementById('restaurants-list');

// Inicialização do mapa
function initMap() {
    // Configuração inicial do mapa (centro em Brasília como fallback)
    map = new google.maps.Map(document.getElementById('map"), {
        center: { lat: -15.7975, lng: -47.8919 },
        zoom: 13
    });

    placesService = new google.maps.places.PlacesService(map);

    // Event listener para o botão de localização
    findMeButton.addEventListener('click', findMyLocation);
}

// Busca a localização do usuário
function findMyLocation() {
    statusElement.textContent = "Obtendo sua localização...";
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                statusElement.textContent = "Localização encontrada!";
                updateMap(userLocation);
                searchNearbyRestaurants(userLocation);
            },
            error => {
                console.error("Erro na geolocalização:", error);
                statusElement.textContent = "Erro ao obter localização: " + error.message;
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    } else {
        statusElement.textContent = "Geolocalização não suportada pelo navegador.";
    }
}

// Atualiza o mapa com a localização do usuário
function updateMap(location) {
    map.setCenter(location);
    
    // Remove o marcador anterior se existir
    if (userMarker) {
        userMarker.setMap(null);
    }
    
    // Adiciona novo marcador
    userMarker = new google.maps.Marker({
        position: location,
        map: map,
        title: "Você está aqui",
        icon: {
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
        }
    });
}

// Busca restaurantes próximos
function searchNearbyRestaurants(location) {
    restaurantsList.innerHTML = "<p>Buscando restaurantes próximos...</p>";
    
    const request = {
        location: location,
        radius: 10000, // 1km de raio
        type: ['restaurant'],
        rankBy: google.maps.places.RankBy.PROMINENCE
    };

    placesService.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
            displayRestaurants(results);
            addRestaurantsToMap(results);
        } else {
            console.error("Erro na busca por restaurantes:", status);
            restaurantsList.innerHTML = "<p>Não foi possível encontrar restaurantes próximos.</p>";
        }
    });
}

// Exibe a lista de restaurantes
function displayRestaurants(restaurants) {
    if (restaurants.length === 0) {
        restaurantsList.innerHTML = "<p>Nenhum restaurante encontrado nesta área.</p>";
        return;
    }

    let html = '';
    restaurants.forEach(restaurant => {
        html += `
            <div class="restaurant-item">
                <div class="restaurant-name">${restaurant.name}</div>
                <div class="restaurant-address">${restaurant.vicinity || 'Endereço não disponível'}</div>
                <div class="restaurant-rating">⭐ ${restaurant.rating || 'Sem avaliação'}</div>
            </div>
        `;
    });

    restaurantsList.innerHTML = html;
}

// Adiciona marcadores dos restaurantes no mapa
function addRestaurantsToMap(restaurants) {
    restaurants.forEach(restaurant => {
        new google.maps.Marker({
            position: restaurant.geometry.location,
            map: map,
            title: restaurant.name,
            icon: {
                url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
            }
        });
    });
}

// Inicializa o mapa quando a API estiver carregada
window.onload = initMap;
