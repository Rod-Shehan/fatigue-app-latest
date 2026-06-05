import fs from "fs";
import path from "path";

const routePath = path.join("src", "app", "api", "sheets", "[id]", "export", "route.ts");
const lines = fs.readFileSync(routePath, "utf8").split(/\r?\n/);
const header = `import type { jsPDF } from "jspdf";
import { PRODUCT_NAME_EXPORT, TAGLINE_DRIVER } from "@/lib/branding";
import { ROADSIDE_PDF_DISCLAIMER } from "@/lib/roadside-pdf";
import { MINUTES_PER_DAY } from "@/lib/coverage/derive-minute-coverage";
import { halfHourSlotsToRanges, minuteBooleansToRanges } from "@/lib/coverage/grid-to-ranges";

`;
const body = lines.slice(15, 1337).join("\n");
const out = path.join("src", "lib", "sheet-jspdf-export.ts");
fs.writeFileSync(out, header + body);
console.log("wrote", out, (header + body).split("\n").length, "lines");
