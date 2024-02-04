import { identify } from "@libp2p/identify";
import { webSockets } from "@libp2p/websockets";
import { webRTC } from "@libp2p/webrtc";
import { webTransport } from "@libp2p/webtransport";
import { bootstrap } from "@libp2p/bootstrap";
import { all } from "@libp2p/websockets/filters";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import type { Libp2pOptions } from "libp2p";
import { WEBRTC_BOOTSTRAP_NODE, WEBTRANSPORT_BOOTSTRAP_NODE } from "./const.js";

export const OptionsLibp2pNavigateur: Libp2pOptions = {
  addresses: {
    listen: ["/webrtc"],
  },
  transports: [
    webSockets({
      filter: all,
    }),
    webRTC(),
    webTransport(),
    circuitRelayTransport({
      discoverRelays: 1,
    }),
  ],
  connectionEncryption: [noise()],
  streamMuxers: [yamux()],
  connectionGater: {
    denyDialMultiaddr: () => false,
  },
  peerDiscovery: [
    bootstrap({
      list: [WEBRTC_BOOTSTRAP_NODE, WEBTRANSPORT_BOOTSTRAP_NODE],
      tagTTL: Infinity,
    }),
  ],
  services: {
    identify: identify(),
    pubsub: gossipsub({ allowPublishToZeroPeers: true }),
  },
};
