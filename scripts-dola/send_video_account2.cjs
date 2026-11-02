// Script test kirim prompt video ke Dola dengan akun baru dan tangkap respon SSE
const https = require('https');
const crypto = require('crypto');

const promptText = `Dreamina Seedance 2.5 model
Generated video: Realistic mirror selfie video, vertical 9:16, standing in front of a mirror. No dialogue, no speech, no voiceover, silent video with no audio narration. RIGHT hand holds phone up near face for the entire video, never lowers or touches the top. LEFT hand is free, used only for gestures.
0-2s: Right hand holding phone near face, left hand relaxed at side, slight smile, full body visible in mirror.
2-4s: Left hand lifts to gently tug the hem of the top outward, showing the drape and relaxed fit of the fabric.
4-6s: Body turns slightly to a side profile (not fully around, still facing toward the mirror at an angle), left hand smooths down the sleeve, showing the loose fit and fabric texture.
6-8s: Turns back to face the mirror directly, left hand lightly touches the collar/neckline area, showing the fabric near the shoulders.
8-10s: Left hand pinches and gently pulls the fabric at the side of the top, showing the texture and stretch of the material, then releases.
10-12s: Left hand moves down to touch the small brand label near the hem, drawing attention to the detail, then relaxes at side.
12-13s: Weight shifts onto one hip, left hand resting casually on hip, full silhouette of the top clearly visible.
14-15s: Slight handheld micro-movement, freeze near-still on final pose for a clean ending frame., 9:16`;

const cookieStr = `i18next=en; flow_user_country=ID; store-idc=mya; store-country-code=id; store-country-code-src=uid; dbx-web-theme=light; conversation_list_v2_group_mode=none; s_v_web_id=verify_mtv2rg44_7ClBOEkK_2hYM_4nEZ_ABXt_IkFoDnI9eNNc; passport_csrf_token=5f646718f3f0295b87461784631b5b78; passport_csrf_token_default=5f646718f3f0295b87461784631b5b78; oauth_token=dc72dd1f-5930-466d-b1df-82ae35f1c3fc; oauth_token_v2=dc72dd1f-5930-466d-b1df-82ae35f1c3fc; passport_csrf_token_wap_state=0e9d2e1c3gAToVCgoVPZIGYyYmQ1ZTMzNWFhZmQzNTM2ZjFmODBkYjlmMmZhMGU1oU6goVYBoUkAoUQAoUHSAAeQN6FNAKFIrHd3dy5kb2xhLmNvbaFSAqJQTNEIJaZBQ1RJT06goUzZImh0dHBzOi8vd3d3LmRvbGEuY29tL2F1dGgvY2FsbGJhY2uhVNkgMTc5ZGY1M2U5Njk0MmMxOGU2YzU4NmYwYTc3MTA0MzmhVwChRgCiU0EAoVXCok1Mwg%253D%253D; odin_tt=531207442a2574731ebc14291d485a08e24c68d090033ee146d8ae86d6d94854406ffa2fddc05c1728d6674e6a82e6ec029c987229bbb2fa3c5280fed887a6c6; passport_auth_status=b7bc4faf5f9fc9d06b176bb3c5f872d7%2C; passport_auth_status_ss=b7bc4faf5f9fc9d06b176bb3c5f872d7%2C; sid_guard=e53af62a6dea5f13f914bf7e4fb68c62%7C1789017392%7C5184000%7CMon%2C+09-Nov-2026+05%3A16%3A32+GMT; uid_tt=353a6d0c31b789ab8f68c6c06191d2c2faae193641ef65d21cd3346cd68e4be8; uid_tt_ss=353a6d0c31b789ab8f68c6c06191d2c2faae193641ef65d21cd3346cd68e4be8; sid_tt=e53af62a6dea5f13f914bf7e4fb68c62; sessionid=e53af62a6dea5f13f914bf7e4fb68c62; sessionid_ss=e53af62a6dea5f13f914bf7e4fb68c62; has_biz_token=false; sid_ucp_v1=1.0.0-KGE5M2IyOWVmMGMzYWE4NmEzZGZlZTgwYjBjODM3YmRjZWEwN2IwMzgKIAi1iK7uwt-em2oQsPqI1QYYt6AeIAwwjPrZ0QY4CEASEAMaA215YSIgZTUzYWY2MmE2ZGVhNWYxM2Y5MTRiZjdlNGZiNjhjNjI; ssid_ucp_v1=1.0.0-KGE5M2IyOWVmMGMzYWE4NmEzZGZlZTgwYjBjODM3YmRjZWEwN2IwMzgKIAi1iK7uwt-em2oQsPqI1QYYt6AeIAwwjPrZ0QY4CEASEAMaA215YSIgZTUzYWY2MmE2ZGVhNWYxM2Y5MTRiZjdlNGZiNjhjNjI; flow_cur_user_sec_id=Kz9bAGEdJCBsLCAyOh8RFBoqP1d+CAYJCQsrG0IjDANlGgsiJwBQRwMgQzZ6DD8/KA4CJRQ2IhtqLAMZWVcIKDUePR9hXDErDyJaGw==; flow_multi_user_sec_info=Kz9bAGEdJCBsLCAyOh8RFBoqP1d+CAYJCQsrG0IjDANlGgsiJwBQRwMgQzZ6DD8/KA4CJRQ2IhtqLAMZWVcIKDUePR9hXDErDyJaGxcQCg1KAQRJWhpbS0lBQ1wUWVdLVQ==; biz_trace_id=5e40ec47; ttwid=1%7CTaRonh8PzV5d93rMpJqOluHJmcnKwPU_K85SLNVXj6I%7C1789017400%7Ca7517a55c5e2d1bd9bbc6eab49207ad7a5f237549e0cd6b545d0a051c881d363`;

