/**
 * Script untuk memeriksa status dan kuota kredit Google Flow
 * menggunakan endpoint resmi batchexecute nzlxg dari flow.google.com.
 */

const https = require('https');

const flowBatchexecuteUrl = 'https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=nzlxg&source-path=%2F&bl=boq_labs-ai-sandbox-frontend_20261016.00_p1&f.sid=2036562027302786965&hl=id&_reqid=1870755&rt=c';

const cookies = 'SEARCH_SAMESITE=CgQI0aEB; HSID=Aw3IxTIswhLZrpaJa; SSID=AwQrivB191uch6Faa; APISID=8WQzartv7ni6ZefU/A2r-vxRN5XtMDsvM3; SAPISID=CwA-Lmfzan1Fk7C5/ACWiAWICk689nxO0r; __Secure-1PAPISID=CwA-Lmfzan1Fk7C5/ACWiAWICk689nxO0r; __Secure-3PAPISID=CwA-Lmfzan1Fk7C5/ACWiAWICk689nxO0r; _ga=GA1.1.1815201693.1788671923; AEC=Aaa9EJpg845glN9fIgdVntvfzLBgZ_jkPmHUG9ryC7N_Hln2Xi6M1JrsW_s; SID=g.a000Dgm-eKbebGD8Li2LF4POg12InqTY4c14AA4mDsfKOnqGEhR-HBRnMdrTWoBfBEEOjUDbHwACgYKAa8SARMSFQHGX2MiiYpLrUFwTCMmvx14u_DHeBoVAUF8yKpdm45Eptp4LBC1B-Akj6t90076; __Secure-1PSID=g.a000Dgm-eKbebGD8Li2LF4POg12InqTY4c14AA4mDsfKOnqGEhR-i6qse_RKLFyT8GbpX8goAAACgYKAYkSARMSFQHGX2Mi9-0r83ynu1cXKd1ur4qFYRoVAUF8yKpAC8Okn8mpM_EAKgyZVIuw0076; __Secure-3PSID=g.a000Dgm-eKbebGD8Li2LF4POg12InqTY4c14AA4mDsfKOnqGEhR-nRJL9dSBqhoEWxMTkShobQACgYKAXESARMSFQHGX2MiZkKpb0gG4OnPyYn3l6zi2BoVAUF8yKqIXCrLJsuVpuOlNubGeX3-0076; OSID=g.a000Dwm-eMVLe_32YIPcZ3qkhiJ-2FH8ibP1WW1R9dvPdcs-lysD_npxcxf7FwwKfwVG5IiMxgACgYKAe8SARMSFQHGX2MikbG6fX2KPY8jSLvtjLYGgxoVAUF8yKpDRaA3-Ow38EspB2rbth4w0076; __Secure-OSID=g.a000Dwm-eMVLe_32YIPcZ3qkhiJ-2FH8ibP1WW1R9dvPdcs-lysDw6MxlLfSv7bi2ZmlsvxeqQACgYKAeQSARMSFQHGX2MiHh-c40mtTuYdF3im5IRyYRoVAUF8yKoxG0jOfdwYIiuRElMfTCGq0076; NID=CtsCCAESjQIBOxGDSArM2DqX-_Ccxuer2OQQTEQsAj5QJ4Bw2rQ3tbnCnXRwe0cdN2xnCeta_eoVlYWKQ6KPxsHh7--eeSi2CeutQn0a21Zv5IHUWkAcaLk8xKrZk_6iNOZqLqN6QGRMMGOvAHMV6BlCeLx_K2goLukmIpv5JD6R8EfyrtyspDG4ilWgwIQXwRkmxgpktX0yLTV9rTtI5bxStA-BSW3fI8pqskZdqZKKhlLFSNEfOEH8LBgetgOtfp92o2AHKG7tcH_jElCDiifjJvFB8S2LqpXIP8o0g2pZRKDafcnG66GJ3HKRbndxDDNClejY6IUuHLIeFe0NZ_HltIinDoD0Gv4ONiyFnfE1wWN57ygBMkUB0qwHz29xiIWfiOxVpXzY34nBedA9t2vPhAbpbfpZr8-xAhyTtrdmIZzYmRmRHtgGgo1lcAL7P_V9W0UVmxXvX9I2HQM; __Secure-1PSIDTS=sidts-CjcBkldj_0lrlyUr3l0CXngJ3NkyO7jZKHR9ViowBL0Om97pjkZuhNtuP1o8i3aKznVULm64GpSmEAA; __Secure-1PSIDRTS=sidts-CjcBkldj_0lrlyUr3l0CXngJ3NkyO7jZKHR9ViowBL0Om97pjkZuhNtuP1o8i3aKznVULm64GpSmEAA; __Secure-3PSIDTS=sidts-CjcBkldj_0lrlyUr3l0CXngJ3NkyO7jZKHR9ViowBL0Om97pjkZuhNtuP1o8i3aKznVULm64GpSmEAA; __Secure-3PSIDRTS=sidts-CjcBkldj_0lrlyUr3l0CXngJ3NkyO7jZKHR9ViowBL0Om97pjkZuhNtuP1o8i3aKznVULm64GpSmEAA; _ga_X2GNH8R5NS=GS2.1.s1792238410$o14$g1$t1792241870$j60$l0$h18846019; SIDCC=AKEyXzVWy6-JY9vi6pHo6eAJBDa0g0gLVETE7WqFVvF0p7eyiDWuvoGUzn0glffJ7yIhWpxP3Q; __Secure-1PSIDCC=AKEyXzVN4KaMZWlrI_FkycBeXYLZLoY54xAAFwIsk3cBEUeu6fw4PWZu95QbEP6_rl0jZZUtFAs; __Secure-3PSIDCC=AKEyXzVoIKGcX_E4mpfA_bgs_QnSnAq6OYpWu-BsoE30hhcc0es-zIRp7osedsnmP-dId3ngQbs';
const atToken = 'AFfZSpg0RjcrYiHpyO65M0QcrLNY:1792240753386';
const postPayload = 'f.req=%5B%5B%5B%22nzlxg%22%2C%22%5B%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&at=' + encodeURIComponent(atToken) + '&';

