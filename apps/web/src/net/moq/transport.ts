import * as Moq from '@moq/net';
import { Input, Snapshot, TimelineChunk } from '../../generated/temporal_heist.ts';
export const MAX_SNAPSHOT_BYTES = 64 * 1024;
export const MAX_HISTORY_BYTES = 2 * 1024 * 1024;
export interface TransportHandlers {
  snapshot(snapshot: Snapshot): void;
  history(chunk: TimelineChunk): void;
  state(state: string): void;
  error(error: unknown): void;
}
type ProducerTrack = ReturnType<Moq.Broadcast.Producer['createTrack']>;
interface ConsumerTrack {
  subscribe(options: { ordered: boolean; latencyMax: number }): {
    recvGroup(): Promise<{ readFrame(): Promise<{ payload: Uint8Array } | undefined> } | undefined>;
  };
}
export class MoqTransport {
  #connection?: Awaited<ReturnType<typeof Moq.Connection.connect>>;
  #motion?: ProducerTrack;
  #actions?: ProducerTrack;
  #closed = false;
  #failed = false;
  constructor(readonly handlers: TransportHandlers) {}
  async connect(relay: URL, room: string, playerId: number) {
    this.#closed = false;
    this.#failed = false;
    this.handlers.state('connecting');
    const connection = await Moq.Connection.connect(relay, { websocket: { enabled: false } });
    if (this.#closed) {
      connection.close();
      return;
    }
    this.#connection = connection;
    const input = new Moq.Broadcast.Producer();
    this.#motion = input.createTrack('motion', { latencyMax: 30_000 });
    this.#actions = input.createTrack('actions', { latencyMax: 30_000 });
    connection.publish(Moq.Path.from(`th/room/${room}/input/${playerId}`), input);
    const authorityPath = `th/room/${room}/authority`;
    const announced = connection.announced();
    for (;;) {
      const event = await announced.next();
      if (!event) throw new Error(`authority announcement ended: ${authorityPath}`);
      if (event.path === authorityPath && event.active) break;
      if (this.#closed) return;
    }
    announced.close();
    this.handlers.state(`connected:${connection.transport}`);
    const authority = connection.consume(Moq.Path.from(authorityPath));
    void this.#receive('world', authority.track('world'), MAX_SNAPSHOT_BYTES, (bytes) =>
      this.handlers.snapshot(Snapshot.decode(bytes)),
    );
    void this.#receive('history', authority.track('history'), MAX_HISTORY_BYTES, (bytes) =>
      this.handlers.history(TimelineChunk.decode(bytes)),
    );
  }
  sendMotion(input: Input) {
    this.#write(this.#motion, Input.encode(input).finish());
  }
  sendAction(input: Input) {
    this.#write(this.#actions, Input.encode(input).finish());
  }
  close() {
    this.#closed = true;
    this.#connection?.close();
    this.#connection = undefined;
    this.#motion = undefined;
    this.#actions = undefined;
  }
  async #receive(
    name: string,
    track: ConsumerTrack,
    maxBytes: number,
    decode: (bytes: Uint8Array) => void,
  ) {
    try {
      const subscription = track.subscribe({ ordered: true, latencyMax: 30_000 });
      while (!this.#closed) {
        const group = await subscription.recvGroup();
        if (!group) break;
        for (;;) {
          const frame = await group.readFrame();
          if (!frame) break;
          if (this.#closed) return;
          if (frame.payload.byteLength > maxBytes)
            throw new Error(`authority ${name} frame exceeds ${maxBytes} bytes`);
          decode(frame.payload);
        }
      }
      this.#fail(new Error(`authority ${name} track ended`));
    } catch (error) {
      this.#fail(error);
    }
  }
  #fail(error: unknown) {
    if (this.#closed || this.#failed) return;
    this.#failed = true;
    this.handlers.error(error);
  }
  #write(track: ProducerTrack | undefined, payload: Uint8Array) {
    if (!track) return;
    try {
      Promise.resolve(track.writeFrame({ payload, timestamp: Moq.Time.Timestamp.now() })).catch(
        (error) => this.#fail(error),
      );
    } catch (error) {
      this.#fail(error);
    }
  }
}
