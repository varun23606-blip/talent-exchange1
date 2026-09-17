/* ==========================================================================
   TALENT EXCHANGE - USER PROFILE LOGIC
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth()) return;
  renderNavbar("profile");

  const currentUser = getCurrentUser();
  await loadUserProfile(currentUser.id);

  // File input change indicators
  const videoFileInput = document.getElementById("edit-video-file");
  const videoStatus = document.getElementById("edit-video-status");
  if (videoFileInput && videoStatus) {
    videoFileInput.addEventListener("change", () => {
      if (videoFileInput.files && videoFileInput.files[0]) {
        const file = videoFileInput.files[0];
        videoStatus.textContent = `✓ Selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
        videoStatus.style.display = "block";
      } else {
        videoStatus.style.display = "none";
      }
    });
  }

  const certFileInput = document.getElementById("edit-cert-file");
  const certStatus = document.getElementById("edit-cert-status");
  if (certFileInput && certStatus) {
    certFileInput.addEventListener("change", () => {
      if (certFileInput.files && certFileInput.files[0]) {
        const file = certFileInput.files[0];
        certStatus.textContent = `✓ Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        certStatus.style.display = "block";
      } else {
        certStatus.style.display = "none";
      }
    });
  }

  // Handle Verify Now Button
  const btnVerifyNow = document.getElementById("btn-verify-now");
  if (btnVerifyNow) {
    btnVerifyNow.addEventListener("click", async () => {
      setLoading(btnVerifyNow, true);
      try {
        const res = await api.post("/api/verify-certificate", {
          user_id: currentUser.id,
          status: "verified"
        });
        if (res.success) {
          showToast("Certificate successfully verified! 🛡️ You are now a Verified Mentor.", "success");
          setCurrentUser(res.data);
          await loadUserProfile(currentUser.id);
          renderNavbar("profile");
        } else {
          showToast(res.message || "Verification request failed", "error");
        }
      } catch (err) {
        showToast(err.message || "Failed to verify certificate", "error");
      } finally {
        setLoading(btnVerifyNow, false);
      }
    });
  }

  // Handle Profile Form Submission
  const editForm = document.getElementById("profile-edit-form");
  if (editForm) {
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = editForm.querySelector("button[type='submit']");
      setLoading(submitBtn, true);

      const name = document.getElementById("edit-name").value.trim();
      const department = document.getElementById("edit-dept").value.trim();
      const semester = document.getElementById("edit-sem").value.trim();
      const teachSkill = document.getElementById("edit-teach-skill").value.trim();
      const learnSkill = document.getElementById("edit-learn-skill").value.trim();
      const bio = document.getElementById("edit-bio").value.trim();
      const profileImage = document.getElementById("edit-image").value.trim();
      const certTitle = document.getElementById("edit-cert-title") ? document.getElementById("edit-cert-title").value.trim() : "";
      let videoUrl = document.getElementById("edit-video-url") ? document.getElementById("edit-video-url").value.trim() : "";
      let certUrl = document.getElementById("edit-cert-url") ? document.getElementById("edit-cert-url").value.trim() : "";

      try {
        // Upload video file if selected
        if (videoFileInput && videoFileInput.files && videoFileInput.files[0]) {
          showToast("Uploading teaching video...", "info");
          const vRes = await api.upload(videoFileInput.files[0], "video");
          if (vRes && vRes.success && vRes.url) {
            videoUrl = vRes.url;
            if (document.getElementById("edit-video-url")) {
              document.getElementById("edit-video-url").value = videoUrl;
            }
          }
        }

        // Upload certificate file if selected
        if (certFileInput && certFileInput.files && certFileInput.files[0]) {
          showToast("Uploading certificate document...", "info");
          const cRes = await api.upload(certFileInput.files[0], "certificate");
          if (cRes && cRes.success && cRes.url) {
            certUrl = cRes.url;
            if (document.getElementById("edit-cert-url")) {
              document.getElementById("edit-cert-url").value = certUrl;
            }
          }
        }

        const payload = {
          name,
          department,
          semester,
          teach_skill: teachSkill,
          learn_skill: learnSkill,
          bio,
          profile_image: profileImage,
          video_url: videoUrl,
          certificate_url: certUrl,
          certificate_title: certTitle
        };

        const res = await api.put(`/api/profile/${currentUser.id}`, payload);
        if (res.success && res.data) {
          setCurrentUser(res.data);
          showToast("Profile updated successfully!", "success");
          await loadUserProfile(currentUser.id);
          renderNavbar("profile");
        } else {
          showToast(res.message || "Could not update profile", "error");
        }
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        setLoading(submitBtn, false);
      }
    });
  }
});

async function loadUserProfile(userId) {
  try {
    const res = await api.get(`/api/profile/${userId}`);
    if (!res || !res.data) return;

    const u = res.data;

    // Display fields
    const avatarEl = document.getElementById("view-avatar");
    const nameEl = document.getElementById("view-name");
    const emailEl = document.getElementById("view-email");
    const deptEl = document.getElementById("view-dept");
    const teachEl = document.getElementById("view-teach");
    const learnEl = document.getElementById("view-learn");
    const bioEl = document.getElementById("view-bio");
    const connsEl = document.getElementById("view-conns-count");

    if (avatarEl) avatarEl.src = u.profile_image || "assets/avatar-default.svg";
    if (nameEl) nameEl.textContent = u.name;
    if (emailEl) emailEl.textContent = u.email;
    if (deptEl) deptEl.textContent = `${u.department || 'Student'} • ${u.semester || ''}`;
    if (teachEl) teachEl.textContent = u.teach_skill || "Not configured";
    if (learnEl) learnEl.textContent = u.learn_skill || "Not configured";
    if (bioEl) bioEl.textContent = u.bio || "No bio added yet.";
    if (connsEl) connsEl.textContent = u.connections_count || 0;

    // Verification Badge & Status
    const badgeContainer = document.getElementById("view-cert-badge-container");
    const editPill = document.getElementById("edit-cert-badge-pill");
    const verifyNowContainer = document.getElementById("verify-now-container");

    if (badgeContainer) {
      if (u.is_verified) {
        badgeContainer.innerHTML = `<span class="badge badge-verified" style="font-size:0.85rem; padding:6px 14px;">🛡️ Verified Mentor: ${u.certificate_title || 'Certified'}</span>`;
        if (editPill) {
          editPill.textContent = "Verified 🛡️";
          editPill.className = "badge badge-verified";
        }
        if (verifyNowContainer) verifyNowContainer.style.display = "none";
      } else if (u.verification_status === "pending" || u.certificate_url) {
        badgeContainer.innerHTML = `<span class="badge badge-pending" style="font-size:0.85rem; padding:6px 14px;">⏳ Certificate Submitted</span>`;
        if (editPill) {
          editPill.textContent = "Pending Review ⏳";
          editPill.className = "badge badge-pending";
        }
        if (verifyNowContainer) {
          verifyNowContainer.style.display = "block";
          const btn = document.getElementById("btn-verify-now");
          if (btn) btn.textContent = "🛡️ Verify My Certificate Now";
        }
      } else {
        badgeContainer.innerHTML = `<span class="badge" style="background:rgba(255,255,255,0.06); color:var(--text-muted); font-size:0.85rem; padding:6px 14px;">Unverified Mentor</span>`;
        if (editPill) {
          editPill.textContent = "Unverified";
          editPill.className = "badge badge-amber";
        }
        if (verifyNowContainer) verifyNowContainer.style.display = "none";
      }
    }

    // Media Buttons
    const videoBtn = document.getElementById("view-watch-video-btn");
    if (videoBtn) {
      if (u.video_url) {
        videoBtn.style.display = "inline-flex";
        videoBtn.onclick = () => openVideoPlayerModal(u.video_url, u.name);
      } else {
        videoBtn.style.display = "none";
      }
    }

    const certBtn = document.getElementById("view-cert-btn");
    if (certBtn) {
      if (u.certificate_url) {
        certBtn.style.display = "inline-flex";
        certBtn.onclick = () => openCertificateModal(u.certificate_url, u.certificate_title, u.name);
      } else {
        certBtn.style.display = "none";
      }
    }

    // Edit inputs
    if (document.getElementById("edit-name")) document.getElementById("edit-name").value = u.name || "";
    if (document.getElementById("edit-dept")) document.getElementById("edit-dept").value = u.department || "";
    if (document.getElementById("edit-sem")) document.getElementById("edit-sem").value = u.semester || "";
    if (document.getElementById("edit-teach-skill")) document.getElementById("edit-teach-skill").value = u.teach_skill || "";
    if (document.getElementById("edit-learn-skill")) document.getElementById("edit-learn-skill").value = u.learn_skill || "";
    if (document.getElementById("edit-bio")) document.getElementById("edit-bio").value = u.bio || "";
    if (document.getElementById("edit-image")) document.getElementById("edit-image").value = u.profile_image || "";
    if (document.getElementById("edit-video-url")) document.getElementById("edit-video-url").value = u.video_url || "";
    if (document.getElementById("edit-cert-title")) document.getElementById("edit-cert-title").value = u.certificate_title || "";
    if (document.getElementById("edit-cert-url")) document.getElementById("edit-cert-url").value = u.certificate_url || "";

  } catch (err) {
    showToast("Error loading profile: " + err.message, "error");
  }
}