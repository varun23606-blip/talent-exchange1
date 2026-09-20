/* ==========================================================================
   TALENT EXCHANGE - CENTRAL API & CLIENT UTILITIES
   ========================================================================== */

const API_BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : "https://talent-exchange-backend-p5wq.onrender.com";

console.log("[Talent Exchange] API Base URL configured to:", API_BASE_URL);

// Standard API Helper
const api = {
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
    const defaultHeaders = {
      "Content-Type": "application/json",
      "Accept": "application/json"
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };

    try {
      const res = await fetch(url, config);
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg = (data && data.message) || `Request failed with status ${res.status}`;
        throw new Error(errorMsg);
      }

      return data;
    } catch (err) {
      console.error(`[API Error] ${options.method || "GET"} ${url}:`, err);
      let message = err.message || "Unable to connect to server. Please try again.";
      if (err.name === "TypeError" && err.message.includes("Failed to fetch")) {
        message = "Unable to reach the server. Please check your connection or backend status.";
      }
      throw new Error(message);
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(body)
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  },

  async upload(file, type = "") {
    const url = `${API_BASE_URL}/api/upload`;
    const formData = new FormData();
    formData.append("file", file);
    if (type) formData.append("type", type);

    try {
      const res = await fetch(url, {
        method: "POST",
        body: formData
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data && data.message) || `Upload failed with status ${res.status}`);
      }
      return data;
    } catch (err) {
      console.error("[API Upload Error]:", err);
      throw new Error(err.message || "Failed to upload file. Please try again.");
    }
  }
};

// Toast Notifications System
function showToast(message, type = "info", duration = 3500) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let icon = "ℹ️";
  if (type === "success") icon = "✅";
  if (type === "error") icon = "⚠️";

  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Session Helpers
const SESSION_KEY = "userProfile";

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setCurrentUser(user) {
  if (user) {
    // Non-sensitive data only
    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department || "",
      semester: user.semester || "",
      bio: user.bio || "",
      profile_image: user.profile_image || "assets/avatar-default.svg",
      teach_skill: user.teach_skill || "",
      learn_skill: user.learn_skill || "",
      role: user.role || "student",
      video_url: user.video_url || "",
      certificate_url: user.certificate_url || "",
      certificate_title: user.certificate_title || "",
      verification_status: user.verification_status || "unverified",
      is_verified: Boolean(user.is_verified)
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(safeUser));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function isAuthenticated() {
  return Boolean(getCurrentUser() && getCurrentUser().id);
}

function requireAuth() {
  if (!isAuthenticated()) {
    showToast("Please log in to continue.", "info");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 400);
    return false;
  }
  return true;
}

// Button Loading State Helper
function setLoading(button, isLoading, normalText = "") {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Processing...`;
  } else {
    button.disabled = false;
    button.innerHTML = normalText || button.dataset.originalText || "Submit";
  }
}

// Modal Helpers
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("active");
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("active");
}

// Universal Video Player and Certificate Viewer Modals
function openVideoPlayerModal(videoUrl, teacherName) {
  let modal = document.getElementById("video-player-modal");
  if (!modal) {
    createVideoPlayerModal();
    modal = document.getElementById("video-player-modal");
  }

  const titleEl = document.getElementById("video-modal-teacher-name");
  const player = document.getElementById("modal-video-element");
  if (titleEl) titleEl.textContent = `${teacherName || 'Student'}'s Teaching Demo`;
  if (player) {
    player.src = videoUrl;
    player.play().catch(() => {});
  }
  openModal("video-player-modal");
}

function openCertificateModal(certUrl, certTitle, studentName) {
  let modal = document.getElementById("cert-viewer-modal");
  if (!modal) {
    createCertificateModal();
    modal = document.getElementById("cert-viewer-modal");
  }

  const titleEl = document.getElementById("cert-modal-title");
  const studentEl = document.getElementById("cert-modal-student");
  const imgEl = document.getElementById("cert-modal-img");
  const linkEl = document.getElementById("cert-modal-link");

  if (titleEl) titleEl.textContent = certTitle || "Skill Certificate";
  if (studentEl) studentEl.textContent = `Awarded to ${studentName || 'Student'}`;
  if (imgEl) imgEl.src = certUrl;
  if (linkEl) linkEl.href = certUrl;

  openModal("cert-viewer-modal");
}

