import { describe, expect, jest, test } from "@jest/globals";
import { API } from "@/API";

import * as _undici from "undici";
jest.mock("undici");
const undici = _undici as jest.Mocked<typeof _undici>;

describe("Error handling with mocking modules", () => {
  test("invalid region code", () => {
    expect(() => new API(undefined, undefined, "invalid-region-code")).toThrow("Invalid region code");
    expect(() => new API(undefined, undefined, "vn")).toThrow("Invalid region code");
  });

  describe("refreshToken", () => {
    test("invalid credentials", async () => {
      const api = new API("invalid-client-id", "invalid-client-secret");
      const mock = jest.spyOn(global.console, "warn").mockImplementation(() => (api["_hasCredentials"] = true));
      await expect(api.refreshToken()).resolves.toBe(undefined);
      expect(mock).toHaveBeenCalledTimes(2);
      await expect(api.refreshToken()).resolves.toBe(undefined);
      expect(mock).toHaveBeenCalledTimes(2);
      mock.mockRestore();
    });

    test("cannot find token", async () => {
      const api = new API();
      const mock = jest.spyOn(global.console, "warn").mockImplementation(() => {});
      undici.fetch.mockResolvedValueOnce(<any>{ text: () => Promise.resolve("some text without token") });
      await expect(api.refreshToken()).resolves.toBe(undefined);
      expect(api["_tokenAvailable"]).toBe(false);
      expect(undici.fetch).toHaveBeenCalledTimes(1);
      expect(mock).toHaveBeenCalledTimes(1);
      undici.fetch.mockResolvedValueOnce(<any>{ text: () => Promise.resolve("some text without token") });
      await expect(api.refreshToken()).resolves.toBe(undefined);
      expect(api["_tokenAvailable"]).toBe(false);
      expect(undici.fetch).toHaveBeenCalledTimes(2);
      expect(mock).toHaveBeenCalledTimes(1);
      mock.mockRestore();
    });

    test("token found without expiration time", async () => {
      const api = new API();
      undici.fetch.mockResolvedValueOnce(<any>{ text: () => Promise.resolve('"accessToken":"this_is_a_valid_token"') });
      await expect(api.refreshToken()).resolves.toBe(undefined);
      expect(api["_tokenAvailable"]).toBe(true);
      expect(api["_expirationTime"]).toBe(0);
    });
  });

  describe("getData", () => {
    const api = new API();
    test("invalid url", async () => {
      await expect(api.getData("invalid-url")).rejects.toThrow("Invalid URL");
      await expect(api.getData("https://open.spotify.com/show/")).rejects.toThrow("Invalid URL");
      await expect(api.getData("https://open.spotify.com/show/id")).rejects.toThrow("Unsupported URL type");
    });
  });
});
