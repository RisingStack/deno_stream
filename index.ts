import { varnum } from "https://deno.land/std@0.50.0/encoding/binary.ts";

enum PacketType {
  SERVERDATA_AUTH = 3,
  SERVERDATA_AUTH_RESPONSE = 2,
  SERVERDATA_EXECCOMMAND = 2,
  SERVERDATA_RESPONSE_VALUE = 0,
}

const nullTerminator = new Uint8Array(0);

class Packet {
  constructor(
    public ID: number,
    public Type: PacketType,
    public Body: string,
  ) {}

  toNetwork(): Uint8Array {
    const id = toLEUI32(this.ID);
    const type = toLEUI32(this.Type);
    const body = this.Body && this.Body.length
      ? new TextEncoder().encode([this.Body, "\u0000"].join())
      : new Uint8Array([0]);

    const size = toLEUI32(8 + body.byteLength);

    return concatArrayBuffers(size, id, type, body, nullTerminator);
  }

  static fromNetwork(buf: Uint8Array): Packet {
    return new Packet(1, 2, "alma");
  }
}

function concatArrayBuffers(...bufs: ArrayBuffer[]) {
  const length = bufs.reduce(
    (length, { byteLength }) => length + byteLength,
    0,
  );

  const result = new Uint8Array(length);

  bufs.reduce((offset, buf) => {
    const currentBuf = new Uint8Array(buf);
    result.set(currentBuf, offset);
    return offset + buf.byteLength;
  }, 0);

  return result;
}

function toLEUI32(num: number) {
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setInt32(0, num, true);
  return buf;
}

const connection = await Deno.connect({
  port: 27015,
  hostname: "localhost",
  transport: "tcp",
});

const serverDataAuth = new Packet(
  123,
  PacketType.SERVERDATA_AUTH,
  "aeYoqu2Aeh4see3",
);
await connection.write(serverDataAuth.toNetwork());

const authResponseRawSize = new Uint8Array(4);
await connection.read(authResponseRawSize);

const authResponseSize = varnum(
  authResponseRawSize,
  { endian: "little", dataType: "int8" },
);

const authResponse = new Uint8Array(authResponseSize!);

await connection.read(authResponse);

const responsePacketIdRaw = authResponse.slice(0, 4);
const responsePacketId = varnum(
  responsePacketIdRaw,
  { endian: "little", dataType: "int8" },
);

if (responsePacketId === -1) {
  throw new Error("Wrong password!");
}

if (serverDataAuth.ID !== responsePacketId) {
  throw new Error(
    `:( IDs are not the same ${serverDataAuth.ID} ${responsePacketId}`,
  );
}

const typeRaw = authResponse.slice(4, 8);
const type = varnum(
  typeRaw,
  { endian: "little", dataType: "int8" },
);

if (type !== PacketType.SERVERDATA_AUTH_RESPONSE) {
  throw new Error(":(");
}

const bodyRaw = authResponse.slice(8, authResponse.byteLength - 1);
new TextDecoder().decode(bodyRaw);
