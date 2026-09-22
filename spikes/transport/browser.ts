import * as Moq from '@moq/net';

async function run() {
  const connection = await Moq.Connection.connect(new URL('http://relay:4443/anon'), {websocket: {enabled: false}});
  const broadcast = new Moq.Broadcast.Producer();
  const track = broadcast.createTrack('input', {latencyMax: 30_000});
  connection.publish(Moq.Path.from('spike/browser'), broadcast);
  const remote = connection.consume(Moq.Path.from('spike/authority')).track('reply');
  const subscription = remote.subscribe({ordered: true, latencyMax: 30_000});
  const timer = setInterval(() => track.writeFrame({payload: new TextEncoder().encode('browser-to-rust'), timestamp: Moq.Time.Timestamp.now()}), 250);
  const group = await subscription.recvGroup();
  const frame = await group?.readFrame();
  clearInterval(timer);
  const result = {transport: connection.transport, version: connection.version, payload: new TextDecoder().decode(frame?.payload)};
  document.querySelector('#status')!.textContent = JSON.stringify(result);
  (window as any).spikeResult = result;
}
run().catch(error => { document.querySelector('#status')!.textContent = String(error); (window as any).spikeError = String(error); });
