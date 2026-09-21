/* ==========================================================================
   TALENT EXCHANGE - REAL-TIME FIRESTORE CHAT ENGINE
   Architecture: Cloud Firestore onSnapshot Realtime Listeners
   Eliminates: Integer ID parsing errors and Flask polling
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth()) return;
  renderNavbar("chat");

  const currentUser = getCurrentUser();
  const currentUid = (window.firebaseAuth && window.firebaseAuth.getCurrentUserUid()) || currentUser.id || currentUser.uid;

  const urlParams = new URLSearchParams(window.location.search);
  let activePartnerId = urlParams.get("userId");

  const contactsList = document.getElementById("chat-contacts-list");
  const messagesArea = document.getElementById("chat-messages-area");
  const chatHeaderUser = document.getElementById("chat-header-user");
  const messageInput = document.getElementById("chat-message-input");
  const sendForm = document.getElementById("chat-send-form");

  let unsubscribeMessages = null;
  let currentPartner = null;

  // 1. Fetch Connections from Firestore
  let connections = [];
  try {
    const res = await api.get(`/api/connections?user_id=${currentUid}`);
    connections = (res && res.data) ? res.data : [];
  } catch (err) {
    showToast("Failed to load chat contacts: " + err.message, "error");
  }

  // Render contacts in sidebar
  renderContacts(connections);

  // If no partner selected in URL, default to first connection
  if (!activePartnerId && connections.length > 0) {
    activePartnerId = connections[0].id || connections[0].uid;
  }

  if (activePartnerId) {
    selectContact(String(activePartnerId));
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

      const targetPartnerId = currentPartner.id || currentPartner.uid;
      messageInput.value = "";
      messageInput.focus();

      try {
        if (window.firebaseDb) {
          await window.firebaseDb.sendMessage(currentUid, targetPartnerId, messageText);
        } else {
          await api.post("/api/messages", {
            sender_id: currentUid,
            receiver_id: targetPartnerId,
            message: messageText
          });
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
        window.startVideoCall(currentPartner.id || currentPartner.uid, currentPartner.name);
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
        window.startAudioCall(currentPartner.id || currentPartner.uid, currentPartner.name);
      }
    });
  }

  function renderContacts(conns) {
    if (!contactsList) return;
    if (conns.length === 0) {
      contactsList.innerHTML = `
        <li style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
          No active connections yet.<br>
          <a href="find-skills.html" style="color:var(--primary); font-weight:600; margin-top:8px; display:inline-block;">Find skill partners</a>
        </li>
      `;
      return;
    }

    contactsList.innerHTML = conns.map(c => {
      const cId = String(c.id || c.uid);
      const isActive = String(activePartnerId) === cId;
      return `
        <li class="contact-item ${isActive ? 'active' : ''}" data-id="${cId}">
          <img src="${c.profile_image || 'assets/avatar-default.svg'}" class="contact-avatar" alt="${c.name}" onerror="this.src='assets/avatar-default.svg'">
          <div class="contact-meta">
            <div class="contact-name">${c.name}</div>
            <div class="contact-skill">${c.teach_skill || 'Partner'} • ${c.department || 'Student'}</div>
          </div>
        </li>
      `;
    }).join("");

    contactsList.querySelectorAll(".contact-item").forEach(item => {
      item.addEventListener("click", () => {
        selectContact(item.dataset.id);
      });
    });
  }

  function selectContact(partnerId) {
    activePartnerId = String(partnerId);
    currentPartner = connections.find(c => String(c.id || c.uid) === activePartnerId);

    // Update active highlight in contacts list
    if (contactsList) {
      contactsList.querySelectorAll(".contact-item").forEach(item => {
        item.classList.toggle("active", item.dataset.id === activePartnerId);
      });
    }

    if (!currentPartner) {
      showNoConnectionSelected();
      return;
    }

    // Update Header
    if (chatHeaderUser) {
      chatHeaderUser.innerHTML = `
        <img src="${currentPartner.profile_image || 'assets/avatar-default.svg'}" class="chat-header-avatar" alt="${currentPartner.name}" onerror="this.src='assets/avatar-default.svg'">
        <div class="chat-header-meta">
          <div class="chat-header-name">${currentPartner.name}</div>
          <div class="chat-header-status">Teaches: ${currentPartner.teach_skill || 'General'} • Wants: ${currentPartner.learn_skill || 'General'}</div>
        </div>
      `;
    }

    // Enable message input and buttons
    if (messageInput) messageInput.disabled = false;
    const sendBtn = sendForm ? sendForm.querySelector("button[type='submit']") : null;
    if (sendBtn) sendBtn.disabled = false;
    if (videoBtn) videoBtn.disabled = false;
    if (audioBtn) audioBtn.disabled = false;

    // Attach Firestore Realtime Listener
    attachFirestoreChatListener(currentUid, activePartnerId);
  }

  function attachFirestoreChatListener(uid1, uid2) {
    if (unsubscribeMessages) {
      unsubscribeMessages();
      unsubscribeMessages = null;
    }

    if (!messagesArea) return;
    messagesArea.innerHTML = `
      <div style="display:flex; justify-content:center; align-items:center; height:100%; color:var(--text-muted);">
        <span class="spinner"></span> &nbsp; Connecting realtime messages...
      </div>
    `;

    const conversationId = window.firebaseDb 
      ? window.firebaseDb.getConversationId(uid1, uid2)
      : [String(uid1), String(uid2)].sort().join("_");

    if (window.firebaseDb && typeof window.firebaseDb.listenMessages === "function") {
      unsubscribeMessages = window.firebaseDb.listenMessages(conversationId, (messages) => {
        renderMessageList(messages, uid1);
      });
    }
  }

  function renderMessageList(messages, currentUserId) {
    if (!messagesArea) return;

    if (!messages || messages.length === 0) {
      messagesArea.innerHTML = `
        <div class="empty-state" style="margin: auto;">
          <div class="empty-icon">💬</div>
          <div class="empty-title">Start the conversation!</div>
          <div class="empty-desc">Say hello and arrange your skill exchange schedule.</div>
        </div>
      `;
      return;
    }

    messagesArea.innerHTML = messages.map(m => {
      const isMine = String(m.sender_id) === String(currentUserId);
      const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

      return `
        <div class="message-row ${isMine ? 'mine' : 'theirs'}">
          <div class="message-bubble ${isMine ? 'bubble-mine' : 'bubble-theirs'}">
            <div class="message-text">${escapeHtml(m.message)}</div>
            <div class="message-time">${timeStr}</div>
          </div>
        </div>
      `;
    }).join("");

    scrollToBottom();
  }

  function showNoConnectionSelected() {
    if (chatHeaderUser) {
      chatHeaderUser.innerHTML = `
        <div class="chat-header-meta">
          <div class="chat-header-name">No Conversation Selected</div>
          <div class="chat-header-status">Choose a connection from the left to start messaging</div>
        </div>
      `;
    }
    if (messagesArea) {
      messagesArea.innerHTML = `
        <div class="empty-state" style="margin: auto;">
          <div class="empty-icon">👥</div>
          <div class="empty-title">Select a Skill Partner</div>
          <div class="empty-desc">Click any student from your connections list on the left to start trading skills.</div>
        </div>
      `;
    }
    if (messageInput) messageInput.disabled = true;
    const sendBtn = sendForm ? sendForm.querySelector("button[type='submit']") : null;
    if (sendBtn) sendBtn.disabled = true;
    if (videoBtn) videoBtn.disabled = true;
    if (audioBtn) audioBtn.disabled = true;
  }

  function scrollToBottom() {
    if (messagesArea) {
      messagesArea.scrollTop = messagesArea.scrollHeight;
    }
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
  }
});