// =============================
// MAP INITIALIZATION
// =============================
var map = L.map('map');

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 18
}).addTo(map);

// =============================
// GLOBAL STATE
// =============================
var currentMode = "temperature";
var ernakulamBoundary = null;

// =============================
// TEMPERATURE DATA
// =============================
var tempMorning = [];
var tempAfternoon = [];
var activeTempData = [];

fetch('/static/temperature_morning_dense.json')
  .then(r => r.json()).then(d => tempMorning = d);

fetch('/static/temperature_afternoon_dense.json')
  .then(r => r.json()).then(d => tempAfternoon = d);

// =============================
// TEMPERATURE HEATMAP
// =============================
var temperatureHeatmap = L.heatLayer([], {
  radius: 25,
  blur: 18,
  minOpacity: 0.5,
  max: 0.8,
  gradient: {
    0.0: '#313695',
    0.2: '#2b83ba',
    0.4: '#7ad151',
    0.6: '#fee08b',
    0.8: '#f46d43',
    1.0: '#d73027'
  }
}).addTo(map);

// =============================
// TRAFFIC HEATMAP (FOCUSED)
// =============================
var trafficHeatmap = L.heatLayer([], {
  radius: 22,
  blur: 15,
  minOpacity: 0.55,
  max: 1.0,
  gradient: {
    0.4: '#fde68a',
    0.6: '#fb923c',
    0.8: '#f97316',
    1.0: '#dc2626'
  }
});

// =============================
// HIGH-TRAFFIC SOURCE LOCATIONS
// =============================
var trafficSources = [
  [10.0248, 76.3082, 1.0],   // Edappally
  [9.9810, 76.2815, 0.95],   // MG Road / CBD
  [9.9755, 76.2870, 0.9],    // Banerji Road
  [9.9678, 76.2895, 0.9],    // SA Road
  [9.9685, 76.3187, 1.0],    // Vyttila
  [10.1004, 76.3570, 0.85],  // Aluva
  [10.0565, 76.3340, 0.85],  // Amballur
  [10.0760, 76.3530, 0.8],   // Muringoor
  [10.1080, 76.3730, 0.8],   // Chirangara
  [10.1370, 76.3960, 0.85],  // Koratty
  [9.9846, 76.5776, 0.9],    // Muvattupuzha
  [10.0120, 76.5520, 0.85],  // Pezhakapilly
  [10.0205, 76.5405, 0.85]   // Paipra Kavala
];

// =============================
// GENERATE TRAFFIC HEAT DATA
// =============================
function generateTrafficHeatData() {
  let heat = [];

  trafficSources.forEach(p => {
    let lat = p[0], lon = p[1], val = p[2];

    for (let i = 0; i < 35; i++) {
      let angle = Math.random() * Math.PI * 2;
      let dist = Math.random() * 0.02; // ~2 km

      heat.push([
        lat + Math.cos(angle) * dist,
        lon + Math.sin(angle) * dist,
        val
      ]);
    }
  });

  return heat;
}

var trafficHeatData = generateTrafficHeatData();

// =============================
// LOW TRAFFIC BASE (SUBTLE GREEN)
// =============================
var lowTrafficLayer = L.geoJSON(null, {
  style: {
    color: '#166534',
    weight: 0,
    fillColor: '#22c55e',
    fillOpacity: 0.18   // 👈 subtle, readable
  }
});

// =============================
// LOAD ERNAKULAM BOUNDARY
// =============================
fetch('/static/ernakulam_boundary.geojson')
  .then(r => r.json())
  .then(data => {

    ernakulamBoundary = data;

    // Outline
    L.geoJSON(data, {
      style: {
        color: '#1f2937',
        weight: 2,
        fillOpacity: 0
      }
    }).addTo(map);

    // Low traffic base
    lowTrafficLayer.addData(data);

    map.fitBounds(L.geoJSON(data).getBounds());

    showTemperature('afternoon');
  });

