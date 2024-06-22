/**
 * User Configurations
 * -------------------
 * @param {number} PARCELS_MAX - maximum number of parcels that can be carried by an agent
 * @param {number} MOVEMENT_STEPS - number of steps to move in a single movement
 * @param {number} MOVEMENT_DURATION - duration of a single movement
 * @param {number} AGENTS_OBSERVATION_DISTANCE - distance to observe other agents
 * @param {number} PARCEL_DECADING_INTERVAL - interval for parcel decaying
 * @param {number} PARCEL_REWARD_AVG - average reward of a parcel
 * @param {number} CLOCK - clock interval
 */
export type UserConfig = {
  PARCELS_MAX: number,
  MOVEMENT_STEPS: number,
  MOVEMENT_DURATION: number,
  AGENTS_OBSERVATION_DISTANCE: number,
  PARCEL_DECADING_INTERVAL: number,
  PARCEL_REWARD_AVG: number,
  CLOCK: number,
};
/**
 * Default User Configurations
 */
export const DEFAULT_USER_CONFIG: UserConfig = {
  PARCELS_MAX: 10,
  MOVEMENT_STEPS: 1,
  MOVEMENT_DURATION: 50,
  AGENTS_OBSERVATION_DISTANCE: 10,
  PARCEL_DECADING_INTERVAL: 1,
  PARCEL_REWARD_AVG: 10,
  CLOCK: 50,
};

/**
 * Point2D type
 * ------------
 * @param {number} x - x coordinate
 * @param {number} y - y coordinate
 */
export type Point2D = {
  x: number,
  y: number,
};
export const DEFAULT_POINT2D: Point2D = { x: 0, y: 0 };
/**
 * 
 * @param {Point2D} a first point
 * @param {Point2D} b second point
 * @returns true if the two points are equal, false otherwise
 */
export const point2DEqual = (a: Point2D, b: Point2D): boolean => a.x === b.x && a.y === b.y;

/**
 * Me type
 * -------
 * @param {string} id - agent id
 * @param {string} name - agent name
 * @param {Point2D} position - agent position
 * @param {number} score - agent score
 */
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

/**
 * TeamMate type
 * -------------
 * @param {Point2D} position - teammate position
 * @param {number} score - teammate score
 */
export type TeamMate = {
  position: Point2D,
  score: number,
};
export const DEFAULT_TEAMMATE: TeamMate = {
  position: DEFAULT_POINT2D,
  score: 0,
};

/**
 * Parcel type
 * -----------
 * @param {string | null} id - parcel id
 * @param {Point2D} position - parcel position
 * @param {string | null} carriedBy - agent id carrying the parcel
 * @param {number} reward - parcel reward
 */
export type Parcel = {
  id: string | null,
  position: Point2D,
  carriedBy: string | null,
  reward: number | null,
};
export const DEFAULT_PARCEL: Parcel = {
  id: null,
  position: DEFAULT_POINT2D,
  carriedBy: null,
  reward: 0,
};

/**
 * Desire Enum
 * -----------
 * @param {string} RND_WALK_TO - desire to random walk to a position
 * @param {string} GO_TO - desire to go to a position
 * @param {string} GO_PICK_UP - desire to go pick up a parcel
 * @param {string} GO_PUT_DOWN - desire to go put down a parcel
 * @param {string} PICK_UP - desire to pick up a parcel
 * @param {string} PUT_DOWN - desire to put down a parcel
 * @param {string} PDDL_PLAN - desire to use the PDDL planner to get a plan and future desires
 * @param {string} BLIND_GO_TO - desire to blindly go to a position
 * @param {string} UNKNOWN - unknown desire
 */
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
/**
 * 
 * @param d desire enum type
 * @returns the string representation of the desire
 */
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
/**
 * 
 * @param s string representation of the desire
 * @returns the desire enum type associated with the given string
 */
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
/**
 * Option type
 * -----------
 * @param {Desire} desire - desire of the option
 * @param {Point2D} position - position of the option
 * @param {string | null} id - id of the option
 * @param {number | null} reward - reward of the option
 */
export type Option = {
  desire: Desire,
  position: Point2D,
  id: string | null,
  reward: number | null,
};
/**
 * 
 * @param o option type
 * @returns the string representation of the option
 */
export const OptionStr = (o: Option): string => `Option(desire:${o.desire}, {x:${o.position.x}, y:${o.position.y}}, id:${o.id}, reward:${o.reward})`;

/**
 * Agent type
 * ----------
 * @param {string} id - agent id
 * @param {string} name - agent name
 * @param {Point2D} position - agent position
 * @param {number} score - agent score
 * @param {number} lastUpdate - last update timestamp
 */
export type Agent = {
  id: string,
  name: string,
  position: Point2D,
  score: number,
  lastUpdate: number,
};
