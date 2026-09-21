/* ==========================================================================
   TALENT EXCHANGE - SKILLS CONTROLLER (FIND SKILLS & OFFER SKILL)
   Powered by Cloud Firestore & Firebase Storage
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth()) return;
  const user = getCurrentUser();

  if (window.location.pathname.endsWith("find-skills.html")) {
    renderNavbar("find-skills");
    initFindSkills(user);
  } else if (window.location.pathname.endsWith("offer-skill.html")) {
    renderNavbar("offer-skill");
    initOfferSkill(user);
  }
});

// ==========================================================================
// 1. FIND SKILLS
// ==========================================================================
function initFindSkills(currentUser) {
  const searchInput = document.getElementById("search-input");
  const skillInput = document.getElementById("skill-filter");
  const deptSelect = document.getElementById("dept-filter");
  const semSelect = document.getElementById("sem-filter");
  const verifiedCheckbox = document.getElementById("filter-verified");
  const filterForm = document.getElementById("filter-form");
  const resultsContainer = document.getElementById("skills-results-grid");

  loadUsers();

  if (filterForm) {
    filterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      loadUsers();
    });
  }

  // Live filter handlers
  let debounceTimeout;
  [searchInput, skillInput, deptSelect, semSelect, verifiedCheckbox].forEach(input => {
    if (input) {
      input.addEventListener("input", () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(loadUsers, 250);
      });
      input.addEventListener("change", () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(loadUsers, 100);
      });
    }
  });

  async function loadUsers() {
    if (!resultsContainer) return;
    resultsContainer.innerHTML = `
      <div class="skeleton" style="height: 260px; border-radius: 18px;"></div>
      <div class="skeleton" style="height: 260px; border-radius: 18px;"></div>
      <div class="skeleton" style="height: 260px; border-radius: 18px;"></div>
    `;

    const q = searchInput ? searchInput.value.trim() : "";
    const skill = skillInput ? skillInput.value.trim() : "";
    const dept = deptSelect ? deptSelect.value.trim() : "";
    const sem = semSelect ? semSelect.value.trim() : "";
    const onlyVerified = verifiedCheckbox ? verifiedCheckbox.checked : false;

    const currentUid = currentUser.id || currentUser.uid;
    const params = new URLSearchParams();
    params.append("exclude_user_id", currentUid);
    if (q) params.append("q", q);
    if (skill) params.append("skill", skill);
    if (dept) params.append("department", dept);
    if (sem) params.append("semester", sem);
    if (onlyVerified) params.append("only_verified", "true");

    try {
      const res = await api.get(`/api/users?${params.toString()}`);
      const users = (res && res.data) ? res.data : [];

      if (users.length === 0) {
        resultsContainer.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-icon">🔍</div>
            <div class="empty-title">No matching skill partners found</div>
            <div class="empty-desc">Try loosening your search filters or searching for different keywords.</div>
          </div>
        `;
        return;
      }

      resultsContainer.innerHTML = users.map(u => {
        const isVerified = Boolean(u.is_verified);
        const hasVideo = Boolean(u.video_url);
        const hasCert = Boolean(u.certificate_url);
        const uId = u.id || u.uid;

        return `
          <div class="user-card">
            <div class="user-card-header">
              <img src="${u.profile_image || 'assets/avatar-default.svg'}" class="user-card-avatar" alt="${u.name}" onerror="this.src='assets/avatar-default.svg'">
              <div class="user-card-meta">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  <h3 style="margin-bottom:0;">${u.name}</h3>
                  ${isVerified ? '<span class="badge badge-verified" title="Certified & Verified Mentor">🛡️ Verified Mentor</span>' : ''}
                </div>
                <div class="user-card-dept">${u.department || 'Student'}</div>
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
                    ▶ Watch Teaching Video
                  </button>
                ` : ''}
                ${hasCert ? `
                  <button class="btn btn-secondary btn-sm btn-open-cert" data-cert-url="${u.certificate_url}" data-cert-title="${u.certificate_title || 'Certificate'}" data-name="${u.name}" style="padding: 4px 10px; font-size: 0.78rem;">
                    📜 View Certificate
                  </button>
                ` : ''}
              </div>
            ` : ''}

            <p class="user-card-bio">${u.bio || 'Available for skill exchange.'}</p>
            <div class="user-card-actions">
              <button class="btn btn-primary btn-sm btn-request-exchange" 
                data-user-id="${uId}" 
                data-user-name="${u.name}" 
                data-teach-skill="${u.teach_skill || ''}" 
                data-learn-skill="${u.learn_skill || ''}">
                🤝 Request Exchange
              </button>
            </div>
          </div>
        `;
      }).join("");

      // Bind Modal Launchers
      resultsContainer.querySelectorAll(".btn-open-video").forEach(b => {
        b.addEventListener("click", () => openVideoPlayerModal(b.dataset.videoUrl, b.dataset.name));
      });
      resultsContainer.querySelectorAll(".btn-open-cert").forEach(b => {
        b.addEventListener("click", () => openCertificateModal(b.dataset.certUrl, b.dataset.certTitle, b.dataset.name));
      });

      // Bind Request Exchange Buttons
      bindExchangeButtons(currentUser);
    } catch (err) {
      resultsContainer.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><div class="empty-desc">Error loading skills: ${err.message}</div></div>`;
    }
  }

  // Setup Exchange Modal
  setupExchangeModal(currentUser);
}

// ==========================================================================
// 2. OFFER SKILL
// ==========================================================================
function initOfferSkill(currentUser) {
  const form = document.getElementById("offer-skill-form");
  if (!form) return;

  // Pre-fill existing data if available
  const skillNameInput = document.getElementById("skill-name");
  const learnSkillInput = document.getElementById("learning-skill");
  const skillDescInput = document.getElementById("skill-desc");
  const videoUrlInput = document.getElementById("video-url");
  const certUrlInput = document.getElementById("cert-url");
  const certTitleInput = document.getElementById("cert-title");

  if (skillNameInput && currentUser.teach_skill) skillNameInput.value = currentUser.teach_skill;
  if (learnSkillInput && currentUser.learn_skill) learnSkillInput.value = currentUser.learn_skill;
  if (skillDescInput && currentUser.bio) skillDescInput.value = currentUser.bio;
  if (videoUrlInput && currentUser.video_url) videoUrlInput.value = currentUser.video_url;
  if (certUrlInput && currentUser.certificate_url) certUrlInput.value = currentUser.certificate_url;
  if (certTitleInput && currentUser.certificate_title) certTitleInput.value = currentUser.certificate_title;

  // Video file upload preview
  const videoInput = document.getElementById("video-file-input");
  const videoPreviewWrapper = document.getElementById("video-preview-wrapper");
  const videoPreviewPlayer = document.getElementById("video-preview-player");
  const videoNamePreview = document.getElementById("video-filename-preview");

  if (videoInput) {
    videoInput.addEventListener("change", () => {
      if (videoInput.files && videoInput.files[0]) {
        const file = videoInput.files[0];
        if (videoNamePreview) {
          videoNamePreview.textContent = `✓ Selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
          videoNamePreview.style.display = "block";
        }
        if (videoPreviewWrapper && videoPreviewPlayer) {
          videoPreviewPlayer.src = URL.createObjectURL(file);
          videoPreviewWrapper.style.display = "block";
        }
      }
    });
  }

  // Certificate file upload preview
  const certInput = document.getElementById("cert-file-input");
  const certPreviewWrapper = document.getElementById("cert-preview-wrapper");
  const certPreviewImg = document.getElementById("cert-preview-img");
  const certNamePreview = document.getElementById("cert-filename-preview");

  if (certInput) {
    certInput.addEventListener("change", () => {
      if (certInput.files && certInput.files[0]) {
        const file = certInput.files[0];
        if (certNamePreview) {
          certNamePreview.textContent = `✓ Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
          certNamePreview.style.display = "block";
        }
        if (certPreviewWrapper && certPreviewImg && file.type.startsWith("image/")) {
          certPreviewImg.src = URL.createObjectURL(file);
          certPreviewWrapper.style.display = "block";
        }
      }
    });
  }

  // Handle Form Submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector("button[type='submit']");
    setLoading(submitBtn, true);

    const skillName = document.getElementById("skill-name").value.trim();
    const skillCategory = document.getElementById("skill-category") ? document.getElementById("skill-category").value : "General";
    const skillLevel = document.getElementById("skill-level") ? document.getElementById("skill-level").value : "Intermediate";
    const learningSkill = document.getElementById("learning-skill").value.trim();
    const skillDesc = document.getElementById("skill-desc") ? document.getElementById("skill-desc").value.trim() : "";
    const certTitle = document.getElementById("cert-title") ? document.getElementById("cert-title").value.trim() : "";

    let videoUrl = document.getElementById("video-url") ? document.getElementById("video-url").value.trim() : "";
    let certUrl = document.getElementById("cert-url") ? document.getElementById("cert-url").value.trim() : "";

    const uid = currentUser.id || currentUser.uid;

    try {
      // 1. Upload Video to Firebase Storage if selected
      if (videoInput && videoInput.files && videoInput.files[0]) {
        showToast("Uploading teaching demonstration video to Firebase Storage...", "info");
        const vRes = await api.upload(videoInput.files[0], "video");
        if (vRes && vRes.url) {
          videoUrl = vRes.url;
        }
      }

      // 2. Upload Certificate to Firebase Storage if selected
      if (certInput && certInput.files && certInput.files[0]) {
        showToast("Uploading certificate credential to Firebase Storage...", "info");
        const cRes = await api.upload(certInput.files[0], "certificate");
        if (cRes && cRes.url) {
          certUrl = cRes.url;
        }
      }

      // 3. Save skill document to Firestore
      const skillPayload = {
        user_id: uid,
        skill_name: skillName,
        skill_category: skillCategory,
        skill_level: skillLevel,
        learning_skill: learningSkill,
        description: skillDesc,
        teaching_video: videoUrl,
        certificate: certUrl,
        certificate_title: certTitle,
        verification_status: certUrl ? "pending" : (currentUser.verification_status || "unverified"),
        is_verified: Boolean(currentUser.is_verified)
      };

      await api.post("/api/skills", skillPayload);

      // 4. Update user profile in Firestore
      const userUpdates = {
        teach_skill: skillName,
        learn_skill: learningSkill,
        bio: skillDesc || currentUser.bio,
        video_url: videoUrl,
        certificate_url: certUrl,
        certificate_title: certTitle
      };
      if (certUrl && !currentUser.is_verified) {
        userUpdates.verification_status = "pending";
      }

      const updatedUser = await api.put(`/api/users/${uid}`, userUpdates);
      if (updatedUser && updatedUser.data) {
        setCurrentUser(updatedUser.data);
      }

      // If a new certificate was submitted, also record in certificates collection for admin review
      if (certUrl && !currentUser.is_verified) {
        await api.post("/api/certificates/submit", {
          user_id: uid,
          certificate_title: certTitle || "Skill Certificate",
          file_url: certUrl,
          file_name: certInput && certInput.files && certInput.files[0] ? certInput.files[0].name : "certificate"
        });
      }

      showToast("Skill and credentials saved successfully to Firebase! 🚀", "success");
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 700);
    } catch (err) {
      showToast(err.message || "Failed to save skill.", "error");
      setLoading(submitBtn, false);
    }
  });
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
        sender_id: currentUser.id || currentUser.uid,
        receiver_id: receiverId,
        offered_skill: offeredSkill,
        requested_skill: requestedSkill
      };

      const res = await api.post("/api/requests", payload);
      if (res.success) {
        showToast("Exchange proposal sent successfully! 🎉", "success");
        closeModal("exchange-modal");
      } else {
        showToast(res.message || "Failed to send request", "error");
      }
      setLoading(submitBtn, false);
    } catch (err) {
      showToast(err.message, "error");
      setLoading(submitBtn, false);
    }
  });
}