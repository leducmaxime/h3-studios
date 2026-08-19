import { describe, expect, it } from "vitest";
import {
  INSTAGRAM_LONG_LIVED_TOKEN_SECONDS,
  INSTAGRAM_TOKEN_MIN_AGE_MS,
  parseInstagramRefreshResponse,
  shouldRefreshInstagramToken,
  tokenExpiresAtFromExpiresIn,
} from "../lib/instagram";
import {
  buildInstagramMediaProxyPath,
  isAllowedInstagramMediaUrl,
} from "../lib/instagram-media";

describe("shouldRefreshInstagramToken", () => {
  const now = Date.parse("2026-08-19T10:00:00.000Z");

  it("refreshes when no previous refresh timestamp exists", () => {
    expect(shouldRefreshInstagramToken(null, now)).toBe(true);
    expect(shouldRefreshInstagramToken(undefined, now)).toBe(true);
    expect(shouldRefreshInstagramToken("", now)).toBe(true);
  });

  it("refreshes when the timestamp is invalid", () => {
    expect(shouldRefreshInstagramToken("not-a-date", now)).toBe(true);
  });

  it("does not refresh a token younger than 24 hours", () => {
    const refreshedAt = new Date(now - INSTAGRAM_TOKEN_MIN_AGE_MS + 1).toISOString();
    expect(shouldRefreshInstagramToken(refreshedAt, now)).toBe(false);
  });

  it("refreshes a token that is at least 24 hours old", () => {
    const refreshedAt = new Date(now - INSTAGRAM_TOKEN_MIN_AGE_MS).toISOString();
    expect(shouldRefreshInstagramToken(refreshedAt, now)).toBe(true);
  });
});

describe("parseInstagramRefreshResponse", () => {
  it("parses a valid refresh payload", () => {
    expect(parseInstagramRefreshResponse({
      access_token: " IGAAAA.new ",
      token_type: "bearer",
      expires_in: 5_183_944,
    })).toEqual({
      access_token: "IGAAAA.new",
      token_type: "bearer",
      expires_in: 5_183_944,
    });
  });

  it("defaults token_type to bearer", () => {
    expect(parseInstagramRefreshResponse({
      access_token: "IGAAAA.new",
      expires_in: 100,
    }).token_type).toBe("bearer");
  });

  it("rejects missing or empty access tokens", () => {
    expect(() => parseInstagramRefreshResponse({ expires_in: 100 })).toThrow(/access_token/);
    expect(() => parseInstagramRefreshResponse({ access_token: "  ", expires_in: 100 })).toThrow(/access_token/);
  });

  it("rejects invalid expires_in values", () => {
    expect(() => parseInstagramRefreshResponse({ access_token: "IGAAAA.new" })).toThrow(/expires_in/);
    expect(() => parseInstagramRefreshResponse({ access_token: "IGAAAA.new", expires_in: 0 })).toThrow(/expires_in/);
    expect(() => parseInstagramRefreshResponse({ access_token: "IGAAAA.new", expires_in: -1 })).toThrow(/expires_in/);
  });

  it("rejects non-object payloads", () => {
    expect(() => parseInstagramRefreshResponse(null)).toThrow(/invalid payload/);
    expect(() => parseInstagramRefreshResponse("nope")).toThrow(/invalid payload/);
  });
});

describe("tokenExpiresAtFromExpiresIn", () => {
  it("adds expires_in seconds to now", () => {
    const now = Date.parse("2026-08-19T10:00:00.000Z");
    expect(tokenExpiresAtFromExpiresIn(INSTAGRAM_LONG_LIVED_TOKEN_SECONDS, now)).toBe("2026-10-18T10:00:00.000Z");
  });
});

describe("isAllowedInstagramMediaUrl", () => {
  it("allows Instagram and Facebook CDN hosts over https", () => {
    expect(isAllowedInstagramMediaUrl(new URL("https://scontent-cdg4-1.cdninstagram.com/v/t51.123/video.mp4"))).toBe(true);
    expect(isAllowedInstagramMediaUrl(new URL("https://cdninstagram.com/v/t51.123/photo.jpg"))).toBe(true);
    expect(isAllowedInstagramMediaUrl(new URL("https://scontent.xx.fbcdn.net/v/t51.123/video.mp4"))).toBe(true);
    expect(isAllowedInstagramMediaUrl(new URL("https://fbcdn.net/v/t51.123/photo.jpg"))).toBe(true);
  });

  it("rejects other hosts and non-https URLs", () => {
    expect(isAllowedInstagramMediaUrl(new URL("http://scontent-cdg4-1.cdninstagram.com/v/t51.123/video.mp4"))).toBe(false);
    expect(isAllowedInstagramMediaUrl(new URL("https://evil-cdninstagram.com/video.mp4"))).toBe(false);
    expect(isAllowedInstagramMediaUrl(new URL("https://example.com/video.mp4"))).toBe(false);
  });
});

describe("buildInstagramMediaProxyPath", () => {
  it("builds the existing proxy path with an encoded media URL", () => {
    const mediaUrl = "https://scontent-cdg4-1.cdninstagram.com/o1/v/t2/video.mp4?_nc_cat=1&oh=abc";
    expect(buildInstagramMediaProxyPath(mediaUrl)).toBe(
      `/api/instagram/proxy-image?url=${encodeURIComponent(mediaUrl)}`,
    );
  });
});
