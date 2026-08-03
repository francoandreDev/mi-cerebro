// why: shared layout numbers between the scene graph (contents) and the
//      camera-movement host so walking bounds always match the room geometry.
export const ROOM_HEIGHT = 4;
export const ROOM_DEPTH = 6;
export const FRAME_SPACING = 2.4;
export const ROOM_MARGIN = 2.5;
export const EYE_HEIGHT = 1.6;
export const WALK_SPEED = 3.2;
export const LOOK_SENSITIVITY = 0.0035;
export const MAX_PITCH = 1.3;

export const FRAME_MAX_SIZE: Readonly<Record<'S' | 'M' | 'L', number>> = {
  S: 0.9,
  M: 1.3,
  L: 1.8,
};

export const roomWidth = (count: number): number =>
  Math.max(count * FRAME_SPACING, FRAME_SPACING) + ROOM_MARGIN * 2;
