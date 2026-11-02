// dola-script2/test_send_chat.cjs
// Script untuk mencoba mengirim chat baru ke Dola dan streaming responnya
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const conversationId = '38418213060839185';
const botId = '7339470689562525703';

const cookieStr = `hook_slardar_session_id=202610201913337970F675FAF47207C5D0; i18next=en; dbx-web-theme=light; conversation_list_v2_group_mode=none; flow_cur_user_sec_id=; flow_user_country=ID; s_v_web_id=verify_mvgl45k1_Jxnx5kNN_fS1J_4T2W_99Up_jzV6wB1QR9On; passport_csrf_token=49b72a814cbb923e3161bfc94bd6fb36; passport_csrf_token_default=49b72a814cbb923e3161bfc94bd6fb36; odin_tt=f7f11b6a0ea1790e63b07563779d80ebd27166470c05af710ed93d78a1bc3c9a52174716ced8457cb1633bc2c4b03a73ecf59f10fa3810da134affb80d9c1d8d72aa30a933eaf5604dfe349bd7d98fce; ttwid=1%7C3s4nOI48eNSbiZhNjVNh1IyXdKJfGQwtc8TMYqpfuIc%7C1792494814%7C1820c5e242c764ca552a3f5ff4314a946bacf18b57c2c4a808c2cba228b42fcd; flow_ssr_sidebar_expand=0`;

const testPrompt = process.argv[2] || "Halo Dola! Berikan 3 pantun lucu tentang programmer dan kopi dalam bahasa Indonesia.";