function createVideoPlayerModal() {
  if (document.getElementById("video-player-modal")) return;
  const div = document.createElement("div");
  div.id = "video-player-modal";
  div.className = "modal-backdrop";
  div.innerHTML = `
    <div class="modal-card modal-card-wide">
      <div class="modal-header">
        <h3 class="modal-title" id="video-modal-teacher-name">Teaching Video</h3>
        <button class="modal-close" type="button">&times;</button>
      </div>
      <div class="modal-body" style="padding: 16px;">
        <div class="video-player-frame">
          <video id="modal-video-element" controls style="width:100%;height:100%;background:#000;"></video>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary modal-cancel">Close Video</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);

  div.querySelectorAll(".modal-close, .modal-cancel").forEach(b => {
    b.addEventListener("click", () => {
      closeModal("video-player-modal");
      const p = document.getElementById("modal-video-element");
      if (p) {
        p.pause();
        p.src = "";
      }
    });
  });
}

function createCertificateModal() {
  if (document.getElementById("cert-viewer-modal")) return;
  const div = document.createElement("div");
  div.id = "cert-viewer-modal";
  div.className = "modal-backdrop";
  div.innerHTML = `
    <div class="modal-card modal-card-wide">
      <div class="modal-header">
        <div>
          <h3 class="modal-title" id="cert-modal-title">Verified Skill Certificate</h3>
          <div id="cert-modal-student" style="font-size: 0.85rem; color: var(--text-secondary);">Student</div>
        </div>
        <button class="modal-close" type="button">&times;</button>
      </div>
      <div class="modal-body" style="padding: 20px; text-align: center;">
        <div class="cert-preview-frame">
          <img id="cert-modal-img" src="" alt="Verified Certificate" onerror="this.src='https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80'">
        </div>
      </div>
      <div class="modal-footer">
        <a id="cert-modal-link" href="#" target="_blank" class="btn btn-secondary btn-sm">Open Full Document ↗</a>
        <button type="button" class="btn btn-primary btn-sm modal-cancel">Done</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);

  div.querySelectorAll(".modal-close, .modal-cancel").forEach(b => {
    b.addEventListener("click", () => closeModal("cert-viewer-modal"));
  });
}

