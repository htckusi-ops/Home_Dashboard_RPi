import sys
import json
import time
import logging
import signal
from pathlib import Path

import numpy as np
import cv2
import paho.mqtt.client as mqtt

try:
    from picamera2 import Picamera2
    PICAMERA2_AVAILABLE = True
except ImportError:
    PICAMERA2_AVAILABLE = False

try:
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("camera_agent")


def load_config(path):
    with open(path) as f:
        return json.load(f)


def load_known_faces(known_faces_dir, adult_persons):
    known = []
    base = Path(known_faces_dir)
    if not base.exists():
        log.warning("known_faces_dir %s does not exist", base)
        return known

    for person_dir in sorted(base.iterdir()):
        if not person_dir.is_dir():
            continue
        name = person_dir.name
        is_adult = name in adult_persons

        image_paths = []
        for ext in ("jpg", "jpeg", "png"):
            image_paths.extend(person_dir.glob(f"*.{ext}"))
            image_paths.extend(person_dir.glob(f"*.{ext.upper()}"))

        encodings = []
        for img_path in image_paths:
            img = face_recognition.load_image_file(str(img_path))
            encs = face_recognition.face_encodings(img)
            if encs:
                encodings.append(encs[0])

        if encodings:
            known.append({"name": name, "is_adult": is_adult, "encodings": encodings})
            log.info("Loaded %d encoding(s) for '%s' (adult=%s)", len(encodings), name, is_adult)
        else:
            log.warning("No faces found in %s", person_dir)

    return known


