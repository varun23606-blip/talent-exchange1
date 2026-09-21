/* ==========================================================================
   TALENT EXCHANGE - CLIENT ADAPTER & UI UTILITIES
   Architecture: Pure Firebase Client (Auth, Firestore, Cloud Storage)
   Zero Render / Flask dependencies
   ========================================================================== */

console.log("[Talent Exchange] Loaded with Pure Firebase Infrastructure (talent-exchange-b8827)");

// Universal API Adapter connected directly to Firebase Services
const api = {
  /**
   * Universal GET dispatcher for Firebase Firestore
   */
  async get(endpoint) {
    const url = new URL(endpoint, "http://localhost");
    const pathname = url.pathname;
    const params = url.searchParams;

    // 1. Stats
    if (pathname === "/api/stats" || pathname === "/api/admin/overview") {
      if (window.firebaseDb) {
        const stats = await window.firebaseDb.getAdminStats();
        return { success: true, data: stats };
      }
      return { success: true, data: { total_users: 4, total_skills: 6, verified_mentors: 3, pending_verifications: 0 } };
    }

    // 2. Users query
    if (pathname === "/api/users") {
      if (window.firebaseDb) {
        const filters = {
          exclude_user_id: params.get("exclude_user_id"),
          q: params.get("q"),
          skill: params.get("skill"),
          department: params.get("department"),
          semester: params.get("semester"),
          only_verified: params.get("only_verified") === "true"
        };
        const users = await window.firebaseDb.getAllUsers(filters);
        return { success: true, data: users };
      }
      return { success: true, data: [] };
    }

    // 3. Single User
    if (pathname.startsWith("/api/users/")) {
      const uid = pathname.replace("/api/users/", "");
      if (window.firebaseDb) {
        const user = await window.firebaseDb.getUser(uid);
        return { success: Boolean(user), data: user };
      }
      return { success: false, data: null };
    }

    // 4. Exchange Requests
    if (pathname === "/api/requests") {
      const userId = params.get("user_id");
      if (window.firebaseDb) {
        const reqs = await window.firebaseDb.getRequests(userId);
        return { success: true, data: reqs };
      }
      return { success: true, data: { incoming: [], outgoing: [] } };
    }

    // 5. Connections
    if (pathname === "/api/connections") {
      const userId = params.get("user_id");
      if (window.firebaseDb) {
        const conns = await window.firebaseDb.getConnections(userId);
        return { success: true, data: conns };
      }
      return { success: true, data: [] };
    }

    // 6. Admin Verifications List
    if (pathname === "/api/admin/verifications") {
      if (window.firebaseDb) {
        const certs = await window.firebaseDb.getCertificates();
        return { success: true, data: certs };
      }
      return { success: true, data: [] };
    }

    // 7. Notifications
    if (pathname === "/api/notifications") {
      const userId = params.get("user_id");
      return { success: true, unread_count: 0 };
    }

    // 8. Firebase status
    if (pathname === "/api/firebase-status") {
      return { success: true, is_live: true, project_id: "talent-exchange-b8827" };
    }

    return { success: true, data: [] };
  },

  /**
   * Universal POST dispatcher
   */
  async post(endpoint, body = {}) {
    const pathname = endpoint.split("?")[0];

    // 1. Auth: Login
    if (pathname === "/api/login") {
      if (window.firebaseAuth) {
        return window.firebaseAuth.loginUser(body.email, body.password);
      }
      throw new Error("Authentication service is initializing.");
    }

    // 2. Auth: Register
    if (pathname === "/api/register") {
      if (window.firebaseAuth) {
        return window.firebaseAuth.registerUser(body.email, body.password, body);
      }
      throw new Error("Authentication service is initializing.");
    }

    // 3. Auth: Logout
    if (pathname === "/api/logout") {
      if (window.firebaseAuth) {
        await window.firebaseAuth.logoutUser();
      }
      return { success: true };
    }

    // 4. Send Exchange Request
    if (pathname === "/api/requests") {
      if (window.firebaseDb) {
        const req = await window.firebaseDb.sendExchangeRequest(
          body.sender_id,
          body.receiver_id,
          body.offered_skill,
          body.requested_skill
        );
        return { success: true, data: req };
      }
      throw new Error("Database service is initializing.");
    }

    // 5. Send Chat Message
    if (pathname === "/api/messages") {
      if (window.firebaseDb) {
        const msg = await window.firebaseDb.sendMessage(
          body.sender_id,
          body.receiver_id,
          body.message
        );
        return { success: true, data: msg };
      }
      throw new Error("Database service is initializing.");
    }

    // 6. Submit Certificate for Review
    if (pathname === "/api/certificates/submit" || pathname === "/api/verify-certificate") {
      if (window.firebaseDb) {
        const res = await window.firebaseDb.submitCertificate(body);
        return { success: true, data: res };
      }
      return { success: true };
    }

    // 7. Add Skill
    if (pathname === "/api/skills") {
      if (window.firebaseDb) {
        const s = await window.firebaseDb.addSkill(body);
        return { success: true, data: s };
      }
      return { success: true };
    }

    // 8. Admin Review Certificate
    if (pathname.includes("/review")) {
      const match = pathname.match(/\/api\/admin\/verifications\/([^/]+)\/review/);
      if (match && window.firebaseDb) {
        const certId = match[1];
        const adminUid = (window.getCurrentUser && window.getCurrentUser().id) || "admin";
        await window.firebaseDb.reviewCertificate(certId, body.status, adminUid);
        return { success: true };
      }
    }

    return { success: true };
  },

  /**
   * Universal PUT dispatcher
   */
  async put(endpoint, body = {}) {
    const pathname = endpoint.split("?")[0];

    // 1. Update Request (Accept / Reject)
    if (pathname.startsWith("/api/requests/")) {
      const reqId = pathname.replace("/api/requests/", "");
      if (window.firebaseDb) {
        await window.firebaseDb.updateRequestStatus(reqId, body.status);
        return { success: true };
      }
    }

    // 2. Update User Profile
    if (pathname.startsWith("/api/users/")) {
      const uid = pathname.replace("/api/users/", "");
      if (window.firebaseDb) {
        const updated = await window.firebaseDb.updateUser(uid, body);
        return { success: true, data: updated };
      }
    }

    return { success: true };
  },

  /**
   * Universal Upload Dispatcher to Firebase Cloud Storage
   */
  async upload(file, type = "") {
    if (!window.firebaseStorage) {
      throw new Error("Firebase Storage service is not loaded.");
    }

    const currentUid = (window.getCurrentUser && window.getCurrentUser().id) || "anonymous";

    if (type === "video") {
      return window.firebaseStorage.uploadTeachingVideo(file, currentUid);
    } else if (type === "certificate") {
      return window.firebaseStorage.uploadCertificate(file, currentUid);
    } else {
      return window.firebaseStorage.uploadProfileImage(file, currentUid);
    }
  },

  async getFirebaseStatus() {
    return { success: true, is_live: true, project_id: "talent-exchange-b8827" };
  }
};

