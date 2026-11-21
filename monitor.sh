#!/bin/bash

# Logging configuration

LOG_DIR="$HOME/server-monitor/logs"
LOG_FILE="$LOG_DIR/monitor.log"

mkdir -p "$LOG_DIR"

exec > >(tee -a "$LOG_FILE") 2>&1
echo ""
echo "================================="
echo "Monitoring started: $(date)"
echo "================================="
# Server Health Monitor

RAM_THRESHOLD=80
DISK_THRESHOLD=80
CPU_THRESHOLD=80
# Service monitoring function
alert() 
{
    echo "[ALERT] $(date '+%F %T') - $1"
}
cooldown_alert() {
    MESSAGE=$1
    ALERT_NAME=$2
    COOLDOWN=1800

    ALERT_FILE="$HOME/server-monitor/state/alerts/${ALERT_NAME}.time"
    NOW=$(date +%s)

    if [ -f "$ALERT_FILE" ]; then
        LAST_ALERT=$(cat "$ALERT_FILE")
        ELAPSED=$((NOW - LAST_ALERT))

        if [ "$ELAPSED" -lt "$COOLDOWN" ]; then
            return
        fi
    fi

    alert "$MESSAGE"
    echo "$NOW" > "$ALERT_FILE"
}
check_service() {
    SERVICE=$1
    STATE_FILE="$HOME/server-monitor/state/${SERVICE}.state"

    if systemctl is-active --quiet "$SERVICE"; then

        if [ -f "$STATE_FILE" ] && [ "$(cat "$STATE_FILE")" = "DOWN" ]; then
            echo "[RECOVERY] $(date '+%F %T') - $SERVICE is BACK ONLINE!"
        else
            echo "$SERVICE: RUNNING"
        fi

        echo "UP" > "$STATE_FILE"

    else

        if [ ! -f "$STATE_FILE" ] || [ "$(cat "$STATE_FILE")" != "DOWN" ]; then
            alert "$SERVICE is DOWN!"
        else
            echo "$SERVICE: STILL DOWN"
        fi

        echo "DOWN" > "$STATE_FILE"
    fi
}

echo "================================="
echo "       SERVER HEALTH MONITOR"
echo "================================="

echo "Hostname : $(hostname)"
echo "Date    : $(date)"
echo "Uptime  : $(uptime -p)"

echo "================================="
echo "         SYSTEM RESOURCES"
echo "================================="

# CPU monitoring

CPU1=$(awk '/^cpu / {
    idle=$5+$6
    total=0
    for(i=2;i<=NF;i++) total+=$i
    print total, idle
}' /proc/stat)

sleep 1

CPU2=$(awk '/^cpu / {
    idle=$5+$6
    total=0
    for(i=2;i<=NF;i++) total+=$i
    print total, idle
}' /proc/stat)

read TOTAL1 IDLE1 <<< "$CPU1"
read TOTAL2 IDLE2 <<< "$CPU2"

TOTAL_DIFF=$((TOTAL2 - TOTAL1))
IDLE_DIFF=$((IDLE2 - IDLE1))

CPU_USAGE=$(awk -v total="$TOTAL_DIFF" -v idle="$IDLE_DIFF" \
    'BEGIN {if(total>0) printf "%.0f", ((total-idle)/total)*100; else print 0}')

echo "CPU Usage: ${CPU_USAGE}%"

if [ "$CPU_USAGE" -ge "$CPU_THRESHOLD" ]; then
    cooldown_alert "CPU usage is high: ${CPU_USAGE}%" "cpu"
else
    echo "CPU Status: OK"
fi

echo "---------------------------------"

# RAM monitoring

RAM_USAGE=$(free | awk '/Mem:/ {printf "%.0f", ($3/$2)*100}')

echo "RAM Usage: ${RAM_USAGE}%"

if [ "$RAM_USAGE" -ge "$RAM_THRESHOLD" ]; then
    cooldown_alert "RAM usage is high: ${RAM_USAGE}%" "ram"
else
    echo "RAM Status: OK"
fi

echo "---------------------------------"

# Disk monitoring

DISK_USAGE=$(df / | awk 'NR==2 {gsub("%","",$5); print $5}')

echo "Disk Usage: ${DISK_USAGE}%"

if [ "$DISK_USAGE" -ge "$DISK_THRESHOLD" ]; then
    cooldown_alert "Disk usage is high: ${DISK_USAGE}%" "disk"
else
    echo "Disk Status: OK"
fi
echo "================================="
echo "         SERVICE STATUS"
echo "================================="

check_service nginx
check_service mariadb
check_service php-fpm
check_service sshd
echo "================================="
echo "Monitor completed."
