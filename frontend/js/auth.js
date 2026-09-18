/* ==========================================================================
   TALENT EXCHANGE - AUTHENTICATION LOGIC (LOGIN & REGISTER)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // If already logged in, redirect to dashboard
  if (isAuthenticated() && (window.location.pathname.endsWith("login.html") || window.location.pathname.endsWith("register.html"))) {
    window.location.href = "dashboard.html";
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

  // Handle Login Form
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
          showToast("Welcome back! Redirecting...", "success");
          setTimeout(() => {
            window.location.href = "dashboard.html";
          }, 600);
        } else {
          showError(res.message || "Invalid credentials.");
          setLoading(submitBtn, false);
        }
      } catch (err) {
        showError(err.message || "Login failed. Please try again.");
        setLoading(submitBtn, false);
      }
    });
  }

  // Handle Register Form
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
      const department = document.getElementById("reg-dept").value.trim();
      const semester = document.getElementById("reg-semester").value.trim();
      const teachSkill = document.getElementById("reg-teach-skill").value.trim();
      const learnSkill = document.getElementById("reg-learn-skill").value.trim();
      const bio = document.getElementById("reg-bio").value.trim();
      const profileImage = document.getElementById("reg-image").value.trim();

      if (!name || !email || !password || !confirmPassword) {
        showError("Please fill out all required fields.");
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showError("Please enter a valid email address.");
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

      const certTitle = document.getElementById("reg-cert-title") ? document.getElementById("reg-cert-title").value.trim() : "";
      let certUrl = document.getElementById("reg-cert-url") ? document.getElementById("reg-cert-url").value.trim() : "";
      const certFileInput = document.getElementById("reg-cert-file");

      setLoading(submitBtn, true);

      try {
        if (certFileInput && certFileInput.files && certFileInput.files[0]) {
          try {
            showToast("Uploading certificate file...", "info");
            const uploadRes = await api.upload(certFileInput.files[0], "certificate");
            if (uploadRes && uploadRes.success && uploadRes.url) {
              certUrl = uploadRes.url;
            }
          } catch (uploadErr) {
            console.warn("Certificate upload notice:", uploadErr);
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
          profile_image: profileImage,
          certificate_url: certUrl,
          certificate_title: certTitle
        };

        const res = await api.post("/api/register", payload);
        if (res.success && res.data) {
          setCurrentUser(res.data);
          showToast("Account created successfully! Redirecting...", "success");
          setTimeout(() => {
            window.location.href = "dashboard.html";
          }, 800);
        } else {
          showError(res.message || "Registration failed.");
          setLoading(submitBtn, false);
        }
      } catch (err) {
        showError(err.message || "Registration failed. Please check inputs.");
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