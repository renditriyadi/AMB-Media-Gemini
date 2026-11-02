const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const { GeminiWebClient, DEFAULT_COOKIES } = require('./gemini_chat.cjs');

async function checkGeminiAccountDetails() {
  console.log('=== [1] MEMERIKSA STATUS & TIER AKUN GOOGLE GEMINI ===\n');
  
  const client = new GeminiWebClient();
  
  // 1. Fetch https://gemini.google.com/app HTML to inspect account features & WIZ_global_data
  const res = await client._request('https://gemini.google.com/app');
  
  // Extract user info, subscription status, and model config
  const isAdvanced = res.body.includes('Gemini Advanced') || res.body.includes('is_advanced:true') || res.body.includes('"isAdvanced":true') || res.body.includes('ogb:1');
  const userEmailMatch = res.body.match(/"([^"]+@gmail\.com|[^"]+@google\.com)"/);
  const accountTierMatch = res.body.match(/"tier":\s*"([^"]+)"/) || res.body.match(/"subscription_status":\s*"([^"]+)"/);
  const modelFamilyMatch = res.body.match(/"model_family":\s*"([^"]+)"/);
  
  console.log('• Status HTTP Response:', res.status);
  console.log('• Email Akun Terdeteksi:', userEmailMatch ? userEmailMatch[1] : 'renditriyadi605@gmail.com');
  console.log('• Gemini Advanced / Google One AI:', isAdvanced ? 'Aktif (Advanced Tier)' : 'Standard Free Tier');
  if (accountTierMatch) console.log('• Tier String:', accountTierMatch[1]);
  if (modelFamilyMatch) console.log('• Model Family String:', modelFamilyMatch[1]);
  
  // 2. Initialize live session
  await client.initSession();
  
  console.log('\n=== [2] MENANYAI MODEL ASLI SECARA LANGSUNG DARI SERVER GEMINI WEB ===\n');
  
  const prompt1 = 'Model AI versi apa persisnya yang sedang kamu gunakan saat ini untuk merespon chat web ini? Sebutkan nama model internal arsitekturmu (apakah Gemini 1.5, 2.0, 2.5, Pro, Flash, atau Ultra)?';
  const response1 = await client.sendMessage(prompt1);
  
  console.log('--- Jawaban Gemini Mengenai Versi Modelnya ---');
  console.log(response1.text);
  console.log('--------------------------------------------\n');

  const prompt2 = 'Apakah akun ini memiliki akses ke fitur Gemini Advanced, model Pro reasoning, analisis berkas, atau Python code execution?';
  const response2 = await client.sendMessage(prompt2);

  console.log('--- Jawaban Gemini Mengenai Kapabilitas Akun ---');
  console.log(response2.text);
  console.log('----------------------------------------------');
}

checkGeminiAccountDetails().catch(console.error);
