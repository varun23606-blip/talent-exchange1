/* ==========================================================================
   TALENT EXCHANGE - WEBRTC AUDIO & VIDEO CALL ARCHITECTURE
   ========================================================================== */

let localStream = null;
let callTimerInterval = null;
let callSeconds = 0;
let isAudioMuted = false;
let isVideoDisabled = false;

window.startVideoCall = async function(peerId, peerName) {
  openCallModal("video", peerName);

  try {
    // Request real camera and microphone permissions
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true
    });

    const videoEl = document.getElementById("local-video-preview");
    if (videoEl) {
      videoEl.srcObject = localStream;
      videoEl.play().catch(e => console.error("Play error:", e));
    }

    startCallTimer();
    showToast("Camera & microphone connected.", "success");
  } catch (err) {
    console.error("WebRTC Error:", err);
    let msg = "Could not access camera/microphone.";
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      msg = "Camera/microphone permission was denied. Please allow device access in browser settings.";
    } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      msg = "No camera or microphone found on this device.";
    }
    showToast(msg, "error");
    const statusText = document.getElementById("call-status-desc");
    if (statusText) statusText.textContent = msg;
  }
};

window.startAudioCall = async function(peerId, peerName) {
  openCallModal("audio", peerName);

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    });

    startCallTimer();
    showToast("Microphone connected.", "success");
  } catch (err) {
    console.error("Audio WebRTC Error:", err);
    let msg = "Could not access microphone.";
    if (err.name === "NotAllowedError") {
      msg = "Microphone permission denied. Please allow microphone access in browser settings.";
    }
    showToast(msg, "error");
    const statusText = document.getElementById("call-status-desc");
    if (statusText) statusText.textContent = msg;
  }
};

function openCallModal(type, peerName) {
  let modal = document.getElementById("webrtc-call-modal");
  if (!modal) {
    createCallModalElement();
    modal = document.getElementById("webrtc-call-modal");
  }

  const titleEl = document.getElementById("call-peer-title");
  const videoBox = document.getElementById("call-video-box");
  const audioBox = document.getElementById("call-audio-box");

  if (titleEl) titleEl.textContent = peerName || "Skill Partner";

  if (type === "video") {
    videoBox.style.display = "flex";
    audioBox.style.display = "none";
  } else {
    videoBox.style.display = "none";
    audioBox.style.display = "flex";
  }

  modal.classList.add("active");
  resetCallControls();
}

function resetCallControls() {
  isAudioMuted = false;
  isVideoDisabled = false;
  callSeconds = 0;
  updateTimerDisplay();

  const muteBtn = document.getElementById("call-toggle-mic");
  const camBtn = document.getElementById("call-toggle-cam");
  if (muteBtn) {
    muteBtn.classList.remove("active-off");
    muteBtn.innerHTML = "🎤";
  }
  if (camBtn) {
    camBtn.classList.remove("active-off");
    camBtn.innerHTML = "📷";
  }
}

function startCallTimer() {
  clearInterval(callTimerInterval);
  callSeconds = 0;
  callTimerInterval = setInterval(() => {
    callSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function updateTimerDisplay() {
  const timerEls = document.querySelectorAll(".call-timer-text");
  const mins = String(Math.floor(callSeconds / 60)).padStart(2, "0");
  const secs = String(callSeconds % 60).padStart(2, "0");
  timerEls.forEach(el => el.textContent = `${mins}:${secs}`);
}

window.endCurrentCall = function() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  clearInterval(callTimerInterval);
  const modal = document.getElementById("webrtc-call-modal");
  if (modal) modal.classList.remove("active");

  const videoEl = document.getElementById("local-video-preview");
  if (videoEl) videoEl.srcObject = null;

  showToast("Call ended.", "info");
};

function toggleMicrophone() {
  if (!localStream) return;
  const audioTracks = localStream.getAudioTracks();
  if (audioTracks.length > 0) {
    isAudioMuted = !isAudioMuted;
    audioTracks[0].enabled = !isAudioMuted;
    const btn = document.getElementById("call-toggle-mic");
    if (btn) {
      btn.classList.toggle("active-off", isAudioMuted);
      btn.innerHTML = isAudioMuted ? "🔇" : "🎤";
    }
    showToast(isAudioMuted ? "Microphone muted" : "Microphone unmuted", "info");
  }
}

function toggleCamera() {
  if (!localStream) return;
  const videoTracks = localStream.getVideoTracks();
  if (videoTracks.length > 0) {
    isVideoDisabled = !isVideoDisabled;
    videoTracks[0].enabled = !isVideoDisabled;
    const btn = document.getElementById("call-toggle-cam");
    if (btn) {
      btn.classList.toggle("active-off", isVideoDisabled);
      btn.innerHTML = isVideoDisabled ? "🚫" : "📷";
    }
    showToast(isVideoDisabled ? "Camera stopped" : "Camera turned on", "info");
  }
}

function createCallModalElement() {
  const div = document.createElement("div");
  div.id = "webrtc-call-modal";
  div.className = "call-modal";
  div.innerHTML = `
    <div class="call-container">
      <div class="call-peer-overlay" style="position:static;">
        <span class="pulse-dot"></span>
        <span id="call-peer-title" style="font-weight:700;">Skill Partner</span>
        <span>•</span>
        <span class="call-timer-text">00:00</span>
      </div>

      <!-- Video Feed Box -->
      <div id="call-video-box" class="call-viewscreen">
        <video id="local-video-preview" class="local-video" autoplay muted playsinline></video>
        <div class="call-peer-overlay">
          <span>Camera Preview Active</span>
        </div>
      </div>

      <!-- Audio Avatar Box -->
      <div id="call-audio-box" class="audio-call-container" style="display:none; padding:40px 0;">
        <img src="assets/avatar-default.svg" class="audio-avatar-pulsing" alt="Audio Partner">
        <div class="call-timer-text" style="font-size:1.5rem;font-weight:700;margin-top:12px;">00:00</div>
        <p id="call-status-desc" class="call-status-text">Live Audio Call in Progress</p>
      </div>

      <!-- Controls Dock -->
      <div class="call-controls">
        <button class="call-btn" id="call-toggle-mic" title="Mute/Unmute Mic">🎤</button>
        <button class="call-btn" id="call-toggle-cam" title="Toggle Camera">📷</button>
        <button class="call-btn call-btn-end" id="call-btn-hangup" title="End Call">✕ End</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);

  document.getElementById("call-toggle-mic").addEventListener("click", toggleMicrophone);
  document.getElementById("call-toggle-cam").addEventListener("click", toggleCamera);
  document.getElementById("call-btn-hangup").addEventListener("click", window.endCurrentCall);
}

// Prepare modal on script load
document.addEventListener("DOMContentLoaded", () => {
  createCallModalElement();
});