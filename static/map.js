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

  /* ===== CORE CITY HOTSPOTS (RED BLOBS) ===== */

  [9.9810, 76.2815, 1.0],   // MG Road
  [9.9798, 76.2842, 0.95],
  [9.9779, 76.2868, 0.92],
  [9.9755, 76.2870, 0.9],  // Banerji Road
  [9.9738, 76.2889, 0.88],

  [9.9678, 76.2895, 1.0],  // SA Road
  [9.9690, 76.2912, 0.95],
  [9.9704, 76.2929, 0.9],

  [9.9685, 76.3187, 1.0],  // Vyttila Junction
  [9.9700, 76.3205, 0.95],
  [9.9668, 76.3172, 0.92],
  [9.9652, 76.3156, 0.88],

  /* ===== EDAPPALLY CLUSTER ===== */

  [10.0248, 76.3082, 1.0],   // Edappally
  [10.0262, 76.3098, 0.95],
  [10.0229, 76.3069, 0.92],
  [10.0215, 76.3051, 0.88],
  [10.0281, 76.3110, 0.9],

  /* ===== KALOOR – PALARIVATTOM ===== */

  [9.9982, 76.2974, 0.95],
  [10.0001, 76.2990, 0.9],
  [10.0020, 76.3008, 0.88],
  [10.0041, 76.3025, 0.85],

  /* ===== KAKKANAD / INFO PARK ===== */

  [10.0169, 76.3452, 0.9],
  [10.0192, 76.3478, 0.85],
  [10.0215, 76.3501, 0.82],
  [10.0240, 76.3525, 0.8],

  /* ===== SCATTERED INNER-CITY TRAFFIC (YELLOW DOTS) ===== */

  [9.9895, 76.2932, 0.75],
  [9.9868, 76.2901, 0.72],
  [9.9842, 76.2874, 0.7],
  [9.9821, 76.2849, 0.68],
  [9.9799, 76.2823, 0.66],

  [9.9954, 76.3055, 0.74],
  [9.9978, 76.3081, 0.72],
  [10.0003, 76.3108, 0.7],

  /* ===== OUTER CITY / HIGHWAY FLOW ===== */

  [10.0565, 76.3340, 0.85],  // Amballur
  [10.0602, 76.3385, 0.82],
  [10.0640, 76.3430, 0.8],

  [10.0760, 76.3530, 0.8],   // Muringoor
  [10.0800, 76.3575, 0.78],

  [10.1004, 76.3570, 0.85],  // Aluva
  [10.1040, 76.3608, 0.82],
  [10.1080, 76.3730, 0.8],   // Chirangara
  [10.1120, 76.3780, 0.78],

  /* ===== EASTERN SIDE (LOWER INTENSITY) ===== */

  [9.9846, 76.5776, 0.9],    // Muvattupuzha
  [9.9990, 76.5652, 0.85],
  [10.0120, 76.5520, 0.85],  // Pezhakapilly
  [10.0205, 76.5405, 0.85],  // Paipra Kavala

  /* ===== RANDOM MICRO HOTSPOTS (BLUE → YELLOW DOTS) ===== */

  [9.9725, 76.2955, 0.6],
  [9.9768, 76.3002, 0.58],
  [9.9812, 76.3048, 0.55],
  [9.9865, 76.3099, 0.6],
  [9.9918, 76.3145, 0.58],
  [9.9969, 76.3192, 0.55]
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
