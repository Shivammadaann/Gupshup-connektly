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
const META_SYSTEM_TOKEN = process.env.META_SYSTEM_TOKEN;
const EXTENDED_CREDIT_LINE_ID = process.env.EXTENDED_CREDIT_LINE_ID;
const META_API_VERSION = process.env.META_API_VERSION || 'v21.0';

let cachedGupshupToken: { token: string; expiresAt: number } | null = null;

async function getGupshupPartnerToken() {
  if (cachedGupshupToken && cachedGupshupToken.expiresAt > Date.now()) {
    return cachedGupshupToken.token;
  }
  
  if (!GUPSHUP_PARTNER_EMAIL || !GUPSHUP_PARTNER_PASSWORD) {
    throw new Error("Missing Gupshup Partner Email or Password.");
  }

  try {
    const params = new URLSearchParams();
    params.append('email', GUPSHUP_PARTNER_EMAIL);
    params.append('password', GUPSHUP_PARTNER_PASSWORD);

    const response = await axios.post(`${GUPSHUP_PARTNER_BASE_URL}/partner/account/login`, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' }
    });
    
    // As per docs response is {"token": "...", ...}
    const token = response.data?.token;
    if (token) {
      // Token expires in 24 hours, so we'll cache it for 23 hours to be safe
      cachedGupshupToken = {
        token,
        expiresAt: Date.now() + 23 * 60 * 60 * 1000
      }
      return token;
    }
    
    throw new Error("Token not found in response.");
  } catch (error: any) {
    console.error("Error getting Gupshup token:", error.response?.data || error.message);
    throw new Error("Failed to authenticate with Gupshup.");
  }
}

// API Routes

// --- Gupshup Specific APIs ---

