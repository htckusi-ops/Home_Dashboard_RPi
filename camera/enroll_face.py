import sys
import time
import argparse
from pathlib import Path

import cv2

try:
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False

KNOWN_FACES_DIR = Path(__file__).parent / "known_faces"


def parse_args():
    parser = argparse.ArgumentParser(description="Enroll a new face for the camera agent")
    parser.add_argument("name", help="Person name (used as directory name under known_faces/)")
    parser.add_argument("--adult", action="store_true", help="Mark person as adult (adds 'adult_' prefix to dir name)")
    parser.add_argument("--frames", type=int, default=10, help="Number of frames to capture (default: 10)")
    parser.add_argument("--camera", type=int, default=0, help="Camera index (default: 0)")
    parser.add_argument("--delay", type=float, default=1.0, help="Seconds between captures (default: 1.0)")
    return parser.parse_args()


def main():
    args = parse_args()

    if not FACE_RECOGNITION_AVAILABLE:
        print("ERROR: face_recognition library is not installed.")
        print("Install it with: pip3 install face_recognition")
        sys.exit(1)

    dir_name = f"adult_{args.name}" if args.adult else args.name
    person_dir = KNOWN_FACES_DIR / dir_name
    person_dir.mkdir(parents=True, exist_ok=True)

    print(f"Enrolling: {args.name}")
    print(f"Adult mode: {args.adult}")
    print(f"Saving to: {person_dir}")
    print(f"Target frames: {args.frames}")
    print()

    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        print(f"ERROR: Cannot open camera index {args.camera}")
        sys.exit(1)

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    existing = list(person_dir.glob("face_*.jpg"))
    next_idx = len(existing) + 1
    captured = 0

    print("Starting capture in 2 seconds. Look at the camera...")
    time.sleep(2)

    while captured < args.frames:
        ret, frame = cap.read()
        if not ret:
            print("ERROR: Could not read frame from camera")
            break

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        locations = face_recognition.face_locations(rgb, model="hog")

        if len(locations) == 0:
            print(f"  Frame skipped: no face detected — hold still and face the camera")
            time.sleep(args.delay)
            continue

        if len(locations) > 1:
            print(f"  Frame skipped: {len(locations)} faces detected — only one person should be in frame")
            time.sleep(args.delay)
            continue

        filename = person_dir / f"face_{next_idx:03d}.jpg"
        cv2.imwrite(str(filename), frame)
        captured += 1
        next_idx += 1
        print(f"  Captured {captured}/{args.frames}: {filename.name}")
        time.sleep(args.delay)

    cap.release()

    if captured == 0:
        print("\nNo frames were captured. Enrollment failed.")
        sys.exit(1)

    print(f"\nEnrollment complete: {captured} image(s) saved for '{args.name}'")
    if args.adult:
        print(f"Remember to add '{dir_name}' to the 'adult_persons' list in config.json.")
    print("Restart the camera agent to apply changes.")


if __name__ == "__main__":
    main()
