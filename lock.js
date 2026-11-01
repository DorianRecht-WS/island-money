// The app lock: your phone's own fingerprint, face or screen-lock code (a passkey, WebAuthn) decides whether the app opens.
// When you turn it on, the device makes a key that only unlocks with you; later "unlock" asks the device to prove it is you again.
// Honest limit: this keeps people who pick up your phone out of the app. It is not a vault: the check runs on this device, so someone
// with the tools to take apart the page could skip it. Your data stays protected by the sign-in and by Supabase either way.
const makeLock = (KEY) => {
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const random = (n) => crypto.getRandomValues(new Uint8Array(n));

  // can this device check you (a fingerprint reader, a face scan, or at least a screen-lock code)?
  async function supported() {
    try { return !!(window.PublicKeyCredential && navigator.credentials && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch { return false; }
  }
  const enabled = () => !!(read() && read().id);

  // turning it on: the device creates the key (and asks for your finger, face or code once)
  async function enable(label) {
    const name = label || 'Island Money';
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: random(32), rp: { name: 'Island Money', id: location.hostname },
      user: { id: random(16), name, displayName: name },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000, attestation: 'none',
    } });
    localStorage.setItem(KEY, JSON.stringify({ id: b64(cred.rawId), at: Date.now() }));
  }

  // unlocking: resolves when the device says it is you, throws when it was cancelled or failed
  async function verify(signal) {
    const s = read();
    if (!s) return true;
    await navigator.credentials.get({ publicKey: {
      challenge: random(32), rpId: location.hostname, allowCredentials: [{ type: 'public-key', id: unb64(s.id) }],
      userVerification: 'required', timeout: 60000,
    }, signal });
    return true;
  }
  const disable = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };
  return { supported, enabled, enable, verify, disable };
};
window.AppLock = makeLock('money.lock');   // opens the app
window.PayLock = makeLock('money.pay');   // opens the card on the Pay tab
