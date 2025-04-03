from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import cv2
from ultralytics import YOLO

app = FastAPI()

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
MODEL_DIR = "model"
SMOKING_MODEL_PATH = os.path.join(MODEL_DIR, "drugs.pt")
NUDITY_MODEL_PATH = os.path.join(MODEL_DIR, "nude.pt")
VIOLENCE_MODEL_PATH = os.path.join(MODEL_DIR, "violence.pt")
video_source = None
detection_results = {}  # Store detection results globally

# Ensure the upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Load YOLO models
try:
    smoking_model = YOLO(SMOKING_MODEL_PATH)
    nudity_model = YOLO(NUDITY_MODEL_PATH)
    violence_model = YOLO(VIOLENCE_MODEL_PATH)
except Exception as e:
    raise RuntimeError(f"Failed to load models: {e}")

def format_seconds(seconds):
    """Formats seconds to HH:MM:SS format."""
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    return f"{hours:02}:{minutes:02}:{secs:02}"

def detect_video():
    """Detects smoking, nudity & violence in the video and stores timestamps."""
    global video_source, detection_results
    if not video_source:
        return {"duration": "00:00:00", "smoking": [], "nudity": [], "violence": []}

    cap = cv2.VideoCapture(video_source)
    if not cap.isOpened():
        print("Error: Cannot open video file.")
        return {"duration": "00:00:00", "smoking": [], "nudity": [], "violence": []}

    fps = int(cap.get(cv2.CAP_PROP_FPS))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames // fps  # Total duration in seconds
    smoking_timestamps = []
    nudity_timestamps = []
    violence_timestamps = []

    print(f"Processing video: {video_source} | Duration: {duration} sec | FPS: {fps}")

    for second in range(duration):
        cap.set(cv2.CAP_PROP_POS_FRAMES, second * fps)
        ret, frame = cap.read()
        if not ret:
            break

        smoking_results = smoking_model(frame)
        nudity_results = nudity_model(frame)
        violence_results = violence_model(frame)

        if any(len(result.boxes) > 0 for result in smoking_results):
            smoking_timestamps.append(format_seconds(second))
            print(f"Smoking detected at: {format_seconds(second)}")

        if any(len(result.boxes) > 0 for result in nudity_results):
            nudity_timestamps.append(format_seconds(second))
            print(f"Nudity detected at: {format_seconds(second)}")

        if any(len(result.boxes) > 0 for result in violence_results):
            violence_timestamps.append(format_seconds(second))
            print(f"Violence detected at: {format_seconds(second)}")

    cap.release()

    # Store results globally for later retrieval
    detection_results = {
        "duration": format_seconds(duration),
        "smoking": smoking_timestamps,
        "nudity": nudity_timestamps,
        "violence": violence_timestamps,
    }

    return detection_results

@app.post("/upload/")
async def upload_video(file: UploadFile = File(...)):
    """Uploads video and starts detection synchronously."""
    global video_source, detection_results
    if not file.filename.endswith((".mp4", ".avi", ".mov", ".mkv")):
        raise HTTPException(status_code=400, detail="Invalid video format. Use .mp4, .avi, .mov, or .mkv")

    file_path = os.path.join(UPLOAD_DIR, file.filename)

    try:
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

    video_source = file_path

    # Run detection
    detection_results = detect_video()

    return JSONResponse(content={
        "message": "Processing complete",
        "filename": file.filename,
        "video_url": f"/uploads/{file.filename}",  # For previewing the video
        "results": detection_results
    })

@app.get("/detections")
async def get_detections():
    """Returns detected timestamps (Smoking, Nudity & Violence) along with total duration."""
    return JSONResponse(content=detection_results)