async function sendChat() {
  console.log(`\n Mengirim chat ke Dola...`);
  console.log(`Prompt: "${testPrompt}"`);
  console.log(`Target Conversation: ${conversationId}\n`);

  const localMessageId = crypto.randomUUID();
  const blockId = crypto.randomUUID();
  const uniqueKey = crypto.randomUUID();

  const payload = {
    client_meta: {
      conversation_id: conversationId,
      bot_id: botId,
      last_section_id: "38418213060839441",
      last_message_index: null,
      local_permissions: [
        { permission_name: "ACCESS_COARSE_LOCATION", status: 3 },
        { permission_name: "ACCESS_FINE_LOCATION", status: 3 },
        { permission_name: "ACCESS_BACKGROUND_LOCATION", status: 3 }
      ]
    },
    messages: [
      {
        local_message_id: localMessageId,
        content_block: [
          {
            block_type: 10000,
            content: {
              text_block: {
                text: testPrompt,
                icon_url: "",
                icon_url_dark: "",
                summary: ""
              },
              pc_event_block: ""
            },
            block_id: blockId,
            parent_id: "",
            meta_info: [],
            extra_info: {},
            append_fields: []
          }
        ],
        message_status: 0
      }
    ],
    option: {
      send_message_scene: "",
      create_time_ms: Date.now(),
      collect_id: "",
      is_audio: false,
      answer_with_suggest: false,
      agent_mode: 2,
      tts_switch: false,
      need_deep_think: 0,
      click_clear_context: false,
      from_suggest: false,
      is_regen: false,
      is_replace: false,
      is_from_click_option: false,
      is_from_click_softlink: false,
      disable_sse_cache: false,
      select_text_action: "",
      is_select_text: false,
      resend_for_regen: false,
      scene_type: 0,
      unique_key: uniqueKey,
      start_seq: 0,
      need_create_conversation: false,
      regen_query_id: [],
      edit_query_id: [],
      regen_instruction: "",
      no_replace_for_regen: false,
      message_from: 0,
      shared_app_name: "",
      shared_app_id: "",
      sse_recv_event_options: { support_chunk_delta: true },
      support_lazy_fetch_stream: true,
      is_ai_playground: false,
      is_old_user: false,
      general_task_param: {
        runtime_type: 0,
        agent_task_param: {},
        project_id: "",
        server_do_compare: true
      },
      recovery_option: {
        is_recovery: false,
        req_create_time_sec: Math.floor(Date.now() / 1000),
        append_sse_event_scene: 0
      },
      message_storage_type: 0,
      related_deleted_message_ids: {},
      connector_info_list: [],
      model_config: { model_item_key: "0", model_extra_params: {} },
      aggregate_params: {
        mention_skill_list: "[]",
        mention_plugin_list: "[]",
        mention_ext: "[{}]",
        conversation_mode: "",
        mode_id: "",
        model_item_key: "0",
        agent_mode: "2",
        reasoning_effort: "",
        provider_id: ""
      }
    },
    user_context: [],
    ext: {
      agent_mode: "2",
      use_deep_think: "0",
      general_task_param: '{"runtime_type":0,"agent_task_param":{},"project_id":"","server_do_compare":true}',
      collection_id: "",
      is_finish: "1",
      commerce_credit_config_enable: "0"
    }
  };

  const queryParams = new URLSearchParams({
    aid: "495671",
    device_id: "7698706250172728837",
    device_platform: "web",
    doubao_device_platform: "web",
    doubao_pc_version: "3.42.0",
    fp: "verify_mvgl45k1_Jxnx5kNN_fS1J_4T2W_99Up_jzV6wB1QR9On",
    language: "en",
    pc_version: "3.42.0",
    pkg_type: "release_version",
    real_aid: "495671",
    region: "ID",
    samantha_web: "1",
    sys_region: "ID",
    tea_uuid: "7698706265970591285",
    tz_name: "Asia/Jakarta",
    "use-olympus-account": "1",
    version_code: "20800",
    web_id: "7698706265970591285",
    web_platform: "browser",
    web_tab_id: "52c893b6-7870-4ef5-9d27-4ec8025f9b59"
  });

  const postData = JSON.stringify(payload);
  const targetPath = `/chat/completion?${queryParams.toString()}`;

  return new Promise((resolve) => {
    const req = https.request({
      hostname: "www.dola.com",
      path: targetPath,
      method: "POST",
      headers: {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9",
        "agw-js-conv": "str, str",
        "content-type": "application/json",
        "cookie": cookieStr,
        "last-event-id": "undefined",
        "origin": "https://www.dola.com",
        "priority": "u=1, i",
        "referer": `https://www.dola.com/chat/${conversationId}`,
        "sec-ch-ua": '"Google Chrome";v="155", "Chromium";v="155", "Not(A:Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
        "x-flow-trace": "04-001e8c948d71650e001bb1e62cfd3d4c-001412f27ff5bca7-01",
        "Content-Length": Buffer.byteLength(postData)
      }
    }, (res) => {
      console.log(`Status Code: ${res.statusCode} ${res.statusMessage}`);
      console.log(`Content-Type: ${res.headers['content-type']}`);
      
      let rawResponse = "";
      let accumulatedText = "";

      res.on("data", (chunk) => {
        const str = chunk.toString('utf-8');
        rawResponse += str;

        // Parse SSE stream events: data: {...}
        const lines = str.split("\n");
        for (const line of lines) {
          if (line.startsWith("data:")) {
            const jsonStr = line.slice(5).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const eventData = JSON.parse(jsonStr);
              // Cek bila ada delta text
              const delta = eventData.delta || "";
              if (delta) {
                process.stdout.write(delta);
                accumulatedText += delta;
              } else if (eventData.messages?.[0]?.content_block?.[0]?.content?.text_block?.text) {
                const fullTxt = eventData.messages[0].content_block[0].content.text_block.text;
                if (fullTxt.length > accumulatedText.length) {
                  const added = fullTxt.slice(accumulatedText.length);
                  process.stdout.write(added);
                  accumulatedText = fullTxt;
                }
              }
            } catch (e) {
              // bukan json lengkap di line ini
            }
          }
        }
      });

      res.on("end", () => {
        fs.writeFileSync(path.join(__dirname, 'raw_chat_send_response.txt'), rawResponse);
        console.log(`\n\n Request selesai. Response disimpan ke raw_chat_send_response.txt`);
        resolve({ statusCode: res.statusCode, rawResponse, accumulatedText });
      });
    });

    req.on("error", (err) => {
      console.error("Request Error:", err);
      resolve({ error: err });
    });

    req.write(postData);
    req.end();
  });
}

sendChat();
