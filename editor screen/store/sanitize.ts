/**
 * Sanitizes clip names against XSS and control character injection.
 */
export function sanitizeClipName(name: string): string {
  if (!name) return "Untitled Clip";

  // 1. Strip <script>...</script> and <style>...</style> including their contents
  let cleaned = name.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // 2. Strip any remaining HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, "");

  // 3. Remove non-printable control characters
  cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, "");

  // 4. Normalize whitespace and trim
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // 5. Restrict to 100 characters max
  return cleaned.slice(0, 100) || "Untitled Clip";
}
