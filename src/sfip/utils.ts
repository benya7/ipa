import type { AddrInfo } from "@chainsafe/libp2p-gossipsub/dist/src/types";
import { multiaddr } from "@multiformats/multiaddr";
import { peerIdFromString } from '@libp2p/peer-id'

export const résoudreInfoAdresses = (adresses: string[]): AddrInfo[] => {
  const infos: AddrInfo[] = [];
  for (const adresse of adresses) {
    const ma = multiaddr(adresse);
    const idPaire = ma.getPeerId();
    if (!idPaire) continue;
    const info: AddrInfo = infos.find(i => i.id.toString() === idPaire) || {
        id:  peerIdFromString(idPaire),
        addrs: []
    }
    info.addrs.push(ma);
  }
  return infos
}