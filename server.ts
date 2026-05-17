import express from "express";
import path from "path";
import cors from "cors";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Gupshup Partner configuration
const GUPSHUP_PARTNER_SOLUTION_ID = process.env.GUPSHUP_PARTNER_SOLUTION_ID;
const GUPSHUP_PARTNER_EMAIL = process.env.GUPSHUP_PARTNER_EMAIL;
const GUPSHUP_PARTNER_PASSWORD = process.env.GUPSHUP_PARTNER_PASSWORD;
const GUPSHUP_PARTNER_BASE_URL = process.env.GUPSHUP_PARTNER_BASE_URL || "https://partner.gupshup.io";
const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;

// In a real application, you would generate a partner token using the email and password,
// then use that token to authenticate requests to Gupshup.
async function getGupshupPartnerToken() {
  try {
    const response = await axios.post(`${GUPSHUP_PARTNER_BASE_URL}/partner/v1/auth/login`, {
      email: GUPSHUP_PARTNER_EMAIL,
      password: GUPSHUP_PARTNER_PASSWORD,
    });
    return response.data;
  } catch (error) {
    console.error("Error getting Gupshup token:", error);
    throw new Error("Failed to authenticate with Gupshup.");
  }
}

// API Routes
app.post("/api/whatsapp/onboard", async (req, res) => {
  const { code, waba_id, phone_number_id } = req.body;
  if (!code && !waba_id) {
    return res.status(400).json({ error: "Missing required onboarding data from Meta." });
  }

  try {
    // 1. Get Gupshup Partner Auth Token
    // const partnerTokenResponse = await getGupshupPartnerToken();
    // const partnerToken = partnerTokenResponse.token;

    // 2. Pass the Meta Authorization Code / Oauth token to Gupshup to bind the WABA
    // This assumes Gupshup has an endpoint to process the embedded signup callback.
    // Example:
    /*
    const bindResponse = await axios.post(
      `${GUPSHUP_PARTNER_BASE_URL}/partner/app/${process.env.GUPSHUP_PARTNER_SOLUTION_ID}/onboard-embedded`,
      {
        oauth_code: code,
        waba_id: waba_id,
        phone_number_id: phone_number_id
      },
      { headers: { Authorization: `Bearer ${partnerToken}` } }
    );
    */
    
    // Using mock logic for simulation without valid live credentials here
    console.log(`Onboarding payload received: code=${code}, waba_id=${waba_id}`);
    
    // Simulate assigning credit line
    // e.g. partner.gupshup.io/partner/app/<appId>/assign-credit
    
    res.json({
      success: true,
      message: "Successfully onboarded and linked WhatsApp account to Gupshup.",
      appId: "gupshup-app-12345", // Mock gupshup app id
    });
  } catch (error: any) {
    console.error("Onboarding failed:", error.message || error);
    res.status(500).json({ error: "Onboarding via Gupshup failed." });
  }
});

app.post("/api/whatsapp/assign-credit", async (req, res) => {
  const { appId, creditAmount } = req.body;
  if (!appId || !creditAmount) {
    return res.status(400).json({ error: "Missing appId or creditAmount." });
  }

  try {
    // 1. Get Gupshup Partner Auth Token
    // const partnerTokenResponse = await getGupshupPartnerToken();
    
    // 2. Call Assign Credit Line API
    /*
    await axios.post(
      `${GUPSHUP_PARTNER_BASE_URL}/partner/app/${appId}/credit/assign`,
      { amount: creditAmount },
      { headers: { Authorization: `Bearer ${partnerTokenResponse.token}` } }
    );
    */

    console.log(`Assigned ${creditAmount} credits to App ${appId}`);

    res.json({
      success: true,
      message: `Successfully assigned ${creditAmount} credits.`,
    });
  } catch (error: any) {
    console.error("Credit assignment failed:", error.message || error);
    res.status(500).json({ error: "Failed to assign credit line." });
  }
});

app.get("/api/config", (req, res) => {
  res.json({
    metaAppId: META_APP_ID || "",
    partnerId: GUPSHUP_PARTNER_SOLUTION_ID || "",
  });
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