const urlObj = new URL(flowBatchexecuteUrl);
const options = {
  hostname: urlObj.hostname,
  path: urlObj.pathname + urlObj.search,
  method: 'POST',
  headers: {
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    'Cookie': cookies,
    'Origin': 'https://flow.google.com',
    'Referer': 'https://flow.google.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
    'x-same-domain': '1',
    'Content-Length': Buffer.byteLength(postPayload),
  },
};

console.log('Sending Google Flow batchexecute (rpcids=nzlxg) request...');

const req = https.request(options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log(`Response Status: ${res.statusCode}`);
    const match = responseData.match(/"nzlxg",\s*"(\[[^"]+\])"/);
    if (match) {
      const arr = JSON.parse(match[1]);
      const remaining = arr[0];
      const resetUnix = arr[6]?.[0];
      const resetDate = resetUnix ? new Date(resetUnix * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : 'Besok';

      console.log('\n====================================================');
      console.log('       HASIL CEK KREDIT GOOGLE FLOW (REAL-TIME)     ');
      console.log('====================================================');
      console.log(`Status Akun       : AKTIF & VALID (HTTP ${res.statusCode})`);
      console.log(`Sisa Kredit Riil  : ${remaining} / 50 Credits`);
      console.log(`Kredit Terpakai   : ${50 - remaining} Credits`);
      console.log(`Waktu Reset Kredit: ${resetDate}`);
      console.log('Data Mentah RPC   :', arr);
      console.log('====================================================\n');
    } else {
      console.log('Could not find nzlxg response in payload:', responseData.slice(0, 300));
    }
  });
});

req.on('error', (err) => {
  console.error('Request Error:', err.message);
});

req.write(postPayload);
req.end();

