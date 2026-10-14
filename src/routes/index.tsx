import { createFileRoute } from "@tanstack/react-router";
import { Game } from "../game/Game";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Linefield — Explore the Neon Megacity" },
      { name: "description", content: "A browser voxel sandbox: mine, build, and survive day and night with saved worlds." },
      { property: "og:title", content: "Linefield — Explore the Neon Megacity" },
      { property: "og:description", content: "Mine, build, and survive day and night in a 3D voxel world that saves automatically." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Game,
});
