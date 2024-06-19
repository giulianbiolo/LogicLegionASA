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

export type TeamMate = {
  position: Point2D,
  score: number,
};
export const DEFAULT_TEAMMATE: TeamMate = {
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

export enum Desire {
  RND_WALK_TO = 'rnd_walk_to',
  GO_TO = 'go_to',
  GO_PICK_UP = 'go_pick_up',
  GO_PUT_DOWN = 'go_put_down',
  PICK_UP = 'pick_up',
  PUT_DOWN = 'put_down',
  PDDL_PLAN = 'pddl_plan',
  BLIND_GO_TO = 'blind_go_to',
  UNKNOWN = 'unknown',
};
export const desireStr = (d: Desire): string => {
  switch (d) {
    case Desire.RND_WALK_TO: return 'rnd_walk_to';
    case Desire.GO_TO: return 'go_to';
    case Desire.GO_PICK_UP: return 'go_pick_up';
    case Desire.GO_PUT_DOWN: return 'go_put_down';
    case Desire.PICK_UP: return 'pick_up';
    case Desire.PUT_DOWN: return 'put_down';
    case Desire.PDDL_PLAN: return 'pddl_plan';
    case Desire.BLIND_GO_TO: return 'blind_go_to';
    case Desire.UNKNOWN: return 'unknown';
  };
};
export const desireFromStr = (s: string): Desire => {
  switch (s) {
    case 'rnd_walk_to': return Desire.RND_WALK_TO;
    case 'go_to': return Desire.GO_TO;
    case 'go_pick_up': return Desire.GO_PICK_UP;
    case 'go_put_down': return Desire.GO_PUT_DOWN;
    case 'pick_up': return Desire.PICK_UP;
    case 'put_down': return Desire.PUT_DOWN;
    case 'pddl_plan': return Desire.PDDL_PLAN;
    case 'blind_go_to': return Desire.BLIND_GO_TO;
    default: return Desire.UNKNOWN;
  };
};
export type Option = {
  desire: Desire,
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