// Universal Navbar Renderer
function renderNavbar(activePage = "") {
  const navPlaceholder = document.getElementById("navbar-mount");
  if (!navPlaceholder) return;

  const user = getCurrentUser();
  const loggedIn = Boolean(user && user.id);

  let navLinksHtml = "";
  let navActionsHtml = "";

  if (loggedIn) {
    const isAdmin = user.role === "admin";
    navLinksHtml = isAdmin ? `
      <li><a href="admin.html" class="nav-link ${activePage === 'admin' ? 'active' : ''}">🛡️ Admin Console</a></li>
      <li><a href="find-skills.html" class="nav-link ${activePage === 'find-skills' ? 'active' : ''}">Find Skills</a></li>
      <li><a href="dashboard.html" class="nav-link ${activePage === 'dashboard' ? 'active' : ''}">Student View</a></li>
    ` : `
      <li><a href="dashboard.html" class="nav-link ${activePage === 'dashboard' ? 'active' : ''}">Dashboard</a></li>
      <li><a href="find-skills.html" class="nav-link ${activePage === 'find-skills' ? 'active' : ''}">Find Skills</a></li>
      <li><a href="offer-skill.html" class="nav-link ${activePage === 'offer-skill' ? 'active' : ''}">Offer Skill</a></li>
      <li><a href="requests.html" class="nav-link ${activePage === 'requests' ? 'active' : ''}">Requests</a></li>
      <li><a href="connections.html" class="nav-link ${activePage === 'connections' ? 'active' : ''}">Connections</a></li>
      <li><a href="chat.html" class="nav-link ${activePage === 'chat' ? 'active' : ''}">Messages</a></li>
    `;

    navActionsHtml = `
      ${!isAdmin ? `
        <a href="requests.html" class="notif-btn" id="notif-bell" title="Notifications">
          🔔
          <span class="notif-badge" id="notif-count" style="display: none;">0</span>
        </a>
      ` : ''}
      <div class="user-menu-wrapper">
        <div class="user-menu-trigger" id="user-menu-btn">
          <img src="${user.profile_image || 'assets/avatar-default.svg'}" class="user-menu-avatar" alt="${user.name}" onerror="this.src='assets/avatar-default.svg'">
          <span class="user-menu-name">${user.name.split(' ')[0]}</span>
          <span style="font-size:0.7rem;">▼</span>
        </div>
        <div class="user-dropdown" id="user-dropdown">
          ${isAdmin ? '<a href="admin.html" class="dropdown-item" style="color:#fbbf24; font-weight:600;">🛡️ Admin Console</a>' : ''}
          <a href="profile.html" class="dropdown-item">👤 My Profile</a>
          <a href="offer-skill.html" class="dropdown-item">💡 My Skills</a>
          <a href="connections.html" class="dropdown-item">👥 My Connections</a>
          <div class="dropdown-divider"></div>
          <a href="#" class="dropdown-item danger" id="nav-logout-btn">🚪 Logout</a>
        </div>
      </div>
    `;
  } else {
    navLinksHtml = `
      <li><a href="index.html#features" class="nav-link">Features</a></li>
      <li><a href="index.html#how-it-works" class="nav-link">How It Works</a></li>
      <li><a href="index.html#about" class="nav-link">About</a></li>
    `;

    navActionsHtml = `
      <a href="login.html" class="btn btn-secondary btn-sm" title="Student Login">User Login</a>
      <a href="admin-login.html" class="btn btn-secondary btn-sm" style="border-color: rgba(245, 158, 11, 0.4); color: #fbbf24;" title="Administrator Portal">🛡️ Admin</a>
      <a href="register.html" class="btn btn-primary btn-sm">Register</a>
    `;
  }

  navPlaceholder.innerHTML = `
    <nav class="navbar">
      <div class="nav-container">
        <a href="${loggedIn ? (user.role === 'admin' ? 'admin.html' : 'dashboard.html') : 'index.html'}" class="nav-brand">
          <img src="assets/logo.svg" alt="Talent Exchange Logo">
          <span class="brand-text">Talent<span>Exchange</span></span>
        </a>
        <ul class="nav-links" id="nav-links">
          ${navLinksHtml}
        </ul>
        <div class="nav-actions">
          ${navActionsHtml}
          <button class="mobile-toggle" id="mobile-nav-toggle" aria-label="Toggle menu">☰</button>
        </div>
      </div>
    </nav>
  `;

  // Bind dropdown & logout
  if (loggedIn) {
    const trigger = document.getElementById("user-menu-btn");
    const dropdown = document.getElementById("user-dropdown");
    if (trigger && dropdown) {
      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("show");
      });
      document.addEventListener("click", () => {
        dropdown.classList.remove("show");
      });
    }

    const logoutBtn = document.getElementById("nav-logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        api.post("/api/logout", {}).catch(() => {});
        clearSession();
        showToast("Logged out successfully", "info");
        setTimeout(() => {
          window.location.href = "login.html";
        }, 500);
      });
    }

    refreshNotificationBadge();
  }

  // Mobile navigation toggle
  const mobileToggle = document.getElementById("mobile-nav-toggle");
  const navLinks = document.getElementById("nav-links");
  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener("click", () => {
      navLinks.classList.toggle("active");
    });
  }
}

// Refresh Notification Badge from backend
async function refreshNotificationBadge() {
  const user = getCurrentUser();
  if (!user || !user.id) return;

  try {
    const res = await api.get(`/api/notifications?user_id=${user.id}`);
    const badge = document.getElementById("notif-count");
    if (badge && res && typeof res.unread_count === "number") {
      if (res.unread_count > 0) {
        badge.textContent = res.unread_count > 9 ? "9+" : res.unread_count;
        badge.style.display = "flex";
      } else {
        badge.style.display = "none";
      }
    }
  } catch (err) {
    // Silently ignore badge network failure
  }
}