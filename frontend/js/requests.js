/* ==========================================================================
   TALENT EXCHANGE - REQUESTS MANAGEMENT CONTROLLER
   Powered by Cloud Firestore Realtime Exchange Proposals
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth()) return;
  renderNavbar("requests");

  const user = getCurrentUser();
  const incomingContainer = document.getElementById("incoming-requests-list");
  const outgoingContainer = document.getElementById("outgoing-requests-list");

  // Tab switching
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const target = btn.dataset.tab;
      if (target === "incoming") {
        document.getElementById("tab-incoming").style.display = "block";
        document.getElementById("tab-outgoing").style.display = "none";
      } else {
        document.getElementById("tab-incoming").style.display = "none";
        document.getElementById("tab-outgoing").style.display = "block";
      }
    });
  });

  await loadRequests();

  async function loadRequests() {
    try {
      const uid = user.id || user.uid;
      const res = await api.get(`/api/requests?user_id=${uid}`);
      const data = (res && res.data) ? res.data : { incoming: [], outgoing: [] };

      renderIncoming(data.incoming || []);
      renderOutgoing(data.outgoing || []);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function renderIncoming(incoming) {
    if (!incomingContainer) return;
    if (incoming.length === 0) {
      incomingContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📬</div>
          <div class="empty-title">No incoming requests</div>
          <div class="empty-desc">When other students find your skills and request an exchange, you will see them here.</div>
        </div>
      `;
      return;
    }

    incomingContainer.innerHTML = incoming.map(r => `
      <div class="request-card">
        <div class="request-user-info">
          <img src="${r.sender_image || 'assets/avatar-default.svg'}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;" alt="${r.sender_name}" onerror="this.src='assets/avatar-default.svg'">
          <div class="request-details">
            <h3 style="font-size:1.1rem;font-weight:700;">${r.sender_name}</h3>
            <div style="font-size:0.85rem;color:var(--text-secondary);">${r.sender_dept || 'Student'} • ${r.sender_semester || ''}</div>
            <div class="request-skills-badge" style="margin-top:6px;">
              Offers: <span class="badge badge-purple">${r.offered_skill}</span>
              → Wants: <span class="badge badge-emerald">${r.requested_skill}</span>
            </div>
          </div>
        </div>
        <div class="request-actions">
          ${r.status === 'Pending' ? `
            <button class="btn btn-success btn-sm btn-accept" data-id="${r.id}">Accept Exchange</button>
            <button class="btn btn-danger btn-sm btn-reject" data-id="${r.id}">Reject</button>
          ` : `
            <span class="badge ${r.status === 'Accepted' ? 'badge-emerald' : 'badge-amber'}">${r.status}</span>
          `}
        </div>
      </div>
    `).join("");

    incomingContainer.querySelectorAll(".btn-accept").forEach(b => {
      b.addEventListener("click", async () => {
        setLoading(b, true);
        try {
          await api.put(`/api/requests/${b.dataset.id}`, { status: "Accepted" });
          showToast("Exchange accepted! Connection created. You can now chat! 🎉", "success");
          await loadRequests();
        } catch (e) {
          showToast(e.message, "error");
          setLoading(b, false);
        }
      });
    });

    incomingContainer.querySelectorAll(".btn-reject").forEach(b => {
      b.addEventListener("click", async () => {
        setLoading(b, true);
        try {
          await api.put(`/api/requests/${b.dataset.id}`, { status: "Rejected" });
          showToast("Exchange request rejected.", "info");
          await loadRequests();
        } catch (e) {
          showToast(e.message, "error");
          setLoading(b, false);
        }
      });
    });
  }

  function renderOutgoing(outgoing) {
    if (!outgoingContainer) return;
    if (outgoing.length === 0) {
      outgoingContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📤</div>
          <div class="empty-title">No outgoing proposals</div>
          <div class="empty-desc">Propose an exchange with students who offer skills you want to learn!</div>
          <a href="find-skills.html" class="btn btn-primary" style="margin-top:16px;">Browse Skills</a>
        </div>
      `;
      return;
    }

    outgoingContainer.innerHTML = outgoing.map(r => `
      <div class="request-card">
        <div class="request-user-info">
          <img src="${r.receiver_image || 'assets/avatar-default.svg'}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;" alt="${r.receiver_name}" onerror="this.src='assets/avatar-default.svg'">
          <div class="request-details">
            <h3 style="font-size:1.1rem;font-weight:700;">Sent to ${r.receiver_name}</h3>
            <div class="request-skills-badge" style="margin-top:6px;">
              You Offered: <span class="badge badge-purple">${r.offered_skill}</span>
              → You Wanted: <span class="badge badge-emerald">${r.requested_skill}</span>
            </div>
          </div>
        </div>
        <div class="request-actions">
          <span class="badge ${r.status === 'Accepted' ? 'badge-emerald' : r.status === 'Rejected' ? 'badge-amber' : 'badge-purple'}">
            ${r.status}
          </span>
        </div>
      </div>
    `).join("");
  }
});