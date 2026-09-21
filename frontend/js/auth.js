/* ==========================================================================
   TALENT EXCHANGE - AUTHENTICATION CONTROLLER (LOGIN & REGISTRATION)
   Powered by Firebase Authentication & Cloud Firestore
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // If already authenticated, redirect to appropriate portal
  if (isAuthenticated() && (window.location.pathname.endsWith("login.html") || window.location.pathname.endsWith("register.html") || window.location.pathname.endsWith("admin-login.html"))) {
    const user = getCurrentUser();
    window.location.href = (user && user.role === "admin") ? "admin.html" : "dashboard.html";
    return;
  }

  // Setup Password Visibility Toggles
  const toggles = document.querySelectorAll(".password-toggle");
  toggles.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (input) {
        if (input.type === "password") {
          input.type = "text";
          btn.textContent = "Hide";
        } else {
          input.type = "password";
          btn.textContent = "Show";
        }
      }
    });
  });

  // Teaching video file selection indicator
  const regVideoFile = document.getElementById("reg-video-file");
  const regVideoStatus = document.getElementById("reg-video-status");
  if (regVideoFile && regVideoStatus) {
    regVideoFile.addEventListener("change", () => {
      if (regVideoFile.files && regVideoFile.files[0]) {
        regVideoStatus.textContent = `✓ Selected: ${regVideoFile.files[0].name} (${(regVideoFile.files[0].size / (1024 * 1024)).toFixed(2)} MB)`;
        regVideoStatus.style.display = "block";
      } else {
        regVideoStatus.style.display = "none";
      }
    });
  }

  // Certificate input feedback
  const regCertFile = document.getElementById("reg-cert-file");
  const regCertStatus = document.getElementById("reg-cert-status");
  if (regCertFile && regCertStatus) {
    regCertFile.addEventListener("change", () => {
      if (regCertFile.files && regCertFile.files[0]) {
        regCertStatus.textContent = `✓ Selected: ${regCertFile.files[0].name} (${(regCertFile.files[0].size / 1024).toFixed(1)} KB)`;
        regCertStatus.style.display = "block";
      } else {
        regCertStatus.style.display = "none";
      }
    });
  }

  // Handle Student Login Form
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errBanner = document.getElementById("auth-error");
      const submitBtn = loginForm.querySelector("button[type='submit']");
      if (errBanner) errBanner.classList.remove("show");

      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value;

      if (!email || !password) {
        showError("Please enter both email and password.");
        return;
      }

      setLoading(submitBtn, true);

      try {
        const res = await api.post("/api/login", { email, password });
        if (res.success && res.data) {
          setCurrentUser(res.data);
          const isAdm = res.data.role === "admin";
          showToast(isAdm ? "Welcome Administrator! Redirecting to Admin Console..." : "Welcome back! Redirecting to dashboard...", "success");
          setTimeout(() => {
            window.location.href = isAdm ? "admin.html" : "dashboard.html";
          }, 600);
        } else {
          showError(res.message || "Invalid credentials.");
          setLoading(submitBtn, false);
        }
      } catch (err) {
        showError(err.message || "Login failed. Please check your credentials.");
        setLoading(submitBtn, false);
      }
    });
  }

  // Handle Registration Form
  const registerForm = document.getElementById("register-form");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errBanner = document.getElementById("auth-error");
      const submitBtn = registerForm.querySelector("button[type='submit']");
      if (errBanner) errBanner.classList.remove("show");

      const name = document.getElementById("reg-name").value.trim();
      const email = document.getElementById("reg-email").value.trim();
      const password = document.getElementById("reg-password").value;
      const confirmPassword = document.getElementById("reg-confirm-password").value;
      const department = document.getElementById("reg-dept") ? document.getElementById("reg-dept").value.trim() : "";
      const semester = document.getElementById("reg-semester") ? document.getElementById("reg-semester").value.trim() : "";
      const teachSkill = document.getElementById("reg-teach-skill").value.trim();
      const learnSkill = document.getElementById("reg-learn-skill").value.trim();
      const bio = document.getElementById("reg-bio") ? document.getElementById("reg-bio").value.trim() : "";
      const profileImage = document.getElementById("reg-image") ? document.getElementById("reg-image").value.trim() : "";

      if (!name || !email || !password || !confirmPassword || !teachSkill || !learnSkill) {
        showError("Please fill out all required fields.");
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showError("Please enter a valid student email address.");
        return;
      }

      if (password.length < 6) {
        showError("Password must be at least 6 characters long.");
        return;
      }

      if (password !== confirmPassword) {
        showError("Passwords do not match. Please verify.");
        return;
      }

      setLoading(submitBtn, true);

      try {
        let certUrl = document.getElementById("reg-cert-url") ? document.getElementById("reg-cert-url").value.trim() : "";
        const certTitle = document.getElementById("reg-cert-title") ? document.getElementById("reg-cert-title").value.trim() : "";
        const certFileInput = document.getElementById("reg-cert-file");

        let videoUrl = document.getElementById("reg-video-url") ? document.getElementById("reg-video-url").value.trim() : "";
        const videoFileInput = document.getElementById("reg-video-file");

        // Upload certificate if provided
        if (certFileInput && certFileInput.files && certFileInput.files[0]) {
          try {
            showToast("Uploading certificate file to Firebase Storage...", "info");
            const uploadRes = await api.upload(certFileInput.files[0], "certificate");
            if (uploadRes && uploadRes.url) {
              certUrl = uploadRes.url;
            }
          } catch (uploadErr) {
            console.warn("Certificate upload notice:", uploadErr);
          }
        }

        // Upload video if provided
        if (videoFileInput && videoFileInput.files && videoFileInput.files[0]) {
          try {
            showToast("Uploading teaching video to Firebase Storage...", "info");
            const vRes = await api.upload(videoFileInput.files[0], "video");
            if (vRes && vRes.url) {
              videoUrl = vRes.url;
            }
          } catch (vErr) {
            console.warn("Video upload notice:", vErr);
          }
        }

        const payload = {
          name,
          email,
          password,
          department,
          semester,
          teach_skill: teachSkill,
          learn_skill: learnSkill,
          bio,
          profile_image: profileImage || "assets/avatar-default.svg",
          video_url: videoUrl,
          certificate_url: certUrl,
          certificate_title: certTitle,
          verification_status: certUrl ? "pending" : "unverified",
          is_verified: false
        };

        const res = await api.post("/api/register", payload);
        if (res.success && res.data) {
          setCurrentUser(res.data);
          showToast("Profile created successfully! Redirecting...", "success");
          setTimeout(() => {
            window.location.href = "dashboard.html";
          }, 800);
        } else {
          showError(res.message || "Registration failed.");
          setLoading(submitBtn, false);
        }
      } catch (err) {
        showError(err.message || "Registration failed. Please try again.");
        setLoading(submitBtn, false);
      }
    });
  }

  function showError(msg) {
    const errBanner = document.getElementById("auth-error");
    if (errBanner) {
      errBanner.textContent = msg;
      errBanner.classList.add("show");
    } else {
      showToast(msg, "error");
    }
  }
});