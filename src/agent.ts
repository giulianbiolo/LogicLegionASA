import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import ApathFind from "a-star-pathfind";
import { DEFAULT_ME, DEFAULT_USER_CONFIG, type Agent, type Me, type Parcel, type Point2D, type UserConfig } from "./types";
import { configParse, MAP_SIZE, DEBUG } from "./conf";
import { IntentionRevisionRevise, type IntentionRevisionInterface } from "./intention";
import { generateOptions } from "./options";
import { agentArgs } from "./args";


export const client: DeliverooApi = new DeliverooApi();
if (!DEBUG) { console.log = () => {}; }
console.log("Args: ", agentArgs);

// * Beliefset revision function
export const me: Me = DEFAULT_ME;
client.onYou(({ id, name, x, y, score }) => {
  me.id = id;
  me.name = name;
  me.position.x = x;
  me.position.y = y;
  me.score = score;
});

export const myAgent: IntentionRevisionInterface = new IntentionRevisionRevise();
export const parcels: Map<string, Parcel> = new Map();
export var pathFind: ApathFind = new ApathFind();
export var pathFindInit: boolean = false;
export var delivery_tiles: Array<Point2D> = [];
export var other_agents: Map<string, Agent> = new Map();
export var CONFIG: UserConfig = DEFAULT_USER_CONFIG;

client.onConfig((config: any) => {
  CONFIG = configParse(config);
  CONFIG.PARCELS_MAX = Number(config["PARCELS_MAX"]);
  CONFIG.MOVEMENT_STEPS = Number(config["MOVEMENT_STEPS"]);
  CONFIG.MOVEMENT_DURATION = Number(config["MOVEMENT_DURATION"]);
  CONFIG.AGENTS_OBSERVATION_DISTANCE = Number(config["AGENTS_OBSERVATION_DISTANCE"]);
  if (config["PARCEL_DECADING_INTERVAL"].includes("infinite")) {
    CONFIG.PARCEL_DECADING_INTERVAL = Number.MAX_VALUE;
  } else if (config["PARCEL_DECADING_INTERVAL"].includes("s")) {
    CONFIG.PARCEL_DECADING_INTERVAL = Number(config["PARCEL_DECADING_INTERVAL"].replace("s", ""));
  } else if (config["PARCEL_DECADING_INTERVAL"].includes("m")) {
    CONFIG.PARCEL_DECADING_INTERVAL = Number(config["PARCEL_DECADING_INTERVAL"].replace("m", "")) * 60;
  } else if (config["PARCEL_DECADING_INTERVAL"].includes("h")) {
    CONFIG.PARCEL_DECADING_INTERVAL = Number(config["PARCEL_DECADING_INTERVAL"].replace("h", "")) * 60 * 60;
  }
  CONFIG.PARCEL_REWARD_AVG = Number(config["PARCEL_REWARD_AVG"]);
  CONFIG.CLOCK = Number(config["CLOCK"]);
  console.log("CONFIG", CONFIG);

  // * Init matrix of map
  var tiles: Array<Array<number>> = [];
  for (let i = 0; i < MAP_SIZE; i++) {
    tiles[i] = [];
    for (let j = 0; j < MAP_SIZE; j++) {
      tiles[i][j] = 0;
    }
  }
  pathFind.init(tiles, { allowDiagonal: false, });
  pathFindInit = true;
});
client.onParcelsSensing(async (perceived_parcels) => {
  // console.log("Parcel Sensing Event at time", new Date().getTime() / 1000 - start_time, "with parcels", parcels);
  for (const p of perceived_parcels) {
    parcels.set(p.id, {
      id: p.id,
      position: { x: p.x, y: p.y },
      carriedBy: p.carriedBy,
      reward: p.reward,
    });
  }
  for (const [id, p] of parcels) {
    if (!perceived_parcels.find((pp) => pp.id === id)) { parcels.delete(id); }
    if (p.reward && p.reward <= 2 && CONFIG.PARCEL_DECADING_INTERVAL <= 99999) { parcels.delete(id); }
    if (!p.reward) { parcels.delete(id); }
  }
  generateOptions();
});
client.onTile((tx: number, ty: number, tile_delivery: boolean) => {
  // console.log("Tile Event at time", new Date().getTime() / 1000 - start_time, "with x", x, "y", y, "delivery", delivery);
  pathFind.changeTileValue(tx, ty, 1);
  if (tile_delivery) { delivery_tiles.push({ x: tx, y: ty }); }
});
client.onAgentsSensing((new_agents: [{ id: string, name: string, x: number, y: number, score: number }]) => {
  // console.log("Agent Sensing Event at time", new Date().getTime() / 1000 - start_time, "with parcels", parcels);
  // * Now let's update the grid beliefset by replacement!
  // * Now let's update the grid beliefset by revision!
  let timenow: number = new Date().getTime() / 1000;
  for (const ag of new_agents) {
    let agent = {
      id: ag.id,
      name: ag.name,
      position: { x: ag.x, y: ag.y },
      score: ag.score,
      lastUpdate: timenow,
    };
    if (String(agent.id) === String(me.id)) { continue; }
    if (agent.position.x === null || agent.position.y === null) { continue; }
    if (agent.position.x < 0 || agent.position.y < 0) { continue; }
    if (agent.position.x >= MAP_SIZE || agent.position.y >= MAP_SIZE) { continue; }
    // check if this agent is contained in the other_agents array, if so then remove it from the old position
    if (other_agents.has(agent.id)) {
      let old_agent: Agent | undefined = other_agents.get(agent.id);
      if (old_agent !== undefined) { pathFind.changeTileValue(Math.round(old_agent.position.x), Math.round(old_agent.position.y), 1); }
    }
    other_agents.set(agent.id, agent);
    pathFind.changeTileValue(Math.round(agent.position.x), Math.round(agent.position.y), 0);
  }
  // ? Also update all agents with older timestamp of 3 seconds by removing them from the grid
  for (const [id, agent] of other_agents) {
    if (agent.lastUpdate < timenow - 3) {
      pathFind.changeTileValue(Math.round(agent.position.x), Math.round(agent.position.y), 1);
      other_agents.delete(id);
    }
  }
  // * Now let's generate new options
  generateOptions();
});
// ? Execute every tot milliseconds the option generation...
setInterval(() => { if (pathFindInit) { generateOptions(); } }, CONFIG.MOVEMENT_DURATION);
// ? Execute every tot milliseconds the intention revision...
myAgent.loop();
