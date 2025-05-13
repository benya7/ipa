export const ADRESSES_NŒUDS_RELAI_WS = [
  "/dns4/relay01.lon.riff.cc/tcp/443/wss/p2p/12D3KooWLrPDcPdo74cmEWHK7YNAg8kjRTrSAzaKNRxZSdKf9Ugm",
  "/dns4/relay02.lon.riff.cc/tcp/443/wss/p2p/12D3KooWJc7ojxQoamFMQfoDGnCiYZzByHNuRoyfJXe2rs3qSkSb",
  "/dns4/relay03.lon.riff.cc/tcp/443/wss/p2p/12D3KooWFpasiuwNcLv8V9tJHrjqHt44EdWGAo6xxR3K5yHhwcxt",
];

export const ADRESSES_NŒUDS_RELAI_RUST = [
  "/ip4/164.90.222.145/udp/9090/webrtc-direct/certhash/uEiAJOkKT64u6jmXV5YxncCoER5WXSO2HYE23Xpap651xMw/p2p/12D3KooWJ7P1yeoxB5mq3TwQh8YgmVhankjtT4rsVGZPUyf617aR",
  "/ip4/164.90.222.145/udp/9091/quic-v1/p2p/12D3KooWJ7P1yeoxB5mq3TwQh8YgmVhankjtT4rsVGZPUyf617aR",
  "/ip4/164.90.222.145/tcp/9092/p2p/12D3KooWJ7P1yeoxB5mq3TwQh8YgmVhankjtT4rsVGZPUyf617aR",
];

export const ADRESSES_PUBLIQUES_LIBP2P = [
  "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
  "/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa",
  "/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
  "/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",
];

export const ADRESSES_NŒUDS_INITIAUX = [
  ...ADRESSES_NŒUDS_RELAI_RUST,
  ...ADRESSES_NŒUDS_RELAI_WS,
];

// Pour développement
export const ADRESSES_NŒUDS_RELAI_LOCAL = [
  "/ip4/127.0.0.1/tcp/12345/ws/p2p/12D3KooWLEh5DYcoNyDfNqR9vGUxApxUPRyHnrjSWGHn3YwNM5tT",
  "/ip4/127.0.0.1/udp/9090/webrtc-direct/certhash/uEiAWCRG30KUzLUuWYZ9HZNcFBHt8uLjLRB2xlLW_L_8lQg/p2p/12D3KooWKeJNXytogRbQPvYrFxXAaDGaJUfysrPeGbbEBDM78iTu",
  "/ip4/127.0.0.1/udp/9091/quic-v1/p2p/12D3KooWKeJNXytogRbQPvYrFxXAaDGaJUfysrPeGbbEBDM78iTu",
  "/ip4/127.0.0.1/tcp/9092/p2p/12D3KooWKeJNXytogRbQPvYrFxXAaDGaJUfysrPeGbbEBDM78iTu",
];
