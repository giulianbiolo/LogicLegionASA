// define the types used in index.ts
export type UserConfig = {
  PARCELS_MAX: number,
  MOVEMENT_STEPS: number,
  MOVEMENT_DURATION: number,
  AGENTS_OBSERVATION_DISTANCE: number,
  PARCEL_DECADING_INTERVAL: number,
  PARCEL_REWARD_AVG: number,
  CLOCK: number,
};
export const DEFAULT_USER_CONFIG: UserConfig = {
  PARCELS_MAX: 10,
  MOVEMENT_STEPS: 1,
  MOVEMENT_DURATION: 50,
  AGENTS_OBSERVATION_DISTANCE: 10,
  PARCEL_DECADING_INTERVAL: 1,
  PARCEL_REWARD_AVG: 10,
  CLOCK: 50,
};

export type Point2D = {
  x: number,
  y: number,
};
export const DEFAULT_POINT2D: Point2D = { x: 0, y: 0 };
// define equality for Point2D
export const point2DEqual = (a: Point2D, b: Point2D): boolean => a.x === b.x && a.y === b.y;

export type Me = {
  id: string,
  name: string,
  position: Point2D,
  score: number,
};
export const DEFAULT_ME: Me = {
  id: 'me',
  name: 'me',
  position: DEFAULT_POINT2D,
  score: 0,
};

export type Parcel = {
  id: string | null,
  position: Point2D,
  carriedBy: string | null,
  reward: number | null,
};
export const DEFAULT_PARCEL: Parcel = {
  id: 'parcel',
  position: DEFAULT_POINT2D,
  carriedBy: null,
  reward: 0,
};

export type Option = {
  desire: string,
  position: Point2D,
  id: string | null,
  reward: number | null,
};
export const OptionStr = (o: Option): string => `Option(desire:${o.desire}, {x:${o.position.x}, y:${o.position.y}}, id:${o.id}, reward:${o.reward})`;

export type Agent = {
  id: string,
  name: string,
  position: Point2D,
  score: number,
  lastUpdate: number,
};
