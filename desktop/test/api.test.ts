import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { createApi, type PendingAnswer } from "../src/api.ts";

const answer: PendingAnswer = {
  id: "11111111-1111-1111-1111-111111111111",
  sessionItemId: "22222222-2222-2222-2222-222222222222",
  answeredAt: "2026-09-28T12:00:00.000Z",
  booleanChoice: true,
  optionId: null,
  writtenText: null,
  equivalent: null,
};

async function withServer(
  handler: (status: number, body: string) => { status: number; body: string },
  run: (baseUrl: string) => Promise<void>,
) {
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const result = handler(0, Buffer.concat(chunks).toString("utf8"));
      response.writeHead(result.status, { "content-type": "application/json" });
      response.end(result.body);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("una respuesta aplicada, rechazada o sin token se traduce al estado de la bandeja", async () => {
  await withServer(
    () => ({ status: 200, body: JSON.stringify({ results: [{ status: "applied", outcome: "pleno" }] }) }),
    async (baseUrl) => {
      const api = createApi(baseUrl, () => "token");
      assert.deepEqual(await api.submitAnswer(answer), { status: "applied" });
    },
  );
  await withServer(
    () => ({ status: 422, body: JSON.stringify({ results: [{ status: "rejected" }] }) }),
    async (baseUrl) => {
      const api = createApi(baseUrl, () => "token");
      assert.deepEqual(await api.submitAnswer(answer), { status: "rejected" });
    },
  );
  await withServer(
    () => ({ status: 401, body: JSON.stringify({ error: "token" }) }),
    async (baseUrl) => {
      const api = createApi(baseUrl, () => "token");
      assert.deepEqual(await api.submitAnswer(answer), { status: "unauthorized" });
    },
  );
});

test("un fallo de red al enviar la respuesta se propaga", async () => {
  const api = createApi("http://127.0.0.1:1", () => "token");
  await assert.rejects(() => api.submitAnswer(answer), /red/);
});
