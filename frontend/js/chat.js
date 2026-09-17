/* ==========================================================================
   TALENT EXCHANGE - REAL-TIME CHAT ENGINE
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth()) return;
  renderNavbar("chat");

  const currentUser = getCurrentUser();
  const urlParams = new URLSearchParams(window.location.search);
  let activePartnerId = urlParams.get("userId");

  const contactsList = document.getElementById("chat-contacts-list");
  const messagesArea = document.getElementById("chat-messages-area");
  const chatHeaderUser = document.getElementById("chat-header-user");
  const messageInput = document.getElementById("chat-message-input");
  const sendForm = document.getElementById("chat-send-form");

  let pollInterval = null;
  let currentPartner = null;
  let knownMessageCount = 0;

  // 1. Fetch Connections
  let connections = [];
  try {
    const res = await api.get(`/api/connections?user_id=${currentUser.id}`);
    connections = (res && res.data) ? res.data : [];
  } catch (err) {
    showToast("Failed to load chat contacts: " + err.message, "error");
  }

  // Render contacts in sidebar
  renderContacts(connections);

  // If no partner selected in URL, default to first connection
  if (!activePartnerId && connections.length > 0) {
    activePartnerId = connections[0].id;
  }

  if (activePartnerId) {
    selectContact(parseInt(activePartnerId, 10));
  } else {
    showNoConnectionSelected();
  }

  // Bind Send Message Form
  if (sendForm) {
    sendForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentPartner || !messageInput) return;

      const messageText = messageInput.value.trim();
      if (!messageText) return;

      const submitBtn = sendForm.querySelector("button[type='submit']");
      messageInput.value = "";
      messageInput.focus();

      // Ensure exact keys required by backend
      const payload = {
        sender_id: parseInt(currentUser.id, 10),
        receiver_id: parseInt(currentPartner.id, 10),
        message: messageText
      };

      try {
        const res = await api.post("/api/messages", payload);
        if (res && res.success && res.data) {
          appendSingleMessage(res.data, true);
          scrollToBottom();
        }
      } catch (err) {
        showToast(err.message || "Could not send message", "error");
      }
    });
  }

  // Bind Top Action Buttons (Video & Audio Calls)
  const videoBtn = document.getElementById("chat-call-video");
  const audioBtn = document.getElementById("chat-call-audio");

  if (videoBtn) {
    videoBtn.addEventListener("click", () => {
      if (!currentPartner) {
        showToast("Please select a conversation first.", "info");
        return;
      }
      if (window.startVideoCall) {
        window.startVideoCall(currentPartner.id, currentPartner.name);
      }
    });
  }

  if (audioBtn) {
    audioBtn.addEventListener("click", () => {
      if (!currentPartner) {
        showToast("Please select a conversation first.", "info");
        return;
      }
      if (window.startAudioCall) {
        window.startAudioCall(currentPartner.id, currentPartner.name);
      }
    });
  }

  function renderContacts(conns) {
    if (!contactsList) return;
    if (conns.length === 0) {
      contactsList.innerHTML = `
        <li style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
          No active connections yet.<br>
          <a href="find-skills.html" style="color:var(--primary); font-weight:600; margin-top:8px; display:inline-block;">Find partners</a>
        </li>
      `;
      return;
    }

    contactsList.innerHTML = conns.map(c => `
      <li class="contact-item ${parseInt(activePartnerId, 10) === c.id ? 'active' : ''}" data-id="${c.id}">
        <img src="${c.profile_image || 'assets/avatar-default.svg'}" class="contact-avatar" alt="${c.name}" onerror="this.src='assets/avatar-default.svg'">
        <div class="contact-info">
          <div class="contact-name">${c.name}</div>
          <div class="contact-sub">${c.teach_skill || 'Skill Partner'}</div>
        </div>
      </li>
    `).join("");

    contactsList.querySelectorAll(".contact-item").forEach(item => {
      item.addEventListener("click", () => {
        const id = parseInt(item.dataset.id, 10);
        selectContact(id);
      });
    });
  }

  async function selectContact(partnerId) {
    activePartnerId = partnerId;

    // Update active contact highlighting
    if (contactsList) {
      contactsList.querySelectorAll(".contact-item").forEach(item => {
        item.classList.toggle("active", parseInt(item.dataset.id, 10) === partnerId);
      });
    }

    // Fetch partner details
    try {
      const res = await api.get(`/api/profile/${partnerId}`);
      currentPartner = res.data;
    } catch (e) {
      currentPartner = connections.find(c => c.id === partnerId) || { id: partnerId, name: "Partner" };
    }

    // Update Chat Header
    if (chatHeaderUser) {
      chatHeaderUser.innerHTML = `
        <img src="${currentPartner.profile_image || 'assets/avatar-default.svg'}" class="chat-header-avatar" alt="${currentPartner.name}" onerror="this.src='assets/avatar-default.svg'">
        <div>
          <div class="chat-header-name">${currentPartner.name}</div>
          <div class="chat-header-meta">
            <span class="badge badge-purple" style="font-size:0.75rem;">Teaches: ${currentPartner.teach_skill || 'General'}</span>
            <span style="color:var(--emerald);">● Online</span>
          </div>
        </div>
      `;
    }

    // Enable input
    if (messageInput) messageInput.disabled = false;

    // Initial message load & start polling
    knownMessageCount = 0;
    await fetchMessages();

    clearInterval(pollInterval);
    // Reliable 3-second live polling
    pollInterval = setInterval(fetchMessages, 3000);
  }

  async function fetchMessages() {
    if (!currentPartner || !messagesArea) return;

    try {
      const res = await api.get(`/api/messages/${currentPartner.id}?current_user_id=${currentUser.id}`);
      const messages = (res && res.data) ? res.data : [];

      // Only re-render if message count changed
      if (messages.length !== knownMessageCount) {
        knownMessageCount = messages.length;
        renderMessageList(messages);
        scrollToBottom();
      }
    } catch (err) {
      console.warn("Polling messages warning:", err.message);
    }
  }

  function renderMessageList(messages) {
    if (!messagesArea) return;

    if (messages.length === 0) {
      messagesArea.innerHTML = `
        <div class="empty-state" style="margin: auto;">
          <div class="empty-icon">💬</div>
          <div class="empty-title">Start your conversation</div>
          <div class="empty-desc">Say hello to ${currentPartner.name} and plan your skill exchange session!</div>
        </div>
      `;
      return;
    }

    messagesArea.innerHTML = messages.map(m => {
      const isOutgoing = m.sender_id === currentUser.id;
      const timeStr = formatMsgTime(m.created_at);
      return `
        <div class="message-row ${isOutgoing ? 'message-outgoing' : 'message-incoming'}">
          <div class="message-bubble">
            ${escapeHtml(m.message)}
            <span class="message-time">${timeStr} ${isOutgoing ? '✓' : ''}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  function appendSingleMessage(m, isOutgoing) {
    if (!messagesArea) return;
    const emptyState = messagesArea.querySelector(".empty-state");
    if (emptyState) emptyState.remove();

    const timeStr = formatMsgTime(m.created_at);
    const div = document.createElement("div");
    div.className = `message-row ${isOutgoing ? 'message-outgoing' : 'message-incoming'}`;
    div.innerHTML = `
      <div class="message-bubble">
        ${escapeHtml(m.message)}
        <span class="message-time">${timeStr} ${isOutgoing ? '✓' : ''}</span>
      </div>
    `;
    messagesArea.appendChild(div);
    knownMessageCount++;
  }

  function showNoConnectionSelected() {
    if (chatHeaderUser) {
      chatHeaderUser.innerHTML = `
        <div style="color:var(--text-secondary);">No connection selected</div>
      `;
    }
    if (messagesArea) {
      messagesArea.innerHTML = `
        <div class="empty-state" style="margin: auto;">
          <div class="empty-icon">🤝</div>
          <div class="empty-title">Welcome to Messages</div>
          <div class="empty-desc">Select an accepted connection on the left or send an exchange request to start chatting.</div>
          <a href="find-skills.html" class="btn btn-primary" style="margin-top:16px;">Find Skill Partners</a>
        </div>
      `;
    }
    if (messageInput) messageInput.disabled = true;
  }

  function scrollToBottom() {
    if (messagesArea) {
      messagesArea.scrollTop = messagesArea.scrollHeight;
    }
  }

  function formatMsgTime(dateVal) {
    if (!dateVal) return "";
    try {
      const d = new Date(dateVal);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return "";
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // Clear polling on page leave
  window.addEventListener("beforeunload", () => {
    clearInterval(pollInterval);
  });
});