app.post("/api/gupshup/app/create", async (req, res) => {
  try {
    const { appName } = req.body;
    if (!appName) return res.status(400).json({ error: "appName is required" });

    const token = await getGupshupPartnerToken();
    const params = new URLSearchParams();
    params.append('name', appName);
    params.append('templateMessaging', 'true');
    params.append('disableOptinPrefUrl', 'false');

    console.log(`Creating Gupshup App with name: ${appName}`);
    const response = await axios.post(`${GUPSHUP_PARTNER_BASE_URL}/partner/app`, params.toString(), {
      headers: {
        'token': token,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    res.json(response.data);
  } catch (error: any) {
    console.error("Gupshup App Create Error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

app.put("/api/gupshup/app/:appId/contact", async (req, res) => {
  try {
    const { contactEmail, contactName, contactNumber } = req.body;
    if (!contactEmail || !contactName || !contactNumber) {
      return res.status(400).json({ error: "contactEmail, contactName, and contactNumber are required" });
    }

    const token = await getGupshupPartnerToken();
    const params = new URLSearchParams();
    params.append('contactEmail', contactEmail);
    params.append('contactName', contactName);
    params.append('contactNumber', contactNumber.toString());

    console.log(`Setting contact details for App ${req.params.appId}`);
    const response = await axios.put(
      `${GUPSHUP_PARTNER_BASE_URL}/partner/app/${req.params.appId}/onboarding/contact`,
      params.toString(),
      {
        headers: {
          'token': token,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error("Gupshup App Contact Update Error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

app.get("/api/gupshup/app/:appId/embed-link", async (req, res) => {
  try {
    const { user, lang, regenerate } = req.query;
    if (!user || !lang) return res.status(400).json({ error: "user and lang are required" });

    const token = await getGupshupPartnerToken();
    console.log(`Generating embed link for App ${req.params.appId}`);
    const response = await axios.get(
      `${GUPSHUP_PARTNER_BASE_URL}/partner/app/${req.params.appId}/onboarding/embed/link`,
      {
        headers: { 'token': token },
        params: { user, lang, regenerate: regenerate === 'true' }
      }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error("Gupshup Embed Link Error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

// --- Meta Manual Authentication Fallback APIs ---
app.post("/api/whatsapp/onboard", async (req, res) => {
  const { code, pin } = req.body;
  let { waba_id, phone_number_id } = req.body;

  if (!code && !waba_id) {
    return res.status(400).json({ error: "Missing required onboarding data from Meta." });
  }

  let businessToken = "";
  
  try {
    console.log(`Onboarding payload received: code=${code}`);

    if (code) {
      // Step 1: Exchange the token code for a business token
      console.log("Step 1: Exchanging code for business token...");
      const tokenResponse = await axios.get(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`, {
        params: {
          client_id: META_APP_ID,
          client_secret: META_APP_SECRET,
          code: code
        }
      });
      businessToken = tokenResponse.data.access_token;
      console.log("Business token obtained.");

      // Attempt to extract WABA ID and Phone Number ID from debug_token if not provided
      if (!waba_id || !phone_number_id) {
        console.log("Fetching WABA ID and Phone Number ID via debug_token...");
        const debugTokenUrl = `https://graph.facebook.com/${META_API_VERSION}/debug_token?input_token=${businessToken}&access_token=${META_APP_ID}|${META_APP_SECRET}`;
        const debugRes = await axios.get(debugTokenUrl);
        const scopes = debugRes.data.data.granular_scopes || [];
        
        scopes.forEach((scope: any) => {
          if (scope.scope === 'whatsapp_business_management' && scope.target_ids) {
            waba_id = waba_id || scope.target_ids[0];
          }
          if (scope.scope === 'whatsapp_business_messaging' && scope.target_ids) {
            phone_number_id = phone_number_id || scope.target_ids[0];
          }
        });
        console.log(`Extracted WABA ID: ${waba_id}, Phone Number ID: ${phone_number_id}`);
      }
    }

    // Step 2: Subscribe to webhooks on the customer’s WABA
    if (businessToken && waba_id) {
      console.log(`Step 2: Subscribing to webhooks for WABA ${waba_id}...`);
      await axios.post(`https://graph.facebook.com/${META_API_VERSION}/${waba_id}/subscribed_apps`, null, {
        headers: { Authorization: `Bearer ${businessToken}` }
      });
      console.log("Successfully subscribed to webhooks.");
    }

    // Step 3: Share credit line with the customer
    if (META_SYSTEM_TOKEN && EXTENDED_CREDIT_LINE_ID && waba_id) {
      console.log(`Step 3: Sharing credit line for WABA ${waba_id}...`);
      const wabaCurrency = "USD";
      await axios.post(
        `https://graph.facebook.com/${META_API_VERSION}/${EXTENDED_CREDIT_LINE_ID}/whatsapp_credit_sharing_and_attach`,
        null,
        {
          params: {
            waba_currency: wabaCurrency,
            waba_id: waba_id,
          },
          headers: { Authorization: `Bearer ${META_SYSTEM_TOKEN}` }
        }
      );
      console.log("Successfully shared credit line.");
    } else {
      console.log("Step 3 Skipped: Missing META_SYSTEM_TOKEN or EXTENDED_CREDIT_LINE_ID.");
    }

    // Step 4: Register the customer’s phone number
    if (businessToken && phone_number_id) {
      console.log(`Step 4: Registering phone number ${phone_number_id}...`);
      const phonePin = pin || "123456";
      await axios.post(`https://graph.facebook.com/${META_API_VERSION}/${phone_number_id}/register`,
        {
          messaging_product: "whatsapp",
          pin: phonePin
        },
        {
          headers: { 
            Authorization: `Bearer ${businessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log("Successfully registered phone number.");
    }

    // Step 5: Send a test message (Optional)
    // Skipping for now, can be triggered separately.

    res.json({
      success: true,
      message: "Successfully completed Embedded Signup Meta API steps.",
      wabaId: waba_id,
      phoneNumberId: phone_number_id
    });
  } catch (error: any) {
    console.error("Onboarding failed:", error.response?.data || error.message || error);
    res.status(500).json({ error: "Onboarding Meta steps failed.", details: error.response?.data });
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

// Gupshup Webhook Handler
app.post("/api/webhooks/gupshup", (req, res) => {
  const event = req.body;
  console.log("Received Gupshup Webhook Event:", JSON.stringify(event, null, 2));
  
  // Here you will handle inbound messages, delivery receipts, and status updates 
  // forwarded to you from Gupshup's infrastructure.
  
  res.status(200).send("OK");
});

app.get("/api/config", (req, res) => {
  res.json({
    metaAppId: META_APP_ID || "",
    partnerId: GUPSHUP_PARTNER_SOLUTION_ID || "",
    metaConfigId: process.env.META_CONFIG_ID || "",
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
