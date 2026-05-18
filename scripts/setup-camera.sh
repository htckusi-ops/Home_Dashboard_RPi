#!/bin/bash
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CAMERA_DIR="$REPO_DIR/camera"
SERVICE_NAME="dashboard-camera"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

log() { echo "[setup-camera] $*"; }
warn() { echo "[setup-camera] WARN: $*" >&2; }
die() { echo "[setup-camera] ERROR: $*" >&2; exit 1; }

check_rpi() {
    if [ ! -f /proc/device-tree/model ]; then
        warn "This does not appear to be a Raspberry Pi (/proc/device-tree/model not found)."
        warn "Continuing anyway — picamera2 will not be installed."
        IS_RPI=false
    else
        MODEL=$(cat /proc/device-tree/model 2>/dev/null | tr -d '\0')
        log "Detected: $MODEL"
        IS_RPI=true
    fi
}

install_system_packages() {
    log "Updating package list..."
    apt-get update -qq

    PKGS=(
        python3-pip
        python3-numpy
        libatlas-base-dev
        cmake
        build-essential
        python3-dev
        libopencv-dev
        python3-opencv
    )

    if [ "$IS_RPI" = true ]; then
        PKGS+=(python3-picamera2)
    fi

    log "Installing system packages: ${PKGS[*]}"
    apt-get install -y "${PKGS[@]}"
}

install_python_packages() {
    log "Installing Python packages..."
    pip3 install --break-system-packages paho-mqtt numpy 2>/dev/null || \
        pip3 install paho-mqtt numpy

    if ! python3 -c "import cv2" 2>/dev/null; then
        log "System opencv not usable from Python, installing opencv-python-headless..."
        pip3 install --break-system-packages opencv-python-headless 2>/dev/null || \
            pip3 install opencv-python-headless
    else
        log "OpenCV already available."
    fi
}

ask_face_recognition() {
    echo ""
    echo "Face recognition requires dlib (C++ library) which takes ~30-60 minutes to compile"
    echo "on a Raspberry Pi 4B unless a pre-built wheel is available."
    echo ""
    read -r -p "Install face_recognition? (requires ~45min compile) [y/N]: " answer
    case "$answer" in
        [yY]|[yY][eE][sS])
            log "Installing dlib and face_recognition (this will take a while)..."
            pip3 install --break-system-packages dlib face_recognition 2>/dev/null || \
                pip3 install dlib face_recognition
            log "face_recognition installed successfully."
            ;;
        *)
            log "Skipping face_recognition. Agent will run in presence-only mode."
            ;;
    esac
}

copy_config() {
    if [ ! -f "$CAMERA_DIR/config.json" ]; then
        log "Copying config.example.json → config.json"
        cp "$CAMERA_DIR/config.example.json" "$CAMERA_DIR/config.json"
        log "Edit $CAMERA_DIR/config.json and set your MQTT broker address and panel_id."
    else
        log "config.json already exists, skipping."
    fi
}

install_service() {
    log "Installing systemd service: $SERVICE_FILE"
    cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Dashboard Camera Agent
After=network.target
Wants=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/Home_Dashboard_RPi/camera
ExecStart=/usr/bin/python3 /home/pi/Home_Dashboard_RPi/camera/camera_agent.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    log "Service enabled (will start on next boot or when manually started)."
}

print_next_steps() {
    echo ""
    echo "=========================================="
    echo " Setup complete — next steps"
    echo "=========================================="
    echo ""
    echo "1. Edit the configuration:"
    echo "   nano $CAMERA_DIR/config.json"
    echo "   → Set panel_id, mqtt.broker, adult_persons"
    echo ""
    echo "2. Enroll known faces (requires face_recognition):"
    echo "   cd $CAMERA_DIR"
    echo "   python3 enroll_face.py mama"
    echo "   python3 enroll_face.py papa"
    echo ""
    echo "3. Start the camera agent:"
    echo "   sudo systemctl start $SERVICE_NAME"
    echo ""
    echo "4. Check logs:"
    echo "   journalctl -u $SERVICE_NAME -f"
    echo ""
    echo "5. Import Node-RED flow:"
    echo "   $REPO_DIR/node-red/flows/camera-agent-addon.json"
    echo ""
}

main() {
    if [ "$EUID" -ne 0 ]; then
        die "Run as root: sudo $0"
    fi

    log "Starting camera agent setup..."
    check_rpi
    install_system_packages
    install_python_packages
    ask_face_recognition
    copy_config
    install_service
    print_next_steps
}

main "$@"