class CameraAgent:
    def __init__(self, config):
        self.cfg = config
        self.panel_id = config["panel_id"]
        self.running = False

        det = config.get("detection", {})
        self.motion_threshold = det.get("motion_threshold", 5000)
        self.presence_cooldown = det.get("presence_cooldown_seconds", 30)
        self.face_check_interval = det.get("face_check_interval_seconds", 2)
        self.face_confidence_min = det.get("face_confidence", 0.6)
        self.adult_session_seconds = det.get("adult_session_seconds", 300)
        self.adult_cooldown = det.get("adult_cooldown_seconds", 120)

        feat = config.get("features", {})
        self.presence_enabled = feat.get("presence", True)
        self.face_enabled = feat.get("face_recognition", True) and FACE_RECOGNITION_AVAILABLE
        self.adult_persons = feat.get("adult_persons", [])

        cam = config.get("camera", {})
        self.cam_index = cam.get("index", 0)
        self.cam_width = cam.get("width", 640)
        self.cam_height = cam.get("height", 480)
        self.fps = cam.get("fps", 10)

        self.known_faces = []
        if self.face_enabled:
            known_faces_dir = config.get("known_faces_dir", "known_faces")
            self.known_faces = load_known_faces(known_faces_dir, self.adult_persons)
            if not self.known_faces:
                log.warning("No known faces loaded; face recognition disabled")
                self.face_enabled = False

        self.prev_gray = None
        self.last_presence_publish = 0.0
        self.last_presence_state = None
        self.no_motion_frame_count = 0
        self.last_face_check = 0.0
        self.last_adult_trigger = 0.0

        self.client = self._build_mqtt_client()

    def _build_mqtt_client(self):
        mqtt_cfg = self.cfg.get("mqtt", {})
        broker = mqtt_cfg.get("broker", "localhost")
        port = mqtt_cfg.get("port", 1883)

        client = mqtt.Client(client_id=f"camera_agent_{self.panel_id}")
        client.on_connect = lambda c, u, f, rc: log.info("MQTT connected rc=%d", rc)
        client.on_disconnect = lambda c, u, rc: log.warning("MQTT disconnected rc=%d", rc)
        client.connect_async(broker, port, keepalive=60)
        client.loop_start()
        return client

    def _topic(self, suffix):
        return f"dashboard/panels/{self.panel_id}/{suffix}"

    def _publish_presence(self, detected):
        now = time.time()
        if detected:
            if self.last_presence_state is True and (now - self.last_presence_publish) < self.presence_cooldown:
                return
            payload = json.dumps({"detected": True, "ts": now})
            self.client.publish(self._topic("presence/state"), payload, qos=0, retain=False)
            log.info("Presence: detected")
            self.last_presence_publish = now
            self.last_presence_state = True
        else:
            if self.last_presence_state is False:
                return
            payload = json.dumps({"detected": False, "ts": now})
            self.client.publish(self._topic("presence/state"), payload, qos=0, retain=False)
            log.info("Presence: not detected")
            self.last_presence_state = False

    def _publish_face(self, name, is_adult, confidence):
        now = time.time()
        if is_adult and (now - self.last_adult_trigger) < self.adult_cooldown:
            return
        payload = json.dumps({"person": name, "adult": is_adult, "confidence": round(confidence, 3)})
        self.client.publish(self._topic("face/recognized"), payload, qos=0, retain=False)
        log.info("Face recognized: %s adult=%s confidence=%.2f", name, is_adult, confidence)
        if is_adult:
            self.last_adult_trigger = now

    def _detect_motion(self, frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)

        if self.prev_gray is None:
            self.prev_gray = gray
            return False

        delta = cv2.absdiff(self.prev_gray, gray)
        self.prev_gray = gray
        _, thresh = cv2.threshold(delta, 15, 255, cv2.THRESH_BINARY)
        thresh = cv2.dilate(thresh, None, iterations=2)
        motion_pixels = cv2.countNonZero(thresh)
        return motion_pixels > self.motion_threshold

    def _check_faces(self, frame):
        small = cv2.resize(frame, (0, 0), fx=0.5, fy=0.5)
        rgb_small = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
        locations = face_recognition.face_locations(rgb_small, model="hog")
        if not locations:
            return
        encodings = face_recognition.face_encodings(rgb_small, locations)
        for encoding in encodings:
            best_name = None
            best_confidence = 0.0
            best_is_adult = False

            for person in self.known_faces:
                distances = face_recognition.face_distance(person["encodings"], encoding)
                min_dist = float(np.min(distances))
                confidence = 1.0 - min_dist
                if confidence >= self.face_confidence_min and confidence > best_confidence:
                    best_confidence = confidence
                    best_name = person["name"]
                    best_is_adult = person["is_adult"]

            if best_name:
                self._publish_face(best_name, best_is_adult, best_confidence)

    def _open_camera(self):
        if PICAMERA2_AVAILABLE:
            try:
                cam = Picamera2()
                cam.configure(
                    cam.create_preview_configuration(
                        main={"size": (self.cam_width, self.cam_height), "format": "BGR888"}
                    )
                )
                cam.start()
                log.info("Camera opened via picamera2")
                return cam, "picamera2"
            except Exception as e:
                log.warning("picamera2 failed (%s), falling back to OpenCV", e)

        cap = cv2.VideoCapture(self.cam_index)
        if not cap.isOpened():
            raise RuntimeError("Cannot open camera index %d" % self.cam_index)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.cam_width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.cam_height)
        cap.set(cv2.CAP_PROP_FPS, self.fps)
        log.info("Camera opened via OpenCV VideoCapture index=%d", self.cam_index)
        return cap, "opencv"

    def _read_frame(self, cam, cam_type):
        if cam_type == "picamera2":
            return cam.capture_array()
        else:
            ret, frame = cam.read()
            if not ret:
                raise RuntimeError("VideoCapture.read() returned False")
            return frame

    def _close_camera(self, cam, cam_type):
        try:
            if cam_type == "picamera2":
                cam.stop()
            else:
                cam.release()
        except Exception:
            pass

    def run(self):
        self.running = True
        frame_interval = 1.0 / self.fps
        no_motion_threshold_frames = self.fps * 3

        log.info(
            "Starting camera agent panel=%s face_recognition=%s picamera2=%s",
            self.panel_id,
            self.face_enabled,
            PICAMERA2_AVAILABLE,
        )

        while self.running:
            cam = None
            cam_type = None
            try:
                cam, cam_type = self._open_camera()
                self.prev_gray = None

                while self.running:
                    t_start = time.monotonic()
                    frame = self._read_frame(cam, cam_type)

                    motion = self._detect_motion(frame)

                    if motion:
                        self.no_motion_frame_count = 0
                        if self.presence_enabled:
                            self._publish_presence(True)

                        now = time.time()
                        if self.face_enabled and (now - self.last_face_check) >= self.face_check_interval:
                            self.last_face_check = now
                            self._check_faces(frame)
                    else:
                        self.no_motion_frame_count += 1
                        if self.no_motion_frame_count >= no_motion_threshold_frames:
                            if self.presence_enabled:
                                self._publish_presence(False)

                    elapsed = time.monotonic() - t_start
                    sleep_for = frame_interval - elapsed
                    if sleep_for > 0:
                        time.sleep(sleep_for)

            except KeyboardInterrupt:
                self.running = False
            except Exception as e:
                log.error("Camera error: %s — retrying in 5s", e)
                time.sleep(5)
            finally:
                if cam is not None:
                    self._close_camera(cam, cam_type)

        self.client.loop_stop()
        self.client.disconnect()
        log.info("Camera agent stopped")


def main():
    config_path = sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent / "config.json"
    config = load_config(config_path)
    agent = CameraAgent(config)

    def _handle_signal(signum, frame):
        log.info("Signal %d received, shutting down", signum)
        agent.running = False

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    try:
        agent.run()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
