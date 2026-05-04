// Tiny markdown → HTML converter. Handles: headings, paragraphs, lists,
// links, inline code, bold/italic, fenced code blocks, tables, blockquotes, hr.
// Not exhaustive but good enough for our research docs.
(function () {
  function escape(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function inline(s) {
    s = escape(s);
    // links [text](url)
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // bold **x** / __x__
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    // italic *x* / _x_
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");
    // inline code
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    return s;
  }
  function parseTable(lines, i) {
    // header row, separator row, then rows until blank
    const header = lines[i].split("|").map(s => s.trim()).filter(Boolean);
    const sep = lines[i + 1] || "";
    if (!/^\s*\|?\s*:?-+/.test(sep)) return null;
    let j = i + 2;
    const rows = [];
    while (j < lines.length && lines[j].includes("|")) {
      rows.push(lines[j].split("|").map(s => s.trim()).filter((c, idx, arr) => !(idx === 0 && c === "") && !(idx === arr.length - 1 && c === "")));
      j++;
    }
    let html = "<table><thead><tr>" + header.map(h => `<th>${inline(h)}</th>`).join("") + "</tr></thead><tbody>";
    for (const r of rows) html += "<tr>" + r.map(c => `<td>${inline(c)}</td>`).join("") + "</tr>";
    html += "</tbody></table>";
    return { html, next: j };
  }
  function md(src) {
    const lines = src.replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // fenced code block
      if (/^```/.test(line)) {
        const lang = line.replace(/^```/, "").trim();
        let buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) {
          buf.push(lines[i]);
          i++;
        }
        i++; // skip closing ```
        out.push(`<pre><code class="lang-${escape(lang)}">${escape(buf.join("\n"))}</code></pre>`);
        continue;
      }

      // hr
      if (/^[-*_]{3,}\s*$/.test(line)) {
        out.push("<hr/>");
        i++;
        continue;
      }

      // heading
      const h = /^(#{1,6})\s+(.+)$/.exec(line);
      if (h) {
        const level = h[1].length;
        out.push(`<h${level}>${inline(h[2])}</h${level}>`);
        i++;
        continue;
      }

      // table
      if (line.includes("|") && /\S/.test(line) && lines[i + 1] && /^\s*\|?\s*:?-+/.test(lines[i + 1])) {
        const t = parseTable(lines, i);
        if (t) { out.push(t.html); i = t.next; continue; }
      }

      // blockquote
      if (/^>\s?/.test(line)) {
        let buf = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          buf.push(lines[i].replace(/^>\s?/, ""));
          i++;
        }
        out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
        continue;
      }

      // unordered list
      if (/^\s*[-*+]\s+/.test(line)) {
        let buf = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
          buf.push(`<li>${inline(lines[i].replace(/^\s*[-*+]\s+/, ""))}</li>`);
          i++;
        }
        out.push(`<ul>${buf.join("")}</ul>`);
        continue;
      }

      // ordered list
      if (/^\s*\d+\.\s+/.test(line)) {
        let buf = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          buf.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ""))}</li>`);
          i++;
        }
        out.push(`<ol>${buf.join("")}</ol>`);
        continue;
      }

      // blank line
      if (!/\S/.test(line)) { i++; continue; }

      // paragraph (gather until blank or next block)
      let buf = [line];
      i++;
      while (i < lines.length && /\S/.test(lines[i]) &&
             !/^(#{1,6}\s|\s*[-*+]\s+|\s*\d+\.\s+|>\s|```|[-*_]{3,}\s*$)/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      out.push(`<p>${inline(buf.join(" "))}</p>`);
    }
    return out.join("\n");
  }
  window.md = md;
})();
