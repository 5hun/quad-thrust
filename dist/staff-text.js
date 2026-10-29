// Credits are fixed 16-pixel cells, clipped by the viewport, never wrapped.
// Cache complete lines so sliding does not reflow or rerasterize the glyphs.
export class StaffText {
    lines = new Map();
    draw(g, text, x, y) {
        let line = this.lines.get(text);
        if (!line) {
            line = document.createElement("canvas");
            line.width = Math.max(1, [...text].length * 16);
            line.height = 16;
            const ctx = line.getContext("2d");
            ctx.font = '16px "Noto Sans CJK JP", "Yu Gothic", Meiryo, sans-serif';
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = "white";
            [...text].forEach((ch, i) => {
                // Fit the ink, including fallback-font ascenders/descenders, into its cell.
                const m = ctx.measureText(ch);
                const height = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
                const scale = height > 15 ? 15 / height : 1;
                ctx.save();
                ctx.translate(i * 16, 0);
                ctx.scale(scale, scale);
                ctx.fillText(ch, (16 / scale - m.width) / 2, m.actualBoundingBoxAscent + (16 / scale - height) / 2, 16 / scale);
                ctx.restore();
            });
            this.lines.set(text, line);
        }
        g.drawImage(line, Math.round(x), Math.round(y));
    }
}