const deviceId = "7657033422301644341";
const webId = "7657033902997292551";
const teaUuid = "7657033902997292551";
const aid = "495671";
const botId = "7339470689562525703"; // Dola Bot
const localConvId = `local_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
const localMsgId = crypto.randomUUID();
const uniqueKey = crypto.randomUUID();
const blockId = crypto.randomUUID();
const webTabId = "21ee6d0d-372f-4005-bee4-c89bb664ce12";

const payload = {
  client_meta: {
    local_conversation_id: localConvId,
    conversation_id: "",
    bot_id: botId,
    last_section_id: "",
    last_message_index: 0
  },
  messages: [{
    local_message_id: localMsgId,
    content_block: [{
      block_type: 10000,
      content: {
        text_block: {
          text: promptText,
          icon_url: "",
          icon_url_dark: "",
          summary: ""
        },
        pc_event_block: ""
      },
      block_id: blockId,
      parent_id: "",
      meta_info: [],
      append_fields: [],
      is_finish: true,
      patch_type: 2
    }],
    message_status: 0
  }],
  option: {
    send_message_scene: "",
    create_time_ms: 0,
    collect_id: "",
    is_audio: false,
    answer_with_suggest: true,
    tts_switch: false,
    need_deep_think: 0,
    click_clear_context: false,
    from_suggest: false,
    is_regen: false,
    is_replace: false,
    disable_sse_cache: false,
    select_text_action: "",
    resend_for_regen: false,
    scene_type: 0,
    unique_key: uniqueKey,
    start_seq: 0,
    need_create_conversation: true,
    conversation_init_option: { need_ack_conversation: true },
    regen_query_id: [],
    edit_query_id: [],
    regen_instruction: "",
    no_replace_for_regen: false,
    message_from: 0,
    shared_app_name: "",
    action_bar_skill_id: 0,
    sse_recv_event_options: { support_chunk_delta: true },
    is_ai_playground: false
  },
  chat_ability: {},
  ext: {
    use_deep_think: "0",
    fp: "verify_mtv2rg44_7ClBOEkK_2hYM_4nEZ_ABXt_IkFoDnI9eNNc",
    use_submit_pipeline: "1",
    commerce_credit_config_enable: "0",
    sub_conv_firstmet_type: "1"
  }
};

const queryParams = new URLSearchParams({
  version_code: "20800",
  language: "en",
  device_platform: "web",
  doubao_device_platform: "web",
  aid: aid,
  real_aid: aid,
  pkg_type: "release_version",
  device_id: deviceId,
  pc_version: "3.36.0",
  doubao_pc_version: "3.36.0",
  web_id: webId,
  tea_uuid: teaUuid,
  region: "ID",
  sys_region: "ID",
  samantha_web: "1",
  web_platform: "browser",
  "use-olympus-account": "1",
  web_tab_id: webTabId
});

const targetUrl = `https://www.dola.com/chat/completion?${queryParams.toString()}`;
console.log("Mengirim request video ke:", targetUrl);

const postBody = JSON.stringify(payload);

const req = https.request(targetUrl, {
  method: "POST",
  headers: {
    "Accept": "text/event-stream",
    "Content-Type": "application/json; encoding=utf-8",
    "agw-js-conv": "str",
    "cookie": cookieStr,
    "origin": "https://www.dola.com",
    "referer": "https://www.dola.com/chat/?from_login=1&origin_landing=https%3A%2F%2Fwww.dola.com%2Fchat%2F&",
    "sec-ch-ua": '"Chromium";v="152", "Not?A_Brand";v="24", "Google Chrome";v="152"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
    "x-tt-passport-csrf-token": "5f646718f3f0295b87461784631b5b78",
    "Content-Length": Buffer.byteLength(postBody)
  }
}, (res) => {
  console.log(`HTTP Status: ${res.statusCode} ${res.statusMessage}`);
  console.log("\n==================== LIVE SSE STREAM DARI DOLA ====================\n");

  let buffer = "";
  res.on("data", (chunk) => {
    const text = chunk.toString("utf-8");
    buffer += text;
    process.stdout.write(text);
  });

  res.on("end", () => {
    console.log("\n==================== SSE STREAM SELESAI ====================\n");
  });
});

req.on("error", (err) => {
  console.error("Request error:", err);
});

req.write(postBody);
req.end();
