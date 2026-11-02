import React, { useState } from 'react';
import { Check, Copy, Sparkles, Film, ArrowRight, ScanEye, AlertTriangle } from 'lucide-react';
import {
  ChatStoryboardCopilotCard,
  extractStoryboardProjectFromData,
  StoryboardCopilotProject,
} from './ChatStoryboardCopilotCard';

interface CleanMessageRendererProps {
  content: string;
  isUser?: boolean;
  onSendToGenerateVideo?: (prompt: string) => void;
  onNavigateStudio?: (project?: any) => void;
}

export function hasStoryboardProject(text: string): boolean {
  if (!text) return false;
  return (
    text.includes('storyboard_project') ||
    text.includes('storyboard-project') ||
    text.includes('copilot_storyboard') ||
    text.includes('storyboard_copilot') ||
    (text.includes('"scenes"') &&
      (text.includes('"visualDescription"') ||
        text.includes('"sceneNumber"') ||
        text.includes('"cameraAngle"') ||
        text.includes('"shoots"')))
  );
}

// Utility to completely strip markdown syntax for clean text copying or raw export
export function cleanPlainText(text: string): string {
  if (!text) return '';
  return text
    // Remove [Thinking]...[/Thinking] or <thinking>...</thinking> blocks
    .replace(/\[Thinking\][\s\S]*?\[\/Thinking\]/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    // Remove weavy_generate & weavy_repost blocks
    .replace(/```(weavy_generate|weavy_repost)[\s\S]*?```/gi, '')
    // Remove markdown headers (#, ##, ###, ####, etc.)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove horizontal rules (---, ***, ___)
    .replace(/^(\*{3,}|-{3,}|_{3,})$/gm, '')
    // Clean bullet symbols at start of line (*, -, +) into simple clean bullet
    .replace(/^(\s*)[\*\-\+]\s+/gm, '$1• ')
    // Remove bold/italic symbols (**text**, *text*, __text__, _text_)
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Remove strikethrough
    .replace(/~~(.*?)~~/g, '$1')
    // Remove inline code ticks
    .replace(/`([^`]+)`/g, '$1')
    // Convert markdown links [text](url) to text (url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    // Collapse excess empty lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Helper to format inline styling: bold, italic, code, links
function renderInlineContent(text: string): React.ReactNode[] {
  // Tokenize string with regex capturing markdown inline patterns and @img references
  const tokens: React.ReactNode[] = [];
  // Regex matches: code `...`, bold **...**, italic *...* or _..._, links [...](...), @img\d+, @vid\d+, @video\d+
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|(?<!\*)\*[^*]+(?!\*)|(?<!_)_[^_]+(?!_)|\[[^\]]+\]\([^)]+\)|@img\d+|@vid\d+|@video\d+)/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];

    if (token.startsWith('`') && token.endsWith('`')) {
      // Inline Code
      tokens.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-white/10 text-amber-300 dark:text-amber-300 font-mono text-[11px] sm:text-xs"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (
      (token.startsWith('**') && token.endsWith('**')) ||
      (token.startsWith('__') && token.endsWith('__'))
    ) {
      // Bold text
      tokens.push(
        <strong key={match.index} className="font-semibold text-stone-900 dark:text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (
      (token.startsWith('*') && token.endsWith('*')) ||
      (token.startsWith('_') && token.endsWith('_'))
    ) {
      // Italic text
      tokens.push(
        <em key={match.index} className="italic text-stone-700 dark:text-stone-300">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('[') && token.includes('](')) {
      // Link
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        tokens.push(
          <a
            key={match.index}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        tokens.push(token);
      }
    } else if (token.toLowerCase().startsWith('@img')) {
      // Highlight @img references (e.g. @img1, @img2, @img10)
      tokens.push(
        <span
          key={match.index}
          className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded bg-amber-500/20 border border-amber-500/35 text-amber-300 font-mono font-semibold text-[11px] sm:text-xs select-none"
        >
          {token}
        </span>
      );
    } else if (token.toLowerCase().startsWith('@vid')) {
      // Highlight @vid or @video references (e.g. @vid1, @video1)
      tokens.push(
        <span
          key={match.index}
          className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded bg-sky-500/20 border border-sky-500/35 text-sky-300 font-mono font-semibold text-[11px] sm:text-xs select-none"
        >
          {token}
        </span>
      );
    } else {
      tokens.push(token);
    }

    lastIndex = regex.lastIndex;
  }

  // Push remainder
  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens.length > 0 ? tokens : [text];
}

// Code block or dedicated Prompt Card with 1-click copy button and Video Generator redirection
const CodeBlock: React.FC<{
  language: string;
  code: string;
  onSendToGenerateVideo?: (prompt: string) => void;
  onNavigateStudio?: (project?: any) => void;
}> = ({ language, code, onSendToGenerateVideo, onNavigateStudio }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const langLower = (language || '').toLowerCase();
  const isStoryboardProject =
    langLower.includes('storyboard_project') ||
    langLower.includes('storyboard') ||
    langLower.includes('copilot') ||
    (code.includes('"scenes"') && (code.includes('"visualDescription"') || code.includes('"duration"') || code.includes('"title"')));

  const isProductCard =
    langLower.includes('product_card') ||
    (code.includes('"store"') && code.includes('"price"') && (code.includes('"usps"') || code.includes('"thumbnail_url"')));

  // Render Rich Storyboard Project Card (Identical to ektension-weavy)
  if (isStoryboardProject) {
    const sbProject = extractStoryboardProjectFromData(code);
    if (sbProject && sbProject.scenes && sbProject.scenes.length > 0) {
      return (
        <div className="my-2.5 w-full">
          <ChatStoryboardCopilotCard
            project={sbProject}
            onApplyStoryboard={onNavigateStudio}
            onSendToGenerateVideo={onSendToGenerateVideo}
          />
        </div>
      );
    }
  }

  // Render Product Card (AI Worker • Product Extractor - 100% Identical to Extension)
  if (isProductCard) {
    let parsed: any = null;
    try {
      parsed = JSON.parse(code);
    } catch {
      const match = code.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch {}
      }
    }

    if (parsed && (parsed.title || parsed.store || parsed.price)) {
      const platform = parsed.platform || "Tokopedia / TikTok Shop";
      const store = parsed.store || parsed.author_name || "";
      const price = parsed.price || "";
      const usps = Array.isArray(parsed.usps) ? parsed.usps : [];

      return (
        <div className="my-3 rounded-2xl overflow-hidden border border-amber-500/20 bg-[#121318]/95 shadow-2xl select-none font-sans">
          {/* Header */}
          <div className="px-4 py-3 bg-[#171922] border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              <span className="text-[11px] font-bold text-amber-400 tracking-wider flex items-center gap-1">
                ⚡ AI WORKER • PRODUCT EXTRACTOR
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-stone-300 border border-white/10">
              {platform}
            </span>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            <div>
              <h4 className="text-sm font-bold text-white tracking-tight leading-snug">
                {parsed.title}
              </h4>
              {store && (
                <div className="text-xs text-stone-400 mt-1 flex items-center gap-1.5">
                  <span>🏪 Toko/Kreator:</span>
                  <span className="font-semibold text-stone-200">
                    {store.startsWith("@") ? store : `@${store}`}
                  </span>
                </div>
              )}
              {price && (
                <div className="text-base font-bold text-emerald-400 font-mono mt-1.5">
                  {price}
                </div>
              )}
            </div>

            {parsed.description && (
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-stone-300 leading-relaxed">
                {parsed.description}
              </div>
            )}

            {usps.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {usps.map((usp: string, uIdx: number) => (
                  <span
                    key={uIdx}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-blue-950/40 text-blue-300 border border-blue-800/40 flex items-center gap-1"
                  >
                    ✨ {usp}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }
  }

  const isVideoPrompt =
    langLower.includes('video') ||
    langLower.includes('sora') ||
    langLower.includes('runway') ||
    langLower.includes('kling') ||
    langLower.includes('minimax') ||
    langLower.includes('veo') ||
    langLower.includes('luma');

  const isFashion15s =
    code.includes('15-second') ||
    code.includes('0–3 SECONDS') ||
    code.includes('0-3 SECONDS') ||
    code.includes('TikTok fashion') ||
    code.includes('COLOR AND DESIGN LOCK');

  const isNaturalVideo =
    code.includes('OPENING CANDID BEAT') ||
    code.includes('NATURAL MID-MOVEMENT') ||
    code.includes('ORGANIC DETAIL GLIMPSE') ||
    code.includes('RELAXED CLOSING BEAT') ||
    code.includes('Organic Non-Rigid') ||
    code.includes('organic narrative');

  const isPromptCard =
    isVideoPrompt ||
    isFashion15s ||
    isNaturalVideo ||
    langLower.startsWith('prompt') ||
    langLower.includes('prompt') ||
    langLower === 'image' ||
    langLower === 'flux' ||
    langLower === 'midjourney';

  if (isPromptCard) {
    return (
      <div className="my-3 rounded-2xl overflow-hidden border border-stone-300/80 dark:border-white/10 bg-white dark:bg-[#121217] shadow-xl select-none">
        <div className="px-3.5 py-2.5 bg-stone-100/80 dark:bg-white/[0.04] border-b border-stone-200 dark:border-white/8 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-lg shrink-0 ${
                isNaturalVideo
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : isFashion15s
                    ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400'
                    : isVideoPrompt
                      ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              }`}
            >
              {isVideoPrompt || isFashion15s || isNaturalVideo ? <Film className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-stone-900 dark:text-white tracking-tight">
                {isNaturalVideo
                  ? '🌿 Natural Organic Video Director Preset'
                  : isFashion15s
                    ? '🎬 15s Fashion Video Director Preset'
                    : isVideoPrompt
                      ? 'Prompt Video (Siap Salin)'
                      : 'Prompt AI (Siap Salin)'}
              </span>
              {isNaturalVideo && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-semibold">
                  Candid Flow
                </span>
              )}
              {isFashion15s && !isNaturalVideo && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 text-amber-600 dark:text-amber-300 font-semibold">
                  9:16 TikTok
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onSendToGenerateVideo && (isVideoPrompt || isFashion15s || isNaturalVideo) && (
              <button
                type="button"
                onClick={() => onSendToGenerateVideo(code)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 border border-purple-500/30 transition-all active:scale-95 cursor-pointer"
                title="Buka dan gunakan prompt ini di menu Generate Video"
              >
                <span>Pakai di Generator Video</span>
                <ArrowRight className="w-3 h-3 stroke-[2.5]" />
              </button>
            )}

            <button
              type="button"
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all active:scale-95 ${
                copied
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                  : 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md shadow-amber-500/15 hover:shadow-amber-500/25'
              }`}
              title="Salin Prompt ke Clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Salin Prompt</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="p-3.5 bg-stone-50 dark:bg-black/60 select-text">
          <pre className="font-mono text-xs sm:text-[13px] text-stone-800 dark:text-stone-200 leading-relaxed whitespace-pre-wrap break-words">
            <code>{code}</code>
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-keep-dark my-3 rounded-xl overflow-hidden border border-white/10 bg-[#0c0c0f]">
      <div className="px-3 py-1.5 bg-white/5 border-b border-white/5 flex items-center justify-between text-[11px] text-stone-400 font-mono">
        <span>{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Tersalin</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Salin</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs font-mono text-stone-200 leading-relaxed custom-scrollbar">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export const CleanMessageRenderer: React.FC<CleanMessageRendererProps> = ({
  content,
  isUser = false,
  onSendToGenerateVideo,
  onNavigateStudio,
}) => {
  if (!content) return null;

  // Filter out any [Thinking]...[/Thinking] or <thinking>...<\/thinking> internal monologue
  const cleanContent = content
    .replace(/\[Thinking\][\s\S]*?\[\/Thinking\]/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .trim();

  if (!cleanContent) return null;

  // Special handling for Storyboard Copilot projects (identical to ektension-weavy's chat-render.js post-processing)
  // If the message contains a storyboard project, render ONLY the rich, clean Storyboard Card.
  // This eliminates all duplicate markdown text, intros, and raw JSON dumps,
  // leaving only the clean, concise, elegant Storyboard Card.
  if (!isUser) {
    const directProject = extractStoryboardProjectFromData(cleanContent);
    if (directProject && directProject.scenes && directProject.scenes.length > 0) {
      return (
        <div className="my-1 w-full">
          <ChatStoryboardCopilotCard
            project={directProject}
            onApplyStoryboard={onNavigateStudio}
            onSendToGenerateVideo={onSendToGenerateVideo}
          />
        </div>
      );
    }

    // If it looks like a storyboard project is currently arriving via streaming
    if (
      cleanContent.includes('storyboard_project') ||
      cleanContent.includes('copilot_storyboard') ||
      cleanContent.includes('create_storyboard_project') ||
      (cleanContent.includes('"scenes"') &&
        (cleanContent.includes('"visualDescription"') || cleanContent.includes('"sceneNumber"')))
    ) {
      return (
        <div className="chat-typing-status my-2">
          <div className="chat-typing-dots">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
          <span>🎬 AI sedang merancang adegan storyboard...</span>
        </div>
      );
    }
  }

  // Parse lines into logical blocks: headings, code blocks, lists, dividers, paragraphs
  const lines = cleanContent.split(/\r?\n/);
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    // Handle code blocks (```)
    if (rawLine.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        if (
          !codeBlockLang.toLowerCase().includes('weavy_generate') &&
          !codeBlockLang.toLowerCase().includes('weavy_repost')
        ) {
          elements.push(
            <CodeBlock
              key={`code-${i}`}
              language={codeBlockLang}
              code={codeBlockBuffer.join('\n')}
              onSendToGenerateVideo={onSendToGenerateVideo}
              onNavigateStudio={onNavigateStudio}
            />
          );
        }
        inCodeBlock = false;
        codeBlockLang = '';
        codeBlockBuffer = [];
      } else {
        // Start of code block
        inCodeBlock = true;
        codeBlockLang = rawLine.trim().replace(/^```/, '').trim();
        codeBlockBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(rawLine);
      continue;
    }

    const trimmed = rawLine.trim();

    // 1. Horizontal rules (---, ***, ___)
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      elements.push(
        <div key={`divider-${i}`} className="my-3.5 h-px bg-white/10 w-full" />
      );
      continue;
    }

    // 2. Empty line
    if (!trimmed) {
      elements.push(<div key={`spacer-${i}`} className="h-2" />);
      continue;
    }

    // 3. Headings: ### Heading, ## Heading, # Heading (Strip ## and render styled)
    const headingMatch = rawLine.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];

      if (level === 1) {
        elements.push(
          <div
            key={`h1-${i}`}
            className="text-base sm:text-lg font-bold text-stone-900 dark:text-white mt-4 mb-2 pb-1 border-b border-stone-200 dark:border-white/10 flex items-center gap-2"
          >
            {renderInlineContent(headingText)}
          </div>
        );
      } else if (level === 2) {
        elements.push(
          <div
            key={`h2-${i}`}
            className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-300 mt-3.5 mb-1.5 flex items-center gap-2"
          >
            {renderInlineContent(headingText)}
          </div>
        );
      } else {
        // level 3, 4, 5, 6
        elements.push(
          <div
            key={`h3-${i}`}
            className="text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400 mt-3 mb-1 flex items-center gap-2"
          >
            {renderInlineContent(headingText)}
          </div>
        );
      }
      continue;
    }

    // 4. Numbered / Ordered List (e.g. "1. Item" or "1) Item")
    const orderedMatch = rawLine.match(/^(\s*)(\d+[\.\)])\s+(.*)$/);
    if (orderedMatch) {
      const indentSpaces = orderedMatch[1].length;
      const numLabel = orderedMatch[2];
      const itemText = orderedMatch[3];
      const indentClass = indentSpaces >= 4 ? 'pl-6' : indentSpaces >= 2 ? 'pl-3' : 'pl-0';

      elements.push(
        <div
          key={`ol-${i}`}
          className={`flex items-start gap-2.5 my-1 leading-relaxed text-stone-800 dark:text-stone-200 ${indentClass}`}
        >
          <span className="font-mono text-xs font-semibold text-amber-500 dark:text-amber-400 shrink-0 mt-0.5">
            {numLabel}
          </span>
          <div className="flex-1 break-words">
            {renderInlineContent(itemText)}
          </div>
        </div>
      );
      continue;
    }

    // 5. Unordered List Bullets (* Item, - Item, + Item)
    const bulletMatch = rawLine.match(/^(\s*)[\*\-\+]\s+(.*)$/);
    if (bulletMatch) {
      const indentSpaces = bulletMatch[1].length;
      const itemText = bulletMatch[2];
      const isSubBullet = indentSpaces >= 2;

      elements.push(
        <div
          key={`ul-${i}`}
          className={`flex items-start gap-2.5 my-1 leading-relaxed text-stone-800 dark:text-stone-200 ${
            isSubBullet ? 'pl-5 text-stone-600 dark:text-stone-300' : 'pl-0.5'
          }`}
        >
          <span
            className={`rounded-full shrink-0 mt-2 ${
              isSubBullet
                ? 'w-1.5 h-1.5 border border-stone-400 bg-transparent'
                : 'w-1.5 h-1.5 bg-amber-500 dark:bg-amber-400 shadow-2xs'
            }`}
          />
          <div className="flex-1 break-words">
            {renderInlineContent(itemText)}
          </div>
        </div>
      );
      continue;
    }

    // 6. Blockquote (> quote text or prompt)
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s*/, '');
      elements.push(
        <div
          key={`quote-${i}`}
          className="my-2.5 p-3 rounded-xl bg-amber-500/5 dark:bg-white/[0.03] border-l-2 border-amber-500 text-stone-800 dark:text-stone-200 text-xs sm:text-[13px] leading-relaxed select-text"
        >
          {renderInlineContent(quoteText)}
        </div>
      );
      continue;
    }

    // 7. Special Highlights: Analisis Konten Gambar / Catatan Ketidakcocokan / Konfirmasi Diperlukan
    const lowerTrimmed = trimmed.toLowerCase();
    if (
      lowerTrimmed.startsWith('**analisis konten gambar') ||
      lowerTrimmed.startsWith('analisis konten gambar')
    ) {
      elements.push(
        <div
          key={`analysis-header-${i}`}
          className="mt-3 mb-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/25 text-sky-700 dark:text-sky-300 font-semibold text-xs sm:text-sm flex items-center gap-2"
        >
          <ScanEye className="w-4 h-4 text-sky-500 shrink-0 stroke-[2.2]" />
          <span>{trimmed.replace(/\*\*/g, '')}</span>
        </div>
      );
      continue;
    }

    if (
      lowerTrimmed.startsWith('**catatan ketidakcocokan') ||
      lowerTrimmed.startsWith('catatan ketidakcocokan') ||
      lowerTrimmed.startsWith('**mismatch detected') ||
      lowerTrimmed.startsWith('mismatch detected')
    ) {
      elements.push(
        <div
          key={`mismatch-header-${i}`}
          className="mt-3 mb-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 font-semibold text-xs sm:text-sm flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 stroke-[2.2]" />
          <span>{trimmed.replace(/\*\*/g, '')}</span>
        </div>
      );
      continue;
    }

    // 8. Regular Paragraph Line
    elements.push(
      <div key={`p-${i}`} className="leading-relaxed text-stone-800 dark:text-stone-200 my-0.5 break-words">
        {renderInlineContent(rawLine)}
      </div>
    );
  }

  // If still in unclosed code block at end of message
  if (inCodeBlock && codeBlockBuffer.length > 0) {
    elements.push(
      <CodeBlock
        key="code-unclosed"
        language={codeBlockLang}
        code={codeBlockBuffer.join('\n')}
        onSendToGenerateVideo={onSendToGenerateVideo}
        onNavigateStudio={onNavigateStudio}
      />
    );
  }

  return <div className="space-y-0.5 text-xs sm:text-sm select-text selection:bg-amber-500/30 selection:text-white">{elements}</div>;
};