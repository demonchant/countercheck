import test from "node:test";
import assert from "node:assert/strict";
import { resolveOllamaBaseUrl } from "../src/ollama-config.mjs";

test("Ollama defaults to loopback and accepts local HTTP/HTTPS endpoints", () => {
  assert.equal(resolveOllamaBaseUrl(), "http://127.0.0.1:11434");
  assert.equal(resolveOllamaBaseUrl("http://localhost:11434", "false"), "http://localhost:11434");
  assert.equal(resolveOllamaBaseUrl("http://[::1]:11434", "false"), "http://[::1]:11434");
  assert.equal(resolveOllamaBaseUrl("https://127.0.0.1:11434", "false"), "https://127.0.0.1:11434");
});

test("remote Ollama endpoints need explicit opt-in and HTTPS", () => {
  assert.throws(() => resolveOllamaBaseUrl("https://model.example.test"), /blocked/u);
  assert.throws(() => resolveOllamaBaseUrl("http://model.example.test", "true"), /HTTPS/u);
  assert.equal(resolveOllamaBaseUrl("https://model.example.test:11434", "true"), "https://model.example.test:11434");
});

test("Ollama URL and remote opt-in reject ambiguous or credential-bearing configuration", () => {
  for (const allowRemote of ["TRUE", "1", "yes"]) {
    assert.throws(() => resolveOllamaBaseUrl("http://127.0.0.1:11434", allowRemote), /exactly true or false/u);
  }
  for (const url of [
    "ftp://localhost:11434",
    "http://user:pass@127.0.0.1:11434",
    "http://127.0.0.1:11434/api",
    "http://127.0.0.1:11434/?token=private",
    "http://127.0.0.1:11434/#fragment",
  ]) {
    assert.throws(() => resolveOllamaBaseUrl(url, "false"));
  }
});
