// ==========================================
// ASTRA NOC - LIVE SERVER MONITOR
// ==========================================

const API_URL = "/dashboard/api/metrics";
const REFRESH_INTERVAL = 3000;
const MAX_POINTS = 60;

const history = {
    labels: [],
    cpu: [],
    ram: [],
    rx: [],
    tx: [],
    load1: [],
    load5: [],
    load15: []
};

let cpuPeak = 0;
let cpuTotal = 0;
let cpuSamples = 0;

let cpuChart;
let ramChart;
let networkChart;
let loadChart;


// ==========================================
// HELPERS
// ==========================================

function formatBytesPerSecond(bytes) {
    if (bytes < 1024) return `${bytes.toFixed(0)} B/s`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB/s`;
}

function formatTime() {
    return new Date().toLocaleTimeString("en-IN", {
        hour12: false
    });
}

function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function setBar(id, value) {
    const element = document.getElementById(id);
    if (!element) return;

    element.style.width = `${clamp(value)}%`;
}

function getState(value) {
    if (value >= 90) return "CRITICAL";
    if (value >= 80) return "WARNING";
    return "NORMAL";
}


// ==========================================
// CHART GLOBAL CONFIG
// ==========================================

Chart.defaults.color = "#758397";
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 10;

function createGradient(ctx, color1, color2) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 250);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    return gradient;
}

function baseChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 500
        },
        interaction: {
            intersect: false,
            mode: "index"
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: "#111a27",
                borderColor: "rgba(148,163,184,0.15)",
                borderWidth: 1,
                padding: 10,
                titleColor: "#e5edf8",
                bodyColor: "#a9b7ca"
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    maxTicksLimit: 7,
                    color: "#65748a"
                },
                border: {
                    display: false
                }
            },
            y: {
                grid: {
                    color: "rgba(148,163,184,0.07)"
                },
                ticks: {
                    color: "#65748a"
                },
                border: {
                    display: false
                }
            }
        }
    };
}


// ==========================================
// CPU CHART
// ==========================================

function initCPUChart() {
    const canvas = document.getElementById("cpuChart");
    const ctx = canvas.getContext("2d");

    cpuChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: history.labels,
            datasets: [{
                label: "CPU Usage",
                data: history.cpu,
                borderColor: "#39d5ff",
                backgroundColor: createGradient(
                    ctx,
                    "rgba(57,213,255,0.28)",
                    "rgba(57,213,255,0.01)"
                ),
                borderWidth: 2,
                fill: true,
                tension: 0.38,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: "#39d5ff"
            }]
        },
        options: {
            ...baseChartOptions(),
            scales: {
                ...baseChartOptions().scales,
                y: {
                    ...baseChartOptions().scales.y,
                    min: 0,
                    max: 100,
                    ticks: {
                        stepSize: 20,
                        callback: value => `${value}%`
                    }
                }
            }
        }
    });
}


// ==========================================
// RAM CHART
// ==========================================

function initRAMChart() {
    const canvas = document.getElementById("ramChart");
    const ctx = canvas.getContext("2d");

    ramChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: history.labels,
            datasets: [{
                label: "RAM Usage",
                data: history.ram,
                borderColor: "#9b7bff",
                backgroundColor: createGradient(
                    ctx,
                    "rgba(155,123,255,0.25)",
                    "rgba(155,123,255,0.01)"
                ),
                borderWidth: 2,
                fill: true,
                tension: 0.38,
                pointRadius: 0,
                pointHoverRadius: 4
            }]
        },
        options: {
            ...baseChartOptions(),
            scales: {
                ...baseChartOptions().scales,
                y: {
                    ...baseChartOptions().scales.y,
                    min: 0,
                    max: 100,
                    ticks: {
                        stepSize: 20,
                        callback: value => `${value}%`
                    }
                }
            }
        }
    });
}


// ==========================================
// NETWORK CHART
// ==========================================

function initNetworkChart() {
    const canvas = document.getElementById("networkChart");
    const ctx = canvas.getContext("2d");

    networkChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: history.labels,
            datasets: [
                {
                    label: "Download RX",
                    data: history.rx,
                    borderColor: "#39d5ff",
                    backgroundColor: "rgba(57,213,255,0.08)",
                    borderWidth: 2,
                    fill: false,
                    tension: 0.35,
                    pointRadius: 0
                },
                {
                    label: "Upload TX",
                    data: history.tx,
                    borderColor: "#9b7bff",
                    backgroundColor: "rgba(155,123,255,0.08)",
                    borderWidth: 2,
                    fill: false,
                    tension: 0.35,
                    pointRadius: 0
                }
            ]
        },
        options: {
            ...baseChartOptions(),
            scales: {
                ...baseChartOptions().scales,
                y: {
                    ...baseChartOptions().scales.y,
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatBytesPerSecond(value)
                    }
                }
            }
        }
    });
}


// ==========================================
// LOAD CHART
// ==========================================

function initLoadChart() {
    const canvas = document.getElementById("loadChart");
    const ctx = canvas.getContext("2d");

    loadChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: history.labels,
            datasets: [
                {
                    label: "1 Minute",
                    data: history.load1,
                    borderColor: "#39d5ff",
                    borderWidth: 2,
                    tension: 0.35,
                    pointRadius: 0
                },
                {
                    label: "5 Minutes",
                    data: history.load5,
                    borderColor: "#4e8cff",
                    borderWidth: 2,
                    tension: 0.35,
                    pointRadius: 0
                },
                {
                    label: "15 Minutes",
                    data: history.load15,
                    borderColor: "#9b7bff",
                    borderWidth: 2,
                    tension: 0.35,
                    pointRadius: 0
                }
            ]
        },
        options: {
            ...baseChartOptions(),
            plugins: {
                ...baseChartOptions().plugins,
                legend: {
                    display: true,
                    position: "bottom",
                    labels: {
                        usePointStyle: true,
                        pointStyle: "circle",
                        boxWidth: 7,
                        padding: 15,
                        color: "#8391a5"
                    }
                }
            },
            scales: {
                ...baseChartOptions().scales,
                y: {
                    ...baseChartOptions().scales.y,
                    beginAtZero: true
                }
            }
        }
    });
}


// ==========================================
// UPDATE CHARTS
// ==========================================

function updateCharts() {
    cpuChart.update("none");
    ramChart.update("none");
    networkChart.update("none");
    loadChart.update("none");
}


// ==========================================
// RESOURCE STATUS
// ==========================================

function updateResourceStatus(resource, value) {
    const state = getState(value);

    setText(`${resource}-state`, state);
    setText(`${resource}-alert`, state);

    const dot = document.getElementById(`${resource}-dot`);

    if (dot) {
        dot.style.background =
            state === "CRITICAL" ? "#ff5e73" :
            state === "WARNING" ? "#ffbd59" :
            "#34e6a1";

        dot.style.boxShadow =
            state === "CRITICAL" ? "0 0 8px rgba(255,94,115,0.5)" :
            state === "WARNING" ? "0 0 8px rgba(255,189,89,0.5)" :
            "0 0 8px rgba(52,230,161,0.3)";
    }
}


// ==========================================
// UPDATE DASHBOARD
// ==========================================

function updateDashboard(data) {

    // HOST INFORMATION

    setText("hostname", data.hostname);
    setText("info-hostname", data.hostname);
    setText("uptime", data.uptime);
    setText("uptime-card", data.uptime);
    setText("last-update", formatTime());


    // CPU

    const cpu = Number(data.cpu) || 0;

    setText("cpu-value", `${cpu.toFixed(1)}%`);
    setText("cpu-current", `${cpu.toFixed(1)}%`);

    setBar("cpu-bar", cpu);

    cpuPeak = Math.max(cpuPeak, cpu);
    cpuTotal += cpu;
    cpuSamples++;

    setText("cpu-peak", `${cpuPeak.toFixed(1)}%`);
    setText("cpu-average", `${(cpuTotal / cpuSamples).toFixed(1)}%`);


    // RAM

    const ram = data.ram;
    const ramUsage = Number(ram.usage_percent) || 0;

    setText("ram-value", `${ramUsage.toFixed(1)}%`);
    setText("ram-current", `${ram.used_mb.toFixed(0)} MB`);
    setText("ram-total", `${ram.total_mb.toFixed(0)} MB`);
    setText("ram-available", `${ram.available_mb.toFixed(0)} MB`);
    setText("ram-details", `${ram.used_mb.toFixed(0)} / ${ram.total_mb.toFixed(0)} MB`);

    setBar("ram-bar", ramUsage);


    // DISK

    const disk = data.disk;
    const diskUsage = Number(disk.usage_percent) || 0;

    setText("disk-value", `${diskUsage.toFixed(1)}%`);
    setText("disk-details", `${disk.free_gb.toFixed(2)} GB free`);

    setBar("disk-bar", diskUsage);


    // NETWORK

    const network = data.network || {};

    setText("rx-speed", formatBytesPerSecond(network.rx_bytes_per_sec || 0));
    setText("tx-speed", formatBytesPerSecond(network.tx_bytes_per_sec || 0));


    // LOAD AVERAGE

    const load = data.load || {};

    setText("load-1", (load.load_1m || 0).toFixed(2));
    setText("load-5", (load.load_5m || 0).toFixed(2));
    setText("load-15", (load.load_15m || 0).toFixed(2));


    // RESOURCE STATES

    updateResourceStatus("cpu", cpu);
    updateResourceStatus("ram", ramUsage);
    updateResourceStatus("disk", diskUsage);


    // HISTORY

    history.labels.push(formatTime());
    history.cpu.push(cpu);
    history.ram.push(ramUsage);
    history.rx.push(network.rx_bytes_per_sec || 0);
    history.tx.push(network.tx_bytes_per_sec || 0);
    history.load1.push(load.load_1m || 0);
    history.load5.push(load.load_5m || 0);
    history.load15.push(load.load_15m || 0);

    // Keep the chart history limited to 60 points

    if (history.labels.length > MAX_POINTS) {
        Object.values(history).forEach(array => array.shift());
    }

    updateCharts();
}


// ==========================================
// LIVE CLOCK
// ==========================================

function updateClock() {
    const clock = document.getElementById("clock");

    if (clock) {
        clock.textContent = new Date().toLocaleTimeString("en-IN", {
            hour12: false
        });
    }
}


// ==========================================
// API
// ==========================================

async function fetchMetrics() {

    try {
        const response = await fetch(API_URL, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        updateDashboard(data);

    } catch (error) {
        console.error("Metrics API error:", error);

        const hostname = document.getElementById("hostname");

        if (hostname) {
            hostname.textContent = "Connection Lost";
        }
    }
}


// ==========================================
// INITIALIZATION
// ==========================================

function initDashboard() {

    initCPUChart();
    initRAMChart();
    initNetworkChart();
    initLoadChart();

    updateClock();

    fetchMetrics();

    setInterval(fetchMetrics, REFRESH_INTERVAL);
    setInterval(updateClock, 1000);
}

document.addEventListener("DOMContentLoaded", initDashboard);
// ==========================================
// LIVE SYSTEM SERVICE MONITOR
// ==========================================

async function fetchServices() {

    try {
        const response = await fetch("/dashboard/api/services", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const services = await response.json();

        let runningCount = 0;

        services.forEach(service => {

            const id = `service-${service.name}`;
            const row = document.getElementById(id);

            if (!row) return;

            const statusElement = row.querySelector(".service-status");

            row.classList.remove(
                "service-running",
                "service-stopped",
                "service-warning"
            );

            const status = service.status.toLowerCase();

            if (status === "active") {

                row.classList.add("service-running");
                statusElement.textContent = "RUNNING";
                runningCount++;

            } else if (
                status === "inactive" ||
                status === "failed"
            ) {

                row.classList.add("service-stopped");
                statusElement.textContent = status.toUpperCase();

            } else {

                row.classList.add("service-warning");
                statusElement.textContent = status.toUpperCase();

            }

        });

        setText(
            "service-summary-count",
            `${runningCount} / ${services.length}`
        );

    } catch (error) {

        console.error("Service monitoring error:", error);

        setText("service-summary-count", "ERROR");
    }
}


// Initial service check
fetchServices();

// Refresh services every 3 seconds
setInterval(fetchServices, 3000);
