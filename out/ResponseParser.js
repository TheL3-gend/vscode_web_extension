"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseParser = void 0;
const jsdom_1 = require("jsdom");
class ResponseParser {
    parse(html) {
        const dom = new jsdom_1.JSDOM(`<body>${html}</body>`).window.document;
        const text = Array.from(dom.querySelectorAll('p, li'))
            .map(e => e.textContent?.trim() || '')
            .filter(Boolean)
            .join('\n\n');
        const codeBlocks = Array.from(dom.querySelectorAll('pre > code'))
            .map(e => {
            const m = e.className.match(/language-(\w+)/);
            return { language: m?.[1] || '', code: e.textContent || '' };
        });
        const combined = text + codeBlocks.map(cb => `\n\n\`\`\`${cb.language}\n${cb.code}\n\`\`\``).join('');
        return { text, codeBlocks, commands: this.parseCommands(combined) };
    }
    parseCommands(str) {
        const cmds = [];
        const re = /\[VSCODE_COMMAND:(\w+)=['"]([^'"]+)['"]([^]*?)\]/g;
        let m;
        while ((m = re.exec(str))) {
            const [, action, payload, rest = ''] = m;
            const params = { arg: payload };
            if (action === 'writeFile') {
                params.path = payload;
                delete params.arg;
            }
            const kvRe = /\b(\w+)='([^']*)'/g;
            let kv;
            while ((kv = kvRe.exec(rest))) {
                params[kv[1]] = kv[2];
            }
            cmds.push({ action, params });
        }
        return cmds;
    }
}
exports.ResponseParser = ResponseParser;
//# sourceMappingURL=ResponseParser.js.map