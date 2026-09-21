/* ==========================================================================
   TALENT EXCHANGE - ADMINISTRATOR CONSOLE CONTROLLER
   Powered by Firebase Authentication (Role: admin) & Cloud Firestore
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  const user = getCurrentUser();
  if (!user || user.role !== "admin") {
    showToast("Administrator privileges required to access this portal.", "error");
    setTimeout(() => {
      window.location.href = "admin-login.html";
    }, 700);
    return;
  }

  renderNavbar("admin");

  // Load initial data
  await loadAdminData();

  // Bind refresh button
  const refreshBtn = document.getElementById("btn-refresh");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      setLoading(refreshBtn, true);
      await loadAdminData();
      setLoading(refreshBtn, false);
      showToast("Admin data refreshed successfully!", "success");
    });
  }

  // Bind logout button
  const logoutBtn = document.getElementById("btn-admin-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      if (window.firebaseAuth) {
        await window.firebaseAuth.logoutUser();
      }
      clearSession();
      showToast("Logged out from admin console.", "info");
      setTimeout(() => {
        window.location.href = "admin-login.html";
      }, 500);
    });
  }

  // Bind student directory search
  const searchInput = document.getElementById("search-users-input");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      filterUsersTable(searchInput.value.toLowerCase().trim());
    });
  }
});

let allUsersCache = [];

async function loadAdminData() {
  await Promise.all([
    loadOverviewMetrics(),
    loadVerificationsList(),
    loadUsersList()
  ]);
}

async function loadOverviewMetrics() {
  try {
    const res = await api.get("/api/admin/overview");
    if (res && res.data) {
      const d = res.data;
      if (document.getElementById("stat-total-users")) document.getElementById("stat-total-users").textContent = d.total_users || 0;
      if (document.getElementById("stat-total-skills")) document.getElementById("stat-total-skills").textContent = d.total_skills || 0;
      if (document.getElementById("stat-verified-mentors")) document.getElementById("stat-verified-mentors").textContent = d.verified_mentors || 0;
      if (document.getElementById("stat-pending-verifications")) document.getElementById("stat-pending-verifications").textContent = d.pending_verifications || 0;
      if (document.getElementById("stat-active-connections")) document.getElementById("stat-active-connections").textContent = d.active_connections || 0;
      if (document.getElementById("stat-exchanges-completed")) document.getElementById("stat-exchanges-completed").textContent = d.exchanges_completed || 0;
    }
  } catch (err) {
    console.error("Failed to load admin overview metrics:", err);
  }

  // Update Firebase status badge
  const badge = document.getElementById("firebase-status-badge");
  if (badge) {
    badge.innerHTML = `🔥 Firebase: Live (Auth, Firestore, Storage)`;
    badge.style.color = "#34d399";
    badge.style.borderColor = "rgba(52, 211, 153, 0.4)";
    badge.style.background = "rgba(52, 211, 153, 0.15)";
  }
}

async function loadVerificationsList() {
  const tbody = document.getElementById("verifications-table-body");
  if (!tbody) return;

  try {
    const res = await api.get("/api/admin/verifications");
    let items = (res && res.data) ? res.data : [];

    // Also pull users with pending certificates directly
    const usersRes = await api.get("/api/users");
    const users = (usersRes && usersRes.data) ? usersRes.data : [];
    
    // Combine items
    const combined = [...items];
    users.forEach(u => {
      if (u.certificate_url && !combined.some(c => c.user_id === u.id)) {
        combined.push({
          id: "u_cert_" + u.id,
          user_id: u.id,
          user_name: u.name,
          user_email: u.email,
          user_dept: u.department,
          skill_name: u.teach_skill || "General",
          certificate_title: u.certificate_title || "Skill Certificate",
          file_url: u.certificate_url,
          video_url: u.video_url || "",
          status: u.verification_status || (u.is_verified ? "verified" : "pending"),
          is_verified: Boolean(u.is_verified)
        });
      }
    });

    if (combined.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 32px; color: var(--text-secondary);">
            ✨ No certificates uploaded for review yet.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = combined.map(item => {
      const isVerified = item.status === "verified" || Boolean(item.is_verified);
      const isRejected = item.status === "rejected";
      const hasVideo = Boolean(item.video_url);
      const certUrl = item.file_url || item.certificate_url || item.cert_url;
      const certTitle = item.certificate_title || item.cert_title || "Skill Certificate";
      const studentName = item.user_name || item.name || "Student";
      const studentEmail = item.user_email || item.email || "";
      const userId = item.user_id || item.id;

      let statusBadge = `<span class="badge badge-pending">⏳ Pending Review</span>`;
      if (isVerified) {
        statusBadge = `<span class="badge badge-verified">🛡️ Verified Mentor</span>`;
      } else if (isRejected) {
        statusBadge = `<span class="badge badge-amber">❌ Rejected</span>`;
      }

      return `
        <tr data-user-id="${userId}">
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="assets/avatar-default.svg" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover;">
              <div>
                <strong style="color: #fff; display: block;">${studentName}</strong>
                <span style="font-size: 0.8rem; color: var(--text-secondary);">${studentEmail}</span>
              </div>
            </div>
          </td>
          <td>
            <strong style="color: var(--primary);">${item.skill_name || 'General'}</strong>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${item.user_dept || 'Student'}</div>
          </td>
          <td>
            <div style="max-width: 220px; font-weight: 500; font-size: 0.88rem; color: var(--text-primary);">
              ${certTitle}
            </div>
          </td>
          <td>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              ${certUrl ? `
                <button class="btn btn-secondary btn-sm btn-view-cert"
                  data-url="${certUrl}"
                  data-title="${certTitle}"
                  data-name="${studentName}"
                  style="padding: 4px 8px; font-size: 0.78rem;">
                  📜 View Cert
                </button>
              ` : '<span style="color: var(--text-muted); font-size: 0.8rem;">No file</span>'}
              ${hasVideo ? `
                <button class="btn btn-secondary btn-sm btn-view-video"
                  data-url="${item.video_url}"
                  data-name="${studentName}"
                  style="padding: 4px 8px; font-size: 0.78rem;">
                  ▶ Video
                </button>
              ` : ''}
            </div>
          </td>
          <td>
            ${statusBadge}
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 6px;">
              ${!isVerified ? `
                <button class="btn btn-success btn-sm btn-approve-cert" data-user-id="${userId}" data-cert-id="${item.id}" style="padding: 4px 10px; font-size: 0.8rem;">
                  ✅ Approve
                </button>
                <button class="btn btn-danger btn-sm btn-reject-cert" data-user-id="${userId}" data-cert-id="${item.id}" style="padding: 4px 10px; font-size: 0.8rem;">
                  ❌ Reject
                </button>
              ` : `
                <button class="btn btn-secondary btn-sm btn-reject-cert" data-user-id="${userId}" data-cert-id="${item.id}" style="padding: 4px 10px; font-size: 0.78rem; color: var(--text-secondary);">
                  Revoke Badge
                </button>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Bind certificate modal
    tbody.querySelectorAll(".btn-view-cert").forEach(b => {
      b.addEventListener("click", () => {
        openCertificateModal(b.dataset.url, b.dataset.title, b.dataset.name);
      });
    });

    // Bind video modal
    tbody.querySelectorAll(".btn-view-video").forEach(b => {
      b.addEventListener("click", () => {
        openVideoPlayerModal(b.dataset.url, b.dataset.name);
      });
    });

    // Bind approve action
    tbody.querySelectorAll(".btn-approve-cert").forEach(b => {
      b.addEventListener("click", async () => {
        const userId = b.dataset.userId;
        const certId = b.dataset.certId;
        setLoading(b, true);
        try {
          if (window.firebaseDb) {
            const adminUid = (getCurrentUser() && getCurrentUser().id) || "admin";
            if (certId && !certId.startsWith("u_cert_")) {
              await window.firebaseDb.reviewCertificate(certId, "verified", adminUid);
            } else {
              await window.firebaseDb.updateUser(userId, {
                is_verified: true,
                verification_status: "verified"
              });
              await window.firebaseDb.createNotification(userId, {
                type: "cert_approved",
                title: "Certificate Approved! 🛡️",
                message: "Congratulations! Your skill certificate has been approved by the administrator. You are now a Verified Mentor!",
                link: "profile.html"
              });
            }
          }
          showToast("Certificate approved! Student granted Verified Mentor badge 🛡️", "success");
          await loadAdminData();
        } catch (err) {
          showToast(err.message, "error");
          setLoading(b, false);
        }
      });
    });

    // Bind reject action
    tbody.querySelectorAll(".btn-reject-cert").forEach(b => {
      b.addEventListener("click", async () => {
        const userId = b.dataset.userId;
        const certId = b.dataset.certId;
        if (!confirm("Are you sure you want to reject or revoke this verification?")) {
          return;
        }
        setLoading(b, true);
        try {
          if (window.firebaseDb) {
            const adminUid = (getCurrentUser() && getCurrentUser().id) || "admin";
            if (certId && !certId.startsWith("u_cert_")) {
              await window.firebaseDb.reviewCertificate(certId, "rejected", adminUid);
            } else {
              await window.firebaseDb.updateUser(userId, {
                is_verified: false,
                verification_status: "rejected"
              });
              await window.firebaseDb.createNotification(userId, {
                type: "cert_rejected",
                title: "Certificate Verification Update",
                message: "Your submitted certificate was not approved by the administrator.",
                link: "profile.html"
              });
            }
          }
          showToast("Certificate verification rejected/revoked.", "info");
          await loadAdminData();
        } catch (err) {
          showToast(err.message, "error");
          setLoading(b, false);
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">Failed to load verifications: ${err.message}</td></tr>`;
  }
}

async function loadUsersList() {
  const tbody = document.getElementById("users-table-body");
  if (!tbody) return;

  try {
    const res = await api.get("/api/users");
    allUsersCache = (res && res.data) ? res.data : [];
    renderUsersTable(allUsersCache);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">Failed to load students: ${err.message}</td></tr>`;
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById("users-table-body");
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 24px; color: var(--text-secondary);">
          No student accounts matching criteria.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const isVerified = Boolean(u.is_verified);
    const userId = u.id || u.uid;

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${u.profile_image || 'assets/avatar-default.svg'}" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover;" onerror="this.src='assets/avatar-default.svg'">
            <div>
              <strong style="color: #fff; display: block;">${u.name}</strong>
              <span style="font-size: 0.78rem; color: var(--text-secondary);">${u.email}</span>
            </div>
          </div>
        </td>
        <td>
          <span style="font-size: 0.88rem;">${u.department || 'N/A'}</span>
          <div style="font-size: 0.76rem; color: var(--text-muted);">${u.semester || ''}</div>
        </td>
        <td>
          <span class="badge ${u.role === 'admin' ? 'badge-amber' : 'badge-purple'}">
            ${u.role || 'student'}
          </span>
        </td>
        <td>
          <span class="badge badge-purple">${u.teach_skill ? '1 Skill' : '0 Skills'}</span>
        </td>
        <td>
          <span style="font-weight: 600; color: #fff;">${u.teach_skill || 'None'}</span>
        </td>
        <td>
          ${isVerified 
            ? '<span class="badge badge-verified">🛡️ Verified</span>' 
            : u.certificate_url 
              ? '<span class="badge badge-pending">⏳ Pending</span>' 
              : '<span class="badge badge-amber">Unverified</span>'}
        </td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-sm btn-toggle-verify-user"
            data-user-id="${userId}"
            data-is-verified="${isVerified}"
            style="padding: 4px 8px; font-size: 0.75rem;">
            ${isVerified ? 'Remove Badge' : 'Grant Badge 🛡️'}
          </button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".btn-toggle-verify-user").forEach(b => {
    b.addEventListener("click", async () => {
      const userId = b.dataset.userId;
      const willVerify = b.dataset.isVerified !== "true";
      setLoading(b, true);
      try {
        if (window.firebaseDb) {
          await window.firebaseDb.updateUser(userId, {
            is_verified: willVerify,
            verification_status: willVerify ? "verified" : "unverified"
          });
        }
        showToast(willVerify ? "Granted Verified Mentor badge 🛡️" : "Removed Verified status.", "info");
        await loadAdminData();
      } catch (err) {
        showToast(err.message, "error");
        setLoading(b, false);
      }
    });
  });
}

function filterUsersTable(query) {
  if (!query) {
    renderUsersTable(allUsersCache);
    return;
  }
  const filtered = allUsersCache.filter(u => 
    (u.name || "").toLowerCase().includes(query) ||
    (u.email || "").toLowerCase().includes(query) ||
    (u.department || "").toLowerCase().includes(query) ||
    (u.teach_skill || "").toLowerCase().includes(query)
  );
  renderUsersTable(filtered);
}
