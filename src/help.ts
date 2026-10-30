// OTR_MODE.C online_help / select / book. Layout uses the original 320x240 cells.
import { HELP_BOOKS } from "./help-data.js";
import { StaffText } from "./staff-text.js";
export type HelpPage = "root" | "controls" | "machines" | "book";
const ROOT = [
  "はじめに",
  "操作について",
  "マシン紹介",
  "ゲームモード紹介",
  "路面の記号について",
  "セーブ・ロードについて",
  "このゲームについて",
  "スタッフ",
];
const CONTROLS = [
  "左右（ラダー）",
  "上下（傾き）",
  "×ボタン（ブースター）",
  "□ボタン（ターボ）",
  "○ボタン（ブレーキ）",
  "Ｒ１Ｒ２・Ｌ１Ｌ２（スラスター）",
];
const MACHINES = [
  "ＬＵＳＴＥＲ",
  "ＥＸＣＥＬ",
  "ＢＥＴＡ",
  "ＪＵＳＴＥＲ",
  "ＡＬＰＨＡ",
  "ＳＵＺＵＫＩ",
];
const CONTROL_BOOKS = [
  "radder",
  "move",
  "booster",
  "turbo",
  "brake",
  "slaster",
];
const MACHINE_BOOKS = ["luster", "excel", "beta", "juster", "alpha", "suzuki"];
const ROOT_BOOKS = [
  "intro",
  "",
  "",
  "modes",
  "sign",
  "replay",
  "about",
  "staff",
];
const MODES: Record<string, number> = {
  radder: 3,
  booster: 4,
  slaster: 5,
  luster: 6,
  excel: 7,
  beta: 8,
  juster: 9,
  alpha: 10,
  suzuki: 11,
  sign: 2,
  about: -1,
  staff: 1,
};
export interface HelpAnnotation {
  x: number;
  y: number;
  text: string;
  left?: boolean;
}
export class OriginalHelp {
  page: HelpPage = "root";
  selected = 0;
  rootSelection = 0;
  bookParent: HelpPage = "root";
  bookSelection = 0;
  book = "intro";
  scroll = 0;
  frame = 0;
  annotations: HelpAnnotation[] = [];
  wall = new Image();
  signs = new Image();
  background = document.createElement("canvas");
  glyphs = new StaffText();
  lines = new Map<string, HTMLCanvasElement>();
  constructor(
    public changed: () => void,
    public exit: () => void,
  ) {
    this.background.width = 320;
    this.background.height = 240;
    this.wall.src = "assets/help-wall.png";
    this.signs.src = "assets/help-signs.png";
  }
  reset() {
    this.page = "root";
    this.selected = 0;
    this.rootSelection = 0;
  }
  get items() {
    return this.page === "root"
      ? ROOT
      : this.page === "controls"
        ? CONTROLS
        : this.page === "machines"
          ? MACHINES.slice(0, HoverRules.machineCount())
          : [];
  }
  get title() {
    return this.page === "controls"
      ? "ＨＥＬＰ　「操作について」"
      : this.page === "machines"
        ? "ＨＥＬＰ　「マシン紹介」"
        : "ＨＥＬＰ　「もくじ」";
  }
  get description() {
    return this.page === "book"
      ? HELP_BOOKS[this.book].join("\n")
      : this.items[this.selected];
  }
  get mode() {
    return this.page === "book" ? MODES[this.book] || 0 : 0;
  }
  get maxScroll() {
    return Math.max(0, HELP_BOOKS[this.book].length * 28 - 228);
  }
  move(delta: number) {
    if (this.page === "book") this.scrollBy(delta * 28);
    else
      this.selected = Math.max(
        0,
        Math.min(this.items.length - 1, this.selected + delta),
      );
  }
  scrollBy(delta: number) {
    this.scroll = Math.max(0, Math.min(this.maxScroll, this.scroll + delta));
  }
  tick(direction: number, fast: boolean) {
    if (this.page !== "book") return;
    this.scrollBy(direction * (fast ? 4 : 2));
    ++this.frame;
  }
  confirm() {
    if (this.page === "book") return;
    if (this.page === "root" && (this.selected === 1 || this.selected === 2)) {
      this.rootSelection = this.selected;
      this.page = this.selected === 1 ? "controls" : "machines";
      this.selected = 0;
    } else {
      this.bookParent = this.page;
      this.bookSelection = this.selected;
      this.book = (
        this.page === "root"
          ? ROOT_BOOKS
          : this.page === "controls"
            ? CONTROL_BOOKS
            : MACHINE_BOOKS
      )[this.selected];
      this.page = "book";
      this.scroll = 0;
      this.frame = 0;
    }
    this.changed();
  }
  back() {
    if (this.page === "root") {
      this.exit();
      return;
    }
    if (this.page === "book") {
      this.page = this.bookParent;
      this.selected = this.bookSelection;
    } else {
      this.page = "root";
      this.selected = this.rootSelection;
    }
    this.changed();
  }
  paintBackground() {
    const g = this.background.getContext("2d")!;
    g.fillStyle = "#737369";
    g.fillRect(0, 0, 320, 240);
    if (this.wall.complete && this.wall.naturalWidth) {
      for (
        let y = -((this.page === "book" ? this.scroll : 0) & 31);
        y < 240;
        y += 32
      )
        for (let x = 0; x < 320; x += 32) g.drawImage(this.wall, x, y);
    }
    return this.background;
  }
  text(
    g: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    green = false,
  ) {
    const key = `${green}:${text}`;
    let line = this.lines.get(key);
    if (!line) {
      const mask = document.createElement("canvas");
      mask.width = Math.max(1, [...text].length * 16);
      mask.height = 16;
      this.glyphs.draw(mask.getContext("2d")!, text, 0, 0);
      line = document.createElement("canvas");
      line.width = mask.width + 2;
      line.height = 18;
      const ctx = line.getContext("2d")!;
      const stamp = (color: string, dx: number, dy: number) => {
        const tinted = document.createElement("canvas");
        tinted.width = mask.width;
        tinted.height = mask.height;
        const t = tinted.getContext("2d")!;
        t.drawImage(mask, 0, 0);
        t.globalCompositeOperation = "source-in";
        t.fillStyle = color;
        t.fillRect(0, 0, mask.width, mask.height);
        ctx.drawImage(tinted, dx, dy);
      };
      stamp(green ? "#007b00" : "#7b8373", 2, 1);
      stamp(green ? "#007b00" : "#7b8373", 1, 2);
      stamp(green ? "#003900" : "#393931", 0, 1);
      stamp(green ? "#003900" : "#393931", 1, 0);
      stamp(green ? "#001000" : "#101010", 1, 1);
      this.lines.set(key, line);
    }
    g.drawImage(line, Math.round(x) - 1, Math.round(y) - 1);
  }
  draw(
    g: CanvasRenderingContext2D,
    latin: (text: string, x: number, y: number, color?: string) => void,
  ) {
    if (this.page !== "book") {
      this.text(g, this.title, 8, 8, true);
      this.items.forEach((text, i) =>
        this.text(g, text, 32, 40 + i * 24, i === this.selected),
      );
      return;
    }
    const lines = HELP_BOOKS[this.book];
    const first = Math.floor(this.scroll / 28);
    for (let i = first; i < Math.min(first + 10, lines.length); i++) {
      const x = this.mode === 1 ? 160 - [...lines[i]].length * 8 : 32;
      this.text(g, lines[i], x, 10 + i * 28 - this.scroll);
    }
    if (this.mode === 2 && this.signs.complete && this.signs.naturalWidth) {
      const bx = [0, 1, 1, 0, 1],
        by = [2, 2, 1, 1, 0];
      for (let i = 0; i < 5; i++)
        g.drawImage(
          this.signs,
          bx[i] * 32,
          by[i] * 32,
          32,
          32,
          32,
          66 + i * 140 - this.scroll,
          32,
          32,
        );
    }
    if (this.mode === -1) {
      const y = 10 + (lines.length - 2) * 28 - this.scroll;
      g.fillStyle = "black";
      g.fillRect(12, y - 8, 296, 40);
      latin("http://www.sakuranet.or.jp/~uzusio/", 20, y);
      latin("E-Mail:uzusio@sakuranet.or.jp", 20, y + 16);
    }
    for (const a of this.annotations) {
      const dx = a.left ? -20 : 20;
      g.strokeStyle = "black";
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(a.x + dx, a.y - 10);
      if (this.mode !== 5) g.lineTo(a.x + dx, a.y - 20);
      g.stroke();
      latin(
        a.text,
        a.x + dx - (a.left ? a.text.length * 8 : 0),
        a.y - 20,
        this.mode === 5 ? "#404080" : "#202080",
      );
    }
  }
}
