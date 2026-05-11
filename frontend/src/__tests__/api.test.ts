import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { api } from "../api/todos";
import { server } from "../test/server";

describe("api client — handle() error branches", () => {
  it("falls back to 'Request failed with status N' when the error body isn't JSON", async () => {
    // Hit the GET path with a 500 whose body is plain text. handle() tries
    // res.json(), catches the parse error, and uses the status-code message.
    server.use(
      http.get("/api/todos", () =>
        new HttpResponse("Internal Server Error", {
          status: 500,
          headers: { "content-type": "text/html" },
        })
      )
    );

    await expect(api.list()).rejects.toThrow(
      /Request failed with status 500/
    );
  });

  it("uses the server's structured `error` message when present", async () => {
    // Sanity check that the happy-path error branch still works when the
    // server DID send a structured body. (Exercises the non-fallback path.)
    server.use(
      http.get("/api/todos", () =>
        HttpResponse.json({ error: "you can't read this" }, { status: 403 })
      )
    );

    await expect(api.list()).rejects.toThrow(/you can't read this/);
  });

  it("api.remove returns undefined when the server replies 204 No Content", async () => {
    // The DELETE happy path in the unit suite — Playwright covers the
    // end-to-end version, but the unit-level branch in handle()
    // (`if (res.status === 204) return undefined as T`) wasn't otherwise
    // exercised.
    server.use(
      http.delete("/api/todos/:id", () =>
        new HttpResponse(null, { status: 204 })
      )
    );

    await expect(api.remove("any-id")).resolves.toBeUndefined();
  });
});
