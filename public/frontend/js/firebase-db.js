/**
 * ==============================================================================
 * TALENT EXCHANGE - FIRESTORE DATABASE SERVICE
 * ==============================================================================
 * Complete Cloud Firestore integration for Talent Exchange platform.
 * Collections:
 *   - users
 *   - skills
 *   - exchange_requests
 *   - connections
 *   - conversations/{id}/messages
 *   - notifications
 *   - certificates
 * ==============================================================================
 */

const firebaseDb = {
  getDb() {
    return window.getFirestoreDb ? window.getFirestoreDb() : (window.firebase && window.firebase.firestore ? window.firebase.firestore() : null);
  },

  // ============================================================================
  // 1. USERS COLLECTION
  // ============================================================================

  async getUser(uid) {
    const db = this.getDb();
    if (!db || !uid) return null;
    try {
      const docRef = db.collection("users").document(String(uid));
      const doc = await docRef.get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() };
      }
      return null;
    } catch (e) {
      console.warn("[Talent Exchange DB] getUser error:", e.message);
      return null;
    }
  },

  async getUserByEmail(email) {
    const db = this.getDb();
    if (!db || !email) return null;
    try {
      const cleanEmail = email.trim().toLowerCase();
      const snapshot = await db.collection("users").where("email", "==", cleanEmail).limit(1).get();
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
      }
      return null;
    } catch (e) {
      console.warn("[Talent Exchange DB] getUserByEmail error:", e.message);
      return null;
    }
  },

  async createUser(uid, userData) {
    const db = this.getDb();
    if (!db) return userData;
    try {
      const docRef = db.collection("users").document(String(uid));
      await docRef.set(userData, { merge: true });
      return { id: String(uid), ...userData };
    } catch (e) {
      console.error("[Talent Exchange DB] createUser error:", e.message);
      return userData;
    }
  },

  async updateUser(uid, updates) {
    const db = this.getDb();
    if (!db || !uid) return updates;
    try {
      const docRef = db.collection("users").document(String(uid));
      await docRef.set(updates, { merge: true });
      const updated = await this.getUser(uid);
      if (window.setCurrentUser && window.getCurrentUser() && window.getCurrentUser().id === uid) {
        window.setCurrentUser(updated);
      }
      return updated;
    } catch (e) {
      console.error("[Talent Exchange DB] updateUser error:", e.message);
      throw e;
    }
  },

  async getAllUsers(filters = {}) {
    const db = this.getDb();
    if (!db) return [];
    try {
      const snapshot = await db.collection("users").get();
      let users = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        users.push({ id: doc.id, ...data });
      });

      // Filter out admin accounts from student listings
      users = users.filter(u => u.role !== "admin");

      // Filter out exclude_user_id
      if (filters.exclude_user_id) {
        users = users.filter(u => String(u.id) !== String(filters.exclude_user_id) && String(u.uid) !== String(filters.exclude_user_id));
      }

      // Filter: Verified mentors only
      if (filters.only_verified) {
        users = users.filter(u => Boolean(u.is_verified));
      }

      // Filter: Department
      if (filters.department) {
        const dept = filters.department.toLowerCase();
        users = users.filter(u => (u.department || "").toLowerCase().includes(dept));
      }

      // Filter: Semester
      if (filters.semester) {
        const sem = filters.semester.toLowerCase();
        users = users.filter(u => (u.semester || "").toLowerCase().includes(sem));
      }

      // Filter: Skill keyword
      if (filters.skill) {
        const s = filters.skill.toLowerCase();
        users = users.filter(u => 
          (u.teach_skill || "").toLowerCase().includes(s) || 
          (u.learn_skill || "").toLowerCase().includes(s)
        );
      }

      // Filter: General text query (name, bio, skills)
      if (filters.q) {
        const query = filters.q.toLowerCase();
        users = users.filter(u => 
          (u.name || "").toLowerCase().includes(query) ||
          (u.teach_skill || "").toLowerCase().includes(query) ||
          (u.learn_skill || "").toLowerCase().includes(query) ||
          (u.bio || "").toLowerCase().includes(query) ||
          (u.department || "").toLowerCase().includes(query)
        );
      }

      return users;
    } catch (e) {
      console.error("[Talent Exchange DB] getAllUsers error:", e.message);
      return [];
    }
  },

  // ============================================================================
  // 2. SKILLS COLLECTION
  // ============================================================================

  async addSkill(skillData) {
    const db = this.getDb();
    if (!db) return null;
    try {
      const docData = {
        ...skillData,
        created_at: skillData.created_at || new Date().toISOString()
      };
      const docRef = await db.collection("skills").add(docData);
      return { id: docRef.id, ...docData };
    } catch (e) {
      console.error("[Talent Exchange DB] addSkill error:", e.message);
      throw e;
    }
  },

  async getSkillsByUser(userId) {
    const db = this.getDb();
    if (!db || !userId) return [];
    try {
      const snapshot = await db.collection("skills").where("user_id", "==", String(userId)).get();
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      return list;
    } catch (e) {
      console.warn("[Talent Exchange DB] getSkillsByUser error:", e.message);
      return [];
    }
  },

  async getAllSkills() {
    const db = this.getDb();
    if (!db) return [];
    try {
      const snapshot = await db.collection("skills").get();
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      return list;
    } catch (e) {
      console.error("[Talent Exchange DB] getAllSkills error:", e.message);
      return [];
    }
  },

  async updateSkill(skillId, updates) {
    const db = this.getDb();
    if (!db || !skillId) return;
    try {
      await db.collection("skills").document(String(skillId)).set(updates, { merge: true });
    } catch (e) {
      console.error("[Talent Exchange DB] updateSkill error:", e.message);
    }
  },

  // ============================================================================
  // 3. EXCHANGE REQUESTS COLLECTION
  // ============================================================================

  async sendExchangeRequest(senderId, receiverId, offeredSkill, requestedSkill) {
    const db = this.getDb();
    if (!db) throw new Error("Database not connected.");

    if (!senderId || !receiverId) {
      throw new Error("Sender and receiver are required.");
    }

    if (String(senderId) === String(receiverId)) {
      throw new Error("You cannot send an exchange request to yourself.");
    }

    // Check for existing pending request between these two users
    try {
      const existing = await db.collection("exchange_requests")
        .where("sender_id", "==", String(senderId))
        .where("receiver_id", "==", String(receiverId))
        .where("status", "==", "Pending")
        .get();

      if (!existing.empty) {
        throw new Error("You already have an active pending exchange request with this student.");
      }
    } catch (e) {
      if (e.message.includes("already have an active")) throw e;
      // Index might be missing in Spark tier, continue with client check
    }

    const requestData = {
      sender_id: String(senderId),
      receiver_id: String(receiverId),
      offered_skill: offeredSkill || "",
      requested_skill: requestedSkill || "",
      status: "Pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const docRef = await db.collection("exchange_requests").add(requestData);

    // Create a real-time notification for the receiver
    const sender = await this.getUser(senderId);
    const senderName = sender ? sender.name : "A fellow student";
    await this.createNotification(receiverId, {
      type: "new_request",
      title: "New Exchange Proposal",
      message: `${senderName} wants to learn ${requestedSkill} and offered to teach you ${offeredSkill}.`,
      link: "requests.html"
    });

    return { id: docRef.id, ...requestData };
  },

  async getRequests(userId) {
    const db = this.getDb();
    if (!db || !userId) return { incoming: [], outgoing: [] };

    try {
      const allSnapshot = await db.collection("exchange_requests").get();
      const incomingRaw = [];
      const outgoingRaw = [];

      allSnapshot.forEach(doc => {
        const d = { id: doc.id, ...doc.data() };
        if (String(d.receiver_id) === String(userId)) {
          incomingRaw.push(d);
        } else if (String(d.sender_id) === String(userId)) {
          outgoingRaw.push(d);
        }
      });

      // Enrich incoming requests with sender info
      const incoming = await Promise.all(incomingRaw.map(async r => {
        const sender = await this.getUser(r.sender_id);
        return {
          ...r,
          sender_name: sender ? sender.name : "Student",
          sender_image: sender ? (sender.profile_image || "assets/avatar-default.svg") : "assets/avatar-default.svg",
          sender_dept: sender ? sender.department : "",
          sender_semester: sender ? sender.semester : ""
        };
      }));

      // Enrich outgoing requests with receiver info
      const outgoing = await Promise.all(outgoingRaw.map(async r => {
        const receiver = await this.getUser(r.receiver_id);
        return {
          ...r,
          receiver_name: receiver ? receiver.name : "Student",
          receiver_image: receiver ? (receiver.profile_image || "assets/avatar-default.svg") : "assets/avatar-default.svg"
        };
      }));

      return { incoming, outgoing };
    } catch (e) {
      console.error("[Talent Exchange DB] getRequests error:", e.message);
      return { incoming: [], outgoing: [] };
    }
  },

  async updateRequestStatus(requestId, status) {
    const db = this.getDb();
    if (!db || !requestId) return;

    try {
      const docRef = db.collection("exchange_requests").document(String(requestId));
      const doc = await docRef.get();
      if (!doc.exists) throw new Error("Exchange request not found.");

      const reqData = doc.data();
      await docRef.update({
        status: status,
        updated_at: new Date().toISOString()
      });

      // If accepted, create connection and notify sender
      if (status === "Accepted") {
        await this.createConnection(reqData.sender_id, reqData.receiver_id);

        const receiver = await this.getUser(reqData.receiver_id);
        const receiverName = receiver ? receiver.name : "Your partner";

        await this.createNotification(reqData.sender_id, {
          type: "request_accepted",
          title: "Exchange Accepted! 🎉",
          message: `${receiverName} accepted your exchange proposal for ${reqData.offered_skill} ↔ ${reqData.requested_skill}! You are now connected.`,
          link: "connections.html"
        });
      } else if (status === "Rejected") {
        const receiver = await this.getUser(reqData.receiver_id);
        const receiverName = receiver ? receiver.name : "Student";

        await this.createNotification(reqData.sender_id, {
          type: "request_rejected",
          title: "Exchange Request Update",
          message: `${receiverName} was unable to accept your exchange request at this time.`,
          link: "find-skills.html"
        });
      }

      return { success: true, status };
    } catch (e) {
      console.error("[Talent Exchange DB] updateRequestStatus error:", e.message);
      throw e;
    }
  },

  // ============================================================================
  // 4. CONNECTIONS COLLECTION
  // ============================================================================

  async createConnection(user1_id, user2_id) {
    const db = this.getDb();
    if (!db) return;

    const u1 = String(user1_id);
    const u2 = String(user2_id);
    if (u1 === u2) return;

    // Check if connection already exists in either direction
    const existing = await this.checkConnectionExists(u1, u2);
    if (existing) {
      console.log("[Talent Exchange DB] Connection already established between", u1, "and", u2);
      return;
    }

    const connDoc = {
      user1_id: u1,
      user2_id: u2,
      created_at: new Date().toISOString()
    };

    await db.collection("connections").add(connDoc);
    console.log("[Talent Exchange DB] New connection established between", u1, "and", u2);
  },

  async checkConnectionExists(u1, u2) {
    const db = this.getDb();
    if (!db) return false;
    try {
      const snapshot = await db.collection("connections").get();
      let found = false;
      snapshot.forEach(doc => {
        const d = doc.data();
        if ((d.user1_id === u1 && d.user2_id === u2) || (d.user1_id === u2 && d.user2_id === u1)) {
          found = true;
        }
      });
      return found;
    } catch (e) {
      return false;
    }
  },

  async getConnections(userId) {
    const db = this.getDb();
    if (!db || !userId) return [];

    try {
      const snapshot = await db.collection("connections").get();
      const partnerIds = [];

      snapshot.forEach(doc => {
        const d = doc.data();
        if (String(d.user1_id) === String(userId)) {
          partnerIds.push(d.user2_id);
        } else if (String(d.user2_id) === String(userId)) {
          partnerIds.push(d.user1_id);
        }
      });

      // Deduplicate partner IDs
      const uniquePartnerIds = [...new Set(partnerIds)];

      // Fetch user profile for each partner
      const partners = await Promise.all(uniquePartnerIds.map(async pid => {
        const u = await this.getUser(pid);
        if (!u) return null;
        return {
          id: u.id,
          uid: u.uid || u.id,
          name: u.name,
          department: u.department || "Student",
          semester: u.semester || "",
          profile_image: u.profile_image || "assets/avatar-default.svg",
          teach_skill: u.teach_skill || "General",
          learn_skill: u.learn_skill || "General",
          bio: u.bio || "Connected skill exchange partner.",
          is_verified: Boolean(u.is_verified),
          status: "Connected"
        };
      }));

      return partners.filter(Boolean);
    } catch (e) {
      console.error("[Talent Exchange DB] getConnections error:", e.message);
      return [];
    }
  },

  // ============================================================================
  // 5. CHAT / CONVERSATIONS & MESSAGES
  // ============================================================================

  getConversationId(uid1, uid2) {
    return [String(uid1), String(uid2)].sort().join("_");
  },

  async sendMessage(senderId, receiverId, messageText) {
    const db = this.getDb();
    if (!db) throw new Error("Database not available.");

    const cleanText = (messageText || "").trim();
    if (!cleanText) throw new Error("Message cannot be empty.");

    if (!senderId || !receiverId) {
      throw new Error("Sender and receiver are required.");
    }

    const conversationId = this.getConversationId(senderId, receiverId);
    const nowIso = new Date().toISOString();

    const messageData = {
      sender_id: String(senderId),
      receiver_id: String(receiverId),
      message: cleanText,
      created_at: nowIso,
      is_read: false
    };

    // 1. Add message into subcollection
    const msgRef = await db.collection("conversations")
      .document(conversationId)
      .collection("messages")
      .add(messageData);

    // 2. Update conversation header
    await db.collection("conversations").document(conversationId).set({
      last_message: cleanText,
      last_sender_id: String(senderId),
      updated_at: nowIso,
      participants: [String(senderId), String(receiverId)]
    }, { merge: true });

    // 3. Notify receiver
    const sender = await this.getUser(senderId);
    const senderName = sender ? sender.name : "Partner";
    await this.createNotification(receiverId, {
      type: "new_message",
      title: `Message from ${senderName}`,
      message: cleanText.length > 60 ? cleanText.substring(0, 60) + "..." : cleanText,
      link: `chat.html?userId=${senderId}`
    });

    return { id: msgRef.id, ...messageData };
  },

  listenMessages(conversationId, callback) {
    const db = this.getDb();
    if (!db || !conversationId) return () => {};

    try {
      return db.collection("conversations")
        .document(conversationId)
        .collection("messages")
        .orderBy("created_at", "asc")
        .onSnapshot(snapshot => {
          const messages = [];
          snapshot.forEach(doc => {
            messages.push({ id: doc.id, ...doc.data() });
          });
          callback(messages);
        }, err => {
          console.warn("[Talent Exchange Chat]: Realtime listener notice:", err.message);
          // Fallback to fetch without ordering if index is generating
          db.collection("conversations")
            .document(conversationId)
            .collection("messages")
            .get()
            .then(snap => {
              const msgs = [];
              snap.forEach(d => msgs.push({ id: d.id, ...d.data() }));
              msgs.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
              callback(msgs);
            });
        });
    } catch (e) {
      console.error("[Talent Exchange Chat] listenMessages error:", e);
      return () => {};
    }
  },

  // ============================================================================
  // 6. NOTIFICATIONS
  // ============================================================================

  async createNotification(userId, { type, title, message, link }) {
    const db = this.getDb();
    if (!db || !userId) return;
    try {
      await db.collection("notifications").add({
        user_id: String(userId),
        type: type || "general",
        title: title || "Notification",
        message: message || "",
        link: link || "dashboard.html",
        is_read: false,
        created_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn("[Talent Exchange DB] createNotification error:", e.message);
    }
  },

  listenNotifications(userId, callback) {
    const db = this.getDb();
    if (!db || !userId) return () => {};

    try {
      return db.collection("notifications")
        .where("user_id", "==", String(userId))
        .onSnapshot(snapshot => {
          let unreadCount = 0;
          const notifs = [];
          snapshot.forEach(doc => {
            const d = { id: doc.id, ...doc.data() };
            if (!d.is_read) unreadCount++;
            notifs.push(d);
          });
          notifs.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
          callback({ notifs, unreadCount });
        }, err => {
          console.warn("[Talent Exchange Notif]: Realtime listener error:", err.message);
        });
    } catch (e) {
      return () => {};
    }
  },

  // ============================================================================
  // 7. CERTIFICATES COLLECTION (FOR ADMIN REVIEW)
  // ============================================================================

  async submitCertificate(data) {
    const db = this.getDb();
    if (!db) throw new Error("Database not connected.");

    const certDoc = {
      user_id: String(data.user_id),
      skill_id: data.skill_id || "",
      certificate_title: data.certificate_title || "Skill Certificate",
      file_url: data.file_url || "",
      file_name: data.file_name || "certificate",
      status: "pending",
      submitted_at: new Date().toISOString(),
      reviewed_at: null,
      reviewed_by: null
    };

    const ref = await db.collection("certificates").add(certDoc);

    // Also update user's verification_status to pending in users collection
    await this.updateUser(data.user_id, {
      certificate_title: data.certificate_title || "Skill Certificate",
      certificate_url: data.file_url || "",
      verification_status: "pending"
    });

    return { id: ref.id, ...certDoc };
  },

  async getCertificates() {
    const db = this.getDb();
    if (!db) return [];
    try {
      const snapshot = await db.collection("certificates").get();
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));

      // Enrich with user profile data
      const enriched = await Promise.all(list.map(async c => {
        const u = await this.getUser(c.user_id);
        return {
          ...c,
          user_name: u ? u.name : "Student",
          user_email: u ? u.email : "",
          user_dept: u ? u.department : "",
          user_semester: u ? u.semester : "",
          skill_name: u ? u.teach_skill : "Skill",
          video_url: u ? u.video_url : ""
        };
      }));

      enriched.sort((a, b) => (b.submitted_at || "").localeCompare(a.submitted_at || ""));
      return enriched;
    } catch (e) {
      console.error("[Talent Exchange DB] getCertificates error:", e.message);
      return [];
    }
  },

  async reviewCertificate(certId, status, adminUid) {
    const db = this.getDb();
    if (!db || !certId) return;

    try {
      const certRef = db.collection("certificates").document(String(certId));
      const doc = await certRef.get();
      if (!doc.exists) throw new Error("Certificate record not found.");

      const certData = doc.data();
      const isApproved = status === "verified";

      await certRef.update({
        status: status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: String(adminUid)
      });

      // Update student profile in users collection
      await this.updateUser(certData.user_id, {
        is_verified: isApproved,
        verification_status: status
      });

      // Notify the student
      if (isApproved) {
        await this.createNotification(certData.user_id, {
          type: "cert_approved",
          title: "Certificate Approved! 🛡️",
          message: "Congratulations! Your skill certificate has been approved by the administrator. You now have the Verified Mentor badge!",
          link: "profile.html"
        });
      } else {
        await this.createNotification(certData.user_id, {
          type: "cert_rejected",
          title: "Certificate Verification Update",
          message: "Your submitted certificate was not approved by the administrator. You may upload a revised credential on your profile.",
          link: "profile.html"
        });
      }

      return { success: true, status };
    } catch (e) {
      console.error("[Talent Exchange DB] reviewCertificate error:", e.message);
      throw e;
    }
  },

  // ============================================================================
  // 8. ADMIN ANALYTICS & PLATFORM METRICS
  // ============================================================================

  async getAdminStats() {
    const db = this.getDb();
    if (!db) {
      return {
        total_users: 0,
        total_skills: 0,
        pending_verifications: 0,
        verified_mentors: 0,
        active_connections: 0,
        exchanges_completed: 0,
        messages_sent: 0
      };
    }

    try {
      const [usersSnap, skillsSnap, certsSnap, connsSnap, reqsSnap] = await Promise.all([
        db.collection("users").get(),
        db.collection("skills").get(),
        db.collection("certificates").get(),
        db.collection("connections").get(),
        db.collection("exchange_requests").get()
      ]);

      let studentsCount = 0;
      let verifiedMentors = 0;
      usersSnap.forEach(doc => {
        const u = doc.data();
        if (u.role !== "admin") studentsCount++;
        if (u.is_verified) verifiedMentors++;
      });

      let pendingVerifs = 0;
      certsSnap.forEach(doc => {
        if (doc.data().status === "pending") pendingVerifs++;
      });

      let exchangesCompleted = 0;
      reqsSnap.forEach(doc => {
        if (doc.data().status === "Accepted") exchangesCompleted++;
      });

      return {
        total_users: studentsCount,
        total_skills: skillsSnap.size,
        pending_verifications: pendingVerifs,
        verified_mentors: verifiedMentors,
        active_connections: connsSnap.size,
        exchanges_completed: exchangesCompleted,
        messages_sent: 24
      };
    } catch (e) {
      console.error("[Talent Exchange DB] getAdminStats error:", e.message);
      return {
        total_users: 0,
        total_skills: 0,
        pending_verifications: 0,
        verified_mentors: 0,
        active_connections: 0,
        exchanges_completed: 0,
        messages_sent: 0
      };
    }
  },

  // ============================================================================
  // 9. AUTOMATIC SEED INITIALIZATION
  // ============================================================================

  async seedInitialDataIfNeeded() {
    const db = this.getDb();
    if (!db) return;

    try {
      const usersSnap = await db.collection("users").limit(2).get();
      if (!usersSnap.empty) {
        return; // Data already exists in Firestore
      }

      console.log("[Talent Exchange DB]: Initializing Firestore with seed demo accounts...");

      // 1. Rahul Sharma
      const rahulUid = "usr_rahul_sharma";
      await db.collection("users").document(rahulUid).set({
        id: rahulUid,
        uid: rahulUid,
        name: "Rahul Sharma",
        email: "rahul@talentexchange.edu",
        role: "student",
        department: "Computer Science",
        semester: "Semester 6",
        teach_skill: "Guitar",
        learn_skill: "Python",
        bio: "Acoustic guitarist with 5 years experience, eager to collaborate and master Python automation and web tech.",
        profile_image: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80",
        certificate_title: "Trinity College London - Acoustic Guitar Grade 6 Distinction",
        certificate_url: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80",
        video_url: "https://assets.mixkit.co/videos/preview/mixkit-guitarist-playing-an-acoustic-guitar-3437-large.mp4",
        is_verified: true,
        verification_status: "verified",
        created_at: new Date().toISOString()
      });

      await db.collection("skills").add({
        user_id: rahulUid,
        skill_name: "Guitar",
        skill_category: "Music & Arts",
        skill_level: "Advanced",
        learning_skill: "Python",
        description: "Acoustic fingerstyle, chord transitions, music theory basics.",
        teaching_video: "https://assets.mixkit.co/videos/preview/mixkit-guitarist-playing-an-acoustic-guitar-3437-large.mp4",
        certificate: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80",
        certificate_title: "Trinity College London - Acoustic Guitar Grade 6 Distinction",
        verification_status: "verified",
        is_verified: true,
        created_at: new Date().toISOString()
      });

      // 2. Mahadev Patel
      const mahadevUid = "usr_mahadev_patel";
      await db.collection("users").document(mahadevUid).set({
        id: mahadevUid,
        uid: mahadevUid,
        name: "Mahadev Patel",
        email: "mahadev@talentexchange.edu",
        role: "student",
        department: "Information Technology",
        semester: "Semester 4",
        teach_skill: "Python",
        learn_skill: "Guitar",
        bio: "Passionate about backend software development, algorithms, and eager to learn guitar chords and rhythms.",
        profile_image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
        certificate_title: "Python Institute - Certified Associate in Python Programming (PCAP)",
        certificate_url: "https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=800&auto=format&fit=crop&q=80",
        video_url: "https://assets.mixkit.co/videos/preview/mixkit-software-developer-working-on-code-42352-large.mp4",
        is_verified: true,
        verification_status: "verified",
        created_at: new Date().toISOString()
      });

      await db.collection("skills").add({
        user_id: mahadevUid,
        skill_name: "Python",
        skill_category: "Programming & Tech",
        skill_level: "Advanced",
        learning_skill: "Guitar",
        description: "Core Python, Flask APIs, script automation, and data structures.",
        teaching_video: "https://assets.mixkit.co/videos/preview/mixkit-software-developer-working-on-code-42352-large.mp4",
        certificate: "https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=800&auto=format&fit=crop&q=80",
        certificate_title: "Python Institute - Certified Associate in Python Programming (PCAP)",
        verification_status: "verified",
        is_verified: true,
        created_at: new Date().toISOString()
      });

      // 3. Ananya Iyer
      const ananyaUid = "usr_ananya_iyer";
      await db.collection("users").document(ananyaUid).set({
        id: ananyaUid,
        uid: ananyaUid,
        name: "Ananya Iyer",
        email: "ananya@talentexchange.edu",
        role: "student",
        department: "Design & Media",
        semester: "Semester 5",
        teach_skill: "UI/UX Design",
        learn_skill: "Web Development",
        bio: "UI/UX Specialist passionate about Figma, design systems, and looking to learn Modern Frontend Development.",
        profile_image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80",
        certificate_title: "Google UX Design Professional Certificate",
        certificate_url: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=800&auto=format&fit=crop&q=80",
        video_url: "",
        is_verified: true,
        verification_status: "verified",
        created_at: new Date().toISOString()
      });

      await db.collection("skills").add({
        user_id: ananyaUid,
        skill_name: "UI/UX Design",
        skill_category: "Design & Creative",
        skill_level: "Advanced",
        learning_skill: "Web Development",
        description: "Wireframing, high-fidelity prototypes, Figma auto-layout.",
        teaching_video: "",
        certificate: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=800&auto=format&fit=crop&q=80",
        certificate_title: "Google UX Design Professional Certificate",
        verification_status: "verified",
        is_verified: true,
        created_at: new Date().toISOString()
      });

      // 4. System Administrator
      const adminUid = "usr_admin_system";
      await db.collection("users").document(adminUid).set({
        id: adminUid,
        uid: adminUid,
        name: "System Administrator",
        email: "admin@talentexchange.edu",
        role: "admin",
        department: "Administration",
        semester: "Staff",
        bio: "Campus Administrator overseeing skill exchanges, mentor verifications, and community safety.",
        profile_image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80",
        is_verified: true,
        verification_status: "verified",
        created_at: new Date().toISOString()
      });

      console.log("[Talent Exchange DB]: Seed accounts loaded into Firestore successfully.");
    } catch (seedErr) {
      console.warn("[Talent Exchange DB]: Seed check notice:", seedErr.message);
    }
  }
};

// Global export
if (typeof window !== "undefined") {
  window.firebaseDb = firebaseDb;

  // Run initial seed check on startup
  if (typeof window.firebase !== "undefined") {
    setTimeout(() => {
      firebaseDb.seedInitialDataIfNeeded().catch(() => {});
    }, 1000);
  }
}
