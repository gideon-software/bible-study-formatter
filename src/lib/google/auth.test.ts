import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  serializeSessionCookie,
  parseSessionCookie,
  isAdminEmail,
  hasRequiredDriveScope,
  classifyGoogleAuthError,
  DRIVE_FILE_SCOPE,
  SessionData,
} from "./auth";

describe("Google Auth & Signed Session Cookie Utilities", () => {
  it("signs and verifies a session payload via HMAC-SHA256", () => {
    const payload: SessionData = {
      accessToken: "ya29.test",
      refreshToken: "1//test",
      user: { email: "user@example.com", name: "Test User" },
    };

    const signed = serializeSessionCookie(payload);
    assert.ok(signed.includes("."));

    const parsed = parseSessionCookie(signed);
    assert.ok(parsed);
    assert.equal(parsed.user?.email, "user@example.com");
    assert.equal(parsed.accessToken, "ya29.test");
    assert.equal(parsed.refreshToken, "1//test");
  });

  it("rejects a tampered signed cookie payload or signature", () => {
    const payload: SessionData = {
      accessToken: "ya29.test",
      user: { email: "user@example.com" },
    };

    const signed = serializeSessionCookie(payload);
    const [encodedB64, sig] = signed.split(".");

    // Tamper with the signature
    const tamperedSig = `${encodedB64}.${sig.slice(0, -2)}ff`;
    assert.equal(parseSessionCookie(tamperedSig), null);

    // Forged unsigned JSON without real OAuth tokens
    const forgedAdminJson = JSON.stringify({
      user: { email: "admin@example.com" },
    });
    assert.equal(parseSessionCookie(forgedAdminJson), null);
  });

  it("matches admin emails case-insensitively", () => {
    const prev = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = "Alice@Example.com, bob@example.com ";
    try {
      assert.equal(isAdminEmail("alice@example.com"), true);
      assert.equal(isAdminEmail("BOB@EXAMPLE.COM"), true);
      assert.equal(isAdminEmail("eve@example.com"), false);
      assert.equal(isAdminEmail(null), false);
    } finally {
      process.env.ADMIN_EMAILS = prev;
    }
  });

  it("verifies whether granted OAuth scopes include drive.file", () => {
    assert.equal(
      hasRequiredDriveScope(
        `${DRIVE_FILE_SCOPE} https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile`
      ),
      true
    );
    assert.equal(
      hasRequiredDriveScope(
        "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile"
      ),
      false
    );
    assert.equal(hasRequiredDriveScope(""), false);
    assert.equal(hasRequiredDriveScope(undefined), false);
    // Prefix lookalike must not match
    assert.equal(
      hasRequiredDriveScope("https://www.googleapis.com/auth/drive.file.readonly"),
      false
    );
  });

  it("classifies insufficient scope errors vs expired credential errors", () => {
    assert.equal(
      classifyGoogleAuthError(
        new Error("Request had insufficient authentication scopes.")
      ),
      "insufficient_scope"
    );
    assert.equal(
      classifyGoogleAuthError({
        code: 403,
        message: "Insufficient Permission",
        errors: [{ reason: "ACCESS_TOKEN_SCOPE_INSUFFICIENT" }],
      }),
      "insufficient_scope"
    );
    assert.equal(
      classifyGoogleAuthError({
        code: 401,
        message: "Invalid Credentials",
      }),
      "expired"
    );
    assert.equal(
      classifyGoogleAuthError(new Error("invalid_grant")),
      "expired"
    );
    assert.equal(
      classifyGoogleAuthError(new Error("ESV API timeout")),
      null
    );
  });
});
