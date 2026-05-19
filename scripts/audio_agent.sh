#!/usr/bin/env bash
# Subscribes to MQTT audio/set, controls HDMI audio via pactl (PipeWire/PulseAudio)
set -euo pipefail

BROKER="${MQTT_BROKER:-localhost}"
PANEL_ID="${DASHBOARD_PANEL_ID:-kitchen}"
TOPIC_IN="dashboard/panels/${PANEL_ID}/audio/set"
TOPIC_OUT="dashboard/panels/${PANEL_ID}/audio/state"

publish_state() {
    local vol muted_raw muted
    vol=$(pactl get-sink-volume @DEFAULT_SINK@ 2>/dev/null | grep -oP '\d+(?=%)' | head -1 || echo 80)
    muted_raw=$(pactl get-sink-mute @DEFAULT_SINK@ 2>/dev/null | grep -oP 'yes|no' || echo no)
    muted=$([ "$muted_raw" = "yes" ] && echo true || echo false)
    mosquitto_pub -h "$BROKER" -t "$TOPIC_OUT" -m "{\"volume\": $vol, \"muted\": $muted}" -q 1
}

echo "[audio-agent] Subscribing to $TOPIC_IN on $BROKER"
publish_state

mosquitto_sub -h "$BROKER" -t "$TOPIC_IN" | while IFS= read -r payload; do
    vol=$(echo "$payload" | jq -r '.volume // empty' 2>/dev/null)
    muted=$(echo "$payload" | jq -r '.muted // empty' 2>/dev/null)

    [ -n "$vol" ] && pactl set-sink-volume @DEFAULT_SINK@ "${vol}%" 2>/dev/null || true
    if [ "$muted" = "true" ]; then
        pactl set-sink-mute @DEFAULT_SINK@ 1 2>/dev/null || true
    elif [ "$muted" = "false" ]; then
        pactl set-sink-mute @DEFAULT_SINK@ 0 2>/dev/null || true
    fi

    publish_state
done
