import { afterEach, describe, expect, it, vi } from "vitest";

const user = {
  id: "client-1",
  email: "client@example.com",
  name: "Client Test",
  first_name: "Client",
  last_name: "Test",
  phone: null,
  band_name: null,
  address_line1: null,
  address_line2: null,
  postal_code: null,
  city: null,
};

function response(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status });
}

async function loadStore() {
  vi.resetModules();
  return import("@/lib/client-auth-store");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("client auth store refresh failure classification", () => {
  it.each([401, 403])("demotes %s to guest without logging out", async (status) => {
    const fetchMock = vi.fn().mockResolvedValue(response(status));
    vi.stubGlobal("fetch", fetchMock);
    const store = await loadStore();

    await expect(store.refresh()).resolves.toBeNull();
    expect(store.getClientAuthState()).toMatchObject({ status: "ready", user: null, logoutCount: 0 });
  });

  it("demotes a successful response without a user payload to guest", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, {})));
    const store = await loadStore();

    await expect(store.refresh()).resolves.toBeNull();
    expect(store.getClientAuthState()).toMatchObject({ status: "ready", user: null, logoutCount: 0 });
  });

  it("settles and falls through to guest when a 200 response is malformed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not-json", { status: 200 })));
    const store = await loadStore();

    await expect(store.refresh()).resolves.toBeNull();
    expect(store.getClientAuthState()).toMatchObject({ status: "ready", user: null });
  });

  it("preserves a ready user on 5xx and always settles", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(200, { data: user }))
      .mockResolvedValueOnce(response(503));
    vi.stubGlobal("fetch", fetchMock);
    const store = await loadStore();

    await store.refresh();
    await expect(store.refresh({ force: true })).resolves.toEqual(user);
    expect(store.getClientAuthState().user).toEqual(user);
  });

  it("preserves a ready user on network failure, but loading failures become guest", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const store = await loadStore();

    await expect(store.refresh()).resolves.toBeNull();
    expect(store.getClientAuthState()).toMatchObject({ status: "ready", user: null });

    fetchMock.mockResolvedValueOnce(response(200, { data: user }));
    await store.refresh();
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(store.refresh({ force: true })).resolves.toEqual(user);
    expect(store.getClientAuthState().user).toEqual(user);
  });

  it("increments logoutCount on logout, while refresh does not", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(200, { data: user }))
      .mockResolvedValueOnce(response(200));
    vi.stubGlobal("fetch", fetchMock);
    const store = await loadStore();

    await store.refresh();
    expect(store.getClientAuthState().logoutCount).toBe(0);
    await expect(store.logout()).resolves.toEqual({ ok: true });
    expect(store.getClientAuthState()).toMatchObject({ user: null, logoutCount: 1 });
  });

  it("dedupes normal refreshes but forced refreshes start a separate request", async () => {
    let resolveFirst!: (value: Response) => void;
    const first = new Promise<Response>((resolve) => { resolveFirst = resolve; });
    const fetchMock = vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce(response(200, { data: user }));
    vi.stubGlobal("fetch", fetchMock);
    const store = await loadStore();

    const normal = store.refresh();
    const deduped = store.refresh();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const forced = store.refresh({ force: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect(forced).resolves.toEqual(user);
    resolveFirst(response(200, { data: user }));
    await expect(normal).resolves.toEqual(user);
  });

  it("does not let an older refresh overwrite a newer forced result", async () => {
    let resolveOlder!: (value: Response) => void;
    const older = new Promise<Response>((resolve) => { resolveOlder = resolve; });
    const newerUser = { ...user, name: "Newer Result" };
    const fetchMock = vi.fn()
      .mockReturnValueOnce(older)
      .mockResolvedValueOnce(response(200, { data: newerUser }));
    vi.stubGlobal("fetch", fetchMock);
    const store = await loadStore();

    const olderRefresh = store.refresh();
    await expect(store.refresh({ force: true })).resolves.toEqual(newerUser);
    resolveOlder(response(200, { data: user }));
    await expect(olderRefresh).resolves.toEqual(newerUser);
    expect(store.getClientAuthState().user).toEqual(newerUser);
  });
});
