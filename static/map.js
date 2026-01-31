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
// TEMPERATURE HEATMAP + HELPERS
// =============================
// nicer gradient and default options; we expose radius & opacity controls below
var temperatureHeatmap = L.heatLayer([], {
  radius: 25,
  blur: 18,
  minOpacity: 0.5,
  max: 1.0,
  gradient: {
    0.0: '#313695',     // cool
    0.25: '#74add1',    // cool-light
    0.5: '#fdae61',     // warm
    0.75: '#f97316',    // hot
    1.0: '#d73027'      // very hot
  }
}).addTo(map);

// Map normalized value (0..1) to Celsius using original scale (kept for consistency)
function valueToTemp(v) {
  // base 26°C + normalized * 12°C range => 26..38
  return 26 + v * 12;
}

// Risk level from temperature (returns key and short message)
function tempRisk(temp) {
  if (temp < 30) return ['Low', 'Comfortable temperature range.', 'risk-low'];
  if (temp < 33) return ['Moderate', 'Mild heat stress possible.', 'risk-moderate'];
  if (temp < 36) return ['High', 'High heat stress risk.', 'risk-high'];
  return ['Very High', 'Severe heat stress conditions.', 'risk-very-high'];
}

// Utility: update legend labels in DOM
function updateLegend() {
  var minEl = document.getElementById('legendMin');
  var midEl = document.getElementById('legendMid');
  var maxEl = document.getElementById('legendMax');

  if (activeTempData && activeTempData.length) {
    var vals = activeTempData.map(p => p[2]);
    var mn = Math.min.apply(null, vals); var mx = Math.max.apply(null, vals);
    var tmin = Math.round(valueToTemp(mn));
    var tmax = Math.round(valueToTemp(mx));
    var tmid = Math.round((tmin + tmax) / 2);
    minEl.innerText = tmin + '°C';
    midEl.innerText = tmid + '°C';
    maxEl.innerText = tmax + '°C';
  }
}


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

    // Create a small floating tooltip for hover info
    var tip = document.createElement('div');
    tip.id = 'mapTooltip';
    tip.style.position = 'absolute';
    tip.style.pointerEvents = 'none';
    tip.style.padding = '6px 8px';
    tip.style.background = 'rgba(17,24,39,0.9)';
    tip.style.color = '#fff';
    tip.style.fontSize = '12px';
    tip.style.borderRadius = '6px';
    tip.style.display = 'none';
    tip.style.zIndex = 1300;
    document.body.appendChild(tip);

    // Show nearest temperature point on mousemove (lightweight distance check)
    map.on('mousemove', function (e) {
      if (currentMode !== 'temperature' || !activeTempData.length) { tip.style.display = 'none'; return; }

      var nearest = null; var nd = Infinity;
      for (var i = 0; i < activeTempData.length; i++) {
        var p = activeTempData[i];
        var d = (p[0]-e.latlng.lat)*(p[0]-e.latlng.lat) + (p[1]-e.latlng.lng)*(p[1]-e.latlng.lng);
        if (d < nd) { nd = d; nearest = p; }
      }

      // roughly within ~0.003 deg (~300m) show tooltip
      if (nd < 0.000009) {
        var t = valueToTemp(nearest[2]).toFixed(1);
        var r = tempRisk(t);
        tip.innerHTML = '<strong>' + t + '°C</strong><br/>' + r[0] + ' — ' + r[1];
        // position using original browser mouse event
        tip.style.left = (e.originalEvent.clientX + 12) + 'px';
        tip.style.top = (e.originalEvent.clientY + 12) + 'px';
        tip.style.display = 'block';
      } else {
        tip.style.display = 'none';
      }

    });

    map.on('mouseout', function () { document.getElementById('mapTooltip').style.display = 'none'; });

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

  if (time === "morning") {
    activeTempData = tempMorning;
  } else {
    activeTempData = tempAfternoon;
  }

  // Make heat points use the normalized value as intensity and slightly amplify to improve visibility
  var heat = activeTempData.map(p => [p[0], p[1], Math.min(1, p[2] * 1.1)]);
  temperatureHeatmap.setLatLngs(heat);

  // update legend to current data
  updateLegend();

  // reset sidebar
  var ir = document.getElementById("info-risk");
  ir.innerText = "—";
  ir.className = 'risk-badge';
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
  var ir = document.getElementById("info-risk");
  ir.innerText = "—";
  ir.className = 'risk-badge';
  document.getElementById("info-reason").innerText =
    "Green indicates low traffic areas. Red zones represent congestion hotspots.";

  // Hide legend when in traffic mode
  document.getElementById('legend').style.display = 'none';
}

// ensure legend is visible for temperature mode
function ensureLegendVisible() {
  if (currentMode === 'temperature') document.getElementById('legend').style.display = 'block';
}


// =============================
// CLICK HANDLER → SIDEBAR
// =============================
map.on('click', function (e) {

  // TEMPERATURE
  if (currentMode === "temperature" && activeTempData.length) {

    let p = activeTempData.reduce((a, b) =>
      ((a[0]-e.latlng.lat)**2 + (a[1]-e.latlng.lng)**2) <
      ((b[0]-e.latlng.lat)**2 + (b[1]-e.latlng.lng)**2) ? a : b
    );

    let temp = valueToTemp(p[2]);
    let tstr = temp.toFixed(1);

    let r = tempRisk(temp);

    document.getElementById("info-location").innerText =
      `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
    document.getElementById("info-temp").innerText = tstr + " °C";

    let ir = document.getElementById("info-risk");
    ir.innerText = r[0];
    ir.className = 'risk-badge ' + r[2];

    document.getElementById("info-reason").innerText = r[1];

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
// time select
document.getElementById("timeSelect").addEventListener("change", e => {
  showTemperature(e.target.value);
});

// mode select
document.getElementById("modeSelect").addEventListener("change", e => {
  if (e.target.value === "temperature") {
    showTemperature(document.getElementById("timeSelect").value);
    document.getElementById('legend').style.display = 'block';
  } else {
    showTraffic();
  }
});

// radius slider
var radiusInput = document.getElementById('radiusRange');
radiusInput.addEventListener('input', function (e) {
  var r = parseInt(e.target.value, 10);
  temperatureHeatmap.options.radius = r;
  temperatureHeatmap.redraw();
});

// opacity slider
var opacityInput = document.getElementById('opacityRange');
opacityInput.addEventListener('input', function (e) {
  var v = parseInt(e.target.value, 10) / 100;
  temperatureHeatmap.options.minOpacity = Math.max(0.05, v);
  temperatureHeatmap.redraw();
});

// initialize legend visibility
ensureLegendVisible();
// update legend when dataset loads
setTimeout(updateLegend, 500);

