import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import ApathFind from "a-star-pathfind";
import { DEFAULT_ME, DEFAULT_USER_CONFIG, OptionStr, point2DEqual, type Agent, type Me, type Option, type Parcel, type Point2D, type UserConfig } from "./types";
import { sleep } from "bun";
import clc from "chalk";

const client: DeliverooApi = new DeliverooApi();
const MAP_SIZE: number = 100;
const DEBUG: boolean = true;
var start_time: number = new Date().getTime() / 1000;
if (!DEBUG) { console.log = () => {}; }

function distance(pt1: Point2D, pt2: Point2D): number {
  const dx = Math.abs(Math.round(pt1.x) - Math.round(pt2.x));
  const dy = Math.abs(Math.round(pt1.y) - Math.round(pt2.y));
  return dx + dy;
}

function real_profit(parcel: Parcel, carrying: number): number {
  // * This method computes the expected profit achievable by going to pick up a parcel, instead of moving to a delivery tile
  // ? If parcel decaying time is infinite then the real profit is the reward of the parcel
  if (CONFIG.PARCEL_DECADING_INTERVAL >= 999999) { return parcel.reward ? parcel.reward : 0; }
  let parcel_reward: number = parcel.reward ? parcel.reward : 0;
  let distance_to_parcel: number = distance(parcel.position, me.position);
  let distance_to_closest_delivery_tile_from_parcel: number = Number.MAX_VALUE;
  for (const delivery_tile of delivery_tiles) {
    let d = distance(delivery_tile, parcel.position);
    if (d < distance_to_closest_delivery_tile_from_parcel) { distance_to_closest_delivery_tile_from_parcel = d; }
  }
  let distance_multiplier: number = Math.round((CONFIG.MOVEMENT_DURATION  / (1000 * CONFIG.PARCEL_DECADING_INTERVAL)));

  let distance_to_closest_delivery_tile_from_me: number = Number.MAX_VALUE;
  for (const delivery_tile of delivery_tiles) {
    let d = distance(delivery_tile, me.position);
    if (d < distance_to_closest_delivery_tile_from_me) { distance_to_closest_delivery_tile_from_me = d; }
  }

  let loss_if_deliver_right_away: number = carrying * distance_to_closest_delivery_tile_from_me * distance_multiplier;
  let loss_if_go_pick_up: number = carrying * distance_to_parcel * distance_multiplier + (carrying + 1) * distance_to_closest_delivery_tile_from_parcel * distance_multiplier;
  let gain_if_go_pick_up: number = parcel_reward - distance_to_parcel * distance_multiplier;

  return gain_if_go_pick_up - (loss_if_go_pick_up - loss_if_deliver_right_away);
}

function reachable(pt: Point2D): boolean {
  // console.log("Now checking reachability of { x:", pt.x, ", y: ", pt.y, " }...");
  try{
    let mypos = { x: Math.round(me.position.x), y: Math.round(me.position.y) };
    let path = pathFind.findPath(mypos.x, mypos.y, pt.x, pt.y);
    return ((path !== null) && (path.length > 0));
  } catch { return true; } // ? If the pathfind fails, then just blind belief that it's reachable
}

function carrying_parcels_fn(): number {
  let count: number = 0;
  for (const parcel of parcels.values()) {
    if (parcel.carriedBy === me.id) { count += 1; }
  }
  return count;
}

function onAnyDeliveryTile(parcel: Parcel): boolean {
  for (const delivery of delivery_tiles) {
    if (point2DEqual(parcel.position, delivery)) { return true; }
  }
  return false;
}

// * Beliefset revision function
const me: Me = DEFAULT_ME;
client.onYou(({ id, name, x, y, score }) => {
  me.id = id;
  me.name = name;
  me.position.x = x;
  me.position.y = y;
  me.score = score;
});

const parcels: Map<string, Parcel> = new Map();
var pathFind: ApathFind = new ApathFind();
var pathFindInit: boolean = false;
var tiles: Array<Array<number>> = [];
var delivery_tiles: Array<Point2D> = [];

