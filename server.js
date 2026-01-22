///sequiert 
const BASIC_USER = "admin";
const BASIC_PASS = "mypassword123";

app.use((req, res, next) => {
  const auth = req.headers.authorization;

  if (!auth) {
    res.set("WWW-Authenticate", 'Basic realm="Secure Area"');
    return res.status(401).send("Authentication required");
  }

  const base64 = auth.split(" ")[1];
  const [user, pass] = Buffer.from(base64, "base64")
    .toString()
    .split(":");

  if (user === BASIC_USER && pass === BASIC_PASS) {
    next();
  } else {
    res.set("WWW-Authenticate", 'Basic realm="Secure Area"');
    res.status(401).send("Access denied");
  }
});
////admin password//


const express = require("express");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");

const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions"); // ✅ MISSING IMPORT
const input = require("input");

const app = express();

/* ===============================
   MIDDLEWARE
================================ */

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: "uploads/" });

/* ===============================
   TELEGRAM SESSION (FIXED)
================================ */

const apiId = 35725264;
const apiHash = "d2e59ed2ba045dc46b4586a181ae8756";

const SESSION_FILE = path.join(__dirname, "telegram.session");

const stringSession = new StringSession(
  fs.existsSync(SESSION_FILE)
    ? fs.readFileSync(SESSION_FILE, "utf8")
    : ""
);

/* ===============================
   ROUTES
================================ */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.post("/upload", upload.single("csvfile"), async (req, res) => {
  try {
    const inviteLink = req.body.link;
    const userMessage = req.body.message;
    const numbers = [];

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on("data", (row) => {
        if (row.phone) numbers.push(row.phone);
      })
      .on("end", async () => {
        console.log("Total numbers:", numbers.length);

        const client = new TelegramClient(
          stringSession,
          apiId,
          apiHash,
          { connectionRetries: 5 }
        );

        // Login (only first time)
        await client.start({
          phoneNumber: async () => await input.text("Telegram number: "),
          phoneCode: async () => await input.text("OTP: "),
          password: async () => await input.text("2FA password (if any): "),
          onError: (err) => console.log(err),
        });

        // ✅ Save session once
        fs.writeFileSync(SESSION_FILE, client.session.save());
        console.log("✅ Telegram session saved");

        for (let phone of numbers) {
          try {
            const finalMessage = userMessage.replace(/{{link}}/g, inviteLink);

            await client.sendMessage(phone, {
              message: finalMessage,
            });

            console.log("Sent:", phone);
            await sleep(5000);
          } catch (err) {
            console.log("Failed:", phone);
          }
        }

       res.status(200).json({ success: true });

      });

  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Something went wrong");
  }
});

/* ===============================
   HELPERS
================================ */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ===============================
   SERVER
================================ */

app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
