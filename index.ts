import { varnum } from "https://deno.land/std@0.50.0/encoding/binary.ts";

class Packet {
  constructor(private ID: number, private Type: number, private Body: string) {}

  toNetwork(): Uint8Array {
    const id = toLEUI32(this.ID);
    const type = toLEUI32(this.Type);
    const body =
      this.Body && this.Body.length
        ? new TextEncoder().encode(this.Body)
        : new Uint8Array(0);
    const size = toLEUI32(id.byteLength + type.byteLength + body.byteLength);
    const end = new Uint8Array(0);

    return concatArrayBuffers(size, id, type, body, end);
  }

  static fromNetwork (buf: Uint8Array)  : Packet {
    return new Packet(1,2,'alma');
  }
}

function concatArrayBuffers(...bufs: ArrayBuffer[]) {
  const length = bufs.reduce(
    (length, { byteLength }) => length + byteLength,
    0
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
  view.setUint32(0, num, true);
  return buf;
}

const connection = await Deno.connect({
  port: 27015,
  hostname: "localhost",
  transport: "tcp",
});

const serverDataAuth = new Packet(123, 3, "he1Quu7eekiecho");

await connection.write(serverDataAuth.toNetwork());

const authResponseRawSize = new Uint8Array(4);
await connection.read(authResponseRawSize);

const authResponseSize = varnum(authResponseRawSize, { endian: "little" });

const authResponse = new Uint8Array(authResponseSize!);

await connection.read(authResponse);
console.log(authResponse);

const response = new TextDecoder().decode(authResponse)
console.log(response);