// ============================================================================
// Toast Notification Engine
// ============================================================================
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

// ============================================================================
// Session Persistence Helpers
// ============================================================================
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
    const safeUser = {
      id: user.id || user.uid,
      uid: user.uid || user.id,
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
  const u = getCurrentUser();
  return Boolean(u && (u.id || u.uid));
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

// ============================================================================
// UI Helpers: Loading States, Modals, Players
// ============================================================================
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

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("active");
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("active");
}

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

// ============================================================================
// Universal Navbar Renderer
// ============================================================================
function renderNavbar(activePage = "") {
  const navPlaceholder = document.getElementById("navbar-mount");
  if (!navPlaceholder) return;

  const user = getCurrentUser();
  const loggedIn = Boolean(user && (user.id || user.uid));

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
          <span class="user-menu-name">${(user.name || "Student").split(' ')[0]}</span>
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
      logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        if (window.firebaseAuth) {
          await window.firebaseAuth.logoutUser();
        }
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

// Refresh Notification Badge from Firestore Realtime Listener
function refreshNotificationBadge() {
  const user = getCurrentUser();
  if (!user || (!user.id && !user.uid)) return;

  const uid = user.id || user.uid;
  if (window.firebaseDb && typeof window.firebaseDb.listenNotifications === "function") {
    window.firebaseDb.listenNotifications(uid, ({ unreadCount }) => {
      const badge = document.getElementById("notif-count");
      if (badge) {
        if (unreadCount > 0) {
          badge.textContent = unreadCount > 9 ? "9+" : unreadCount;
          badge.style.display = "flex";
        } else {
          badge.style.display = "none";
        }
      }
    });
  }
}

// Global exports
if (typeof window !== "undefined") {
  window.api = api;
  window.showToast = showToast;
  window.getCurrentUser = getCurrentUser;
  window.setCurrentUser = setCurrentUser;
  window.clearSession = clearSession;
  window.isAuthenticated = isAuthenticated;
  window.requireAuth = requireAuth;
  window.setLoading = setLoading;
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.openVideoPlayerModal = openVideoPlayerModal;
  window.openCertificateModal = openCertificateModal;
  window.renderNavbar = renderNavbar;
  window.refreshNotificationBadge = refreshNotificationBadge;
}