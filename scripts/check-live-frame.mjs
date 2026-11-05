// 실시간 재현 화면 메시지 해석(live-frame.ts) 자체 점검. 의존성 없이 Node(타입 제거 지원, 22.18+)로 돌린다.
//   node scripts/check-live-frame.mjs
import assert from "node:assert/strict";
import {
  backoffDelay,
  closeAction,
  decodeLiveFrame,
  parseLiveText,
} from "../app/(admin)/reports/[id]/live-frame.ts";

const JOB = "a".repeat(32);

function frame(meta, jpeg) {
  const header = new TextEncoder().encode(JSON.stringify(meta));
  const out = new Uint8Array(4 + header.length + jpeg.length);
  new DataView(out.buffer).setUint32(0, header.length, false);
  out.set(header, 4);
  out.set(jpeg, 4 + header.length);
  return out.buffer;
}

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
const meta = {
  schema_version: "live-1",
  kind: "frame",
  sequence: 7,
  created_at: "2026-11-06T00:00:00+00:00",
  job_id: JOB,
  stream: 1,
  data: {
    attempt: 1, revision: 0, phase: "action", step_index: 2, action: "click", total_steps: 5,
    mime_type: "image/jpeg", width: 960, height: 540, bytes: jpeg.length, masked: true,
  },
};

// 정상 프레임
const decoded = decodeLiveFrame(frame(meta, jpeg));
assert.equal(decoded.sequence, 7);
assert.equal(decoded.stream, 1);
assert.equal(decoded.width, 960);
assert.deepEqual(new Uint8Array(decoded.jpeg), jpeg);
assert.equal(decoded.progress.step_index, 2);
assert.equal(decoded.progress.action, "click");

// 깨진 프레임은 모두 거부
const bad = [
  new ArrayBuffer(3),
  frame({ ...meta, data: { ...meta.data, bytes: jpeg.length + 1 } }, jpeg),
  frame({ ...meta, schema_version: "live-2" }, jpeg),
  frame({ ...meta, kind: "progress" }, jpeg),
  frame({ ...meta, data: { ...meta.data, mime_type: "image/png" } }, jpeg),
  frame({ ...meta, sequence: "7" }, jpeg),
  frame(meta, new Uint8Array(0)),
  (() => { const b = new Uint8Array(frame(meta, jpeg)); new DataView(b.buffer).setUint32(0, 5000, false); return b.buffer; })(),
  (() => { const b = new Uint8Array(frame(meta, jpeg)); new DataView(b.buffer).setUint32(0, b.length, false); return b.buffer; })(),
  (() => { const big = new Uint8Array(512 * 1024 + 1); return frame({ ...meta, data: { ...meta.data, bytes: big.length } }, big); })(),
];
for (const [index, buffer] of bad.entries()) {
  assert.throws(() => decodeLiveFrame(buffer), Error, `bad frame #${index} must be rejected`);
}

// text 메시지
assert.deepEqual(parseLiveText(JSON.stringify({ schema_version: "live-relay-1", kind: "heartbeat", at: "x" })), { kind: "heartbeat" });
const relay = parseLiveText(JSON.stringify({
  schema_version: "live-relay-1", kind: "relay_state", job_id: JOB, report_id: "r", job_status: "running",
  preview: "live", stream: 2, condition_id: null, updated_at: "x",
}));
assert.equal(relay?.kind, "relay_state");
assert.equal(relay?.preview, "live");
assert.equal(relay?.stream, 2);
const progress = parseLiveText(JSON.stringify({
  schema_version: "live-1", kind: "progress", sequence: 3, created_at: "x", job_id: JOB, stream: 1,
  data: { attempt: 0, revision: -1, phase: "attempt_started", step_index: null, action: null, total_steps: null },
}));
assert.equal(progress?.kind, "progress");
assert.equal(progress?.progress.phase, "attempt_started");
assert.equal(progress?.progress.step_index, null);
assert.equal(parseLiveText("not json"), null);
assert.equal(parseLiveText(JSON.stringify({ schema_version: "live-1", kind: "frame", sequence: 1 })), null);
assert.equal(parseLiveText(JSON.stringify({ schema_version: "live-1", kind: "status", job_id: JOB })), null);

// close code
assert.equal(closeAction(1000, "JOB_ENDED"), "ended");
assert.equal(closeAction(1008, ""), "stop");
assert.equal(closeAction(4401, "TICKET_INVALID"), "new-ticket");
assert.equal(closeAction(4401, "UNAUTHENTICATED"), "login");
assert.equal(closeAction(4404, "NOT_FOUND"), "hide");
for (const code of [4429, 4408, 1006, 1011]) assert.equal(closeAction(code, ""), "backoff");

// backoff: 1초부터 두 배, 최대 30초
assert.equal(backoffDelay(0, 1), 1000);
assert.equal(backoffDelay(3, 1), 8000);
assert.equal(backoffDelay(20, 1), 30000);
assert.ok(backoffDelay(20, 0) >= 22500);

console.log("live-frame: ok");
