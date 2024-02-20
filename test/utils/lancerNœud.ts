import { initSFIP } from "@/sfip/index.js";
console.log("on est ici");
initSFIP("./testSfip").then(async (sfip) => {
  console.log(
    "SFIP initialisé avec id de nœud :",
    sfip.libp2p.peerId.toString(),
  );
  sfip.libp2p.services.pubsub.subscribe("test");
  sfip.libp2p.services.pubsub.addEventListener("gossipsub:message", m => {
    if (m.detail.msg.topic === "test") {
      console.log(m.detail.msg.topic, new TextDecoder().decode(m.detail.msg.data));
      const message = new TextDecoder().decode(m.detail.msg.data)
      if (!message.includes("Retour")) {
        sfip.libp2p.services.pubsub.publish("test", new TextEncoder().encode("Retour :" + message))
      }
    }
  })
  sfip.libp2p.addEventListener("peer:discovery", async () => {
    const pairs = sfip.libp2p.getPeers();
    console.log(
      "pairs : ",
      pairs.map((p) => p.toString()),
    );
    const connexions = sfip.libp2p.getConnections();
    console.log(
      "connexions : ",
      JSON.stringify(
        connexions.map((c) => c.remoteAddr.toString()),
        undefined,
        2,
      ),
    );
  });
});
