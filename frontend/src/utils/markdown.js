const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const inline = s => s
  .replace(/`([^`\n]+)`/g, '<code>$1</code>')
  .replace(/([\w\-./]+\.(?:py|js|ts|tsx|jsx|json|yaml|yml|md|html|css|java|go|rs|cpp|c|h)):(\d+)/g, '<span class="cite">$1:$2</span>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

export function renderMarkdown(text = '') {
  const blocks = [];
  // hide <think>…</think> reasoning from thinking models
  let t = esc(text.replace(/<think>[\s\S]*?(<\/think>|$)/g, ''));
  t = t.replace(/```(\w*)\n?([\s\S]*?)(```|$)/g, (_, _l, code) => {
    blocks.push(`<pre><code>${code.trim()}</code></pre>`);
    return `\u0000${blocks.length - 1}\u0000`;
  });

  const out = [];
  let list = false;
  for (const raw of t.split('\n')) {
    const line = raw.trimEnd();
    const li = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/);
    if (li) {
      if (!list) { out.push('<ul>'); list = true; }
      out.push(`<li>${inline(li[1])}</li>`);
      continue;
    }
    if (list) { out.push('</ul>'); list = false; }
    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (h) out.push(`<h${h[1].length + 2}>${inline(h[2])}</h${h[1].length + 2}>`);
    else if (/^\u0000\d+\u0000$/.test(line.trim())) out.push(line.trim());
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push('</ul>');
  return out.join('').replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[i]);
}