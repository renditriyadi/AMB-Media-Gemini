// dola-script2/view_analysis.cjs
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'raw_single_chain.json'), 'utf-8'));
const messages = raw.downlink_body?.pull_singe_chain_downlink_body?.messages || [];

console.log(`Total messages in chain: ${messages.length}`);

// Temukan pesan balasan bot
const botMsg = messages.find(m => m.sender_id === "7339470689562525703" || m.user_type === 2);
if (botMsg) {
  let contentBlocks = [];
  try {
    contentBlocks = JSON.parse(botMsg.content);
  } catch (e) {
    console.error("Parse error:", e);
  }

  let fullMarkdown = "";
  let searchResults = [];

  contentBlocks.forEach(b => {
    if (b.block_type === 10025 && b.content?.search_query_result_block) {
      searchResults = b.content.search_query_result_block.results || [];
    }
    if (b.block_type === 10000 && b.content?.text_block?.text) {
      fullMarkdown += b.content.text_block.text;
    }
  });

  const mdPath = path.join(__dirname, 'response_analisis_produk.md');
  let fileContent = `# Hasil Analisis Produk dari Dola AI\n\n`;
  fileContent += `> Sumber link: \`https://vt.tokopedia.com/t/ZS9D7TvWy126c-SUX5G\`\n\n`;
  fileContent += fullMarkdown + `\n\n---\n## Sumber & Referensi Pencarian Dola\n\n`;
  searchResults.forEach((r, idx) => {
    if (r.text_card) {
      fileContent += `${idx + 1}. [${r.text_card.title}](${r.text_card.url})\n`;
    }
  });

  fs.writeFileSync(mdPath, fileContent);
  console.log(`Berhasil mengekstrak response Dola ke file: ${mdPath}`);
  console.log(`\nPratinjau isi:\n`);
  console.log(fullMarkdown.substring(0, 1000) + '...\n');
}
