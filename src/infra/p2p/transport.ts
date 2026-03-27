import { createLibp2p } from "libp2p";
import { tcp } from "@libp2p/tcp";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { mdns } from "@libp2p/mdns";
import { bootstrap } from "@libp2p/bootstrap";
import { kadDHT } from "@libp2p/kad-dht";
import { ping } from "@libp2p/ping";
import { EventProtocol } from "../protocol/event.protocol";

const PROTOCOL = "../protocol/event.protocol";

const BOOTSTRAP_LIST: string[] = [

];

export async function createNode() {
    const node = await createLibp2p({
        addresses: {
            listen: ["/ip4/0.0.0.0/tcp/0"],
        },
        transports: [tcp()],
        connectionEncrypters: [noise()],
        streamMuxers: [yamux()],
        peerDiscovery: [
            bootstrap({
                list: BOOTSTRAP_LIST,
                timeout: 1_000,
                tagName: "bootstrap",
                tagValue: 50,
                tagTTL: 120_000,
            }),
        ],
        services: {
            ping: ping(),
            dht: kadDHT({
            }),
        },
    });

    node.addEventListener("peer:discovery", async (evt: any) => {
        const peerId = evt.detail.id ?? evt.detail;
        try {
            await node.dial(peerId);
        } catch (err) {
            console.error("Failed to dial discovered peer:", err);
        }
    });

    node.handle(PROTOCOL, ({ stream }: any) => {
        stream.addEventListener("message", (evt: any) => {
            
        });
    });

    await node.start();

    console.log("PeerId:", node.peerId.toString());
    console.log("Listening on:");
    node.getMultiaddrs().forEach((ma) => console.log(ma.toString()));

    return node;
}
