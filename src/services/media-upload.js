import { assert } from "../utils/http-error.js";
export function validateImageUpload(bytes) {
  assert(Buffer.isBuffer(bytes) && bytes.length >= 12 && bytes.length <= 5 * 1024 * 1024, 400, "Upload an image up to 5 MB.");
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  assert(false, 400, "Only PNG, JPEG and WebP image files are supported. SVG and other file types are not accepted.");
}
