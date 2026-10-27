const DREF_PATH_BYTES = 500;
const RREF_PATH_BYTES = 400;

function datarefBytes(path: string, maxBytes: number): Buffer {
  if (!/^[a-zA-Z0-9_/-]+$/.test(path)) {
    throw new Error(`Invalid dataref path: ${path}`);
  }
  const encoded = Buffer.from(path, 'ascii');
  if (encoded.length >= maxBytes) {
    throw new Error('Dataref path is too long');
  }
  return encoded;
}

export function encodeDataref(path: string, value: number): Buffer {
  if (!Number.isFinite(value)) throw new Error('Dataref value must be finite');
  const packet = Buffer.alloc(509);
  packet.write('DREF\0', 0, 'ascii');
  packet.writeFloatLE(value, 5);
  datarefBytes(path, DREF_PATH_BYTES).copy(packet, 9);
  return packet;
}

export function encodeSubscription(path: string, frequency: number, index: number): Buffer {
  const packet = Buffer.alloc(413);
  packet.write('RREF\0', 0, 'ascii');
  packet.writeInt32LE(frequency, 5);
  packet.writeInt32LE(index, 9);
  datarefBytes(path, RREF_PATH_BYTES).copy(packet, 13);
  return packet;
}

export function decodeSubscriptions(packet: Buffer): Array<{ index: number; value: number }> {
  if (packet.length < 13 || packet.toString('ascii', 0, 5) !== 'RREF,') return [];
  const items: Array<{ index: number; value: number }> = [];
  for (let offset = 5; offset + 8 <= packet.length; offset += 8) {
    items.push({ index: packet.readInt32LE(offset), value: packet.readFloatLE(offset + 4) });
  }
  return items;
}
