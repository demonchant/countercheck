import { createHash } from "node:crypto";
import * as ed25519 from "@noble/ed25519";

// Concordium's account transaction digest code uses noble-ed25519's synchronous
// SHA-512 hook. The package's Node shim enables WebCrypto, but leaves this hook
// unset. Use Node's built-in SHA-512 implementation for deterministic Node use.
if (!ed25519.etc.sha512Sync) {
  ed25519.etc.sha512Sync = (...messages) => createHash("sha512")
    .update(Buffer.concat(messages.map((message) => Buffer.from(message))))
    .digest();
}
