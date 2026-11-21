from flask import Flask, jsonify, render_template
from datetime import datetime
import socket
import shutil
import time

app = Flask(__name__)

# ---------- CPU ----------

def read_cpu_times():
    with open("/proc/stat") as f:
        values = list(map(int, f.readline().split()[1:]))

    idle = values[3] + values[4]
    total = sum(values)

    return total, idle


def get_cpu_usage():
    total1, idle1 = read_cpu_times()
    time.sleep(0.1)
    total2, idle2 = read_cpu_times()

    total_diff = total2 - total1
    idle_diff = idle2 - idle1

    if total_diff <= 0:
        return 0.0

    return round((1 - idle_diff / total_diff) * 100, 1)


# ---------- MEMORY ----------

def get_memory():
    memory = {}

    with open("/proc/meminfo") as f:
        for line in f:
            key, value = line.split(":")
            memory[key] = int(value.strip().split()[0])

    total = memory["MemTotal"]
    available = memory["MemAvailable"]
    used = total - available

    return {
        "total_mb": round(total / 1024, 1),
        "used_mb": round(used / 1024, 1),
        "available_mb": round(available / 1024, 1),
        "usage_percent": round((used / total) * 100, 1)
    }


# ---------- DISK ----------

def get_disk():
    usage = shutil.disk_usage("/")

    return {
        "total_gb": round(usage.total / (1024 ** 3), 2),
        "used_gb": round(usage.used / (1024 ** 3), 2),
        "free_gb": round(usage.free / (1024 ** 3), 2),
        "usage_percent": round((usage.used / usage.total) * 100, 1)
    }


# ---------- NETWORK ----------

def read_network():
    interfaces = {}

    with open("/proc/net/dev") as f:
        lines = f.readlines()[2:]

    for line in lines:
        parts = line.split()

        interface = parts[0].rstrip(":")
        rx_bytes = int(parts[1])
        tx_bytes = int(parts[9])

        interfaces[interface] = {
            "rx_bytes": rx_bytes,
            "tx_bytes": tx_bytes
        }

    return interfaces


def get_network():
    current = read_network()

    if not hasattr(app, "previous_network"):
        app.previous_network = current
        app.previous_network_time = time.time()

        return {
            "rx_bytes_per_sec": 0,
            "tx_bytes_per_sec": 0,
            "rx_mb": 0,
            "tx_mb": 0
        }

    now = time.time()
    elapsed = now - app.previous_network_time

    rx_delta = 0
    tx_delta = 0

    if elapsed > 0:
        for interface, stats in current.items():

            # Ignore loopback
            if interface == "lo":
                continue

            previous = app.previous_network.get(interface, {})

            rx_delta += max(
                0,
                stats["rx_bytes"] - previous.get("rx_bytes", stats["rx_bytes"])
            )

            tx_delta += max(
                0,
                stats["tx_bytes"] - previous.get("tx_bytes", stats["tx_bytes"])
            )

    app.previous_network = current
    app.previous_network_time = now

    return {
        "rx_bytes_per_sec": round(rx_delta / elapsed, 2) if elapsed > 0 else 0,
        "tx_bytes_per_sec": round(tx_delta / elapsed, 2) if elapsed > 0 else 0,
        "rx_mb": round(rx_delta / (1024 ** 2), 4),
        "tx_mb": round(tx_delta / (1024 ** 2), 4)
    }


# ---------- SYSTEM LOAD ----------

def get_load():
    with open("/proc/loadavg") as f:
        values = f.readline().split()

    return {
        "load_1m": float(values[0]),
        "load_5m": float(values[1]),
        "load_15m": float(values[2])
    }


# ---------- UPTIME ----------

def get_uptime():
    with open("/proc/uptime") as f:
        seconds = float(f.readline().split()[0])

    days = int(seconds // 86400)
    hours = int((seconds % 86400) // 3600)
    minutes = int((seconds % 3600) // 60)

    return f"{days}d {hours}h {minutes}m"


# ---------- SYSTEM INFO ----------

def get_system_info():
    return {
        "hostname": socket.gethostname(),
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "uptime": get_uptime()
    }


# ---------- ROUTES ----------

@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/health")
def health():
    return jsonify({
        **get_system_info(),
        "status": "online"
    })


@app.route("/api/metrics")
def metrics():
    return jsonify({
        **get_system_info(),
        "cpu": get_cpu_usage(),
        "ram": get_memory(),
        "disk": get_disk(),
        "network": get_network(),
        "load": get_load()
    })

# ---------- SERVICE MONITORING ----------

import subprocess

@app.route("/api/services")
def services():

    service_list = ["nginx", "mariadb", "php-fpm", "sshd"]
    results = []

    for service in service_list:
        try:
            result = subprocess.run(
                ["systemctl", "is-active", service],
                capture_output=True,
                text=True,
                timeout=3
            )

            status = result.stdout.strip()

            results.append({
                "name": service,
                "status": status
            })

        except Exception as e:
            results.append({
                "name": service,
                "status": "unknown"
            })

    return jsonify(results)
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)