var other_agents: Map<string, Agent> = new Map();
const CONFIG: UserConfig = DEFAULT_USER_CONFIG;
client.onConfig((config: any) => {
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

function generateOptions() {
  // * Options generation
  console.log("Generating new options for the agent");
  const options: Array<Option> = [];
  const currently_carrying_parcels = carrying_parcels_fn();
  for (const parcel of parcels.values()) {
    // check if any other agent is on top of that parcel
    if (onAnyDeliveryTile(parcel)) { continue; }
    if (anyAgentOnTile(parcel.position)) { continue; }
    if (!parcel.carriedBy) { options.push({ desire: "go_pick_up", position: parcel.position, id: parcel.id, reward: parcel.reward }); }
  }
  if (currently_carrying_parcels > 0) {
    for (const delivery of delivery_tiles) {
      if (anyAgentOnTile(delivery)) { continue; }
      options.push({ desire: "go_put_down", position: delivery, id: null, reward: null });
    }
  }
  if (options.length === 0 && pathFindInit) {
    // * Consider random walk to a tile in the map that is reachable
    console.log("No options available, generating random walk option");
    let rnd_x: number = 0;
    let rnd_y: number = 0;
    do {
      // let's make the random walk execute around where i stand now +- 3 tiles
      rnd_x = Math.max(Math.min(Math.floor(me.position.x + Math.floor(Math.random() * 6) - 3), MAP_SIZE - 1), 0);
      rnd_y = Math.max(Math.min(Math.floor(me.position.y + Math.floor(Math.random() * 6) - 3), MAP_SIZE - 1), 0);
      console.log("trying with { x: ", rnd_x, ", y: ", rnd_y, " }");
    } while ((pathFind.tiles[rnd_y][rnd_x].val == 0) || (!reachable({x: rnd_x, y: rnd_y})) || (distance({ x: rnd_x, y: rnd_y }, me.position) <= 1));
    // options.push({ desire: "rnd_walk_to", position: { x, y }, id: null, reward: null });
    console.log("Random walk option generated", { desire: "rnd_walk_to", position: { x: rnd_x, y: rnd_y }, id: null, reward: null });
    myAgent.push({ desire: "rnd_walk_to", position: { x: rnd_x, y: rnd_y }, id: null, reward: null });
  }
  // console.log("Options generated", options);
  // * Options filtering
  let must_deliver: boolean = (currently_carrying_parcels >= CONFIG.PARCELS_MAX); // ? Se ho più di un pacco devo per forza consegnare [ Temporaneo per testing ]
  let nothing_to_deliver: boolean = (currently_carrying_parcels === 0);
  let best_option: Option | null = null;
  let nearest: number = Number.MAX_VALUE;
  // ! Maximize Value / Distance metric
  for (const option of options) {
    let { desire, position, id, reward } = option;
    if (must_deliver && desire === "go_pick_up") { continue; }
    if (nothing_to_deliver && desire === "go_put_down") { continue; }
    if (desire === "go_pick_up" && !reachable(position)) { continue; }
    let current_d = distance(position, me.position);
    // ! Value / Distance metric
    // ? If it's a go_put_down then the distance is just that. in case of go_pick_up do *2
    let metric: number = 9999999;
    if (CONFIG.PARCEL_DECADING_INTERVAL < 999999) {
      if (desire === "go_pick_up" && reward !== null) { metric = (current_d * 2) / reward; }
      if (desire === "go_put_down") { metric = current_d / (currently_carrying_parcels * CONFIG.PARCEL_REWARD_AVG); }
    } else {
      // ? We chose to go_pick_up most of the time
      if (desire === "go_pick_up" && reward !== null) { metric = current_d / reward; }
      if (desire === "go_put_down") { metric = current_d; }
    }
    if (metric < nearest) {
      best_option = option;
      nearest = metric;
    }
  }

  // * Best option is selected
  // ? Let us add a new intention to the agent. If the current best is go_pick_up, and in the options there is a go_put_down, then let's push also that
  if (best_option) {
    console.log("Pushing new option to the agent", OptionStr(best_option));
    myAgent.push(best_option);
  }
  if (best_option && best_option.desire === "go_pick_up") {
    // Let's check if there is a go_put_down in the options
    // Calculate the cloest go_put_down to me now
    let nearest_down: number = Number.MAX_VALUE;
    let best_option_down: Option | null = null;
    for (const option_down of options) {
      let { desire, position, id, reward } = option_down;
      if (desire === "go_put_down" && reachable(position)) {
        let d = distance(position, me.position);
        if (d < nearest_down) {
          best_option_down = option_down;
          nearest_down = d;
        }
      }
    }
    if (best_option_down !== null) {
      console.log("Also pushing other option to the agent", OptionStr(best_option_down));
      myAgent.push(best_option_down);
    }
  }
}
setInterval(() => { if (pathFindInit) { generateOptions(); } }, CONFIG.MOVEMENT_DURATION); // ? Execute every tot milliseconds...

function anyAgentOnTile(pt: Point2D) {
  for (const other_agent of other_agents.values()) {
    let other_pos = { x: Math.round(other_agent.position.x), y: Math.round(other_agent.position.y) };
    let pt_round = { x: Math.round(pt.x), y: Math.round(pt.y) };
    if (point2DEqual(pt_round, other_pos)) { return true; }
  }
  return false;
}

interface IntentionRevisionInterface {
  push(predicate: Option): void;
  loop(): Promise<void>;
}

// * Intention revision loop
class IntentionRevision implements IntentionRevisionInterface {
  #intention_queue: Array<Intention> = new Array();
  get intention_queue() { return this.#intention_queue; }
  async push(predicate: Option) { }

  async loop() {
    while (true) {
      // Consumes intention_queue if not empty
      console.log("intentionRevision.loop queue: ", this.intention_queue.map((i) => OptionStr(i.predicate)));
      if (this.intention_queue.length > 0) {
        console.log("intentionRevision.loop", this.intention_queue.map((i) => OptionStr(i.predicate)));
        // Current intention
        const intention = this.intention_queue[0];
        // Is queued intention still valid? Do I still want to achieve it?
        // TODO: Add other checks and cases
        if (intention.predicate.desire === "rnd_walk_to" && carrying_parcels_fn() > 0 && delivery_tiles.length > 0) {
          if (pathFindInit) { generateOptions(); }
          console.log("Skipping intention because no more valid, delivery tiles are present", OptionStr(intention.predicate));
          this.intention_queue.shift();
          continue;
        }
        if ((intention.predicate.desire === "rnd_walk_to") && (this.intention_queue.find((i) => i.predicate.desire !== "rnd_walk_to") !== undefined)) {
          console.log("Skipping intention because no more valid, other intentions in queue", OptionStr(intention.predicate));
          this.intention_queue.shift();
          continue;
        }
        if (intention.predicate.desire === "go_pick_up" && intention.predicate.id !== null) {
          let p = parcels.get(intention.predicate.id);
          if (p && p.carriedBy) {
            console.log("Skipping intention because no more valid, parcel carriedBy other agent", OptionStr(intention.predicate));
            this.intention_queue.shift();
            continue;
          }
        }
        // TODO: Forse è meglio fare distance(me, target) <= 1 && anyAgentOnTile(target) invece che controllare solo "go_put_down"
        if (intention.predicate.desire === "go_put_down" && anyAgentOnTile(intention.predicate.position)) {
          console.log("Skipping intention because no more valid, other agent on delivery tile", OptionStr(intention.predicate));
          this.intention_queue.shift();
          continue;
        }
        if (!reachable(intention.predicate.position)) {
          console.log("Skipping because unreachable tile ", OptionStr(intention.predicate));
          this.intention_queue.shift();
          continue;
        }
        console.log("Now Achieving intention", OptionStr(intention.predicate));
        // Start achieving intention
        await intention
          .achieve()
          // Catch eventual error and continue
          .catch((error: { msg: string, option: Option }) => { console.log('Failed intention', OptionStr(intention.predicate), 'with error:', error) });
        // Remove from the queue
        this.intention_queue.shift();
        // Postpone next iteration at setImmediate
      } else {
        if (pathFindInit) { generateOptions(); }
      }
      await new Promise((res) => setImmediate(res));
    }
  }
}

class IntentionRevisionQueue extends IntentionRevision implements IntentionRevisionInterface {
  async push(predicate: Option) {
    // Check if already queued
    if (this.intention_queue.find((i) => i.predicate.desire == predicate.desire && i.predicate.position.x == predicate.position.x && i.predicate.position.y == predicate.position.y) !== undefined) {
      return; // intention is already queued
    }
    console.log("IntentionRevisionQueue.push", OptionStr(predicate));
    const intention = new Intention(predicate);
    this.intention_queue.push(intention);
  }
}

class IntentionRevisionReplace extends IntentionRevision implements IntentionRevisionInterface{
  async push(predicate: Option) {
    // Check if already queued
    const last: Intention | undefined = this.intention_queue.at(this.intention_queue.length - 1);
    if (last !== undefined && last.predicate.desire == predicate.desire && last.predicate.position.x == predicate.position.x && last.predicate.position.y == predicate.position.y) {
      return; // intention is already being achieved
    }
    console.log("IntentionRevisionReplace.push", OptionStr(predicate));
    const intention = new Intention(predicate);
    this.intention_queue.push(intention);
    // Force current intention stop
    if (last) { last.stop(); }
  }
}

class IntentionRevisionRevise extends IntentionRevision implements IntentionRevisionInterface{
  async push(predicate: Option): Promise<void> {
    // TODO
    // - order intentions based on utility function (reward - cost) (for example, parcel score minus distance)
    // - eventually stop current one
    // - evaluate validity of intention
    let last: Intention | undefined = this.intention_queue.at(this.intention_queue.length - 1);
    // * If the queue is empty, then just push the intention
    if (last === undefined) {
      console.log("Revising intention queue. Since queue is empty now pushing", OptionStr(predicate));
      let intention: Intention = new Intention(predicate);
      this.intention_queue.push(intention);
      return Promise.resolve();
    }
    let currently_carrying_parcels: number = carrying_parcels_fn();
    console.log(clc.red("Current[last] Intention Predicate: " + OptionStr(last.predicate)));
    console.log(clc.green("New Intention Predicate: " + OptionStr(predicate)));
    
    // console.log("Current State: [ Carry: ", currently_carrying_parcels, ", Delivery: ", delivery_tiles, " ]");
    if (last.predicate.desire == predicate.desire && last.predicate.position.x == predicate.position.x && last.predicate.position.y == predicate.position.y) {
      console.log("Revising intention queue. Skipping because identical new proposition as current. (Already executing now)");
      return Promise.resolve();
    } // ? If the same intention is already being achieved, then skip
    if (last !== undefined && predicate.desire == "rnd_walk_to") {
      console.log("Revising intention queue. Skipping because already doing something else. (Not going to stop to random walk)");
      return Promise.resolve();
    }
    if (last.predicate.desire == "rnd_walk_to" && predicate.desire != "rnd_walk_to") {
      console.log("Revising intention queue. Replacing", OptionStr(last.predicate), "with", OptionStr(predicate));
      let intention: Intention = new Intention(predicate);
      this.intention_queue.push(intention);
      last.stop();
      return Promise.resolve();
    }
    // * If I'm delivering a parcel, and the intention of delivering it arises, then select by distance.
    // * Also if the parcels don't decay, just select by distance
    // ? These two are for testing...
    //if (last.predicate.desire == "go_put_down" && predicate.desire == "go_put_down") { return Promise.resolve(); }
    //if (last.predicate.desire == "go_pick_up" && predicate.desire == "go_pick_up") { return Promise.resolve(); }
    
    if ((last.predicate.desire == "go_put_down" && predicate.desire == "go_put_down") || CONFIG.PARCEL_DECADING_INTERVAL >= 999999) {
      let { desire, position, id, reward } = predicate;
      let current_d = distance(position, me.position);
      let last_d = distance(last.predicate.position, me.position);
      if (current_d < last_d) {
        console.log("Revising intention queue. Replacing", OptionStr(last.predicate), "with", OptionStr(predicate));
        let intention: Intention = new Intention(predicate);
        this.intention_queue.push(intention);
        if (last !== undefined) { last.stop(); }
      } else { return Promise.resolve(); }
    }
    // TODO: If I'm picking up a parcel, and the intention of picking up a new parcel arises, then maximize the reward! [Calc distance and score]
    // ? Calculate the real_profit of both and compare them
    if ((last.predicate.desire == "go_pick_up" && predicate.desire == "go_pick_up")) {
      let { desire, position, id, reward } = predicate;
      // let [go_pick_up, x, y, id, reward] = predicate;
      let profit = real_profit({ id: null, position: position, carriedBy: null, reward: reward }, currently_carrying_parcels);
      let last_profit = real_profit({ id: null, position: last.predicate.position, carriedBy: null, reward: last.predicate.reward }, currently_carrying_parcels);
      if (profit > last_profit) {
        console.log("Revising intention queue. Replacing", OptionStr(last.predicate), "with", OptionStr(predicate));
        let intention: Intention = new Intention(predicate);
        this.intention_queue.push(intention);
        if (last !== undefined) { last.stop(); }
      } else { return Promise.resolve(); }
    }

    // TODO: If I'm delivering a parcel, and the intention of picking up a new parcel arises, then maximize the reward! [Calc distance and score]
    // ? Calculate the real_profit of both and compare them

    // TODO: If I'm picking up a parcel, and the intention of delivering it arises, then maximize the reward! [Calc distance and score]
    // ? BASE CASE: For now we are just replacing the intention
    console.log("Revising intention queue. Reached the BASE CASE. Replacing", OptionStr(last.predicate), "with", OptionStr(predicate));
    const intention: Intention = new Intention(predicate);
    this.intention_queue.push(intention);
    if (last !== undefined) { last.stop(); } // ! Maybe remove if problematic
    return Promise.resolve();
  }
}

// * Start intention revision loop
const myAgent: IntentionRevisionInterface = new IntentionRevisionRevise();
myAgent.loop();

// * Intention
class Intention {
  // Plan currently used for achieving the intention
  #current_plan: Plan | null = null;
  // This is used to stop the intention
  #stopped: boolean = false;
  get stopped() { return this.#stopped; }
  stop() {
    console.log('stop intention', OptionStr(this.#predicate));
    this.#stopped = true;
    if (this.#current_plan) { this.#current_plan.stop(); }
  }
  // * #parent refers to caller
  //#parent: IntentionRevision | Plan;
  get predicate() { return this.#predicate; }
  #predicate: Option;
  constructor(predicate: Option) {
    //this.#parent = parent;
    this.#predicate = predicate;
  }
  log(...args: any[]) {
    console.log("\t", ...args);
  }
  #started: boolean = false;
  // * Using the plan library to achieve an intention
  async achieve(): Promise<Intention | boolean> {
    // Cannot start twice
    if (this.#started) { return this; }
    else { this.#started = true; }
    // Trying all plans in the library
    // if stopped then quit
    if (this.stopped) { throw { msg: "stopped intention", option: this.predicate }; }
    this.log("Current intention", OptionStr(this.predicate));
    let planClass: Plan | undefined = planLibrary.get(this.predicate.desire);
    if (planClass == undefined) { throw { msg: "no plan found for intention", option: this.predicate }; }
    else { this.log("Found plan", planClass.constructor.name); }
    if (planClass.isApplicableTo(this.predicate)) {
      // plan is instantiated
      this.#current_plan = planClass;
      this.log("achieving intention", OptionStr(this.predicate), "with plan", planClass.constructor.name);
      // and plan is executed and result returned
      try {
        const plan_res: boolean = await this.#current_plan.execute(this.predicate);
        this.log("succesful intention", OptionStr(this.predicate), "with plan", planClass.constructor.name, "with result:", plan_res);
        return plan_res;
      } catch (error) {
        this.log("failed intention", OptionStr(this.predicate), "with plan", planClass.constructor.name, "with error:", error);
        if (String(error) == "stucked") {
          // ? If stucked then try the next plan
          this.log("Found a stucked plan, trying the next one!");
        }
      }
    } else { this.log("Plan not applicable to intention", OptionStr(this.predicate)); }

    // if stopped then quit
    if (this.stopped) { throw { msg: "stopped intention", option: this.predicate }; }

    // no plans have been found to satisfy the intention
    this.log('no plan satisfied the intention ', OptionStr(this.predicate));
    throw { msg: "no plan satisfied the intention ", option: this.predicate };
  }
}

// * Plan library
const planLibrary: Map<string, Plan> = new Map();
class Plan implements PlanInterface {
  isApplicableTo(option: Option) { return false; }
  async execute(option: Option): Promise<boolean> { return false; }
  public stopped: boolean = false;
  stop() {
    this.stopped = true;
    for (const i of this.#sub_intentions) { i.stop(); }
    this.stopped = false;
  }
  // * #parent refers to caller
  // #parent: any;
  // constructor(parent: any) { this.#parent = parent; }
  log(...args: any[]) { this.log("\t\t", ...args); }
  // this is an array of sub intention. Multiple ones could eventually being achieved in parallel.
  #sub_intentions: Array<Intention> = [];
  async subIntention(predicate: Option): Promise<boolean | Intention> {
    const sub_intention: Intention = new Intention(predicate);
    this.#sub_intentions.push(sub_intention);
    return await sub_intention.achieve();
  }
}

interface PlanInterface {
  isApplicableTo(option: Option): boolean;
  execute(option: Option): Promise<boolean>;
}

class GoPickUp extends Plan implements PlanInterface {
  isApplicableTo(option: Option): boolean { return option.desire == "go_pick_up"; }
  async execute(option: Option): Promise<boolean> {
    if (this.stopped) { throw "stopped"; }
    await this.subIntention({ desire: "go_to", position: option.position, id: option.id, reward: option.reward })
    if (this.stopped) { throw "stopped"; }
    console.log("Client reached the destination, now picking up the parcel!");
    let nowparcels = carrying_parcels_fn();
    let res = try_action(async () => { await client.pickup(); }, () => { return carrying_parcels_fn() > nowparcels; }, 10);
    if (!res) { console.log(clc.bgRedBright("Failed to pick up parcel, throwing stucked!")); throw "stucked"; }
    console.log("Client picked up the parcel succesfully!");
    if (this.stopped) { throw "stopped"; }
    // carrying_parcels += 1;
    return true;
  }
}

class GoPutDown extends Plan implements PlanInterface {
  isApplicableTo(option: Option): boolean { return option.desire == "go_put_down"; }
  async execute(option: Option): Promise<boolean> {
    if (this.stopped) { throw "stopped"; }
    await this.subIntention({ desire: "go_to", position: option.position, id: option.id, reward: option.reward });
    if (this.stopped) { throw "stopped"; }
    console.log("Client reached the destination, now putting down the parcel!");
    let res = try_action(async () => { await client.putdown(); }, () => { return carrying_parcels_fn() == 0; }, 10);
    if (!res) { console.log(clc.bgRedBright("Failed to put down parcel, throwing stucked!")); throw "stucked"; }
    console.log("Client put down the parcel succesfully!");
    // remove my carried parcels from the parcels list now
    for (const parcel of parcels.values()) { if (parcel.carriedBy == me.id && parcel.id) { parcels.delete(parcel.id); } }
    if (this.stopped) { throw "stopped"; }
    // carrying_parcels = 0;
    return true;
  }
}

class AStarMove extends Plan implements PlanInterface {
  isApplicableTo(option: Option): boolean { return (option.desire == "go_to" || option.desire == "rnd_walk_to"); }
  async execute(option: Option): Promise<boolean> {
    if (this.stopped) { throw "stopped"; }
    await this.astars(option.position);
    if (this.stopped) { throw "stopped"; }
    return true;
  }

  async astars(target: Point2D): Promise<boolean> {
    // ? Base Case Must Be Checked
    if (distance(me.position, target) == 0) { return true; }
    if (this.stopped) { throw "stopped"; }
    if (distance(me.position, target) == 1) {
      let res: boolean = await this.towards(target);
      console.log("Res is", res);
      if (!res) {
        console.log("Stucked at the end, can't touch the objective block!");
        throw "stucked";
      }
      return true;
    }
    if (this.stopped) { throw "stopped"; }
    let mypos = { x: Math.round(me.position.x), y: Math.round(me.position.y) };
    console.log("Now searching for a solution in Me: { x: ", mypos.x, ", y: ", mypos.y, " }, To: { x: ", target.x, ", y: ", target.y, "}");
    let path = pathFind.findPath(mypos.x, mypos.y, target.x, target.y);
    //if (this.stopped) { console.log("Stopping Now since stopped is true"); throw "stopped"; }
    // maplog(me, x, y, path);
    if (path && path.length > 0) {
      // * We found the solution! We can follow it!
      console.log("Found the solution!, From: { x: ", mypos.x, ", y: ", mypos.y, " }, To: { x: ", target.x, ", y: ", target.y, "}, Path: ", path);
      for (let i = 0; i < path.length; i++) {
        //if (this.stopped) { throw "stopped"; }
        let [nx, ny] = [path[i].x, path[i].y];
        let mypos = { x: Math.round(me.position.x), y: Math.round(me.position.y) };
        if (nx == mypos.x && ny == mypos.y) { continue; }
        let res: boolean = await this.towards({ x: nx, y: ny });
        if (!res) {
          // ? Recalculate the road!
          console.log("Currently stuck, recalculating the road!");
          if (this.stopped) { throw "stopped"; }
          await this.astars(target);
          if (this.stopped) { throw "stopped"; }
          return true;
        }
        // If a parcel is on my tile and I still have space, then pick it up
        if (i == path.length - 1 && carrying_parcels_fn() < CONFIG.PARCELS_MAX) {
          try {
            let p = undefined;
            parcels.forEach((parcel) => { if (point2DEqual(parcel.position, me.position)) { p = parcel; } });
            // parcels.forEach((parcel) => { if (parcel.position.x === me.position.x && parcel.position.y === me.position.y) { p = parcel; } });
            if (p !== undefined) {
              console.log("Picking up a new parcel on the road...");
              let nowparcels = carrying_parcels_fn();
              let act = try_action(async () => { await client.pickup(); }, () => { return carrying_parcels_fn() > nowparcels; }, 10);
              if (!act) { console.log(clc.bgRedBright("Failed to pick up parcel on the road, carrying on...")); }
              // carrying_parcels += 1;
            }
          } catch (error) {
            console.log("Error in picking up parcel on the road", error, " carrying on...");
          }
        }
      }
      if (this.stopped) { throw "stopped"; }
      return true;
    } else {
      // * Log the grid also
      if (this.stopped) { throw "stopped"; }
      console.log("No solution found, Me: { x: ", me.position.x, ", y: ", me.position.y, " }, To: { x: ", target.x, ", y: ", target.y, "}, Path: ", path);
      console.log("stucked");
      throw "stucked";
    }
  }

  async towards(target: Point2D): Promise<boolean> {
    let maxAttempts = 25;
    let attempts = 0;
    console.log("Now moving towards the target...", target);
    if (this.stopped) { console.log("Stopping now since received a stop signal (towards())"); throw "stopped"; }
    while (Math.round(me.position.x) !== target.x || Math.round(me.position.y) !== target.y) {
      if (this.stopped) { throw "stopped"; }
      if (attempts >= maxAttempts) {
        console.log(`Impossible to reach the end of the path, it should be (${target.x}, ${target.y}) but it is (${Math.round(me.position.x)},${Math.round(me.position.y)})`);
        return false;
      }
      console.log("Current attempt: ", attempts, " Me: ", me.position, " Target: ", target);
      if (Math.round(me.position.x) < target.x) {
        console.log("Moving right...");
        client.move("right");
        console.log("Moved right...");
      } else if (Math.round(me.position.x) > target.x) {
        console.log("Moving left...");
        client.move("left");
        console.log("Moved left...");
      } else if (Math.round(me.position.y) < target.y) {
        console.log("Moving up...");
        client.move("up");
        console.log("Moved up...");
      } else if (Math.round(me.position.y) > target.y) {
        console.log("Moving down...");
        client.move("down");
        console.log("Moved down...");
      }
      console.log("Moved to target...", target);
      await sleep(CONFIG.MOVEMENT_DURATION);
      console.log("Awaited for movement duration...");
      attempts++
    }
    console.log("Succesfully moved to target...");
    if (this.stopped) { throw "stopped"; }
    return true;
  }
}

async function try_action(action: Function, check: Function, maxTries: number): Promise<boolean> {
  let tries = 0;
  while (tries < maxTries) {
    await action();
    if (check()) { return true; }
    await sleep(CONFIG.MOVEMENT_DURATION);
    tries += 1;
  }
  return false;
}

// plan classes are added to plan library
planLibrary.set("go_pick_up", new GoPickUp());
planLibrary.set("go_put_down", new GoPutDown());
planLibrary.set("go_to", new AStarMove());
planLibrary.set("rnd_walk_to", new AStarMove());
