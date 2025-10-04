// mod.ts

// Impor modul yang dibutuhkan (fetch sudah global di Deno)
import { serve } from "https://deno.land/std@0.211.0/http/server.ts";

// --- KONFIGURASI DAN KREDENSIAL (Ambil dari Environment Variables) ---

// Pastikan semua variabel ini disetel di Deno Deploy Anda!
const BOT_TOKEN = Deno.env.get("BOT_TOKEN");
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const CLIENT_ID = Deno.env.get("CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("CLIENT_SECRET");
const REDIRECT_URI = Deno.env.get("REDIRECT_URI"); // URL publik bot Anda
console.log(BOT_TOKEN)
// Konfigurasi GitHub Repository
const GITHUB_REPO_OWNER = Deno.env.get("GITHUB_REPO_OWNER") || "telokuh";
const GITHUB_REPO_NAME = Deno.env.get("GITHUB_REPO_NAME") || "sonto";
const GITHUB_EVENT_AUTH_INIT = "new_url_received";
const GITHUB_EVENT_TOKEN_RECEIVED = "refresh_token_received";
const GITHUB_DISPATCH_URL = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/dispatches`;

// URL dasar API
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const SCOPE = "https://www.googleapis.com/auth/drive"; // Scope OAuth

// Cek konfigurasi penting saat startup
if (!BOT_TOKEN || !GITHUB_TOKEN || !CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
  console.error("Kesalahan: Variabel lingkungan penting tidak lengkap.");
  // Deno Deploy akan menampilkan error ini di log
}

// --- FUNGSI BANTUAN API ---

/** Mengirim pesan sederhana kembali ke Telegram. */
async function sendMessage(chatId: number | string, text: string, parseMode: 'Markdown' | 'HTML' = 'Markdown') {
  const url = `${TELEGRAM_API}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: parseMode,
    }),
  });
}

/** Mengirim event repository_dispatch ke GitHub Actions. */
async function sendToGithubActions(eventType: string, clientPayload: Record<string, unknown>): Promise<Response> {
  const headers = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": `token ${GITHUB_TOKEN}`,
    "Content-Type": "application/json",
  };

  const payload = {
    event_type: eventType,
    client_payload: clientPayload,
  };

  return await fetch(GITHUB_DISPATCH_URL, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(payload),
  });
}

// --- LOGIKA UTAMA: ENDPOINT WEBHOOK TELEGRAM (Path: /) ---

async function handleTelegramWebhook(update: any) {
  const message = update.message;
  if (!message) return; // Abaikan update non-pesan

  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text;
  const firstName = message.from.first_name || "Pengguna";

  // 1. Tangani Perintah dan Teks Biasa
  if (text) {
    const commandMatch = text.match(/^\/([a-zA-Z]+)/);
    const command = commandMatch ? commandMatch[1].toLowerCase() : null;

    if (command === 'start') {
      const responseText = `Halo, **${firstName}**! 👋\n\nSaya adalah bot webhook **Deno** Anda.\nGunakan \`/auth\` untuk otorisasi Google Drive atau kirimkan URL download.`;
      await sendMessage(chatId, responseText);
      return;
    } 
    
    if (command === 'auth') {
        if (!CLIENT_ID || !REDIRECT_URI) {
            await sendMessage(chatId, "❌ Otorisasi Gagal: Konfigurasi CLIENT_ID atau REDIRECT_URI belum lengkap di lingkungan bot.", 'Markdown');
            return;
        }

        // 1. Rangkai URL Otorisasi Google
        const AUTH_URL = (
            `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${CLIENT_ID}&` +
            `redirect_uri=${REDIRECT_URI}&` +
            `scope=${SCOPE}&` +
            `response_type=code&` +
            `access_type=offline&` +
            `prompt=consent&` +
            `state=${userId}` // Menggunakan user_id sebagai 'state'
        );

        // 2. Buat Teks Pesan HTML
        const formattedAuthUrl = (
            `<b>Perhatian! Klik link di bawah ini untuk Otorisasi:</b>\n\n` +
            `<a href="${AUTH_URL}">KLIK UNTUK OTORISASI GOOGLE DRIVE</a>\n\n` +
            `URL: <code>${AUTH_URL}</code>\n\n` +
            `Anda akan dialihkan kembali ke server bot setelah otorisasi.`
        );

        // 3. Kirim pesan
        try {
            await sendMessage(userId, formattedAuthUrl, 'HTML');
            await sendMessage(chatId, "✅ Tautan otorisasi berhasil dikirim. Cek pesan terbaru Anda.");
        } catch (e) {
            console.error("Gagal mengirim URL otorisasi:", e);
            await sendMessage(chatId, `❌ Gagal mengirim URL otorisasi: Terjadi kesalahan.`);
        }
        return;
    }
    
    // 2. Tangani URL yang Masuk
    if (text.includes("http")) {
      const url = text;
      
      const ghResponse = await sendToGithubActions(GITHUB_EVENT_AUTH_INIT, {
        url: url,
        sender: String(userId),
      });

      if (ghResponse.status === 204) {
        await sendMessage(chatId, `URL terdeteksi: \`${url}\`\n\n📥 Memicu alur download.`);
      } else {
        await sendMessage(chatId, `❌ Gagal mengirim ke GitHub Actions. Status: ${ghResponse.status}`);
      }
      return;
    }
    
    // Jika bukan perintah dan bukan URL
    // Abaikan pesan selain perintah/URL
  }
}

