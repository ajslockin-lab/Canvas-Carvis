import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt } from "../lib/crypto.js";

beforeAll(() => {
  process.env["ENCRYPTION_KEY"] = "a".repeat(64);
});

describe("encrypt / decrypt round-trip", () => {
  it("decrypts back to the original plaintext", () => {
    const plaintext = "canvas_pat_abc123";
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("produces a different ciphertext on every call (random IV)", () => {
    const a = encrypt("same-input");
    const b = encrypt("same-input");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("same-input");
    expect(decrypt(b)).toBe("same-input");
  });

  it("ciphertext has three colon-separated base64 parts", () => {
    const parts = encrypt("hello").split(":");
    expect(parts).toHaveLength(3);
    parts.forEach((p) => expect(p.length).toBeGreaterThan(0));
  });

  it("throws on tampered authTag", () => {
    const [iv, body] = encrypt("secret").split(":");
    const tampered = `${iv}:${body}:AAAAAAAAAAAAAAAA`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws when ENCRYPTION_KEY is missing", () => {
    const saved = process.env["ENCRYPTION_KEY"];
    delete process.env["ENCRYPTION_KEY"];
    expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY");
    process.env["ENCRYPTION_KEY"] = saved!;
  });

  it("throws when ENCRYPTION_KEY is wrong length", () => {
    process.env["ENCRYPTION_KEY"] = "tooshort";
    expect(() => encrypt("test")).toThrow("32 bytes");
    process.env["ENCRYPTION_KEY"] = "a".repeat(64);
  });
});
