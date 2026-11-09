/*
 * GoogleMap Web Component
 * Handles Google Maps integration with:
 * - Map initialization
 * - User location
 * - Google Sign-In for saved maps
 * - EV charger display and filtering
 */

export class GoogleMapElement extends HTMLElement {
  connectedCallback() {
    this.loadGoogleMapsAPI();
    this.setupEventListeners();
  }

  loadGoogleMapsAPI() {
    const apiKey = this.getAttribute('data-api-key');
    if (!apiKey) {
      console.error('Google Maps API key is required');
      return;
    }

    const centerLat = parseFloat(this.getAttribute('data-center-lat') || '0');
    const centerLng = parseFloat(this.getAttribute('data-center-lng') || '0');
    const zoom = parseInt(this.getAttribute('data-zoom') || '12');
    const showEvChargers = this.getAttribute('data-show-ev-chargers') === 'true';

    // Load Google Maps API
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    // Store configuration on the element
    this.dataset.centerLat = centerLat;
    this.dataset.centerLng = centerLng;
    this.dataset.zoom = zoom;
    this.dataset.showEvChargers = showEvChargers;
  }

  setupEventListeners() {
    // Listen for location events from locate button
    this.addEventListener('locate-start', () => this.handleLocateStart());
    this.addEventListener('location-found', (event) => this.handleLocationFound(event));
    this.addEventListener('location-error', (event) => this.handleLocationError(event));
    
    // Listen for filter events
    this.addEventListener('filter-click', () => this.handleFilterClick());
  }

  handleLocateStart() {
    const statusEl = this.querySelector('.map-status');
    if (statusEl) {
      statusEl.textContent = 'Locating...';
    }
  }

  handleLocationFound(event) {
    const statusEl = this.querySelector('.map-status');
    if (statusEl && event.detail) {
      statusEl.textContent = `Location: ${event.detail.lat.toFixed(4)}, ${event.detail.lng.toFixed(4)}`;
    }
    
    // Center map on user location
    if (window.googleMap) {
      window.googleMap.setCenter({
        lat: event.detail.lat,
        lng: event.detail.lng
      });
      window.googleMap.setZoom(15);
    }
  }

  handleLocationError(event) {
    const statusEl = this.querySelector('.map-status');
    if (statusEl) {
      statusEl.textContent = event.detail?.message || 'Error locating';
    }
  }

  handleFilterClick() {
    const statusEl = this.querySelector('.map-status');
    if (statusEl) {
      statusEl.textContent = 'Showing filters';
    }
    // Toggle filter panel
    this.toggleFilters();
  }

  toggleFilters() {
    // Show/hide filter panel
    const filterPanel = this.querySelector('.filter-panel');
    if (filterPanel) {
      filterPanel.classList.toggle('visible');
    }
  }

  // Initialize map (called by Google Maps API callback)
  initMap() {
    const mapDiv = this.querySelector('.google-map');
    if (!mapDiv || !window.google || !window.google.maps) {
      return;
    }

    const centerLat = parseFloat(this.dataset.centerLat || '0');
    const centerLng = parseFloat(this.dataset.centerLng || '0');
    const zoom = parseInt(this.dataset.zoom || '12');

    window.googleMap = new window.google.maps.Map(mapDiv, {
      center: { lat: centerLat, lng: centerLng },
      zoom: zoom,
      gestureHandling: 'greedy',
      fullscreenControl: false,
      mapTypeControl: true,
      streetViewControl: false,
      styles: this.getMapStyles()
    });

    // Load EV chargers if enabled
    if (this.dataset.showEvChargers === 'true') {
      this.loadEvChargers();
    }

    // Setup Google Sign-In
    this.setupGoogleSignIn();
  }

  getMapStyles() {
    return [
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'on' }]
      }
    ];
  }

  async loadEvChargers() {
    try {
      const centerLat = parseFloat(this.dataset.centerLat || '0');
      const centerLng = parseFloat(this.dataset.centerLng || '0');
      const evChargers = await fetchEvChargers(centerLat, centerLng);
      this.displayEvChargers(evChargers);
    } catch (error) {
      console.error('Error loading EV chargers:', error);
    }
  }

  displayEvChargers(evChargers) {
    if (!window.googleMap) return;

    evChargers.forEach(charger => {
      const marker = new window.google.maps.Marker({
        position: {
          lat: charger.geometry.location.lat,
          lng: charger.geometry.location.lng
        },
        map: window.googleMap,
        title: charger.name
      });

      // Add click event to show details
      marker.addListener('click', () => {
        this.showChargerDetails(charger.place_id);
      });
    });
  }

  async showChargerDetails(placeId) {
    try {
      const details = await fetchEvChargerDetails(placeId);
      this.displayChargerDetails(details);
    } catch (error) {
      console.error('Error fetching charger details:', error);
    }
  }

  displayChargerDetails(details) {
    // Display charger details in a panel
    const detailsPanel = this.querySelector('.charger-details');
    if (detailsPanel) {
      detailsPanel.innerHTML = `
        <h3>${details.name}</h3>
        <p>${details.formatted_address}</p>
        ${details.opening_hours ? `<p>Hours: ${details.opening_hours.weekday_text.join('<br>')}</p>` : ''}
        ${details.photos ? `<img src="https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${details.photos[0].photo_reference}&key=${this.getAttribute('data-api-key')}" alt="${details.name}">` : ''}
      `;
      detailsPanel.classList.add('visible');
    }
  }

  setupGoogleSignIn() {
    // Load Google Identity Services for sign-in
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => this.initializeGoogleSignIn();
    document.head.appendChild(script);
  }

  initializeGoogleSignIn() {
    if (!window.google || !window.google.accounts) {
      return;
    }

    // Initialize Google Sign-In
    window.google.accounts.id.initialize({
      client_id: this.getAttribute('data-client-id') || '',
      callback: (response) => this.handleGoogleSignIn(response),
      auto_select: false,
      cancel_on_tap_outside: false
    });

    // Render sign-in button
    window.google.accounts.id.renderButton(
      this.querySelector('.google-signin-button') || this,
      { theme: 'outline', size: 'medium', type: 'standard' }
    );
  }

  handleGoogleSignIn(response) {
    // Handle successful sign-in
    console.log('Google Sign-In successful:', response);
    this.loadUserMaps(response.credential);
  }

  async loadUserMaps(accessToken) {
    // Load user's saved maps from Google Maps API
    // This requires the Google Maps JavaScript API with the Places library
    try {
      // Example: Get user's saved places
      // Note: This requires additional OAuth scopes and API setup
      console.log('Loading user maps...');
    } catch (error) {
      console.error('Error loading user maps:', error);
    }
  }

  // Public method to load a specific map/list
  loadMap(mapId) {
    // Load a specific saved map by ID
    console.log('Loading map:', mapId);
  }

  // Public method to toggle EV chargers
  toggleEvChargers(show) {
    this.dataset.showEvChargers = show;
    // Reload EV chargers based on new setting
    if (show) {
      this.loadEvChargers();
    }
  }
}

customElements.define('ev-google-map', GoogleMapElement);

// Global callback for Google Maps API
window.initMap = function() {
  const mapElement = document.querySelector('ev-google-map');
  if (mapElement && typeof mapElement.initMap === 'function') {
    mapElement.initMap();
  }
};
