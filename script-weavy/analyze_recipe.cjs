/**
 * Script Analisis & Execution Recipe / Flow Weavy AI
 * Target Flow: https://app.weavy.ai/flow/6sRRBUf2tRNMJCN1kmL3OS
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const FIREBASE_API_KEY = 'AIzaSyC-qLy3TFyXMogJPfMkZJ9H_q46hEu1sxI';

// Token akun dari user
const DEFAULT_REFRESH_TOKEN = 'AMf-vBxcpnDvwUcDv1fkIp_67P3ajEWWyECxCJ5UN5XCuRFv_T7KaUyFka6TeNl10aMZNqSRjoSUsVKv_zxGYUlX58uHFUrez087-n9XPBqx1WNyx-yTpLohS02hTL3rT3wIC9mVLybjNDNNxNQJSFQslDM9aBP6B8AsykawWIRWDgM76rhS3_sIAjC69nmouAELYBexpB4Tn65RYHI71zRi1oKPLCFakfjiJbulOdV6o9PIkVl6QeB3rCwPd7wJ-A_4vKlEbwjV7p9EQl2B96NB6lYmtkmDazT1eyKlXQJpNww_llLPITkykRyj_c1pxxIY3BdOGWckcS1U4dJzHFal3Y_oprsUcFnP89EES_t6P3P2CAxGNIXukc8zieicom_NtBlbTzYBRCVxYKfdRMDX1CP92-rwnTpd-YRAnH_b0TxtivePwUfMX-kjW1vYu1zgkI1Dp_VH';

async function getFreshIdToken(refreshToken) {
  const cleanToken = (refreshToken || DEFAULT_REFRESH_TOKEN).trim();
  const resp = await axios.post(
    `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: cleanToken,
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    }
  );
  if (!resp.data || !resp.data.id_token) {
    throw new Error('Gagal mendapatkan ID token dari Firebase Auth.');
  }
  return resp.data.id_token;
}

function extractRecipeId(urlOrId) {
  if (!urlOrId) return '6sRRBUf2tRNMJCN1kmL3OS';
  const match = urlOrId.match(/flow\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  const recipeMatch = urlOrId.match(/recipes?\/([a-zA-Z0-9_-]+)/);
  if (recipeMatch) return recipeMatch[1];
  return urlOrId.trim();
}

async function main() {
  const args = process.argv.slice(2);
  const inputUrl = args[0] || 'https://app.weavy.ai/flow/6sRRBUf2tRNMJCN1kmL3OS';
  let inputToken = DEFAULT_REFRESH_TOKEN;
  
  if (args[1] && !args[1].startsWith('--')) {
    inputToken = args[1];
  }

  const isRunMode = args.includes('--run') || args.includes('--execute');
  const promptIndex = args.indexOf('--prompt');
  const customPrompt = promptIndex !== -1 && args[promptIndex + 1] ? args[promptIndex + 1] : null;
  const modelIndex = args.indexOf('--model');
  const customModel = modelIndex !== -1 && args[modelIndex + 1] ? args[modelIndex + 1] : null;

  const recipeId = extractRecipeId(inputUrl);

  console.log('===============================================================');
  console.log('🔍 WEAVY AI RECIPE / FLOW ANALYZER & RUNNER');
  console.log('===============================================================');
  console.log(`📌 Recipe ID     : ${recipeId}`);
  console.log(`🔗 Target URL    : https://app.weavy.ai/flow/${recipeId}`);

  // 1. Authenticate
  let idToken = '';
  try {
    idToken = await getFreshIdToken(inputToken);
  } catch (err) {
    console.error('❌ Gagal otentikasi akun:', err.message);
    process.exit(1);
  }

  const headers = {
    'Authorization': `Bearer ${idToken}`,
    'Accept': 'application/json, text/plain, */*',
    'X-Weavy-Auth-Provider': 'firebase',
    'x-app-version': '4.1.604',
    'User-Agent': 'WeavyApp/4.1.604 (Dart; iOS/17.4)',
    'Content-Type': 'application/json',
    'x-app-recipeid': recipeId,
  };

  // 2. Fetch User Info
  try {
    const userRes = await axios.get('https://api.weavy.ai/api/v1/users', { headers, timeout: 10000 });
    console.log(`👤 Akun Pemilik  : ${userRes.data?.email || userRes.data?.name || 'Unknown'}`);
    console.log(`💰 Sisa Kredit   : ${userRes.data?.credits} credits`);
  } catch (e) {
    console.warn('⚠️ Tidak dapat mengambil user info:', e.message);
  }

  // 3. Fetch Recipe Data
  let recipeData = null;
  try {
    const recipeRes = await axios.get(`https://api.weavy.ai/api/v1/recipes/${recipeId}`, { headers, timeout: 15000 });
    recipeData = recipeRes.data;
  } catch (e) {
    console.error('❌ Gagal mengambil recipe:', e.response?.data || e.message);
    process.exit(1);
  }

  // Save recipe backup JSON
  const outputJsonPath = path.join(__dirname, `recipe_${recipeId}.json`);
  fs.writeFileSync(outputJsonPath, JSON.stringify(recipeData, null, 2), 'utf-8');
  console.log(`💾 Data mentah recipe tersimpan ke: ${outputJsonPath}`);

  const nodes = recipeData.nodes || [];
  const edges = recipeData.edges || [];

  console.log('\n---------------------------------------------------------------');
  console.log('📋 METADATA RECIPE');
  console.log('---------------------------------------------------------------');
  console.log(`Nama Flow        : "${recipeData.name || 'untitled'}"`);
  console.log(`Visibility       : ${recipeData.visibility}`);
  console.log(`Dibuat           : ${recipeData.createdAt}`);
  console.log(`Terakhir Update  : ${recipeData.updatedAt}`);
  console.log(`Total Node       : ${nodes.length}`);
  console.log(`Total Koneksi    : ${edges.length}`);

  // 4. Diagram Flow / Connections
  console.log('\n---------------------------------------------------------------');
  console.log('🔄 PIPELINE / FLOW CONNECTIONS');
  console.log('---------------------------------------------------------------');
  edges.forEach((edge, i) => {
    const srcNode = nodes.find(n => n.id === edge.source);
    const tgtNode = nodes.find(n => n.id === edge.target);
    const srcName = srcNode?.data?.name || srcNode?.data?.menu?.displayName || srcNode?.type || edge.source;
    const tgtName = tgtNode?.data?.name || tgtNode?.data?.menu?.displayName || tgtNode?.type || edge.target;
    console.log(`[${i + 1}] (${srcName}) [${edge.sourceHandle || 'output'}] ---> (${tgtName}) [${edge.targetHandle || 'input'}]`);
  });

  // 5. Node Breakdown
  console.log('\n---------------------------------------------------------------');
  console.log('🧩 DETAIL MASING-MASING NODE');
  console.log('---------------------------------------------------------------');

  const modelNodes = [];
  let fileNode = null;
  let promptNode = null;

  for (const node of nodes) {
    const nodeType = node.type;
    const nodeData = node.data || {};
    const nodeName = nodeData.name || nodeData.menu?.displayName || nodeType;

    if (nodeType === 'custommodelV2' || nodeType === 'model' || nodeData.kind === 'model' || nodeData.model || (node.id && String(node.id).includes('model'))) {
      modelNodes.push(node);
    } else if (nodeType === 'import' || nodeData.files) {
      fileNode = node;
    } else if (nodeType === 'promptV3' || nodeType === 'prompt' || nodeData.prompt !== undefined) {
      promptNode = node;
    }

    console.log(`\n🔹 [Node ID: ${node.id}]`);
    console.log(`   Tipe         : ${nodeType}`);
    console.log(`   Nama Label   : ${nodeName}`);

    if (nodeData.files && Array.isArray(nodeData.files)) {
      console.log(`   📂 File Input:`);
      nodeData.files.forEach((f, idx) => {
        console.log(`      (${idx + 1}) Name: ${f.name || 'Unnamed'} (${f.width || '?'}x${f.height || '?'})`);
        console.log(`          URL : ${f.url}`);
      });
    }

    if (nodeData.prompt !== undefined) {
      console.log(`   📝 Prompt    : "${nodeData.prompt}"`);
    }

    if (nodeData.params) {
      console.log(`   ⚙️  Parameters:`, JSON.stringify(nodeData.params));
    }
  }

  // 6. Deep Dive into all Model Nodes
  for (let idx = 0; idx < modelNodes.length; idx++) {
    const modelNode = modelNodes[idx];
    console.log('\n===============================================================');
    console.log(`🤖 ANALISIS MENDALAM NODE MODEL #${idx + 1} (Node ID: ${modelNode.id})`);
    console.log('===============================================================');
    const mData = modelNode.data || {};
    const schema = mData.schema || {};
    const modelSchema = schema.model || {};
    const currentModel = mData.params?.model || mData.model || modelSchema.default;
    const availableOptions = modelSchema.options || [];

    console.log(`Nama Node        : ${mData.name || mData.menu?.displayName || modelNode.type}`);
    console.log(`Tipe Node        : ${modelNode.type}`);
    console.log(`Model Aktif      : 🔥 ${currentModel}`);
    console.log(`Thinking Mode    : ${mData.params?.thinking !== undefined ? mData.params.thinking : modelSchema.thinking?.default || false}`);
    console.log(`Temperature      : ${mData.params?.temperature !== undefined ? mData.params.temperature : (mData.params?.temp || 0)}`);

    console.log(`\n📥 Input Handles Yang Tersedia:`);
    const inputHandles = mData.handles?.input || {};
    Object.keys(inputHandles).forEach(k => {
      const h = inputHandles[k];
      console.log(`   • [${k}] (Type: ${h.type}, Required: ${h.required || false}) : ${h.description || h.label || ''}`);
    });

    console.log(`\n📤 Output Handles:`);
    const outputHandles = mData.handles?.output || {};
    Object.keys(outputHandles).forEach(k => {
      const h = outputHandles[k];
      console.log(`   • [${k}] (Type: ${h.type}) : ${h.description || ''}`);
    });

    console.log(`\n📋 PILIHAN MODEL LENGKAP YANG TERSEDIA DI DROPDOWN NODE INI:`);
    console.log(`   (Total: ${availableOptions.length} Model Pilihan)\n`);

    const grouped = {
      'Anthropic Claude': [],
      'Google Gemini': [],
      'OpenAI GPT': [],
      'Meta LLaMA': [],
      'Mistral & Lainnya': []
    };

    availableOptions.forEach(opt => {
      if (opt.startsWith('anthropic/')) grouped['Anthropic Claude'].push(opt);
      else if (opt.startsWith('google/')) grouped['Google Gemini'].push(opt);
      else if (opt.startsWith('openai/')) grouped['OpenAI GPT'].push(opt);
      else if (opt.startsWith('meta-llama/')) grouped['Meta LLaMA'].push(opt);
      else grouped['Mistral & Lainnya'].push(opt);
    });

    for (const [provider, list] of Object.entries(grouped)) {
      if (list.length > 0) {
        console.log(`   🏛️  ${provider}:`);
        list.forEach(m => {
          const isSelected = m === currentModel;
          console.log(`      ${isSelected ? '👉 [TERPILIH]' : '  -'} ${m}`);
        });
        console.log('');
      }
    }
  }

  // 7. Execution History / Result of this recipe
  console.log('===============================================================');
  console.log('📊 HASIL EKSEKUSI TERAKHIR DARI RECIPE INI');
  console.log('===============================================================');

  const primaryModelNode = modelNodes[0];
  const latestGen = primaryModelNode?.data?.generations?.[0];
  const lastBatchId = latestGen?.batchId;

  if (lastBatchId) {
    try {
      const statusRes = await axios.get(
        `https://api.weavy.ai/api/v1/batches/recipes/${recipeId}/batches/${lastBatchId}/status`,
        { headers, timeout: 15000 }
      );
      const batchData = statusRes.data;
      const run = batchData.recipeRuns?.[0];
      const nodeRun = run?.nodeRuns?.find(nr => nr.nodeId === primaryModelNode?.id);

      console.log(`Batch ID         : ${lastBatchId}`);
      console.log(`Status Eksekusi  : ✅ ${run?.status || 'COMPLETED'}`);
      console.log(`Waktu Mulai      : ${run?.startTime}`);
      console.log(`Waktu Selesai    : ${run?.endTime}`);
      if (run?.startTime && run?.endTime) {
        const dur = ((new Date(run.endTime) - new Date(run.startTime)) / 1000).toFixed(1);
        console.log(`Durasi Run       : ⏱️  ${dur} detik`);
      }
      console.log(`Sisa Kredit Akun : ${batchData.remainingCredits} credits`);

      if (nodeRun?.result && nodeRun.result.length > 0) {
        console.log('\n📝 TEKS RESPON DARI MODEL:');
        console.log('---------------------------------------------------------------');
        console.log(nodeRun.result[0].value || JSON.stringify(nodeRun.result[0], null, 2));
        console.log('---------------------------------------------------------------');
      }
    } catch (e) {
      console.warn('⚠️ Gagal fetch batch status detail:', e.message);
    }
  } else if (primaryModelNode?.data?.output?.text?.value) {
    console.log('\n📝 Output Tersimpan di Node:');
    console.log('---------------------------------------------------------------');
    console.log(primaryModelNode.data.output.text.value);
    console.log('---------------------------------------------------------------');
  } else {
    console.log('Belum ada riwayat hasil eksekusi pada recipe ini.');
  }

  // 8. Trigger Run / Execution if --run flag is passed
  if (isRunMode) {
    console.log('\n===============================================================');
    console.log('🚀 MENJALANKAN / RUN EKSEKUSI RECIPE SEKARANG...');
    console.log('===============================================================');

    // Update prompt or model if specified
    if (customPrompt && promptNode) {
      promptNode.data.prompt = customPrompt;
      promptNode.data.result = { prompt: customPrompt };
      console.log(`✏️ Menggunakan custom prompt: "${customPrompt}"`);
    }

    if (customModel && primaryModelNode) {
      if (!primaryModelNode.data.params) primaryModelNode.data.params = {};
      primaryModelNode.data.params.model = customModel;
      console.log(`🤖 Menggunakan custom model: "${customModel}"`);
    }

    // Step A: Save Recipe
    console.log('💾 Menyimpan state Recipe ke Weavy AI...');
    try {
      await axios.post(
        `https://api.weavy.ai/api/v1/recipes/${recipeId}/save`,
        { nodes, edges },
        { headers, timeout: 20000 }
      );
      console.log('✅ Recipe berhasil di-save.');
    } catch (saveErr) {
      console.warn('⚠️ Warning saat save recipe:', saveErr?.response?.data || saveErr.message);
    }

    // Step B: Execute Recipe
    console.log('⚡ Mengirim perintah Execute ke Weavy AI...');
    const execPayload = {
      numberOfRuns: 1,
      nodes,
      edges,
    };

    let execRes = null;
    try {
      execRes = await axios.post(
        `https://api.weavy.ai/api/v1/batches/recipes/${recipeId}/execute`,
        execPayload,
        { headers, timeout: 45000 }
      );
    } catch (bErr) {
      execRes = await axios.post(
        `https://api.weavy.ai/api/v1/recipes/${recipeId}/execute`,
        execPayload,
        { headers, timeout: 45000 }
      );
    }

    const newBatchId = execRes?.data?.batchId || execRes?.data?.runId || execRes?.data?.id;
    console.log(`🎉 Berhasil dikirim! Batch ID: ${newBatchId}`);

    // Step C: Poll for results
    console.log('⏳ Menunggu hasil generasi selesai...');
    let pollAttempts = 0;
    let isCompleted = false;

    while (pollAttempts < 30 && !isCompleted) {
      await new Promise(r => setTimeout(r, 3000));
      pollAttempts++;

      try {
        const pollRes = await axios.get(
          `https://api.weavy.ai/api/v1/batches/recipes/${recipeId}/batches/${newBatchId}/status`,
          { headers, timeout: 10000 }
        );
        const pData = pollRes.data;
        const currentRun = pData.recipeRuns?.[0];
        const runStatus = currentRun?.status;

        process.stdout.write(`\r[Polling ${pollAttempts * 3}s] Status: ${runStatus || 'PROCESSING'}... `);

        if (runStatus === 'COMPLETED') {
          isCompleted = true;
          console.log('\n\n✅ GENERASI SELESAI!');
          const targetNodeRun = currentRun?.nodeRuns?.find(nr => nr.nodeId === primaryModelNode?.id);
          if (targetNodeRun?.result?.[0]?.value) {
            console.log('\n📄 HASIL RESPON MODEL TERBARU:');
            console.log('---------------------------------------------------------------');
            console.log(targetNodeRun.result[0].value);
            console.log('---------------------------------------------------------------');
          }
          console.log(`💰 Sisa kredit akun: ${pData.remainingCredits} credits`);
          break;
        } else if (runStatus === 'FAILED') {
          console.log(`\n❌ Eksekusi gagal: ${currentRun?.error || 'Unknown error'}`);
          break;
        }
      } catch (pollErr) {
        // ignore transient poll error
      }
    }
  }

  console.log('\n===============================================================');
  console.log('💡 CARA RUN SCRIPT INI:');
  console.log('===============================================================');
  console.log('1. Analisis Recipe & Model:');
  console.log(`   node script-weavy/analyze_recipe.cjs https://app.weavy.ai/flow/${recipeId}`);
  console.log('\n2. Eksekusi / Re-run Flow:');
  console.log(`   node script-weavy/analyze_recipe.cjs https://app.weavy.ai/flow/${recipeId} --run`);
  console.log('\n3. Eksekusi dengan Model Baru (misal: Gemini 3.1 Pro / Claude Opus 5):');
  console.log(`   node script-weavy/analyze_recipe.cjs https://app.weavy.ai/flow/${recipeId} --run --model "google/gemini-3.1-pro"`);
  console.log('\n4. Eksekusi dengan Prompt Baru:');
  console.log(`   node script-weavy/analyze_recipe.cjs https://app.weavy.ai/flow/${recipeId} --run --prompt "Tuliskan analisis lengkap gambar input ini"`);
  console.log('===============================================================\n');
}

main().catch(err => {
  console.error('Fatal Error:', err);
});
