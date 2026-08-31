import { randomUUID } from "node:crypto";

import { DEFAULT_ICON_COLORS } from "@room-manager/contracts";

import { GuildRepository, RoomRepository } from "./repositories";

const guildRepository = new GuildRepository();
const roomRepository = new RoomRepository();

const guildId = randomUUID();
const roomId = randomUUID();

const now = new Date();

console.log("1. Creating guild...");

const guild = await guildRepository.create({
  guildId: guildId as never,
  creatorChannelId: "creator-channel",
  categoryId: "category",
  panelChannelId: null,
  panelMessageId: null,
  logChannelId: null,
  defaultUserLimit: 0,
  deleteDelaySeconds: 5,
  creationCooldownSeconds: 3,
  accentColor: 0x2b2d31,
  bannerUrl: null,
  iconPack: "niako",
  iconColors: { ...DEFAULT_ICON_COLORS },
  template: "default",
  enabled: true,
  createdAt: now,
  updatedAt: now,
});

console.log("Guild:", guild);

console.log("2. Finding guild...");

const foundGuild = await guildRepository.findById(guildId as never);

console.log("Found guild:", foundGuild);

console.log("3. Updating guild...");

const updatedGuild = await guildRepository.update(guildId as never, {
  defaultUserLimit: 10,
});

console.log("Updated guild:", updatedGuild);

console.log("4. Creating room...");

const room = await roomRepository.create({
  id: roomId as never,
  guildId: guildId as never,
  channelId: randomUUID() as never,
  ownerId: randomUUID() as never,
  name: "Test Room",
  userLimit: 5,
  state: "active",
  locked: false,
  hidden: false,
  createdAt: now,
  updatedAt: now,
  lastActivityAt: now,
});

console.log("Room:", room);

console.log("5. Finding room...");

const foundRoom = await roomRepository.findById(roomId as never);

console.log("Found room:", foundRoom);

console.log("6. Updating room...");

const updatedRoom = await roomRepository.update(roomId as never, {
  name: "Updated Room",
  userLimit: 10,
});

console.log("Updated room:", updatedRoom);

console.log("7. Finding rooms by guild...");

const rooms = await roomRepository.findByGuildId(guildId as never);

console.log("Rooms:", rooms);

console.log("8. Deleting room...");

const roomDeleted = await roomRepository.delete(roomId as never);

console.log("Room deleted:", roomDeleted);

console.log("9. Deleting guild...");

const guildDeleted = await guildRepository.delete(guildId as never);

console.log("Guild deleted:", guildDeleted);

console.log("✅ Database smoke test passed");
