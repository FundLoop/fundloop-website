// Repo-tracked Deno mirror for the unpublished @cubid/api runtime used by Supabase Edge Functions.
// Keep this aligned with the vendored Cubid package until the package ships a stable Deno/Edge entrypoint.

const DEFAULT_CUBID_API_BASE_URL = "https://passport.cubid.me/api/v2";

class CubidApiError extends Error {
  constructor({ code, endpoint, message, rawPayload, status }) {
    super(message);
    this.name = "CubidApiError";
    this.code = code;
    this.endpoint = endpoint;
    this.rawPayload = rawPayload;
    this.status = status;
  }
}

function isCubidApiError(error) {
  return error instanceof CubidApiError;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value) {
  return typeof value === "string" ? value : null;
}

function asNumber(value) {
  return typeof value === "number" ? value : undefined;
}

function asCoordinates(value) {
  if (!isRecord(value)) {
    return undefined;
  }

  const lat = value.lat;
  const lng = value.lng;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return undefined;
  }

  return { lat, lng };
}

function extractErrorCode(payload) {
  if (!isRecord(payload)) {
    return undefined;
  }

  if (typeof payload.code === "string") {
    return payload.code;
  }

  return typeof payload.error === "string" ? payload.error : undefined;
}

function extractErrorMessage(payload, fallback) {
  if (typeof payload === "string" && payload.length > 0) {
    return payload;
  }

  if (isRecord(payload)) {
    if (typeof payload.message === "string" && payload.message.length > 0) {
      return payload.message;
    }

    if (typeof payload.error === "string" && payload.error.length > 0) {
      return payload.error;
    }
  }

  return fallback;
}

async function parseResponsePayload(response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function assertRecord(value, endpoint) {
  if (!isRecord(value)) {
    throw new CubidApiError({
      code: "MALFORMED_RESPONSE",
      endpoint,
      message: `Malformed response from ${endpoint}.`,
      rawPayload: value,
    });
  }

  return value;
}

function normalizeCreateUser(payload) {
  const record = assertRecord(payload, "create_user");
  return {
    error: record.error ?? null,
    isBlacklisted: Boolean(record.is_blacklisted),
    isNewAppUser: Boolean(record.is_new_app_user),
    isSybilAttack: Boolean(record.is_sybil_attack),
    userId: asString(record.user_id),
  };
}

function normalizeFetchIdentity(payload) {
  const record = assertRecord(payload, "identity/fetch_identity");
  const stampDetails = Array.isArray(record.stamp_details) ? record.stamp_details : [];
  return {
    error: record.error ?? null,
    stampDetails: stampDetails.map((item) => {
      const detail = assertRecord(item, "identity/fetch_identity");
      return {
        stampType: asString(detail.stamp_type) ?? "unknown",
        status: asString(detail.status),
        value: asString(detail.value),
      };
    }),
  };
}

function normalizeFetchScore(payload) {
  const record = assertRecord(payload, "score/fetch_score");
  return {
    cubidScore: typeof record.cubid_score === "number" ? record.cubid_score : 0,
    error: record.error ?? null,
    scoringSchema:
      typeof record.scoring_schema === "number" || typeof record.scoring_schema === "string"
        ? record.scoring_schema
        : null,
  };
}

function normalizeFetchStamps(payload) {
  const record = assertRecord(payload, "identity/fetch_stamps");
  const allStamps = Array.isArray(record.all_stamps) ? record.all_stamps : [];
  return {
    allStamps: allStamps.map((rawStamp) => {
      const stamp = assertRecord(rawStamp, "identity/fetch_stamps");
      return {
        emailForVerification: asString(stamp.emailForVerification),
        id: asNumber(stamp.id),
        identity: asString(stamp.identity),
        isValid: typeof stamp.is_valid === "boolean" ? stamp.is_valid : undefined,
        permAvailable: typeof stamp.permAvailable === "boolean" ? stamp.permAvailable : undefined,
        raw: stamp,
        stampType: asString(stamp.stamptype_string),
        stampTypeId: asNumber(stamp.stamptype),
        uniqueValue: asString(stamp.uniquevalue),
      };
    }),
    email: asString(record.email),
  };
}

function normalizeFetchUserData(payload) {
  const record = assertRecord(payload, "identity/fetch_user_data");
  return {
    coordinates: asCoordinates(record.coordinates),
    country: asString(record.country),
    error: record.error ?? null,
    name: asString(record.name),
    placeName: asString(record.placename),
  };
}

function toResolvedConfig(config) {
  const fetchImpl = config.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new CubidApiError({
      code: "MISSING_FETCH",
      endpoint: "config",
      message: "A fetch implementation is required to create the Cubid API client.",
      rawPayload: null,
    });
  }

  return {
    apiKey: config.apiKey,
    baseUrl: (config.baseUrl ?? DEFAULT_CUBID_API_BASE_URL).replace(/\/+$/, ""),
    dappId: config.dappId,
    fetch: fetchImpl,
    headers: config.headers,
  };
}

function createClientRequest(resolvedConfig) {
  return async function request(endpoint, body, normalize) {
    const url = `${resolvedConfig.baseUrl}/${endpoint}`;

    let response;
    try {
      response = await resolvedConfig.fetch(url, {
        body: JSON.stringify(body),
        headers: {
          "content-type": "application/json",
          ...resolvedConfig.headers,
        },
        method: "POST",
      });
    } catch (error) {
      throw new CubidApiError({
        code: "NETWORK_ERROR",
        endpoint,
        message: error instanceof Error ? error.message : `Request to ${endpoint} failed.`,
        rawPayload: error,
      });
    }

    const payload = await parseResponsePayload(response);
    if (!response.ok) {
      throw new CubidApiError({
        code: extractErrorCode(payload),
        endpoint,
        message: extractErrorMessage(payload, `Request to ${endpoint} failed.`),
        rawPayload: payload,
        status: response.status,
      });
    }

    try {
      return normalize(payload);
    } catch (error) {
      if (error instanceof CubidApiError) {
        throw error;
      }

      throw new CubidApiError({
        code: "MALFORMED_RESPONSE",
        endpoint,
        message: error instanceof Error ? error.message : `Malformed response from ${endpoint}.`,
        rawPayload: payload,
        status: response.status,
      });
    }
  };
}

function createCubidApiClient(config) {
  const resolvedConfig = toResolvedConfig(config);
  const request = createClientRequest(resolvedConfig);

  return {
    createUser: ({ email }) =>
      request("create_user", { apikey: resolvedConfig.apiKey, dapp_id: resolvedConfig.dappId, email }, normalizeCreateUser),
    fetchIdentity: ({ userId }) =>
      request("identity/fetch_identity", { apikey: resolvedConfig.apiKey, user_id: userId }, normalizeFetchIdentity),
    fetchScore: ({ userId }) =>
      request("score/fetch_score", { apikey: resolvedConfig.apiKey, dapp_id: resolvedConfig.dappId, user_id: userId }, normalizeFetchScore),
    fetchStamps: ({ userId }) =>
      request("identity/fetch_stamps", { apikey: resolvedConfig.apiKey, user_id: userId }, normalizeFetchStamps),
    fetchUserData: ({ userId }) =>
      request("identity/fetch_user_data", { apikey: resolvedConfig.apiKey, user_id: userId }, normalizeFetchUserData),
  };
}

export { CubidApiError, DEFAULT_CUBID_API_BASE_URL, createCubidApiClient, isCubidApiError };
