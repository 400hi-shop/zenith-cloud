const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
  })
);

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const safeName = Date.now() + "-" + file.originalname.replace(/\s+/g, "-");
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("File harus berupa gambar"));
    }
    if (!["image/jpeg", "image/png"].includes(file.mimetype)) {
      return cb(new Error("Hanya JPG/PNG"));
    }
    cb(null, true);
  },
});

const sanitizeText = (value) =>
  String(value || "")
    .trim()
    .replace(/[<>]/g, "");

app.post("/confirm", upload.single("proof"), async (req, res) => {
  try {
    if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
      return res.status(500).json({ message: "Bot belum dikonfigurasi" });
    }

    const productName = sanitizeText(req.body.productName);
    const productPrice = sanitizeText(req.body.productPrice);
    const recipient = sanitizeText(req.body.recipient);

    if (!productName || !productPrice || !recipient) {
      return res.status(400).json({ message: "Data belum lengkap" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Bukti transfer wajib" });
    }

    const message = `KONFIRMASI PEMBAYARAN BARU
Produk: ${productName} Harga: Rp${productPrice} Penerima Akun: ${recipient}
Bukti transfer terlampir.`;

    const apiBase = `https://api.telegram.org/bot${BOT_TOKEN}`;

    await fetch(`${apiBase}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: message,
      }),
    });

    const formData = new FormData();
    formData.append("chat_id", ADMIN_CHAT_ID);
    formData.append("caption", message);
    formData.append("photo", fs.createReadStream(req.file.path));

    await fetch(`${apiBase}/sendPhoto`, {
      method: "POST",
      body: formData,
    });

    return res.json({ message: "OK" });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
});

app.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ message: err.message || "Upload error" });
  }
  return next();
});

app.listen(PORT, () => {
  console.log(`Server running on :${PORT}`);
});
