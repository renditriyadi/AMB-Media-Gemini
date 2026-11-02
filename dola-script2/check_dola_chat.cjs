// dola-script2/check_dola_chat.cjs
// Script untuk mengecek dan mengambil response chat Dola dari curl user
const https = require('https');
const fs = require('fs');
const path = require('path');

const conversationId = '38418213060839185';
const cookieStr = `hook_slardar_session_id=202610201913337970F675FAF47207C5D0; i18next=en; dbx-web-theme=light; conversation_list_v2_group_mode=none; flow_cur_user_sec_id=; flow_user_country=ID; s_v_web_id=verify_mvgl45k1_Jxnx5kNN_fS1J_4T2W_99Up_jzV6wB1QR9On; passport_csrf_token=49b72a814cbb923e3161bfc94bd6fb36; passport_csrf_token_default=49b72a814cbb923e3161bfc94bd6fb36; odin_tt=f7f11b6a0ea1790e63b07563779d80ebd27166470c05af710ed93d78a1bc3c9a52174716ced8457cb1633bc2c4b03a73ecf59f10fa3810da134affb80d9c1d8d72aa30a933eaf5604dfe349bd7d98fce; ttwid=1%7C3s4nOI48eNSbiZhNjVNh1IyXdKJfGQwtc8TMYqpfuIc%7C1792495554%7C155014690c951ab2336c7079e000352706a53c8215b1f88d70e541f51020e694; flow_ssr_sidebar_expand=0`;

async function fetchSingleChain() {
  console.log(`\n[1] Memeriksa pesan di percakapan ID ${conversationId} via /im/chain/single...`);
  
  const queryParams = new URLSearchParams({
    version_code: "20800",
    language: "en",
    device_platform: "web",
    doubao_device_platform: "web",
    aid: "495671",
    real_aid: "495671",
    pkg_type: "release_version",
    device_id: "7698706250172728837",
    pc_version: "3.42.0",
    doubao_pc_version: "3.42.0",
    web_id: "7698706265970591285",
    tea_uuid: "7698706265970591285",
    region: "ID",
    sys_region: "ID",
    samantha_web: "1",
    web_platform: "browser",
    "use-olympus-account": "1",
    web_tab_id: "52c893b6-7870-4ef5-9d27-4ec8025f9b59"
  }).toString();

  const postData = JSON.stringify({
    cmd: 3100,
    uplink_body: {
      pull_singe_chain_uplink_body: {
        conversation_id: conversationId,
        anchor_index: 9007199254740991,
        conversation_type: 3,
        direction: 1,
        limit: 20,
        ext: {},
        filter: { index_list: [] },
        evaluate_ab_params: "",
        evaluate_common_params: "",
        option: { lazy_load_strategy: 0 }
      }
    },
    sequence_id: "9058b8d0-d929-4976-b304-3d4fec750e6d",
    channel: 2,
    version: "1"
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: "www.dola.com",
      path: `/im/chain/single?${queryParams}`,
      method: "POST",
      headers: {
        "accept": "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9",
        "agw-js-conv": "str",
        "content-type": "application/json; encoding=utf-8",
        "cookie": cookieStr,
        "origin": "https://www.dola.com",
        "referer": `https://www.dola.com/chat/${conversationId}`,
        "sec-ch-ua": '"Google Chrome";v="155", "Chromium";v="155", "Not(A:Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
        "Content-Length": Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        fs.writeFileSync(path.join(__dirname, 'raw_single_chain.json'), body);
        console.log(`Status Code /im/chain/single: ${res.statusCode}`);
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (e) {
          console.error("Gagal parse JSON:", e.message);
          resolve(null);
        }
      });
    });

    req.on("error", (err) => {
      console.error("Request Error:", err);
      resolve(null);
    });

    req.write(postData);
    req.end();
  });
}

