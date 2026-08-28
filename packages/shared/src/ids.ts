export type Brand<T, Name extends string> = T & {
  readonly __brand: Name;
};

export type GuildId = Brand<string, "GuildId">;
export type ChannelId = Brand<string, "ChannelId">;
export type UserId = Brand<string, "UserId">;
export type RoomId = Brand<string, "RoomId">;
