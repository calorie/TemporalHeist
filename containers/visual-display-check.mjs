import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const timeoutMs = 10_000;
const processPidFiles = new Map([
  ['xvfb', '/tmp/xvfb.pid'],
  ['x11vnc', '/tmp/x11vnc.pid'],
  ['websockify', '/tmp/websockify.pid'],
]);

for (const [processName, pidFile] of processPidFiles) {
  const pid = Number((await readFile(pidFile, 'utf8')).trim());
  assert(Number.isSafeInteger(pid) && pid > 1, `${processName} PID is invalid`);
  process.kill(pid, 0);
}

const socket = new WebSocket('ws://127.0.0.1:6080/websockify');
socket.binaryType = 'arraybuffer';
const decoder = new TextDecoder();
const encoder = new TextEncoder();

await new Promise((resolve, reject) => {
  let stage = 'banner';
  const timeout = setTimeout(() => reject(new Error('RFB handshake timed out')), timeoutMs);
  const fail = (error) => {
    clearTimeout(timeout);
    reject(error instanceof Error ? error : new Error(String(error)));
  };

  socket.addEventListener('error', () => fail(new Error('noVNC WebSocket failed')));
  socket.addEventListener('message', ({ data }) => {
    try {
      const bytes = new Uint8Array(data);
      if (stage === 'banner') {
        assert.equal(decoder.decode(bytes), 'RFB 003.008\n');
        socket.send(encoder.encode('RFB 003.008\n'));
        stage = 'security-types';
        return;
      }
      assert(bytes.length >= 2, 'RFB security-types response is incomplete');
      assert(bytes[0] > 0, 'RFB server offered no security type');
      clearTimeout(timeout);
      resolve();
    } catch (error) {
      fail(error);
    }
  });
});

socket.close();
console.log(JSON.stringify({
  event: 'visual-display-ready',
  processes: [...processPidFiles.keys()],
  rfb: '003.008',
}));
