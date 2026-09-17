/* ==========================================================================
   TALENT EXCHANGE - DASHBOARD LOGIC
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth()) return;
  renderNavbar("dashboard");

  const user = getCurrentUser();

  // Set personalized welcome
  const welcomeName = document.getElementById("welcome-user-name");
  if (welcomeName) welcomeName.textContent = user.name;

  const welcomeBadge = document.getElementById("welcome-verified-badge");
  if (welcomeBadge) {
    if (user.is_verified) {
      welcomeBadge.innerHTML = `<span class="badge badge-verified" title="Verified Skill Mentor">🛡️ Verified Mentor</span>`;
    } else if (user.verification_status === "pending" || user.certificate_url) {
      welcomeBadge.innerHTML = `<span class="badge badge-pending">⏳ Verification Pending</span>`;
    } else {
      welcomeBadge.innerHTML = `<a href="profile.html" class="badge badge-amber" style="text-decoration:none;">⚡ Get Verified</a>`;
    }
  }

  // Metric fields
  const mySkillEl = document.getElementById("metric-my-skill");
  const learningSkillEl = document.getElementById("metric-learning-skill");
  const connCountEl = document.getElementById("metric-connections-count");
  const reqCountEl = document.getElementById("metric-requests-count");

  if (mySkillEl) mySkillEl.textContent = user.teach_skill || "Not configured";
  if (learningSkillEl) learningSkillEl.textContent = user.learn_skill || "Not configured";

  // Load backend dashboard data
  await loadDashboardMetrics(user);
  await loadRecommendedPartners(user);
  await loadPendingRequests(user);
  await loadRecentConnections(user);

  // Bind modal exchange request form
  setupExchangeModal(user);
});

async function loadDashboardMetrics(user) {
  try {
    const [connsRes, reqsRes] = await Promise.all([
      api.get(`/api/connections?user_id=${user.id}`),
      api.get(`/api/requests?user_id=${user.id}&type=incoming`)
    ]);

    const connCountEl = document.getElementById("metric-connections-count");
    const reqCountEl = document.getElementById("metric-requests-count");

    const conns = (connsRes && connsRes.data) ? connsRes.data : [];
    const pendingIncoming = (reqsRes && reqsRes.data && reqsRes.data.incoming)
      ? reqsRes.data.incoming.filter(r => r.status === "Pending")
      : [];

    if (connCountEl) connCountEl.textContent = conns.length;
    if (reqCountEl) reqCountEl.textContent = pendingIncoming.length;
  } catch (err) {
    console.error("Failed to load metrics:", err);
  }
}

async function loadRecommendedPartners(user) {
  const container = document.getElementById("recommended-partners-list");
  if (!container) return;

  try {
    const res = await api.get(`/api/users?exclude_user_id=${user.id}`);
    const users = (res && res.data) ? res.data : [];

    if (users.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">👥</div>
          <div class="empty-title">No other students found yet</div>
          <div class="empty-desc">Share Talent Exchange with your classmates to build the network!</div>
        </div>
      `;
      return;
    }

    // Sort by recommendation match (matching skills they offer with what current user wants to learn)
    const myWanted = (user.learn_skill || "").toLowerCase();
    const sorted = [...users].sort((a, b) => {
      const aMatch = myWanted && (a.teach_skill || "").toLowerCase().includes(myWanted) ? 1 : 0;
      const bMatch = myWanted && (b.teach_skill || "").toLowerCase().includes(myWanted) ? 1 : 0;
      return bMatch - aMatch;
    });

    container.innerHTML = sorted.slice(0, 4).map(u => createUserCard(u, user)).join("");
    bindExchangeButtons(user);

    // Bind video and certificate modal openers
    container.querySelectorAll(".btn-open-video").forEach(b => {
      b.addEventListener("click", () => openVideoPlayerModal(b.dataset.videoUrl, b.dataset.name));
    });
    container.querySelectorAll(".btn-open-cert").forEach(b => {
      b.addEventListener("click", () => openCertificateModal(b.dataset.certUrl, b.dataset.certTitle, b.dataset.name));
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><div class="empty-desc">Error loading recommendations: ${err.message}</div></div>`;
  }
}

function createUserCard(u, currentUser) {
  const isVerified = Boolean(u.is_verified);
  const hasVideo = Boolean(u.video_url);
  const hasCert = Boolean(u.certificate_url);

  return `
    <div class="user-card">
      <div class="user-card-header">
        <img src="${u.profile_image || 'assets/avatar-default.svg'}" class="user-card-avatar" alt="${u.name}" onerror="this.src='assets/avatar-default.svg'">
        <div class="user-card-meta">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <h3 style="margin-bottom:0;">${u.name}</h3>
            ${isVerified ? '<span class="badge badge-verified" title="Certified & Verified Mentor">🛡️ Verified</span>' : ''}
          </div>
          <div class="user-card-dept">${u.department || 'Department not set'}</div>
          <div class="user-card-sem">${u.semester || ''}</div>
        </div>
      </div>
      <div class="user-card-skills">
        <div class="skill-row">
          <span class="skill-label">Teaches:</span>
          <span class="badge badge-purple">${u.teach_skill || 'General'}</span>
        </div>
        <div class="skill-row">
          <span class="skill-label">Wants:</span>
          <span class="badge badge-emerald">${u.learn_skill || 'Any skill'}</span>
        </div>
      </div>

      ${(hasVideo || hasCert) ? `
        <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
          ${hasVideo ? `
            <button class="btn btn-secondary btn-sm btn-open-video" data-video-url="${u.video_url}" data-name="${u.name}" style="padding: 4px 10px; font-size: 0.78rem;">
              ▶ Teaching Video
            </button>
          ` : ''}
          ${hasCert ? `
            <button class="btn btn-secondary btn-sm btn-open-cert" data-cert-url="${u.certificate_url}" data-cert-title="${u.certificate_title || 'Certificate'}" data-name="${u.name}" style="padding: 4px 10px; font-size: 0.78rem;">
              📜 Certificate
            </button>
          ` : ''}
        </div>
      ` : ''}

      <p class="user-card-bio">${u.bio || 'Ready to exchange skills and collaborate with fellow students.'}</p>
      <div class="user-card-actions">
        <button class="btn btn-primary btn-sm btn-request-exchange" 
          data-user-id="${u.id}" 
          data-user-name="${u.name}" 
          data-teach-skill="${u.teach_skill || ''}" 
          data-learn-skill="${u.learn_skill || ''}">
          🤝 Request Exchange
        </button>
      </div>
    </div>
  `;
}

async function loadPendingRequests(user) {
  const container = document.getElementById("dashboard-pending-requests");
  if (!container) return;

  try {
    const res = await api.get(`/api/requests?user_id=${user.id}&type=incoming`);
    const requests = (res && res.data && res.data.incoming) ? res.data.incoming : [];
    const pending = requests.filter(r => r.status === "Pending");

    if (pending.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✨</div>
          <div class="empty-title">You're all caught up!</div>
          <div class="empty-desc">No incoming exchange requests waiting for your review.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = pending.slice(0, 3).map(r => `
      <div class="request-card">
        <div class="request-user-info">
          <img src="${r.sender_image || 'assets/avatar-default.svg'}" style="width:46px;height:46px;border-radius:50%;object-fit:cover;" onerror="this.src='assets/avatar-default.svg'">
          <div class="request-details">
            <strong style="font-size:1rem;">${r.sender_name}</strong>
            <div class="request-skills-badge">
              Offers: <span class="badge badge-purple">${r.offered_skill}</span>
              → Wants: <span class="badge badge-emerald">${r.requested_skill}</span>
            </div>
          </div>
        </div>
        <div class="request-actions">
          <button class="btn btn-success btn-sm btn-accept-req" data-req-id="${r.id}">Accept</button>
          <button class="btn btn-danger btn-sm btn-reject-req" data-req-id="${r.id}">Reject</button>
        </div>
      </div>
    `).join("");

    // Bind accept/reject
    container.querySelectorAll(".btn-accept-req").forEach(b => {
      b.addEventListener("click", async () => {
        setLoading(b, true);
        try {
          await api.put(`/api/requests/${b.dataset.reqId}`, { status: "Accepted" });
          showToast("Exchange accepted! Connection created.", "success");
          setTimeout(() => window.location.reload(), 600);
        } catch (e) {
          showToast(e.message, "error");
          setLoading(b, false);
        }
      });
    });

    container.querySelectorAll(".btn-reject-req").forEach(b => {
      b.addEventListener("click", async () => {
        setLoading(b, true);
        try {
          await api.put(`/api/requests/${b.dataset.reqId}`, { status: "Rejected" });
          showToast("Request rejected.", "info");
          setTimeout(() => window.location.reload(), 600);
        } catch (e) {
          showToast(e.message, "error");
          setLoading(b, false);
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-desc">Error loading requests: ${err.message}</div></div>`;
  }
}

async function loadRecentConnections(user) {
  const container = document.getElementById("dashboard-connections");
  if (!container) return;

  try {
    const res = await api.get(`/api/connections?user_id=${user.id}`);
    const conns = (res && res.data) ? res.data : [];

    if (conns.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🤝</div>
          <div class="empty-title">No connections yet</div>
          <div class="empty-desc">Send exchange requests to start learning with other students!</div>
        </div>
      `;
      return;
    }

    container.innerHTML = conns.slice(0, 3).map(c => `
      <div class="request-card">
        <div class="request-user-info">
          <img src="${c.profile_image || 'assets/avatar-default.svg'}" style="width:46px;height:46px;border-radius:50%;object-fit:cover;" onerror="this.src='assets/avatar-default.svg'">
          <div class="request-details">
            <strong style="font-size:1rem;">${c.name}</strong>
            <div style="font-size:0.85rem;color:var(--text-secondary);">${c.department || 'Student'} • ${c.teach_skill || 'Skill Partner'}</div>
          </div>
        </div>
        <div class="request-actions">
          <a href="chat.html?userId=${c.id}" class="btn btn-primary btn-sm">💬 Chat</a>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-desc">Error loading connections: ${err.message}</div></div>`;
  }
}

function bindExchangeButtons(currentUser) {
  document.querySelectorAll(".btn-request-exchange").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetUserId = btn.dataset.userId;
      const targetUserName = btn.dataset.userName;
      const targetTeachSkill = btn.dataset.teachSkill;

      const modal = document.getElementById("exchange-modal");
      if (!modal) return;

      document.getElementById("modal-receiver-id").value = targetUserId;
      document.getElementById("modal-receiver-name").textContent = targetUserName;
      
      // Default offered skill is my current teach skill
      const offerInput = document.getElementById("modal-offered-skill");
      const requestInput = document.getElementById("modal-requested-skill");

      if (offerInput) offerInput.value = currentUser.teach_skill || "";
      if (requestInput) requestInput.value = targetTeachSkill || "";

      openModal("exchange-modal");
    });
  });
}

function setupExchangeModal(currentUser) {
  const form = document.getElementById("exchange-form");
  const modal = document.getElementById("exchange-modal");
  if (!form || !modal) return;

  // Close triggers
  modal.querySelectorAll(".modal-close, .modal-cancel").forEach(b => {
    b.addEventListener("click", () => closeModal("exchange-modal"));
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const receiverId = document.getElementById("modal-receiver-id").value;
    const offeredSkill = document.getElementById("modal-offered-skill").value.trim();
    const requestedSkill = document.getElementById("modal-requested-skill").value.trim();
    const submitBtn = form.querySelector("button[type='submit']");

    if (!offeredSkill || !requestedSkill) {
      showToast("Please specify both offered and requested skills", "error");
      return;
    }

    setLoading(submitBtn, true);

    try {
      const payload = {
        sender_id: currentUser.id,
        receiver_id: parseInt(receiverId, 10),
        offered_skill: offeredSkill,
        requested_skill: requestedSkill
      };

      const res = await api.post("/api/requests", payload);
      if (res.success) {
        showToast("Exchange request sent successfully!", "success");
        closeModal("exchange-modal");
        setTimeout(() => window.location.reload(), 600);
      } else {
        showToast(res.message || "Failed to send request", "error");
        setLoading(submitBtn, false);
      }
    } catch (err) {
      showToast(err.message, "error");
      setLoading(submitBtn, false);
    }
  });
}