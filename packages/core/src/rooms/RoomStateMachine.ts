import type { RoomState } from "@room-manager/contracts";

export function canTransitionRoomState(from: RoomState, to: RoomState): boolean {
  if (from === to) {
    return true;
  }

  switch (from) {
    case "active":
      return to === "cooldown";

    case "cooldown":
      return to === "active" || to === "deleting";

    case "deleting":
      return false;
  }
}
