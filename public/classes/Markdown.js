export class Markdown {

  constructor() {
  }
  
  render(md) {
    const lines = md.split('\n')
    const html = []
    let inTable = false
    let inList = false

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]

      // Headings
      if (line.startsWith('### ')) { this._closeBlocks(html, inList, inTable); inList = inTable = false; html.push(`<h3>${this._inline(line.slice(4))}</h3>`); continue }
      if (line.startsWith('## '))  { this._closeBlocks(html, inList, inTable); inList = inTable = false; html.push(`<h2>${this._inline(line.slice(3))}</h2>`); continue }
      if (line.startsWith('# '))   { this._closeBlocks(html, inList, inTable); inList = inTable = false; html.push(`<h1>${this._inline(line.slice(2))}</h1>`); continue }

      // Table
      if (line.includes('|')) {
        if (!inTable) { if (inList) { html.push('</ul>'); inList = false } html.push('<table>'); inTable = true }
        if (/^\|[-| :]+\|$/.test(line.trim())) continue // separator row
        const cells = line.trim().replace(/^\||\|$/g, '').split('|')
        const tag = (i === 0 || !lines[i-1]?.includes('|')) ? 'th' : 'td'
        html.push(`<tr>${cells.map(c => `<${tag}>${this._inline(c.trim())}</${tag}>`).join('')}</tr>`)
        continue
      } else if (inTable) { html.push('</table>'); inTable = false }

      // Bullet list
      if (/^[-*] /.test(line)) {
        if (!inList) { html.push('<ul>'); inList = true }
        html.push(`<li>${this._inline(line.slice(2))}</li>`)
        continue
      } else if (inList) { html.push('</ul>'); inList = false }

      // Paragraph / blank
      if (line.trim() === '') { html.push(''); continue }
      html.push(`<p>${this._inline(line)}</p>`)
    }

    this._closeBlocks(html, inList, inTable)
    return html.join('\n')
  }

  _closeBlocks(html, inList, inTable) {
    if (inList)  html.push('</ul>')
    if (inTable) html.push('</table>')
  }

  _inline(text) {
    return text
      .replace(/~~(.+?)~~/g,   '<s>$1</s>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g,   '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,   '<em>$1</em>')
      .replace(/(?<![\w\[])_(.+?)_(?![\w])/g, '<em>$1</em>')
  }
}
