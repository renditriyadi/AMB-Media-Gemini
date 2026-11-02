// Script untuk mengekstrak URL CDN Video Dola TANPA WATERMARK (Unwatermarked Direct CDN)
const https = require('https');

const targetConvId = process.argv[2] || '38417524486555153';

const cookieStr = `i18next=en; passport_csrf_token=f4dbed3b057f6bf55eb94e34036e5f34; passport_csrf_token_default=f4dbed3b057f6bf55eb94e34036e5f34; msToken=9K_tX_2Mfdexk8hbP-WayAv6YseZfBulXpFwmhbC9anmiP-3VYk6IynZFk-xSkdebceClpJzpK-a8maLBYox-0vN5H33lwEh2MUdNxuZIwhfVQnAcVLAR9_Uqq2S4O6_Yl0=; odin_tt=7fafcaac58b4324b6281d61959b5b0d6a6fef3c6e4c29eea11a7cc7adffb48d047358fcc3e8b9a6b039b7591fecb880826ceeb50822168c00b7812960a2e6c4c; uid_tt=2883e5bebb4896c3b872eb0c61b308604bc0e7420c5db9a41416ea24a61499ae; uid_tt_ss=2883e5bebb4896c3b872eb0c61b308604bc0e7420c5db9a41416ea24a61499ae; sid_tt=5a573acd1f7459358bf8affc5966a0c2; sessionid=5a573acd1f7459358bf8affc5966a0c2; sessionid_ss=5a573acd1f7459358bf8affc5966a0c2; has_biz_token=false; store-idc=mya; store-country-code=id; store-country-code-src=uid; flow_user_country=ID; s_v_web_id=verify_ms17nlzy_oMES8RXw_FPDN_4T3t_8rhT_NDaD8IDDaQM5; dbx-web-theme=light; conversation_list_v2_group_mode=none; flow_cur_user_sec_id=Kz9bAGEdJCBsLCAyL3U7RR87Hyd/GRANLBkkRl0HIiRqKz4qEmkAGiMVDS0cBxc0OTYAD0wuKSUeHDRFJkMWJCwiFlZKHz0fMQ8FEQ==; biz_trace_id=61e7eaaa; sid_guard=5a573acd1f7459358bf8affc5966a0c2%7C1789016080%7C5184000%7CMon%2C+09-Nov-2026+04%3A54%3A40+GMT; sid_ucp_v1=1.0.0-KGRkYjlhYzEyNDFhNDc3ODQxZTY2Y2YxMTNkNjYxNDM2MDhmNThhYjkKIAiFiNr0hpzRrWoQkPCI1QYYt6AeIAww35ft0gY4CEASEAMaA215YSIgNWE1NzNhY2QxZjc0NTkzNThiZjhhZmZjNTk2NmEwYzI; ssid_ucp_v1=1.0.0-KGRkYjlhYzEyNDFhNDc3ODQxZTY2Y2YxMTNkNjYxNDM2MDhmNThhYjkKIAiFiNr0hpzRrWoQkPCI1QYYt6AeIAww35ft0gY4CEASEAMaA215YSIgNWE1NzNhY2QxZjc0NTkzNThiZjhhZmZjNTk2NmEwYzI; ttwid=1%7C8PI-N-VMSdT7HtCUAT5mJHlwOVwjdy0rADYlcoZVDr4%7C1789016086%7C8074079496914c5fddf4475b3ecf37df88b5dbb6c0e79898f57391766c4093b8`;

const postData = JSON.stringify({
  cmd: 3200,
  uplink_body: {
    pull_recent_conv_chain_uplink_body: {
      limit: 10,
      message_count_per_conv: 20,
      api_version: 1,
      conv_version: 0,
      direction: 3,
      option: {
        not_need_message: false,
        need_complete_conversation: true,
        need_coco_bot: true,
        need_pc_pin_chain: true,
        pc_pin_query_type: 0,
        exclude_archive: true,
        only_archive: false
      }
    }
  },
  sequence_id: "755ee56a-7608-42b5-87d5-4a511ce573c6",
  channel: 2,
  version: "1"
});

