let chart = null;
let dataTimer = null;
let currentUpdateSeconds = 2;
let latestThickness = 0;
let latestThreshold = 5;
let latestSample = null;

const BASE_LINE = "#94a3b8";
const SAFE = "#16a34a";
const WARN = "#eab308";
const DANGER = "#dc2626";

document.addEventListener("DOMContentLoaded", () => {

  initTheme();
  initUpdateInterval();
  initChart();
  bindThreshold();

  updateData();
  refreshStatus();
  refreshDatasets();

  const savedInterval = localStorage.getItem("updateInterval") || "2";
  setUpdateInterval(savedInterval, false);

  // доступ для HTML
  window.setTheme = setTheme;
  window.setUpdateInterval = setUpdateInterval;
  window.uploadModel = uploadModel;
  window.uploadDataset = uploadDataset;
});


// ================= THEME =================

function initTheme() {
  const saved = localStorage.getItem("theme") || "light";
  applyTheme(saved, false);
}

function applyTheme(theme, save = true) {
  document.body.className = theme;
  if (save) localStorage.setItem("theme", theme);
}

function setTheme(theme) {
  applyTheme(theme, true);
}


// ================= THRESHOLD =================

function bindThreshold() {
  const el = document.getElementById("minThickness");
  if (!el) return;

  const saved = localStorage.getItem("minThickness");
  if (saved !== null) el.value = saved;

  latestThreshold = getThresholdValue();

  el.addEventListener("input", () => {
    localStorage.setItem("minThickness", el.value);
    latestThreshold = getThresholdValue();

    if (latestSample) {
      renderModelIndicator(latestSample.thickness, latestThreshold);
      refreshChartFromData();
      checkAlarm(latestSample.thickness);
    }
  });
}

function getThresholdValue() {
  const el = document.getElementById("minThickness");
  const v = parseFloat(el?.value);
  return Number.isFinite(v) ? v : 5;
}


// ================= CHART =================

function initChart() {
  const ctx = document.getElementById("chart").getContext("2d");

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Толщина (мм)",
        data: [],
        borderWidth: 3,
        tension: 0.4,
        pointRadius: 4,
        fill: false,
        borderColor: SAFE,
        pointBackgroundColor: SAFE
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 15
        }
      }
    }
  });
}

function severityColor(value, threshold) {
  const ratio = value / threshold;

  if (ratio <= 1) return DANGER;
  if (ratio <= 1.5) return WARN;
  return SAFE;
}

function pushChartPoint(sample) {
  if (!chart) return;

  chart.data.labels.push(sample.time);
  chart.data.datasets[0].data.push(sample.thickness);

  if (chart.data.labels.length > 40) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }

  const color = severityColor(sample.thickness, getThresholdValue());

  chart.data.datasets[0].borderColor = color;
  chart.data.datasets[0].pointBackgroundColor = color;

  chart.update();
}

function refreshChartFromData() {
  if (!chart || !latestSample) return;

  const color = severityColor(latestSample.thickness, getThresholdValue());

  chart.data.datasets[0].borderColor = color;
  chart.data.datasets[0].pointBackgroundColor = color;

  chart.update();
}


// ================= DATA =================

async function updateData() {
  try {

    const res = await fetch("/robot/data");
    const data = await res.json();

    if (!data.length) return;

    const d = data[0];

    latestSample = d;
    latestThickness = d.thickness;

    renderTable(d);
    checkAlarm(d.thickness);
    pushChartPoint(d);

    // 🔥 3D подсветка
    renderModelIndicator(d.thickness, getThresholdValue());

    // 🔥 AI
    const predRes = await fetch("/predict", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(d)
    });

    const pred = await predRes.json();
    console.log("AI:", pred.prediction);

    await refreshStatus();

  } catch (e) {
    console.error(e);
  }
}


// ================= TABLE =================

function renderTable(sample) {
  document.getElementById("temp").innerText = sample.temperature.toFixed(1) + " °C";
  document.getElementById("hum").innerText = sample.humidity.toFixed(1) + " %";
  document.getElementById("thick").innerText = sample.thickness.toFixed(1) + " мм";
  document.getElementById("dist").innerText = sample.distance.toFixed(1) + " мм";
  document.getElementById("path").innerText = (sample.path || 0).toFixed(1) + " см";
  document.getElementById("crack").innerText = sample.cracks;
}


// ================= ALARM =================

function checkAlarm(thickness) {
  const alarm = document.getElementById("alarm");
  const min = getThresholdValue();

  if (thickness <= min && thickness > 0) {
    alarm.style.display = "block";
  } else {
    alarm.style.display = "none";
  }
}


// ================= STATUS =================

async function refreshStatus() {
  try {
    const server = await (await fetch("/server/status")).json();
    const robot = await (await fetch("/robot/status")).json();

    document.getElementById("serverStatus").innerText = server.status;
    document.getElementById("robotStatus").innerText = robot.connected ? "подключен" : "нет";
    document.getElementById("robotCount").innerText = server.robots;

  } catch {
    document.getElementById("serverStatus").innerText = "offline";
  }
}


// ================= FILES =================

async function uploadModel() {
  const input = document.getElementById("fileInput");
  const file = input.files[0];
  if (!file) return;

  const form = new FormData();
  form.append("file", file);

  await fetch("/upload/stl", { method: "POST", body: form });

  loadModel();
}