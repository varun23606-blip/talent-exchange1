/* ==========================================================================
   TALENT EXCHANGE - ADMINISTRATOR CONSOLE LOGIC
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
    logoutBtn.addEventListener("click", () => {
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
      document.getElementById("stat-total-users").textContent = d.total_users || 0;
      document.getElementById("stat-total-skills").textContent = d.total_skills || 0;
      document.getElementById("stat-verified-mentors").textContent = d.verified_mentors || 0;
      document.getElementById("stat-pending-verifications").textContent = d.pending_verifications || 0;
    }
  } catch (err) {
    console.error("Failed to load admin overview metrics:", err);
  }

  // Update Firebase connection status badge
  try {
    const fbRes = await api.getFirebaseStatus();
    const badge = document.getElementById("firebase-status-badge");
    if (badge && fbRes) {
      const isLive = fbRes.is_live || (fbRes.data && fbRes.data.is_live);
      if (isLive) {
        badge.innerHTML = `🔥 Firebase: Live (Firestore & Storage)`;
        badge.style.color = "#34d399";
        badge.style.borderColor = "rgba(52, 211, 153, 0.4)";
        badge.style.background = "rgba(52, 211, 153, 0.15)";
      } else {
        badge.innerHTML = `🔥 Firebase: Local Fallback Mode`;
        badge.style.color = "#fbbf24";
        badge.style.borderColor = "rgba(251, 191, 36, 0.4)";
        badge.style.background = "rgba(251, 191, 36, 0.12)";
        badge.title = "Ready for serviceAccountKey.json";
      }
    }
  } catch (fbErr) {
    console.warn("Could not check Firebase status:", fbErr);
  }
}

async function loadVerificationsList() {
  const tbody = document.getElementById("verifications-table-body");
  if (!tbody) return;

  try {
    const res = await api.get("/api/admin/verifications");
    const items = (res && res.data) ? res.data : [];

    if (items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 32px; color: var(--text-secondary);">
            ✨ No certificates uploaded for review yet.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = items.map(item => {
      const isVerified = Boolean(item.is_verified);
      const hasVideo = Boolean(item.video_url);
      const hasCert = Boolean(item.cert_url);

      let statusBadge = `<span class="badge badge-pending">⏳ Pending Review</span>`;
      if (isVerified) {
        statusBadge = `<span class="badge badge-verified">🛡️ Verified Mentor</span>`;
      } else if (item.skill_status === "rejected") {
        statusBadge = `<span class="badge badge-danger">❌ Rejected</span>`;
      }

      return `
        <tr data-user-id="${item.user_id}">
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="${item.profile_image || 'assets/avatar-default.svg'}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover;" onerror="this.src='assets/avatar-default.svg'">
              <div>
                <strong style="color: #fff; display: block;">${item.name}</strong>
                <span style="font-size: 0.8rem; color: var(--text-secondary);">${item.email}</span>
              </div>
            </div>
          </td>
          <td>
            <strong style="color: var(--primary);">${item.skill_name || 'General'}</strong>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${item.skill_level || 'Intermediate'}</div>
          </td>
          <td>
            <div style="max-width: 220px; font-weight: 500; font-size: 0.88rem; color: var(--text-primary);">
              ${item.cert_title || 'Certificate of Completion'}
            </div>
          </td>
          <td>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              ${hasCert ? `
                <button class="btn btn-secondary btn-sm btn-view-cert"
                  data-url="${item.cert_url}"
                  data-title="${item.cert_title}"
                  data-name="${item.name}"
                  style="padding: 4px 8px; font-size: 0.78rem;">
                  📜 View Cert
                </button>
              ` : '<span style="color: var(--text-muted); font-size: 0.8rem;">No file</span>'}
              ${hasVideo ? `
                <button class="btn btn-secondary btn-sm btn-view-video"
                  data-url="${item.video_url}"
                  data-name="${item.name}"
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
                <button class="btn btn-success btn-sm btn-approve-cert" data-user-id="${item.user_id}" style="padding: 4px 10px; font-size: 0.8rem;">
                  ✅ Approve
                </button>
                <button class="btn btn-danger btn-sm btn-reject-cert" data-user-id="${item.user_id}" style="padding: 4px 10px; font-size: 0.8rem;">
                  ❌ Reject
                </button>
              ` : `
                <button class="btn btn-secondary btn-sm btn-reject-cert" data-user-id="${item.user_id}" style="padding: 4px 10px; font-size: 0.78rem; color: var(--text-secondary);">
                  Revoke Badge
                </button>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Bind certificate viewer
    tbody.querySelectorAll(".btn-view-cert").forEach(b => {
      b.addEventListener("click", () => {
        openCertificateModal(b.dataset.url, b.dataset.title, b.dataset.name);
      });
    });

    // Bind video viewer
    tbody.querySelectorAll(".btn-view-video").forEach(b => {
      b.addEventListener("click", () => {
        openVideoPlayerModal(b.dataset.url, b.dataset.name);
      });
    });

    // Bind approve action
    tbody.querySelectorAll(".btn-approve-cert").forEach(b => {
      b.addEventListener("click", async () => {
        const userId = b.dataset.userId;
        setLoading(b, true);
        try {
          const res = await api.post("/api/verify-certificate", {
            user_id: parseInt(userId, 10),
            status: "verified"
          });
          if (res.success) {
            showToast("Certificate approved! Student granted Verified Mentor badge 🛡️", "success");
            await loadAdminData();
          } else {
            showToast(res.message || "Failed to approve verification", "error");
            setLoading(b, false);
          }
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
        if (!confirm("Are you sure you want to reject/revoke this student's certificate verification?")) {
          return;
        }
        setLoading(b, true);
        try {
          const res = await api.post("/api/verify-certificate", {
            user_id: parseInt(userId, 10),
            status: "rejected"
          });
          if (res.success) {
            showToast("Certificate rejected/revoked.", "info");
            await loadAdminData();
          } else {
            showToast(res.message || "Failed to update status", "error");
            setLoading(b, false);
          }
        } catch (err) {
          showToast(err.message, "error");
          setLoading(b, false);
        }
      });
    });

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger);">${err.message}</td></tr>`;
  }
}

async function loadUsersList() {
  const tbody = document.getElementById("users-table-body");
  if (!tbody) return;

  try {
    const res = await api.get("/api/admin/users");
    allUsersCache = (res && res.data) ? res.data : [];
    renderUsersTable(allUsersCache);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger);">${err.message}</td></tr>`;
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById("users-table-body");
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-secondary);">No student accounts found matching query.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const isAdmin = u.role === "admin";
    const isVerified = Boolean(u.is_verified);

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${u.profile_image || 'assets/avatar-default.svg'}" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover;" onerror="this.src='assets/avatar-default.svg'">
            <div>
              <strong style="color: #fff;">${u.name}</strong>
              <div style="font-size: 0.78rem; color: var(--text-secondary);">${u.email}</div>
            </div>
          </div>
        </td>
        <td>
          <span style="font-size: 0.85rem;">${u.department || 'General'}</span>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${u.semester || ''}</div>
        </td>
        <td>
          ${isAdmin
            ? '<span class="badge badge-amber" style="font-size: 0.75rem;">🛡️ Admin</span>'
            : '<span class="badge" style="background: rgba(255,255,255,0.06); font-size: 0.75rem;">Student</span>'}
        </td>
        <td>${u.skills_count || 0}</td>
        <td>${u.connections_count || 0}</td>
        <td>
          ${isVerified
            ? '<span class="badge badge-verified" style="font-size: 0.75rem;">🛡️ Verified</span>'
            : '<span class="badge" style="background: rgba(255,255,255,0.04); color: var(--text-muted); font-size: 0.75rem;">Standard</span>'}
        </td>
        <td style="text-align: right;">
          ${!isAdmin ? `
            <button class="btn btn-danger btn-sm btn-delete-user" data-user-id="${u.id}" data-name="${u.name}" style="padding: 4px 8px; font-size: 0.76rem;">
              🗑️ Delete
            </button>
          ` : '<span style="color: var(--text-muted); font-size: 0.78rem;">Protected</span>'}
        </td>
      </tr>
    `;
  }).join("");

  // Bind delete buttons
  tbody.querySelectorAll(".btn-delete-user").forEach(b => {
    b.addEventListener("click", async () => {
      const userId = b.dataset.userId;
      const userName = b.dataset.name;
      if (!confirm(`Are you sure you want to permanently delete the account for "${userName}"? This cannot be undone.`)) {
        return;
      }
      setLoading(b, true);
      try {
        const res = await api.delete(`/api/admin/users/${userId}`);
        if (res.success) {
          showToast(`Account for ${userName} deleted.`, "info");
          await loadAdminData();
        } else {
          showToast(res.message || "Failed to delete user", "error");
          setLoading(b, false);
        }
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
  const filtered = allUsersCache.filter(u => {
    return (u.name && u.name.toLowerCase().includes(query)) ||
           (u.email && u.email.toLowerCase().includes(query)) ||
           (u.department && u.department.toLowerCase().includes(query));
  });
  renderUsersTable(filtered);
}
