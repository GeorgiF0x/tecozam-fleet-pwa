// ─── WebAuthn helpers (lado cliente) ──────────────────────────────────────────
// Las opciones que llegan del backend (yubico) traen los buffers como base64url.
// El navegador los necesita como ArrayBuffer para llamar a
// navigator.credentials.create() / get(). Esta capa convierte ida y vuelta.

export function base64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlDecode(input: string): ArrayBuffer {
  let s = input.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4 !== 0) s += "=";
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ─── Convert raw options JSON → PublicKeyCredentialCreationOptions ─────────────

type RawCreationOptions = {
  publicKey: {
    challenge: string;
    user: { id: string; name: string; displayName: string };
    rp: { id?: string; name: string };
    pubKeyCredParams: Array<{ alg: number; type: "public-key" }>;
    excludeCredentials?: Array<{ id: string; type: "public-key"; transports?: AuthenticatorTransport[] }>;
    authenticatorSelection?: AuthenticatorSelectionCriteria;
    timeout?: number;
    attestation?: AttestationConveyancePreference;
    extensions?: AuthenticationExtensionsClientInputs;
    hints?: string[];
  };
};

export function parseCreationOptions(json: string): CredentialCreationOptions {
  const raw = JSON.parse(json) as RawCreationOptions;
  const pk = raw.publicKey;
  return {
    publicKey: {
      challenge: base64urlDecode(pk.challenge),
      rp: pk.rp,
      user: {
        ...pk.user,
        id: base64urlDecode(pk.user.id),
      },
      pubKeyCredParams: pk.pubKeyCredParams,
      excludeCredentials: pk.excludeCredentials?.map((c) => ({
        ...c,
        id: base64urlDecode(c.id),
      })),
      authenticatorSelection: pk.authenticatorSelection,
      timeout: pk.timeout,
      attestation: pk.attestation,
      extensions: pk.extensions,
    } as PublicKeyCredentialCreationOptions,
  };
}

// ─── Convert raw options JSON → PublicKeyCredentialRequestOptions ─────────────

type RawRequestOptions = {
  publicKey: {
    challenge: string;
    rpId?: string;
    timeout?: number;
    userVerification?: UserVerificationRequirement;
    allowCredentials?: Array<{ id: string; type: "public-key"; transports?: AuthenticatorTransport[] }>;
    extensions?: AuthenticationExtensionsClientInputs;
  };
};

export function parseRequestOptions(json: string): CredentialRequestOptions {
  const raw = JSON.parse(json) as RawRequestOptions;
  const pk = raw.publicKey;
  return {
    publicKey: {
      challenge: base64urlDecode(pk.challenge),
      rpId: pk.rpId,
      timeout: pk.timeout,
      userVerification: pk.userVerification,
      allowCredentials: pk.allowCredentials?.map((c) => ({
        ...c,
        id: base64urlDecode(c.id),
      })),
      extensions: pk.extensions,
    } as PublicKeyCredentialRequestOptions,
  };
}

// ─── Serializar PublicKeyCredential → JSON apto para el backend yubico ────────

export function credentialToJson(cred: PublicKeyCredential): string {
  const attResp = cred.response as AuthenticatorAttestationResponse | undefined;
  const assResp = cred.response as AuthenticatorAssertionResponse | undefined;
  const base: Record<string, unknown> = {
    id: cred.id,
    rawId: base64urlEncode(cred.rawId),
    type: cred.type,
    clientExtensionResults: cred.getClientExtensionResults(),
    authenticatorAttachment: cred.authenticatorAttachment,
  };
  if (attResp && "attestationObject" in attResp) {
    base.response = {
      clientDataJSON: base64urlEncode(attResp.clientDataJSON),
      attestationObject: base64urlEncode(attResp.attestationObject),
      transports: attResp.getTransports?.() ?? [],
    };
  } else if (assResp && "authenticatorData" in assResp) {
    base.response = {
      clientDataJSON: base64urlEncode(assResp.clientDataJSON),
      authenticatorData: base64urlEncode(assResp.authenticatorData),
      signature: base64urlEncode(assResp.signature),
      userHandle: assResp.userHandle ? base64urlEncode(assResp.userHandle) : null,
    };
  }
  return JSON.stringify(base);
}

// ─── Disponibilidad biométrica ────────────────────────────────────────────────

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (typeof window === "undefined" || !("PublicKeyCredential" in window)) {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}
