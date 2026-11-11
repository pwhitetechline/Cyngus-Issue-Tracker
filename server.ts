import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import bodyParser from "body-parser";
import { Resend } from "resend";
import { initializeApp as initializeClientApp } from "firebase/app";
import { getStorage as getClientStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { initializeApp as initializeAdminApp, getApps as getAdminApps } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import multer from "multer";
import fs from "fs";
import xhr2 from "xhr2";

// Polyfill XMLHttpRequest for Firebase Storage in Node.js
(global as any).XMLHttpRequest = xhr2;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let storage: any;
let adminAuth: any = null;

function getStorageInstance() {
  if (!storage) {
    let firebaseConfig;
    try {
      const configPath = path.join(__dirname, "firebase-applet-config.json");
      firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
      const app = initializeClientApp(firebaseConfig);
      storage = getClientStorage(app);
    } catch (error) {
      console.error("Failed to initialize Firebase Client Storage:", error);
      throw new Error("Cloud storage is not configured properly (Client SDK).");
    }
  }
  return storage;
}

function getAdminAuthInstance() {
  if (!adminAuth) {
    try {
      const configPath = path.join(__dirname, "firebase-applet-config.json");
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (!getAdminApps().length) {
        initializeAdminApp({ projectId: firebaseConfig.projectId });
      }
      adminAuth = getAdminAuth();
    } catch (error) {
      console.error("Failed to initialize Firebase Admin Auth:", error);
    }
  }
  return adminAuth;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB safety cap per upload
  },
});

let resend: Resend | null = null;

