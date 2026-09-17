/* ==========================================================================
   TALENT EXCHANGE - SKILLS LOGIC (FIND SKILLS & OFFER SKILL)
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
        debounceTimeout = setTimeout(loadUsers, 300);
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

    const params = new URLSearchParams();
    params.append("exclude_user_id", currentUser.id);
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

        return `
          <div class="user-card">
            <div class="user-card-header">
              <img src="${u.profile_image || 'assets/avatar-default.svg'}" class="user-card-avatar" alt="${u.name}" onerror="this.src='assets/avatar-default.svg'">
              <div class="user-card-meta">
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <h3 style="margin-bottom: 0;">${u.name}</h3>
                  ${isVerified ? '<span class="badge badge-verified" title="Certified & Verified Mentor">🛡️ Verified Mentor</span>' : ''}
                </div>
                <div class="user-card-dept">${u.department || 'Department not specified'}</div>
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
                <span class="badge badge-emerald">${u.learn_skill || 'Open to learn'}</span>
              </div>
            </div>

            <!-- Teaching Video & Certificate Quick Chips -->
            ${(hasVideo || hasCert) ? `
              <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
                ${hasVideo ? `
                  <button class="btn btn-secondary btn-sm btn-open-video" data-video-url="${u.video_url}" data-name="${u.name}" style="padding: 4px 10px; font-size: 0.8rem;">
                    ▶ Watch Teaching Video
                  </button>
                ` : ''}
                ${hasCert ? `
                  <button class="btn btn-secondary btn-sm btn-open-cert" data-cert-url="${u.certificate_url}" data-cert-title="${u.certificate_title || 'Certificate of Proficiency'}" data-name="${u.name}" style="padding: 4px 10px; font-size: 0.8rem;">
                    📜 View Certificate
                  </button>
                ` : ''}
              </div>
            ` : ''}

            <p class="user-card-bio">${u.bio || 'Excited to share skills and collaborate with others.'}</p>

            <div class="user-card-actions">
              <button class="btn btn-secondary btn-sm btn-view-profile" data-user='${JSON.stringify(u)}'>
                View Profile
              </button>
              <button class="btn btn-primary btn-sm btn-request-exchange"
                data-user-id="${u.id}" 
                data-user-name="${u.name}" 
                data-teach-skill="${u.teach_skill || ''}">
                Request Exchange
              </button>
            </div>
          </div>
        `;
      }).join("");

      // Bind Video Modal Watchers
      resultsContainer.querySelectorAll(".btn-open-video").forEach(b => {
        b.addEventListener("click", () => {
          const videoUrl = b.dataset.videoUrl;
          const teacherName = b.dataset.name;
          openVideoPlayerModal(videoUrl, teacherName);
        });
      });

      // Bind Certificate Modal Viewers
      resultsContainer.querySelectorAll(".btn-open-cert").forEach(b => {
        b.addEventListener("click", () => {
          const certUrl = b.dataset.certUrl;
          const certTitle = b.dataset.certTitle;
          const studentName = b.dataset.name;
          openCertificateModal(certUrl, certTitle, studentName);
        });
      });

      // Bind Request Exchange Buttons
      resultsContainer.querySelectorAll(".btn-request-exchange").forEach(b => {
        b.addEventListener("click", () => {
          document.getElementById("modal-receiver-id").value = b.dataset.userId;
          document.getElementById("modal-receiver-name").textContent = b.dataset.userName;
          document.getElementById("modal-offered-skill").value = currentUser.teach_skill || "";
          document.getElementById("modal-requested-skill").value = b.dataset.teachSkill || "";
          openModal("exchange-modal");
        });
      });

      // Bind Profile View Buttons
      resultsContainer.querySelectorAll(".btn-view-profile").forEach(b => {
        b.addEventListener("click", () => {
          const u = JSON.parse(b.dataset.user);
          document.getElementById("modal-profile-img").src = u.profile_image || "assets/avatar-default.svg";
          document.getElementById("modal-profile-name").textContent = u.name;
          document.getElementById("modal-profile-meta").textContent = `${u.department || ''} • ${u.semester || ''}`;
          document.getElementById("modal-profile-teach").textContent = u.teach_skill || "General";
          document.getElementById("modal-profile-learn").textContent = u.learn_skill || "Open";
          document.getElementById("modal-profile-bio").textContent = u.bio || "No biography provided yet.";

          const certPill = document.getElementById("modal-profile-cert-pill");
          if (certPill) {
            if (u.is_verified) {
              certPill.innerHTML = `<span class="badge badge-verified">🛡️ Certified Mentor: ${u.certificate_title || 'Verified Skill'}</span>`;
              certPill.style.display = "block";
            } else {
              certPill.style.display = "none";
            }
          }

          openModal("profile-modal");
        });
      });

    } catch (err) {
      resultsContainer.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><div class="empty-desc">${err.message}</div></div>`;
    }
  }

  // Bind Exchange Request Submission Modal
  const exchangeForm = document.getElementById("exchange-form");
  if (exchangeForm) {
    exchangeForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const receiverId = document.getElementById("modal-receiver-id").value;
      const offeredSkill = document.getElementById("modal-offered-skill").value.trim();
      const requestedSkill = document.getElementById("modal-requested-skill").value.trim();
      const submitBtn = exchangeForm.querySelector("button[type='submit']");

      if (!offeredSkill || !requestedSkill) {
        showToast("Please specify both offered and requested skills.", "error");
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
          setLoading(submitBtn, false);
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

  // Bind Close Buttons for Modals
  document.querySelectorAll(".modal-close, .modal-cancel").forEach(btn => {
    btn.addEventListener("click", () => {
      closeModal("exchange-modal");
      closeModal("profile-modal");
      closeModal("video-player-modal");
      closeModal("cert-viewer-modal");

      const player = document.getElementById("modal-video-element");
      if (player) {
        player.pause();
        player.src = "";
      }
    });
  });
}

// ==========================================================================
// 2. OFFER SKILL (WITH VIDEO & CERTIFICATE UPLOAD)
// ==========================================================================
async function initOfferSkill(currentUser) {
  const form = document.getElementById("offer-skill-form");
  if (!form) return;

  const videoUrlInput = document.getElementById("video-url");
  const videoFileInput = document.getElementById("video-file-input");
  const videoFilenameEl = document.getElementById("video-filename-preview");
  const videoPreviewWrapper = document.getElementById("video-preview-wrapper");
  const videoPreviewPlayer = document.getElementById("video-preview-player");

  const certTitleInput = document.getElementById("cert-title");
  const certUrlInput = document.getElementById("cert-url");
  const certFileInput = document.getElementById("cert-file-input");
  const certFilenameEl = document.getElementById("cert-filename-preview");
  const certPreviewWrapper = document.getElementById("cert-preview-wrapper");
  const certPreviewImg = document.getElementById("cert-preview-img");
  const certStatusBadge = document.getElementById("cert-status-badge");

  // Pre-fill existing skill
  try {
    const res = await api.get(`/api/skills/${currentUser.id}`);
    if (res && res.data && res.data.length > 0) {
      const skill = res.data[0];
      if (document.getElementById("skill-name")) document.getElementById("skill-name").value = skill.skill_name || "";
      if (document.getElementById("skill-category")) document.getElementById("skill-category").value = skill.skill_category || "Programming & Tech";
      if (document.getElementById("skill-level")) document.getElementById("skill-level").value = skill.skill_level || "Intermediate";
      if (document.getElementById("learning-skill")) document.getElementById("learning-skill").value = skill.learning_skill || "";
      if (document.getElementById("skill-desc")) document.getElementById("skill-desc").value = skill.description || "";

      if (videoUrlInput && skill.video_url) {
        videoUrlInput.value = skill.video_url;
        showVideoPreview(skill.video_url);
      }

      if (certTitleInput && skill.certificate_title) {
        certTitleInput.value = skill.certificate_title;
      }

      if (certUrlInput && skill.certificate_url) {
        certUrlInput.value = skill.certificate_url;
        showCertPreview(skill.certificate_url);
      }

      updateCertStatusBadge(skill.verification_status, skill.is_verified);
    }
  } catch (err) {
    console.error("Could not fetch skill:", err);
  }

  // Video URL input change
  if (videoUrlInput) {
    videoUrlInput.addEventListener("input", () => {
      const url = videoUrlInput.value.trim();
      if (url) showVideoPreview(url);
      else hideVideoPreview();
    });
  }

  // Video File Upload
  if (videoFileInput) {
    videoFileInput.addEventListener("change", async () => {
      if (!videoFileInput.files || videoFileInput.files.length === 0) return;
      const file = videoFileInput.files[0];
      videoFilenameEl.textContent = `Uploading ${file.name}...`;
      videoFilenameEl.style.display = "block";

      try {
        const res = await api.upload(file, "video");
        if (res && res.success && res.url) {
          videoUrlInput.value = res.url;
          videoFilenameEl.textContent = `✅ Uploaded: ${file.name}`;
          showVideoPreview(res.url);
          showToast("Teaching video uploaded successfully!", "success");
        }
      } catch (e) {
        videoFilenameEl.textContent = `❌ Upload failed: ${e.message}`;
        showToast(e.message, "error");
      }
    });
  }

  // Certificate URL input change
  if (certUrlInput) {
    certUrlInput.addEventListener("input", () => {
      const url = certUrlInput.value.trim();
      if (url) showCertPreview(url);
      else hideCertPreview();
    });
  }

  // Certificate File Upload
  if (certFileInput) {
    certFileInput.addEventListener("change", async () => {
      if (!certFileInput.files || certFileInput.files.length === 0) return;
      const file = certFileInput.files[0];
      certFilenameEl.textContent = `Uploading ${file.name}...`;
      certFilenameEl.style.display = "block";

      try {
        const res = await api.upload(file, "certificate");
        if (res && res.success && res.url) {
          certUrlInput.value = res.url;
          certFilenameEl.textContent = `✅ Uploaded: ${file.name}`;
          showCertPreview(res.url);
          showToast("Certificate uploaded! Submitted for verification.", "success");
          updateCertStatusBadge("pending", false);
        }
      } catch (e) {
        certFilenameEl.textContent = `❌ Upload failed: ${e.message}`;
        showToast(e.message, "error");
      }
    });
  }

  function showVideoPreview(url) {
    if (videoPreviewWrapper && videoPreviewPlayer) {
      videoPreviewPlayer.src = url;
      videoPreviewWrapper.style.display = "block";
    }
  }

  function hideVideoPreview() {
    if (videoPreviewWrapper && videoPreviewPlayer) {
      videoPreviewPlayer.pause();
      videoPreviewPlayer.src = "";
      videoPreviewWrapper.style.display = "none";
    }
  }

  function showCertPreview(url) {
    if (certPreviewWrapper && certPreviewImg) {
      certPreviewImg.src = url;
      certPreviewWrapper.style.display = "block";
    }
  }

  function hideCertPreview() {
    if (certPreviewWrapper) {
      certPreviewWrapper.style.display = "none";
    }
  }

  function updateCertStatusBadge(status, isVerified) {
    if (!certStatusBadge) return;
    if (isVerified || status === "verified") {
      certStatusBadge.className = "badge badge-verified";
      certStatusBadge.textContent = "Verified Mentor 🛡️";
    } else if (status === "pending") {
      certStatusBadge.className = "badge badge-pending";
      certStatusBadge.textContent = "Pending Review ⏳";
    } else {
      certStatusBadge.className = "badge badge-amber";
      certStatusBadge.textContent = "Unverified";
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector("button[type='submit']");

    const skillName = document.getElementById("skill-name").value.trim();
    const skillCategory = document.getElementById("skill-category").value;
    const skillLevel = document.getElementById("skill-level").value;
    const learningSkill = document.getElementById("learning-skill").value.trim();
    const description = document.getElementById("skill-desc").value.trim();
    const videoUrl = videoUrlInput ? videoUrlInput.value.trim() : "";
    const certUrl = certUrlInput ? certUrlInput.value.trim() : "";
    const certTitle = certTitleInput ? certTitleInput.value.trim() : "";

    if (!skillName) {
      showToast("Skill Name is required.", "error");
      return;
    }

    setLoading(submitBtn, true);

    try {
      const payload = {
        user_id: currentUser.id,
        skill_name: skillName,
        skill_category: skillCategory,
        skill_level: skillLevel,
        learning_skill: learningSkill,
        description: description,
        video_url: videoUrl,
        certificate_url: certUrl,
        certificate_title: certTitle
      };

      const res = await api.post("/api/skills", payload);
      if (res.success) {
        currentUser.teach_skill = skillName;
        currentUser.learn_skill = learningSkill;
        currentUser.video_url = videoUrl;
        currentUser.certificate_url = certUrl;
        currentUser.certificate_title = certTitle;
        if (certUrl) {
          currentUser.verification_status = "pending";
        }
        setCurrentUser(currentUser);

        showToast("Skill details, video & certificate saved to PostgreSQL!", "success");
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 800);
      } else {
        showToast(res.message || "Failed to update skill", "error");
        setLoading(submitBtn, false);
      }
    } catch (err) {
      showToast(err.message, "error");
      setLoading(submitBtn, false);
    }
  });
}