const url = new URL("https://www.dola.com/im/chain/recent_conv?version_code=20800&language=en&device_platform=web&doubao_device_platform=web&aid=495671&real_aid=495671&pkg_type=release_version&device_id=7663802181377164805&pc_version=3.36.0&doubao_pc_version=3.36.0&web_id=7663802672252864021&tea_uuid=7663802672252864021&region=ID&sys_region=ID&samantha_web=1&web_platform=browser&use-olympus-account=1&web_tab_id=5d6de402-df37-4762-971b-093c338df2a1");

console.log(`Mengambil data video unwatermarked dari chat: ${targetConvId} ...`);

const req = https.request({
  hostname: url.hostname,
  path: url.pathname + url.search,
  method: "POST",
  headers: {
    "accept": "application/json, text/plain, */*",
    "agw-js-conv": "str",
    "content-type": "application/json; encoding=utf-8",
    "cookie": cookieStr,
    "origin": "https://www.dola.com",
    "referer": `https://www.dola.com/chat/${targetConvId}`,
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
    "Content-Length": Buffer.byteLength(postData)
  }
}, (res) => {
  let body = "";
  res.on("data", chunk => body += chunk);
  res.on("end", () => {
    try {
      const data = JSON.parse(body);
      const cells = data.downlink_body?.pull_recent_conv_chain_downlink_body?.cells || [];
      const target = cells.find(c => c.id === targetConvId);

      if (!target) {
        console.error(`Percakapan ID ${targetConvId} tidak ditemukan.`);
        return;
      }

      const conv = target.conversation || {};
      let foundVideo = false;

      (conv.messages || []).forEach((m) => {
        let contentBlocks = [];
        try {
          contentBlocks = JSON.parse(m.content);
        } catch (e) {}

        contentBlocks.forEach(b => {
          const creations = b.content?.creation_block?.creations || [];
          creations.forEach(cr => {
            if (cr.video) {
              foundVideo = true;
              console.log(`\n======================================================`);
              console.log(`🎯 DITEMUKAN HASIL VIDEO`);
              console.log(`======================================================`);
              console.log(`Video ID      : ${cr.video.vid}`);
              console.log(`Durasi        : ${cr.video.duration}s`);
              console.log(`Dimensi Asli  : ${cr.video.width}x${cr.video.height}`);

              // Decode video model
              if (cr.video.video_model) {
                try {
                  const vm = JSON.parse(cr.video.video_model);
                  console.log(`Logo Type     : ${vm.logo_type || 'unwatermarked'}`);
                  
                  if (vm.video_list) {
                    Object.keys(vm.video_list).forEach(key => {
                      const item = vm.video_list[key];
                      console.log(`\n--- Format [${key.toUpperCase()}] : ${item.definition} (${item.vwidth}x${item.vheight} @ ${item.fps}fps) ---`);
                      console.log(`Codec         : ${item.codec_type}`);
                      console.log(`File Size     : ${(item.size / (1024 * 1024)).toFixed(2)} MB`);

                      if (item.main_url) {
                        const decodedMain = Buffer.from(item.main_url, 'base64').toString('utf-8');
                        // Ensure HTTPS support
                        const httpsMain = decodedMain.replace(/^http:\/\//i, 'https://');
                        console.log(`\n✨ CDN URL UTAMA (TANPA WATERMARK - HTTPS):`);
                        console.log(httpsMain);
                      }

                      if (item.backup_url_1) {
                        const decodedBackup = Buffer.from(item.backup_url_1, 'base64').toString('utf-8');
                        const httpsBackup = decodedBackup.replace(/^http:\/\//i, 'https://');
                        console.log(`\n✨ CDN URL BACKUP (TANPA WATERMARK - HTTPS):`);
                        console.log(httpsBackup);
                      }
                    });
                  }

                  if (vm.fallback_api) {
                    console.log(`\nFallback API (Official ByteDance VOD):`);
                    console.log(vm.fallback_api);
                  }
                } catch (err) {
                  console.error('Gagal parse video_model:', err);
                }
              }

              console.log(`\n------------------------------------------------------`);
              console.log(`Sebagai perbandingan (Link Download bawaan chat Dola ber-watermark/logo):`);
              console.log(cr.video.download_url);
              console.log(`======================================================\n`);
            }
          });
        });
      });

      if (!foundVideo) {
        console.log(`Belum ada video yang selesai pada chat ini.`);
      }

    } catch (e) {
      console.error('Error:', e);
    }
  });
});

req.write(postData);
req.end();