// =============================
// MODE SWITCH FUNCTIONS
// =============================
function showTemperature(time) {
  currentMode = "temperature";

  map.removeLayer(lowTrafficLayer);
  map.removeLayer(trafficHeatmap);
  temperatureHeatmap.addTo(map);

  document.getElementById("timeSelect").style.display = "block";

  // Only use points that fall inside the Ernakulam boundary polygon
  function pointInPolygon(lon, lat, polygon) {
    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      var xi = polygon[i][0], yi = polygon[i][1];
      var xj = polygon[j][0], yj = polygon[j][1];
      var intersect = ((yi > lat) != (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function filterPointsInsideBoundary(data) {
    if (!ernakulamBoundary || !ernakulamBoundary.features) return data;
    var poly = ernakulamBoundary.features[0].geometry.coordinates[0];
    return data.filter(p => pointInPolygon(p[1], p[0], poly));
  }

  if (time === "morning") {
    activeTempData = filterPointsInsideBoundary(tempMorning);
    temperatureHeatmap.setLatLngs(activeTempData);
  } else {
    activeTempData = filterPointsInsideBoundary(tempAfternoon);
    temperatureHeatmap.setLatLngs(activeTempData);
  }

  document.getElementById("info-risk").innerText = "—";
  document.getElementById("info-reason").innerText =
    "Click on map to view temperature and heat risk.";
}

function showTraffic() {
  currentMode = "traffic";

  map.removeLayer(temperatureHeatmap);

  lowTrafficLayer.addTo(map);
  trafficHeatmap.setLatLngs(trafficHeatData);
  trafficHeatmap.addTo(map);

  document.getElementById("timeSelect").style.display = "none";

  document.getElementById("info-temp").innerText = "—";
  document.getElementById("info-risk").innerText = "—";
  document.getElementById("info-reason").innerText =
    "Green indicates low traffic areas. Red zones represent congestion hotspots.";
}

// =============================
// CLICK HANDLER → SIDEBAR
// =============================
map.on('click', function (e) {

  // TEMPERATURE
  if (currentMode === "temperature" && activeTempData.length) {

    let p = activeTempData.reduce((a, b) =>
      ((a[0] - e.latlng.lat) ** 2 + (a[1] - e.latlng.lng) ** 2) <
        ((b[0] - e.latlng.lat) ** 2 + (b[1] - e.latlng.lng) ** 2) ? a : b
    );

    let temp = (26 + p[2] * 12).toFixed(1);

    let risk =
      temp < 30 ? ["Low", "Comfortable temperature range."] :
        temp < 33 ? ["Moderate", "Mild heat stress possible."] :
          temp < 36 ? ["High", "High heat stress risk."] :
            ["Very High", "Severe heat stress conditions."];

    document.getElementById("info-location").innerText =
      `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
    document.getElementById("info-temp").innerText = temp + " °C";
    document.getElementById("info-risk").innerText = risk[0];
    document.getElementById("info-reason").innerText = risk[1];
    
  }

  // TRAFFIC
  if (currentMode === "traffic") {

    let intensity = 0;

    trafficSources.forEach(p => {
      let d = Math.sqrt(
        (p[0] - e.latlng.lat) ** 2 +
        (p[1] - e.latlng.lng) ** 2
      );
      if (d < 0.03) intensity = Math.max(intensity, p[2]);
    });

    let level =
      intensity > 0.8 ? ["High", "Near a major congestion hotspot."] :
        intensity > 0.5 ? ["Medium", "Moderate traffic influence."] :
          ["Low", "Low traffic activity area."];

    document.getElementById("info-location").innerText =
      `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
    document.getElementById("info-temp").innerText = "—";
    document.getElementById("info-risk").innerText = level[0];
    document.getElementById("info-reason").innerText = level[1];
  }
});

// =============================
// UI CONTROLS
// =============================
document.getElementById("timeSelect").addEventListener("change", e => {
  showTemperature(e.target.value);
});

document.getElementById("modeSelect").addEventListener("change", e => {
  if (e.target.value === "temperature") {
    showTemperature(document.getElementById("timeSelect").value);
  } else {
    showTraffic();
  }
});