async function fetchRecentConv() {
  console.log(`\n[2] Memeriksa via /im/chain/recent_conv...`);
  
  const queryParams = new URLSearchParams({
    version_code: "20800",
    language: "en",
    device_platform: "web",
    doubao_device_platform: "web",
    aid: "495671",
    real_aid: "495671",
    pkg_type: "release_version",
    device_id: "7698706250172728837",
    pc_version: "3.42.0",
    doubao_pc_version: "3.42.0",
    web_id: "7698706265970591285",
    tea_uuid: "7698706265970591285",
    region: "ID",
    sys_region: "ID",
    samantha_web: "1",
    web_platform: "browser",
    "use-olympus-account": "1",
    web_tab_id: "d23a3868-647d-4961-935c-9676c3db1ef8"
  }).toString();

  const postData = JSON.stringify({
    cmd: 3200,
    uplink_body: {
      pull_recent_conv_chain_uplink_body: {
        limit: 10,
        message_count_per_conv: 10,
        api_version: 1,
        conv_version: 0,
        direction: 3,
        option: {
          not_need_message: false,
          need_complete_conversation: true,
          need_coco_conversation: true,
          need_coco_bot: true
        }
      }
    },
    sequence_id: "d8fa0f06-09d2-4440-aafe-e7f0992ba1a9",
    channel: 2,
    version: "1"
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: "www.dola.com",
      path: `/im/chain/recent_conv?${queryParams}`,
      method: "POST",
      headers: {
        "accept": "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9",
        "agw-js-conv": "str",
        "content-type": "application/json; encoding=utf-8",
        "cookie": cookieStr,
        "origin": "https://www.dola.com",
        "referer": `https://www.dola.com/chat/${conversationId}`,
        "sec-ch-ua": '"Google Chrome";v="155", "Chromium";v="155", "Not(A:Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
        "Content-Length": Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        fs.writeFileSync(path.join(__dirname, 'raw_recent_conv.json'), body);
        console.log(`Status Code /im/chain/recent_conv: ${res.statusCode}`);
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (e) {
          console.error("Gagal parse JSON:", e.message);
          resolve(null);
        }
      });
    });

    req.on("error", (err) => {
      console.error("Request Error:", err);
      resolve(null);
    });

    req.write(postData);
    req.end();
  });
}

function parseAndDisplayMessages(messages) {
  if (!messages || messages.length === 0) {
    console.log("Tidak ada pesan ditemukan.");
    return;
  }

  console.log(`\n=== DAFTAR PESAN (Total: ${messages.length}) ===\n`);
  messages.forEach((msg, i) => {
    const isBot = msg.sender_id === "7339470689562525703" || msg.sender_id === "7241547611541340167";
    const sender = isBot ? "🤖 Dola Assistant" : `👤 User (${msg.sender_id || 'User'})`;
    const time = msg.create_time ? new Date(Number(msg.create_time) * 1000).toLocaleString('id-ID') : '-';
    
    console.log(`----------------------------------------`);
    console.log(`[Pesan #${i+1}] ${sender} | Waktu: ${time} | Msg ID: ${msg.id || msg.index || '-'}`);

    let parsedBlocks = [];
    if (typeof msg.content === 'string') {
      try {
        parsedBlocks = JSON.parse(msg.content);
      } catch (e) {
        console.log(`Konten mentah:\n${msg.content}`);
      }
    } else if (Array.isArray(msg.content)) {
      parsedBlocks = msg.content;
    }

    if (Array.isArray(parsedBlocks)) {
      parsedBlocks.forEach((b, bIdx) => {
        if (b.content?.text_block?.text) {
          console.log(`\n💬 [Teks Respon]:\n${b.content.text_block.text}\n`);
        }
        if (b.content?.search_block || b.content?.reference_block) {
          console.log(`🔍 [Web Search / Grounding]:`, JSON.stringify(b.content.search_block || b.content.reference_block, null, 2));
        }
        if (b.content?.attachment_block?.attachments) {
          console.log(`📎 [Attachments]:`, JSON.stringify(b.content.attachment_block.attachments, null, 2));
        }
        if (b.content?.creation_block?.creations) {
          console.log(`🎨 [Creations (Image/Video)]:`, JSON.stringify(b.content.creation_block.creations, null, 2));
        }
      });
    }
  });
}

async function main() {
  const singleData = await fetchSingleChain();
  let msgs = singleData?.downlink_body?.pull_singe_chain_downlink_body?.messages;

  if (msgs && msgs.length > 0) {
    console.log(`Ditemukan ${msgs.length} pesan di pull_singe_chain!`);
    parseAndDisplayMessages(msgs);
  } else {
    console.log("Tidak ada pesan dari pull_singe_chain, mencoba recent_conv...");
    const recentData = await fetchRecentConv();
    const cells = recentData?.downlink_body?.pull_recent_conv_chain_downlink_body?.cells || [];
    const target = cells.find(c => c.id === conversationId);
    if (target && target.conversation?.messages) {
      console.log(`Ditemukan percakapan ${conversationId} di recent_conv!`);
      parseAndDisplayMessages(target.conversation.messages);
    } else {
      console.log("Pesan tidak ditemukan di recent_conv juga. Cek file raw json.");
      if (cells.length > 0) {
        console.log("Daftar ID percakapan di akun ini:");
        cells.forEach(c => console.log(`- ID: ${c.id} | Nama: ${c.conversation?.name}`));
      }
    }
  }
}

main();
