import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import bodyParser from "body-parser";
import { Resend } from "resend";
import { initializeApp as initializeClientApp } from "firebase/app";
import { getStorage as getClientStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import multer from "multer";
import fs from "fs";
import xhr2 from "xhr2";

// Polyfill XMLHttpRequest for Firebase Storage in Node.js
(global as any).XMLHttpRequest = xhr2;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let storage: any;

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
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

// API routes
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

  app.post("/api/send-email", async (req, res) => {
    const { to, subject, html } = req.body;
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

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    console.log("[Upload API] Received request");
    try {
      if (!req.file) {
        console.error("[Upload API] No file in request");
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { path: destinationPath } = req.body;
      if (!destinationPath) {
        console.error("[Upload API] No destination path in request");
        return res.status(400).json({ error: "No destination path provided" });
      }

      console.log(`[Upload API] Uploading ${req.file.originalname} (${req.file.size} bytes) to ${destinationPath}`);
      
      try {
        const storageInstance = getStorageInstance();
        const fileRef = storageRef(storageInstance, destinationPath);
        
        const uploadResult = await uploadBytes(fileRef, new Uint8Array(req.file.buffer), {
          contentType: req.file.mimetype
        });
        
        const url = await getDownloadURL(uploadResult.ref);
        console.log(`[Upload API] Firebase Upload successful: ${url}`);
        return res.json({ name: req.file.originalname, url });
      } catch (firebaseError) {
        console.warn("[Upload API] Firebase Storage failed, using local fallback:", firebaseError);
        
        // Local Fallback: Save to public/uploads
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const fileName = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
        const localPath = path.join(uploadsDir, fileName);
        fs.writeFileSync(localPath, req.file.buffer);
        
        const localUrl = `/uploads/${fileName}`;
        console.log(`[Upload API] Local Fallback successful: ${localUrl}`);
        return res.json({ name: req.file.originalname, url: localUrl });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Vite middleware for development
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
}

startServer().catch(err => {
  console.error("[Fatal] Failed to start server:", err);
});
