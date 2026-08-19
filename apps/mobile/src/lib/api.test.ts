// `api.ts` reads EXPO_PUBLIC_API_URL into a module-level constant at import
// time, so the env var must be set before each fresh `require` of the module.
const TOKEN = 'session-token';

function mockFetchOnce(response: Partial<Response> & { json: () => Promise<unknown> }) {
  global.fetch = jest.fn().mockResolvedValue(response) as never;
}

function loadApi(): typeof import('./api') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamic reload after resetModules()
  return require('./api');
}

beforeEach(() => {
  jest.resetModules();
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('tetherApi.me error handling', () => {
  it('returns the parsed payload on success', async () => {
    const { tetherApi } = loadApi();
    mockFetchOnce({ ok: true, status: 200, json: async () => ({ user: { id: 'u1' } }) });

    const result = await tetherApi.me(TOKEN);

    expect(result).toEqual({ user: { id: 'u1' } });
  });

  it('throws ApiError with the server-provided detail on failure', async () => {
    const { tetherApi, ApiError } = loadApi();
    mockFetchOnce({ ok: false, status: 400, json: async () => ({ detail: 'Bad request' }) });

    await expect(tetherApi.me(TOKEN)).rejects.toMatchObject(new ApiError('Bad request', 400));
  });

  it('falls back to a generic message when there is no detail body', async () => {
    const { tetherApi, ApiError } = loadApi();
    mockFetchOnce({ ok: false, status: 500, json: async () => null });

    await expect(tetherApi.me(TOKEN)).rejects.toMatchObject(
      new ApiError('Something went wrong. Please try again.', 500),
    );
  });

  it('wraps network failures in an ApiError', async () => {
    const { tetherApi, ApiError } = loadApi();
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as never;

    await expect(tetherApi.me(TOKEN)).rejects.toBeInstanceOf(ApiError);
  });

  it('triggers the session-expired handler exactly once on a 401', async () => {
    const { tetherApi, setSessionExpiredHandler, ApiError } = loadApi();
    const handler = jest.fn();
    setSessionExpiredHandler(handler);
    mockFetchOnce({ ok: false, status: 401, json: async () => ({ detail: 'unauthorized' }) });

    await expect(tetherApi.me(TOKEN)).rejects.toBeInstanceOf(ApiError);
    await expect(tetherApi.me(TOKEN)).rejects.toBeInstanceOf(ApiError);

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
