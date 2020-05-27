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

  static fromNetwork(response: Uint8Array, request: Packet): Packet {
    const responsePacketIdRaw = response.slice(0, 4);
    const responsePacketId = varnum(
      responsePacketIdRaw,
      { endian: "little", dataType: "int8" },
    );

    if (responsePacketId === -1) {
      throw new Error("Wrong password!");
    }

    if (responsePacketId !== request.ID) {
      throw new Error("IDs don't match");
    }

    const typeRaw = response.slice(4, 8);
    const type = varnum(
      typeRaw,
      { endian: "little", dataType: "int8" },
    );

    const bodyRaw = response.slice(8, response.byteLength - 2);
    const body = new TextDecoder().decode(bodyRaw);

    return new Packet(responsePacketId!, type!, body);
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

type Maybe<T> = T | null;

class RCONServer {
  connection: Maybe<Deno.Conn>;
  constructor(
    private readonly port: number,
    private readonly hostname: string,
    private readonly password: string,
    private readonly transport?: "tcp",
  ) {
    this.connection = null;
  }

  async connect() {
    this.connection = await Deno.connect({
      port: this.port,
      hostname: this.hostname,
      transport: this.transport,
    });

    await this.sendPacket(
      new Packet(123, PacketType.SERVERDATA_AUTH, this.password),
    );
  }

  private async sendPacket(request: Packet): Promise<Packet> {
    if (!this.connection) {
      throw new Error("Connection was not initialized, call .connect() first");
    }

    this.connection.write(request.toNetwork());

    const rawSize = new Uint8Array(4);
    await this.connection.read(rawSize);

    const size = varnum(
      rawSize,
      { endian: "little", dataType: "int8" },
    );

    const response = new Uint8Array(size!);
    await this.connection.read(response);
    return Packet.fromNetwork(response, request);
  }

  async execCommand(command: string): Promise<string> {
    const response = await rconServer.sendPacket(
      new Packet(
        124,
        PacketType.SERVERDATA_EXECCOMMAND,
        command,
      ),
    );

    return response.Body;
  }
}

const rconServer = new RCONServer(27015, "localhost", "aeYoqu2Aeh4see3", "tcp");
await rconServer.connect();

const players = await rconServer.execCommand(
  "/players",
);

console.log(players);
