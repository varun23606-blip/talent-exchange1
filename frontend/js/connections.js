/* ==========================================================================
   TALENT EXCHANGE - CONNECTIONS LOGIC
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth()) return;
  renderNavbar("connections");

  const user = getCurrentUser();
  const container = document.getElementById("connections-grid");
  const searchInput = document.getElementById("search-connections");

  let allConnections = [];

  await loadConnections();

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.toLowerCase().trim();
      const filtered = allConnections.filter(c => 
        (c.name || "").toLowerCase().includes(q) ||
        (c.teach_skill || "").toLowerCase().includes(q) ||
        (c.department || "").toLowerCase().includes(q)
      );
      renderConnections(filtered);
    });
  }

  async function loadConnections() {
    if (!container) return;
    try {
      const res = await api.get(`/api/connections?user_id=${user.id}`);
      allConnections = (res && res.data) ? res.data : [];
      renderConnections(allConnections);
    } catch (err) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-desc">${err.message}</div></div>`;
    }
  }

  function renderConnections(connections) {
    if (!container) return;
    if (connections.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">🤝</div>
          <div class="empty-title">No connections found</div>
          <div class="empty-desc">You have not established any skill exchanges yet. Search for students to connect with!</div>
          <a href="find-skills.html" class="btn btn-primary" style="margin-top:16px;">Find Skills</a>
        </div>
      `;
      return;
    }

    container.innerHTML = connections.map(c => `
      <div class="user-card">
        <div class="user-card-header">
          <img src="${c.profile_image || 'assets/avatar-default.svg'}" class="user-card-avatar" alt="${c.name}" onerror="this.src='assets/avatar-default.svg'">
          <div class="user-card-meta">
            <h3>${c.name}</h3>
            <div class="user-card-dept">${c.department || 'Student'}</div>
            <div class="user-card-sem">${c.semester || ''}</div>
          </div>
        </div>
        <div class="user-card-skills">
          <div class="skill-row">
            <span class="skill-label">Teaches:</span>
            <span class="badge badge-purple">${c.teach_skill || 'General'}</span>
          </div>
          <div class="skill-row">
            <span class="skill-label">Wants:</span>
            <span class="badge badge-emerald">${c.learn_skill || 'Any skill'}</span>
          </div>
        </div>
        <p class="user-card-bio">${c.bio || 'Connected skill exchange partner.'}</p>
        <div class="user-card-actions" style="flex-wrap: wrap;">
          <a href="chat.html?userId=${c.id}" class="btn btn-primary btn-sm" style="flex: 1 1 45%;">
            💬 Open Chat
          </a>
          <button class="btn btn-secondary btn-sm btn-start-video" data-user-id="${c.id}" data-user-name="${c.name}" style="flex: 1 1 20%;">
            📹 Video
          </button>
          <button class="btn btn-secondary btn-sm btn-start-audio" data-user-id="${c.id}" data-user-name="${c.name}" style="flex: 1 1 20%;">
            📞 Audio
          </button>
        </div>
      </div>
    `).join("");

    // Bind WebRTC Call Launchers
    container.querySelectorAll(".btn-start-video").forEach(b => {
      b.addEventListener("click", () => {
        if (window.startVideoCall) {
          window.startVideoCall(b.dataset.userId, b.dataset.userName);
        }
      });
    });

    container.querySelectorAll(".btn-start-audio").forEach(b => {
      b.addEventListener("click", () => {
        if (window.startAudioCall) {
          window.startAudioCall(b.dataset.userId, b.dataset.userName);
        }
      });
    });
  }
});