import { RCONServer } from './index.ts';

const rconServer = new RCONServer(27015, "localhost", "aeYoqu2Aeh4see3", "tcp");
await rconServer.connect();

const players = await rconServer.execCommand(
  "/players",
);

console.log(players);
