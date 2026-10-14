// Starts the built standalone server with HOST=127.0.0.1, then with HOST=localhost,
// and reports whether "Server listening" was logged and whether it answers anyway.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

// A port that is free right now; the server is started on it so it can be probed
// even when it never says where it listens.
function freePort() {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function run(host) {
  const port = await freePort();
  const child = spawn(process.execPath, ['dist/server/entry.mjs'], {
    env: { ...process.env, HOST: host, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  child.stderr.on('data', (chunk) => {
    output += chunk;
  });

  await new Promise((resolve) => setTimeout(resolve, 3000));
  const answer = await fetch(`http://${host}:${port}/`)
    .then((response) => `HTTP ${response.status}`)
    .catch((error) => `no answer (${error.cause?.code ?? error.message})`);
  child.kill('SIGKILL');

  console.log(`--- HOST=${host} PORT=${port}`);
  console.log(`logged "Server listening": ${output.includes('Server listening') ? 'yes' : 'NO'}`);
  console.log(`GET /: ${answer}`);
  console.log(`output: ${output.trim() === '' ? '(none)' : `\n${output.trim()}`}\n`);
}

console.log(`node ${process.version}\n`);
await run('127.0.0.1');
await run('localhost');