function getResend() {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("RESEND_API_KEY is not set. Email functionality will be disabled.");
      return null;
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

async function startServer() {
  console.log("[Server] Starting initialization...");
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(bodyParser.json());

  // Prevent browser caching of SPA HTML shells
  app.use((req, res, next) => {
    if (req.path === '/' || req.path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });
  app.use("/api", (req, res, next) => {
    console.log(`[API Request] ${req.method} ${req.url}`);
    next();
  });

  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      version: "v13-clean",
      timestamp: new Date().toISOString() 
    });
  });

  // Authentication middleware for protected endpoints
  async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing authentication credentials" });
    }

    const idToken = authHeader.split("Bearer ")[1]?.trim();
    if (!idToken) {
      return res.status(401).json({ error: "Unauthorized: Malformed token" });
    }

    const authInstance = getAdminAuthInstance();
    if (!authInstance) {
      console.warn("[Auth Middleware] Admin auth not available, rejecting unverified request");
      return res.status(500).json({ error: "Authentication service unavailable" });
    }

    try {
      const decodedToken = await authInstance.verifyIdToken(idToken);
      (req as any).user = decodedToken;
      next();
    } catch (err: any) {
      console.error("[Auth Middleware] Token verification failed:", err?.message || err);
      return res.status(401).json({ error: "Unauthorized: Invalid or expired authentication token" });
    }
  }

  // Rate limiter map generator
  function createRateLimiter(maxPerMinute: number) {
    const limits = new Map<string, { count: number; resetTime: number }>();
    return function check(ip: string): boolean {
      const now = Date.now();
      const record = limits.get(ip);
      if (!record || now > record.resetTime) {
        limits.set(ip, { count: 1, resetTime: now + 60000 });
        return true;
      }
      if (record.count >= maxPerMinute) {
        return false;
      }
      record.count += 1;
      return true;
    };
  }

  const checkEmailRateLimit = createRateLimiter(20);
  const checkUploadRateLimit = createRateLimiter(30);

  // Protected email dispatch endpoint
  app.post("/api/send-email", requireAuth, async (req, res) => {
    const user = (req as any).user;
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";

    if (!checkEmailRateLimit(clientIp)) {
      console.warn(`[Email API] Rate limit exceeded for IP: ${clientIp}`);
      return res.status(429).json({ error: "Email rate limit exceeded. Please wait a minute before sending more emails." });
    }

    const { to, subject, html } = req.body;
    if (!to || !subject || !html) {
      return res.status(400).json({ error: "Missing required fields: to, subject, and html are required." });
    }

    const resendClient = getResend();
    if (!resendClient) {
      console.warn("[Email API] Resend client not initialized (missing API key)");
      return res.status(500).json({ error: "Email service not configured" });
    }

    try {
      const normalizedTo = typeof to === "string" 
        ? to.trim().toLowerCase() 
        : Array.isArray(to) 
          ? to.map((e: any) => String(e).trim().toLowerCase()) 
          : to;

      console.log(`[Email API] Authenticated request from ${user?.email || user?.uid} to send email to ${normalizedTo}`);

      const data = await resendClient.emails.send({
        from: "Web Direct Brands <notifications@resend.dev>",
        to: normalizedTo,
        subject,
        html,
      });

      if (data.error) {
        console.error("[Email API] Resend returned error:", data.error);
        return res.status(data.error.statusCode || 400).json({ 
          error: data.error.message, 
          name: data.error.name,
          details: data.error 
        });
      }

      console.log(`[Email API] Email dispatched successfully to ${normalizedTo}, ID: ${data.data?.id}`);
      return res.json({ success: true, id: data.data?.id });
    } catch (error: any) {
      console.error("[Email API] Error sending email:", error);
      return res.status(500).json({ error: error?.message || "Failed to send email" });
    }
  });

  // Allowed MIME types for uploaded attachments
  const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/bmp",
    "image/tiff",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/csv",
    "text/tab-separated-values",
    "text/markdown",
    "text/x-log",
    "application/json"
  ]);

  // Allowed file extensions
  const ALLOWED_EXTENSIONS = new Set([
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".tiff",
    ".pdf", ".doc", ".docx", ".txt", ".csv", ".log", ".text", ".tsv", ".json", ".md"
  ]);

  // Explicitly prohibited dangerous executable / script extensions
  const PROHIBITED_EXTENSIONS = new Set([
    ".exe", ".sh", ".bat", ".cmd", ".com", ".vbs", ".js", ".mjs", ".php",
    ".py", ".rb", ".html", ".htm", ".xhtml", ".jsp", ".asp", ".aspx", ".jar", ".scr", ".dll"
  ]);

  app.post("/api/upload", requireAuth, upload.single("file"), async (req, res) => {
    const user = (req as any).user;
    console.log(`[Upload API] Authenticated request from user: ${user?.uid || "unknown"}`);
    
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkUploadRateLimit(clientIp)) {
        console.warn(`[Upload API] Rate limit exceeded for IP: ${clientIp}`);
        return res.status(429).json({ error: "Upload rate limit exceeded. Please wait a minute before uploading more files." });
      }

      if (!req.file) {
        console.error("[Upload API] No file in request");
        return res.status(400).json({ error: "No file uploaded" });
      }

      const originalName = req.file.originalname || "attachment";
      const ext = path.extname(originalName).toLowerCase();
      const rawMime = (req.file.mimetype || "").toLowerCase().trim();
      const baseMime = rawMime.split(";")[0].trim();

      // Check for prohibited executable or script file extensions
      if (PROHIBITED_EXTENSIONS.has(ext)) {
        console.warn(`[Upload API] Blocked prohibited extension: ${ext}`);
        return res.status(400).json({ error: `File type "${ext}" is not permitted for security reasons.` });
      }

      // Check extension allowlist
      const isAllowedExt = ALLOWED_EXTENSIONS.has(ext);

      // Check MIME type allowlist (allows text/*, images, and octet-stream when extension is approved)
      const isAllowedMime = 
        ALLOWED_MIME_TYPES.has(baseMime) ||
        baseMime.startsWith("text/") ||
        baseMime.startsWith("image/") ||
        (isAllowedExt && (baseMime === "application/octet-stream" || baseMime === "application/x-download" || !baseMime));

      if (!isAllowedExt || !isAllowedMime) {
        console.warn(`[Upload API] Rejected file: ${originalName} (Raw MIME: "${rawMime}", Base MIME: "${baseMime}", Ext: "${ext}")`);
        return res.status(400).json({ 
          error: `File "${originalName}" is not an accepted format. Allowed formats: Text & Logs (.txt, .log, .csv, .md, .json), PDF (.pdf), Word (.doc, .docx), and Images (.png, .jpg, .webp, .svg, .gif).` 
        });
      }

      // Safe canonical destination path construction (prevents directory traversal)
      const sanitizedBaseName = path.basename(originalName).replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const issueId = req.body.issueId ? String(req.body.issueId).replace(/[^a-zA-Z0-9_-]/g, "") : "general";
      const timestamp = Date.now();
      const canonicalDestination = `issues/${issueId}/attachments/${timestamp}_${sanitizedBaseName}`;

      console.log(`[Upload API] Storing validated ${sanitizedBaseName} (${req.file.size} bytes, MIME: ${baseMime}) to ${canonicalDestination}`);
      
      try {
        const storageInstance = getStorageInstance();
        const fileRef = storageRef(storageInstance, canonicalDestination);
        
        const uploadResult = await uploadBytes(fileRef, new Uint8Array(req.file.buffer), {
          contentType: baseMime || "text/plain"
        });
        
        const url = await getDownloadURL(uploadResult.ref);
        console.log(`[Upload API] Firebase Upload successful: ${url}`);
        return res.json({ name: sanitizedBaseName, url });
      } catch (firebaseError) {
        console.warn("[Upload API] Firebase Storage failed, using local fallback:", firebaseError);
        
        // Local Fallback: Save safely to public/uploads
        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const localFileName = `${timestamp}_${sanitizedBaseName}`;
        const localPath = path.join(uploadsDir, localFileName);
        fs.writeFileSync(localPath, req.file.buffer);
        
        const localUrl = `/uploads/${localFileName}`;
        console.log(`[Upload API] Local Fallback successful: ${localUrl}`);
        return res.json({ name: sanitizedBaseName, url: localUrl });
      }
    } catch (error) {
      console.error("[Upload API] Fatal error:", error);
      res.status(500).json({ 
        error: "Failed to upload file", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Handle 404s for API routes specifically
  app.use("/api/*", (req, res) => {
    res.status(404).json({ 
      error: "API endpoint not found", 
      path: req.originalUrl,
      method: req.method 
    });
  });

  // Serve local uploads
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // Vite middleware for development or static dist files for production
  if (process.env.NODE_ENV !== "production") {
    console.log("[Server] Initializing Vite...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("[Server Error]", err);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: err.message 
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("[Fatal] Failed to start server:", err);
});
