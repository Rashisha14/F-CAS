
function uploadVideo() {
    const fileInput = document.getElementById("videoInput");
    const status = document.getElementById("status");
    const videoElement = document.getElementById("uploadedVideo");

    if (!fileInput.files.length) {
        status.innerText = "Please select a video file.";
        return;
    }

    let formData = new FormData();
    formData.append("file", fileInput.files[0]);

    status.innerText = "Uploading...";

    fetch("http://127.0.0.1:8000/upload/", {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        status.innerText = data.message;
        videoElement.src = URL.createObjectURL(fileInput.files[0]);
        videoElement.style.display = "block";

        console.log("📤 Video uploaded successfully!");

        
        setTimeout(fetchDetections, 5000);
    })
    .catch(error => {
        console.error("Upload failed:", error);
        status.innerText = "Upload failed.";sns
    });

    let video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = function () {
        let totalSeconds = Math.floor(video.duration);
        document.getElementById("videoDuration").innerText = formatDuration(totalSeconds);
        document.getElementById("videoDuration").dataset.seconds = totalSeconds;
    };
    video.src = URL.createObjectURL(fileInput.files[0]);
}



function fetchDetections() {
    fetch("http://127.0.0.1:8000/detections")
    .then(response => response.json())
    .then(data => {
        let videoDuration = parseInt(document.getElementById("videoDuration").dataset.seconds) || 1;

        document.getElementById("smokingCount").innerText = formatDetectionStats(data.smoking, videoDuration);
        document.getElementById("nudityCount").innerText = formatDetectionStats(data.nudity, videoDuration);
        document.getElementById("violenceCount").innerText = formatDetectionStats(data.violence, videoDuration);

        updateDetectionList("smokingList", data.smoking);
        updateDetectionList("nudityList", data.nudity);
        updateDetectionList("violenceList", data.violence);

        console.log("📌 Detection timestamps processed!");

        // ✅ Now it's safe to show the certificate
        generateCertificate();
    })
    .catch(error => console.error("Error fetching detections:", error));
}





function updateDetectionList(elementId, timestamps) {
    let container = document.getElementById(elementId);
    container.innerHTML = "";
    if (timestamps.length === 0) {
        container.innerHTML = "<p>No detections</p>";
        return;
    }

    let groupedTimestamps = groupConsecutiveTimestamps(timestamps);
    groupedTimestamps.forEach(time => {
        let span = document.createElement("span");
        span.className = "detection-tag";
        span.innerText = time;
        container.appendChild(span);
    });
}

function groupConsecutiveTimestamps(timestamps) {
    if (timestamps.length === 0) return [];
    let groups = [];
    let start = timestamps[0];
    let prev = timestamps[0];

    for (let i = 1; i < timestamps.length; i++) {
        let current = timestamps[i];
        if (convertToSeconds(current) !== convertToSeconds(prev) + 1) {
            groups.push(start === prev ? start : `${start} - ${prev}`);
            start = current;
        }
        prev = current;
    }
    groups.push(start === prev ? start : `${start} - ${prev}`);
    return groups;
}

function convertToSeconds(time) {
    let parts = time.split(":").map(Number);
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function formatDuration(totalSeconds) {
    let hours = Math.floor(totalSeconds / 3600);
    let minutes = Math.floor((totalSeconds % 3600) / 60);
    let seconds = totalSeconds % 60;
    let formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} (${totalSeconds} sec)`;
    
    document.getElementById("videoDuration").innerText = formattedTime;
    document.getElementById("videoDuration").dataset.seconds = totalSeconds;
    
    return formattedTime;
}


function formatDetectionStats(detectionList, videoDuration) {
    let detectionSeconds = detectionList.length;
    let detectionPercentage = ((detectionSeconds / videoDuration) * 100).toFixed(2);
    return `${detectionSeconds} sec (${detectionPercentage}%)`;
}

document.getElementById("videoInput").addEventListener("change", handleVideoUpload);

function handleVideoUpload(event) {
    let file = event.target.files[0];

    if (file) {
        let videoElement = document.createElement("video");
        videoElement.preload = "metadata";

        videoElement.onloadedmetadata = function () {
            let totalSeconds = Math.floor(videoElement.duration) || 1; 
            document.getElementById("videoDuration").dataset.seconds = totalSeconds;
            
            console.log(`🎥 Video Duration Loaded: ${totalSeconds} sec`);
            
            // ❌ REMOVE THIS: It was causing early execution
            // generateCertificate();  
        };

        videoElement.src = URL.createObjectURL(file);
    }
}



function generateCertificate() {
    console.log("⚡ generateCertificate() function called!");

    let certificateDiv = document.getElementById("certificate");
    let ratingElement = document.getElementById("movieRating");

    let videoInput = document.getElementById("videoInput");

    if (videoInput.files.length > 0) {
        let movieName = videoInput.files[0].name.replace(/\.[^/.]+$/, "");
        document.getElementById("movieName").innerText = movieName;

        let totalSeconds = parseInt(document.getElementById("videoDuration").dataset.seconds) || 1;

        let violenceSeconds = extractSeconds(document.getElementById("violenceCount").innerText);
        let nuditySeconds = extractSeconds(document.getElementById("nudityCount").innerText);

        let violencePercentage = (violenceSeconds / totalSeconds) * 100;
        let nudityPercentage = (nuditySeconds / totalSeconds) * 100;

        let rating = "U";
        if (violencePercentage > 50 || nudityPercentage > 25) {
            rating = "A";
        } else if ((violencePercentage >= 25 && violencePercentage <= 50) || 
                   (nudityPercentage >= 10 && nudityPercentage <= 25)) {
            rating = "U/A";
        }

        ratingElement.innerText = rating;
        certificateDiv.style.display = "block";
        document.getElementById("downloadCertificate").style.display = "inline-block";
    } else {
        console.log("❌ No video file found!");
    }
}

function extractSeconds(text) {
    let match = text.match(/(\d+)\s*sec/);
    return match ? parseInt(match[1]) : 0;
}

document.getElementById("uploadedVideo").onended = function () {
    console.log("Video playback ended. Calling generateCertificate...");
    generateCertificate();
};

document.getElementById("downloadCertificate").addEventListener("click", () => {
    const certificate = document.getElementById("certificate");

    html2canvas(certificate).then(canvas => {
        const link = document.createElement("a");
        link.download = "certificate.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
    });
});