// --- LOGIKA KHUSUS: ENDPOINT OAUTH CALLBACK (Path: /oauth_callback) ---

async function handleOAuthCallback(req: Request, url: URL): Promise<Response> {
  const authCode = url.searchParams.get('code');
  const chatId = url.searchParams.get('state'); // Ini adalah user_id dari permintaan /auth

  if (!authCode) {
    return new Response("❌ Otorisasi Gagal: Tidak ada kode yang diterima.", { status: 400 });
  }

  // 1. Tukar Kode untuk Refresh Token
  try {
    const tokenUrl = "https://oauth2.googleapis.com/token";
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: authCode,
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        redirect_uri: REDIRECT_URI!,
        grant_type: "authorization_code"
      }).toString()
    });

    const tokenData = await tokenResponse.json();
    const refreshToken = tokenData.refresh_token;

    if (!refreshToken) {
        const errorDesc = tokenData.error_description || "Refresh Token tidak ditemukan.";
        return new Response(`❌ Penukaran Gagal: ${errorDesc}.`, { status: 500 });
    }

    // 2. Kirim Refresh Token ke GitHub Actions
    const ghResponse = await sendToGithubActions(GITHUB_EVENT_TOKEN_RECEIVED, {
        refresh_token: refreshToken,
        sender_chat_id: chatId,
    });
    
    // 3. Beri tahu pengguna di Telegram
    if (ghResponse.status === 204) {
        if (chatId) {
            await sendMessage(
                chatId,
                "✅ **Token Otorisasi Berhasil!** Refresh Token Anda sudah diterima dan sedang disimpan di GitHub Secrets.",
                'Markdown'
            );
        }
        return new Response("✅ Token Otorisasi Berhasil Diterima dan sedang diproses di GitHub Actions!", { status: 200 });
    } else {
        return new Response(`❌ Gagal mengirim token ke GitHub Actions: ${ghResponse.status}`, { status: 500 });
    }

  } catch (e) {
    console.error("Kesalahan saat menukar token:", e);
    return new Response(`❌ Kesalahan saat menukar token: Terjadi kesalahan.`, { status: 500 });
  }
}

// --- HANDLER UTAMA Deno ---

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // 1. Routing berdasarkan path URL
  if (url.pathname === "/oauth_callback" && req.method === "GET") {
    // Menangani callback dari Google OAuth
    return handleOAuthCallback(req, url);
  }

  // 2. Routing untuk Webhook Telegram
  if (req.method === "POST" && !url.pathname.includes('.')) {
    // Webhook Telegram harus mengirim POST ke path root atau path yang ditentukan
    try {
      const update = await req.json();
      await handleTelegramWebhook(update);
      
      // PENTING: Respons 200 OK segera setelah update diproses
      return new Response("Update diterima.", { status: 200 });
    } catch (error) {
      console.error("Kesalahan saat memproses webhook:", error);
      // Tetap respons 200 OK agar Telegram tidak mencoba berulang
      return new Response("Kesalahan, tetapi diakui.", { status: 200 });
    }
  }

  // 3. Endpoint Status (untuk cek server)
  if (url.pathname === "/" && req.method === "GET") {
     return new Response(JSON.stringify({ status: "running!" }), {
        headers: { "Content-Type": "application/json" },
        status: 200
     });
  }


  // Respons default jika path tidak ditemukan
  return new Response("Endpoint Not Found", { status: 404 });
}

// Menjalankan Server Deno
console.log("Deno Webhook Server berjalan.");
serve(handler);
