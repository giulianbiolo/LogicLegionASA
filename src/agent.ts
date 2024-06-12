import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import ApathFind from "a-star-pathfind";
import { DEFAULT_ME, DEFAULT_USER_CONFIG, type Agent, type Me, type Parcel, type Point2D, type UserConfig, type Option, type TeamMate, DEFAULT_TEAMMATE } from "./types";
import { configParse, MAP_SIZE, DEBUG } from "./conf";
import { IntentionRevisionRevise, type IntentionRevisionInterface } from "./intention";
import { generateOptions } from "./options";
import { agentArgs } from "./args";


export const client: DeliverooApi = new DeliverooApi();
if (!DEBUG) { console.log = () => {}; }
console.log("Args: ", agentArgs);

// * Beliefset revision function
export const team_agent: TeamMate = DEFAULT_TEAMMATE;
export const me: Me = DEFAULT_ME;
client.onYou(({ id, name, x, y, score }) => {
  me.id = id;
  me.name = name;
  me.position.x = x;
  me.position.y = y;
  me.score = score;
  // ? Tell also your teammate about it!
  if (agentArgs.teamId !== null) { client.say(agentArgs.teamId, { kind: "on_me", position: { x: x, y: y }, score: score }); }
});

export const myAgent: IntentionRevisionInterface = new IntentionRevisionRevise();
export const parcels: Map<string, Parcel> = new Map();
export var currTeamObj: Option | null = null;
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
  updateParcels(perceived_parcels);
  if (agentArgs.teamId !== null) { client.say(agentArgs.teamId, { kind: "on_parcels", parcels: perceived_parcels }); }
  generateOptions();
});
client.onTile((tx: number, ty: number, tile_delivery: boolean) => {
  pathFind.changeTileValue(tx, ty, 1);
  if (tile_delivery) { delivery_tiles.push({ x: tx, y: ty }); }
  if (agentArgs.teamId !== null) { client.say(agentArgs.teamId, { kind: "on_tile", position: { x: tx, y: ty }, delivery: tile_delivery }); }
});
client.onAgentsSensing((new_agents: [{ id: string, name: string, x: number, y: number, score: number }]) => {
  updateAgents(new_agents);
  if (agentArgs.teamId !== null) { client.say(agentArgs.teamId, { kind: "on_agents", agents: new_agents }); }
  generateOptions();
});

function updateParcels(new_parcels: any): void {
  for (const p of new_parcels) {
    parcels.set(p.id, {
      id: p.id,
      position: { x: p.x, y: p.y },
      carriedBy: p.carriedBy,
      reward: p.reward,
    });
  }
  for (const [id, p] of parcels) {
    if (!new_parcels.find((pp: any) => pp.id === id)) { parcels.delete(id); }
    if (p.reward && p.reward <= 2 && CONFIG.PARCEL_DECADING_INTERVAL <= 99999) { parcels.delete(id); }
    if (!p.reward) { parcels.delete(id); }
  }
}

function updateAgents(new_agents: [{ id: string, name: string, x: number, y: number, score: number }]): void {
  let timenow: number = new Date().getTime() / 1000;
  for (const ag of new_agents) {
    let agent = {
      id: ag.id,
      name: ag.name,
      position: { x: ag.x, y: ag.y },
      score: ag.score,
      lastUpdate: timenow,
    };
    if (agent.id === me.id) { continue; }
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
}

client.onMsg((id: string, name: string, msg: any) => {
  if (agentArgs.teamId !== null && id !== agentArgs.teamId) { return; }
  // console.log("Received message: ", msg);
  // We need to parse the received message and use the info for our use
  if (typeof msg !== "object" || typeof msg.kind !== "string") { return; }
  switch (msg.kind) {
    // ? Information Sharing About World State
    case "on_me":
      team_agent.position = msg.position;
      team_agent.score = msg.score;
      break;
    case "on_parcels":
      updateParcels(msg.parcels);
      break;
    case "on_tile":
      pathFind.changeTileValue(msg.position.x, msg.position.y, 1);
      if (msg.delivery) { delivery_tiles.push(msg.position); }
      break;
    case "on_agents":
      updateAgents(msg.agents);
      break;
    // ? Information Sharing About Interactions
    case "on_pickup":
      if (parcels.has(msg.parcel_id)) {
        let par: Parcel | undefined = parcels.get(msg.parcel_id);
        if (par !== undefined) {
          par.carriedBy = msg.agent_id;
          parcels.set(msg.parcel_id, par);
        }
      }
      break;
    case "on_putdown":
      parcels.delete(msg.parcel_id);
      break;
    // ? Information Sharing About Intentions
    // TODO: Tell companion you are going to move to a certain position through a certain path (lock the path so that the companion doesn't take it)
    case "on_objective":
      currTeamObj = msg.objective;
      break;
    default:
      console.log("Received unknown message: ", msg);
      break;
  }
});

// ? Execute every tot milliseconds the option generation...
setInterval(() => { if (pathFindInit) { generateOptions(); } }, CONFIG.MOVEMENT_DURATION);
// ? Execute every tot milliseconds the intention revision...
myAgent.loop();
