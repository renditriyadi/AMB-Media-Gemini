// dola-script2/test_with_tokens.cjs
const https = require('https');
const fs = require('fs');
const path = require('path');

// Test 1: exact URL query params with msToken & a_bogus from curl 1
const exactUrl = `https://www.dola.com/chat/completion?aid=495671&device_id=7698706250172728837&device_platform=web&doubao_device_platform=web&doubao_pc_version=3.42.0&fp=verify_mvgl45k1_Jxnx5kNN_fS1J_4T2W_99Up_jzV6wB1QR9On&language=en&pc_version=3.42.0&pkg_type=release_version&real_aid=495671&region=ID&samantha_web=1&sys_region=ID&tea_uuid=7698706265970591285&tz_name=Asia%2FJakarta&use-olympus-account=1&version_code=20800&web_id=7698706265970591285&web_platform=browser&web_tab_id=52c893b6-7870-4ef5-9d27-4ec8025f9b59&msToken=c0Ul3F6QsFbzlkRBPzV7hW1XP4wTDfj1zue23-MjimMR0H_k0vAwNNd1sZkxQh40E-5RQsuwCN1-F_sLbauJHxp41B6gIWnTw6k0bzXh96DjV2eADyvIVM4zhw4ogmx2nxvVPuUplqsnUudnk2ItgrlXUXkv_A3hJYWFLHTm&a_bogus=x7sfDqy7YomROVFG8cpR9WH5H8clNTSynai2STP59oKEyHeT5hpA4rvwGFz8wEtOmSkhNoNHMxTJPfVapW3z-hxkwshDS2if%2FTQ9VUXoZZJRGBig9pgLeRSEov-P0AsYQ%2FQHi5EX6tl92LQ3ZNoPAZKy7KenQ8bMsNPSd5RltxgB64kY1258SP6%3D`;

const cookieStr = `hook_slardar_session_id=202610201913337970F675FAF47207C5D0; i18next=en; dbx-web-theme=light; conversation_list_v2_group_mode=none; flow_cur_user_sec_id=; flow_user_country=ID; s_v_web_id=verify_mvgl45k1_Jxnx5kNN_fS1J_4T2W_99Up_jzV6wB1QR9On; passport_csrf_token=49b72a814cbb923e3161bfc94bd6fb36; passport_csrf_token_default=49b72a814cbb923e3161bfc94bd6fb36; odin_tt=f7f11b6a0ea1790e63b07563779d80ebd27166470c05af710ed93d78a1bc3c9a52174716ced8457cb1633bc2c4b03a73ecf59f10fa3810da134affb80d9c1d8d72aa30a933eaf5604dfe349bd7d98fce; ttwid=1%7C3s4nOI48eNSbiZhNjVNh1IyXdKJfGQwtc8TMYqpfuIc%7C1792494814%7C1820c5e242c764ca552a3f5ff4314a946bacf18b57c2c4a808c2cba228b42fcd; flow_ssr_sidebar_expand=0`;

// Raw body from curl 1
const rawBodyFromCurl = '{"client_meta":{"conversation_id":"38418213060839185","bot_id":"7339470689562525703","last_section_id":"38418213060839441","last_message_index":null,"local_permissions":[{"permission_name":"ACCESS_COARSE_LOCATION","status":3},{"permission_name":"ACCESS_FINE_LOCATION","status":3},{"permission_name":"ACCESS_BACKGROUND_LOCATION","status":3}]},"messages":[{"local_message_id":"4acd0240-cc77-11f1-9751-7790cfdef091","content_block":[{"block_type":10000,"content":{"text_block":{"text":"https://vt.tokopedia.com/t/ZS9D7TvWy126c-SUX5G tolong analisis produk dari link ini dengan dtail","icon_url":"","icon_url_dark":"","summary":""},"pc_event_block":""},"block_id":"c2c7612e-243a-4251-ac09-d68c1adc3c09","parent_id":"","meta_info":[],"extra_info":{},"append_fields":[]}],"message_status":0}],"option":{"send_message_scene":"","create_time_ms":1792494968408,"collect_id":"","is_audio":false,"answer_with_suggest":false,"agent_mode":2,"tts_switch":false,"need_deep_think":0,"click_clear_context":false,"from_suggest":false,"is_regen":false,"is_replace":false,"is_from_click_option":false,"is_from_click_softlink":false,"disable_sse_cache":false,"select_text_action":"","is_select_text":false,"resend_for_regen":false,"scene_type":0,"unique_key":"52bb7b05-78d6-4300-aca5-1657e0f67ae3","start_seq":0,"need_create_conversation":false,"regen_query_id":[],"edit_query_id":[],"regen_instruction":"","no_replace_for_regen":false,"message_from":0,"shared_app_name":"","shared_app_id":"","sse_recv_event_options":{"support_chunk_delta":true},"support_lazy_fetch_stream":true,"is_ai_playground":false,"is_old_user":false,"general_task_param":{"runtime_type":0,"agent_task_param":{},"project_id":"","server_do_compare":true},"recovery_option":{"is_recovery":false,"req_create_time_sec":1792494968,"append_sse_event_scene":0},"message_storage_type":0,"related_deleted_message_ids":{},"connector_info_list":[],"model_config":{"model_item_key":"0","model_extra_params":{}},"aggregate_params":{"mention_skill_list":"[]","mention_plugin_list":"[]","mention_ext":"[{}]","conversation_mode":"","mode_id":"","model_item_key":"0","agent_mode":"2","reasoning_effort":"","provider_id":""}},"user_context":[],"ext":{"agent_mode":"2","use_deep_think":"0","general_task_param":"{\\"runtime_type\\":0,\\"agent_task_param\\":{},\\"project_id\\":\\"\\",\\"server_do_compare\\":true}","collection_id":"","is_finish":"1","commerce_credit_config_enable":"0"}}';

const req = https.request(exactUrl, {
  method: "POST",
  headers: {
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'agw-js-conv': 'str, str',
    'content-type': 'application/json',
    'cookie': cookieStr,
    'last-event-id': 'undefined',
    'origin': 'https://www.dola.com',
    'priority': 'u=1, i',
    'referer': 'https://www.dola.com/chat/38418213060839185',
    'sec-ch-ua': '"Google Chrome";v="155", "Chromium";v="155", "Not(A:Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
    'x-flow-trace': '04-001e8c948d71650e001bb1e62cfd3d4c-001412f27ff5bca7-01',
    'Content-Length': Buffer.byteLength(rawBodyFromCurl)
  }
}, (res) => {
  console.log(`Status Code exact: ${res.statusCode} ${res.statusMessage}`);
  let responseData = "";
  res.on("data", chunk => {
    responseData += chunk.toString();
    process.stdout.write(chunk);
  });
  res.on("end", () => {
    fs.writeFileSync(path.join(__dirname, 'raw_exact_curl.txt'), responseData);
  });
});

req.on("error", (e) => console.error(e));
req.write(rawBodyFromCurl);
req.end();
