// Reads the RupRong logo from the public folder and returns it as a base64
// data URI, for embedding in generated PDFs. Cached after the first read.
import fs from "fs";
import path from "path";

let cached = null;

export function getLogoDataUri() {
  if (cached) return cached;
  const filePath = path.join(process.cwd(), "public", "logo.jpg");
  const buf = fs.readFileSync(filePath);
  cached = `data:image/jpeg;base64,${buf.toString("base64")}`;
  return cached;
}
