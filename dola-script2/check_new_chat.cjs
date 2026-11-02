// dola-script2/check_new_chat.cjs
const https = require('https');
const fs = require('fs');
const path = require('path');

const targetConvId = '38418121532524817';

const cookieStr = `i18next=en; flow_user_country=ID; odin_tt=637c9af402ce896ab2b4426362ea58c0bcc1089b981b5d6fa6ea043f2392a3952b55db00540fa22709f640c4f38ca8592f2972dbf429ead063ea2b77e174da20; sid_guard=73ef52f81963c753108886878048904e%7C1784896550%7C5184000%7CTue%2C+22-Sep-2026+12%3A35%3A50+GMT; store-idc=mya; store-country-code=id; store-country-code-src=uid; msToken=t7_iu94SXz-lkD1hZPum1fa6nkVcaN8U-GN_BaKfoq6zOY2l4w7sQCA0kp45WXyoQ6xcX2avW_uKwgiVYo3N1da3CTerQi0JQfzMsND5pRcj5yC6itbxuA==; dbx-web-theme=light; conversation_list_v2_group_mode=none; flow_cur_user_sec_id=; s_v_web_id=verify_mvgmct75_PPk8X8Eb_egEc_4FmS_99E7_FIte5jnRgTpC; passport_csrf_token=3a32a9fc2e0fa689b592352d25585c2c; passport_csrf_token_default=3a32a9fc2e0fa689b592352d25585c2c; ttwid=1%7CEAgkhtRSL7oT34ZKBpMiGIeIKVteXDmXL7dgQbQbgvM%7C1792496926%7C8acf44868c8eee950f842526a46bcbd80322a9cc746d754359b7591d0492b6c8`;

const queryParams = new URLSearchParams({
  version_code: "20800",
  language: "en",
  device_platform: "web",
  doubao_device_platform: "web",
  aid: "495671",
  real_aid: "495671",
  pkg_type: "release_version",
  device_id: "7666071784445740597",
  pc_version: "3.42.0",
  doubao_pc_version: "3.42.0",
  web_id: "7666072203264460305",
  tea_uuid: "7666072203264460305",
  region: "ID",
  sys_region: "ID",
  samantha_web: "1",
  web_platform: "browser",
  "use-olympus-account": "1",
  web_tab_id: "a90f026d-6e9a-4690-9482-91879228653a"
}).toString();

const postData = JSON.stringify({
  cmd: 3100,
  uplink_body: {
    pull_singe_chain_uplink_body: {
      conversation_id: targetConvId,
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
  sequence_id: "seq-" + Date.now(),
  channel: 2,
  version: "1"
});

console.log(`Mengambil percakapan ID ${targetConvId} ...`);

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
    "referer": `https://www.dola.com/chat/${targetConvId}`,
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
    "Content-Length": Buffer.byteLength(postData)
  }
}, (res) => {
  let body = "";
  res.on("data", chunk => body += chunk);
  res.on("end", () => {
    fs.writeFileSync(path.join(__dirname, 'raw_new_conv.json'), body);
    try {
      const json = JSON.parse(body);
      const msgs = json.downlink_body?.pull_singe_chain_downlink_body?.messages || [];
      console.log(`HTTP Status: ${res.statusCode} | Total Pesan: ${msgs.length}`);
      
      msgs.forEach((m, idx) => {
        const isBot = m.sender_id === "7339470689562525703" || m.user_type === 2;
        const role = isBot ? "🤖 Dola" : "👤 User";
        console.log(`\n[Pesan #${idx+1}] ${role}:`);
        let contentObj = m.content;
        try {
          contentObj = JSON.parse(m.content);
        } catch (_) {}
        if (Array.isArray(contentObj)) {
          contentObj.forEach(b => {
            if (b.content?.text_block?.text) console.log(b.content.text_block.text);
          });
        } else {
          console.log(contentObj);
        }
      });
    } catch (e) {
      console.error("Parse error:", e);
    }
  });
});

req.on("error", (e) => console.error("Req error:", e));
req.write(postData);
req.end();
