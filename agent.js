import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import ApathFind from "a-star-pathfind";

const client = new DeliverooApi(
  "http://localhost:8080",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjMwZTU2ZDYwN2MyIiwibmFtZSI6InRlc3QxIiwiaWF0IjoxNzEzNzg5NDI1fQ.hovsONlTbtjfcf3LiGcOZ9YlCNVD93XC7WPtC3AdkAE"
);
const MAP_SIZE = 100;
var start_time = new Date().getTime() / 1000;

function distance({ x: x1, y: y1 }, { x: x2, y: y2 }) {
  const dx = Math.abs(Math.round(x1) - Math.round(x2));
  const dy = Math.abs(Math.round(y1) - Math.round(y2));
  return dx + dy;
}

function real_profit(parcel, carrying_parcels) {
  // * This method computes the expected profit achievable by going to pick up a parcel, instead of moving to a delivery tile
  // ? If parcel decaying time is infinite then the real profit is the reward of the parcel
  if (CONFIG.PARCEL_DECADING_INTERVAL >= 999999) { return parcel.reward; }
  let parcel_reward = parcel.reward;
  let distance_to_parcel = distance({ x: parcel.x, y: parcel.y }, me);
  let distance_to_closest_delivery_tile_from_parcel = Number.MAX_VALUE;
  for (const delivery_tile of delivery_tiles) {
    let d = distance({ x: delivery_tile.x, y: delivery_tile.y }, { x: parcel.x, y: parcel.y });
    if (d < distance_to_closest_delivery_tile_from_parcel) { distance_to_closest_delivery_tile_from_parcel = d; }
  }
  let distance_multiplier = Math.round((CONFIG.MOVEMENT_DURATION  / (1000 * CONFIG.PARCEL_DECADING_INTERVAL)));

  let distance_to_closest_delivery_tile_from_me = Number.MAX_VALUE;
  for (const delivery_tile of delivery_tiles) {
    let d = distance({ x: delivery_tile.x, y: delivery_tile.y }, me);
    if (d < distance_to_closest_delivery_tile_from_me) { distance_to_closest_delivery_tile_from_me = d; }
  }

  let loss_if_deliver_right_away = carrying_parcels * distance_to_closest_delivery_tile_from_me * distance_multiplier;
  let loss_if_go_pick_up = carrying_parcels * distance_to_parcel * distance_multiplier + (carrying_parcels + 1) * distance_to_closest_delivery_tile_from_parcel * distance_multiplier;
  let gain_if_go_pick_up = parcel_reward - distance_to_parcel * distance_multiplier;

  return gain_if_go_pick_up - (loss_if_go_pick_up - loss_if_deliver_right_away);
}

// * Beliefset revision function
const me = {};
client.onYou(({ id, name, x, y, score }) => {
  me.id = id;
  me.name = name;
  me.x = x;
  me.y = y;
  me.score = score;
});
/**
 * @type {Map<id,{id, x, y, carriedBy, reward}>}
 */
const parcels = new Map();
var carrying_parcels = 0;
var pathFind = new ApathFind.default();
var pathFindInit = false;
var tiles = [];

var delivery_tiles = [];
/**
 * @type {Map<id,{id, name, x, y, score, lastUpdate}>}
 */
var other_agents = new Map();
const CONFIG = {};
client.onConfig((config) => {
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
  console.log("Parcel Sensing Event at time", new Date().getTime() / 1000 - start_time, "with parcels", parcels);
  for (const p of perceived_parcels) { parcels.set(p.id, p); }
  for (const [id, p] of parcels) {
    if (!perceived_parcels.find((pp) => pp.id == id)) { parcels.delete(id); }
    if (p.reward <= 2 && CONFIG.PARCEL_DECADING_INTERVAL <= 99999) { parcels.delete(id); }
  }
  generateOptions();
});
client.onTile((x, y, delivery) => {
  console.log("Tile Event at time", new Date().getTime() / 1000 - start_time, "with x", x, "y", y, "delivery", delivery);
  pathFind.changeTileValue(x, y, 1);
  if (delivery) { delivery_tiles.push({ x, y }); }
});
client.onAgentsSensing((agents) => {
  console.log("Agent Sensing Event at time", new Date().getTime() / 1000 - start_time, "with parcels", parcels);
  // * Now let's update the grid beliefset by replacement!
  // * Now let's update the grid beliefset by revision!
  let timenow = new Date().getTime() / 1000;
  for (const ag of agents) {
    let agent = {
      id: ag.id,
      x: ag.x,
      y: ag.y,
      score: ag.score,
      lastUpdate: timenow,
    };
    if (agent.id == me.id) { continue; }
    if (agent.x == null || agent.y == null) { continue; }
    if (agent.x < 0 || agent.y < 0) { continue; }
    if (agent.x >= MAP_SIZE || agent.y >= MAP_SIZE) { continue; }
    // check if this agent is contained in the other_agents array, if so then remove it from the old position
    if (other_agents.has(agent.id)) {
      let old_agent = other_agents.get(agent.id);
      pathFind.changeTileValue(Math.round(old_agent.x), Math.round(old_agent.y), 1);
    }
    other_agents.set(agent.id, agent);
    pathFind.changeTileValue(Math.round(agent.x), Math.round(agent.y), 0);
  }
  // ? Also update all agents with older timestamp of 3 seconds by removing them from the grid
  for (const [id, agent] of other_agents) {
    if (agent.lastUpdate < timenow - 3) {
      pathFind.changeTileValue(Math.round(agent.x), Math.round(agent.y), 1);
      other_agents.delete(id);
    }
  }
  // * Now let's generate new options
  generateOptions();
});

function generateOptions() {
  // * Options generation
  const options = [];
  for (const parcel of parcels.values()) {
    if (!parcel.carriedBy) {
      options.push(["go_pick_up", parcel.x, parcel.y, parcel.id, parcel.reward]);
    }
  }
  if (carrying_parcels > 0) {
    for (const delivery of delivery_tiles) {
      if (anyAgentOnTile(delivery)) { continue; }
      options.push(["go_put_down", delivery.x, delivery.y, null, null]);
    }
  }
  if (options.length == 0) {
    // * Consider random walk to a tile in the map that is reachable
    let x, y = 0;
    do {
      x = Math.floor(Math.random() * MAP_SIZE);
      y = Math.floor(Math.random() * MAP_SIZE);
    } while (pathFind.tiles[y][x].val == 0);
    options.push(["rnd_walk_to", x, y]);
  }
  // * Options filtering
  let must_deliver = carrying_parcels >= CONFIG.PARCELS_MAX; // ? Se ho più di un pacco devo per forza consegnare [ Temporaneo per testing ]
  let nothing_to_deliver = carrying_parcels == 0;
  if (must_deliver && nothing_to_deliver) { console.log("PARCELS_MAX Cannot Be Set To 0 !!!"); return; }
  let best_option;
  let nearest = Number.MAX_VALUE;
  for (const option of options) {
    if (must_deliver && option[0] == "go_pick_up") { continue; }
    if (nothing_to_deliver && option[0] == "go_put_down") { continue; }
    let [go_pick_up, x, y, id, reward] = option;
    let current_d = distance({ x, y }, me);
    // ? Take into account only valuable options
    if (go_pick_up == "go_pick_up" && CONFIG.PARCEL_DECADING_INTERVAL < 999999) {
      let profit = real_profit({ x: x, y: y, reward: reward }, carrying_parcels);
      if (profit < 0) { continue; }
    }
    if (current_d < nearest) {
      best_option = option;
      nearest = current_d;
    }
  }
  // * Best option is selected
  console.log("Pushing new option to the agent", best_option);
  // ? Let us add a new intention to the agent. If the current best is go_pick_up, and in the options there is a go_put_down, then let's push also that
  if (best_option) { myAgent.push(best_option); }
  if (best_option && best_option[0] == "go_pick_up") {
    // Let's check if there is a go_put_down in the options
    let go_put_down = options.find((o) => o[0] == "go_put_down");
    if (go_put_down) {
      myAgent.push(go_put_down);
    }
  }
}

function anyAgentOnTile({ x, y }) {
  for (const agent of other_agents.values()) {
    if (Math.round(agent.x) == x && Math.round(agent.y) == y) { return true; }
  }
  return false;
}

// * Intention revision loop
class IntentionRevision {
  #intention_queue = new Array();
  get intention_queue() { return this.#intention_queue; }

  async loop() {
    while (true) {
      // Consumes intention_queue if not empty
      console.log("intentionRevision.loop queue: ", this.intention_queue.map((i) => i.predicate));
      if (this.intention_queue.length > 0) {
        console.log("intentionRevision.loop", this.intention_queue.map((i) => i.predicate));
        // Current intention
        const intention = this.intention_queue[0];
        // Is queued intention still valid? Do I still want to achieve it?
        // TODO: Add other checks and cases
        if (intention.predicate[0] == "go_pick_up") {
          let p = parcels.get(intention.predicate[3]);
          if (p && p.carriedBy) {
            console.log("Skipping intention because no more valid, parcel carriedBy other agent", intention.predicate);
            this.intention_queue.shift();
            continue;
          }
        }
        if (intention.predicate[0] == "go_put_down" && anyAgentOnTile({ x: intention.predicate[1], y: intention.predicate[2] })) {
          console.log("Skipping intention because no more valid, other agent on delivery tile", intention.predicate);
          this.intention_queue.shift();
          continue;
        }
        // Start achieving intention
        await intention
          .achieve()
          // Catch eventual error and continue
          .catch((error) => { console.log('Failed intention', ...intention.predicate, 'with error:', error) });
        // Remove from the queue
        this.intention_queue.shift();
        // Postpone next iteration at setImmediate
      } else {
        if (pathFindInit) { generateOptions(); }
      }
      await new Promise((res) => setImmediate(res));
    }
  }
  // async push ( predicate ) { }
  log(...args) { console.log(...args); }
}

class IntentionRevisionQueue extends IntentionRevision {
  async push(predicate) {
    // Check if already queued
    if (this.intention_queue.find((i) => i.predicate.join(" ") == predicate.join(" "))) {
      return; // intention is already queued
    }
    console.log("IntentionRevisionReplace.push", predicate);
    const intention = new Intention(this, predicate);
    this.intention_queue.push(intention);
  }
}

class IntentionRevisionReplace extends IntentionRevision {
  async push(predicate) {
    // Check if already queued
    const last = this.intention_queue.at(this.intention_queue.length - 1);
    if (last && last.predicate.join(" ") == predicate.join(" ")) {
      return; // intention is already being achieved
    }
    console.log("IntentionRevisionReplace.push", predicate);
    const intention = new Intention(this, predicate);
    this.intention_queue.push(intention);
    // Force current intention stop
    if (last) { last.stop(); }
  }
}

class IntentionRevisionRevise extends IntentionRevision {
  async push(predicate) {
    console.log("Revising intention queue. Received", ...predicate);
    // TODO
    // - order intentions based on utility function (reward - cost) (for example, parcel score minus distance)
    // - eventually stop current one
    // - evaluate validity of intention
    const last = this.intention_queue.at(this.intention_queue.length - 1);
    // * If the queue is empty, then just push the intention
    if (!last) {
      const intention = new Intention(this, predicate);
      this.intention_queue.push(intention);
      return;
    }
    if (last.predicate.join(" ") == predicate.join(" ")) { return; } // ? If the same intention is already being achieved, then skip
    if (last.predicate[0] == "rnd_walk_to" && predicate[0] == "rnd_walk_to") { return; } // ? If already random walking, don't need to revise it with a new random walk
    if (last.predicate[0] != "rnd_walk_to" && predicate[0] == "rnd_walk_to") { return; }
    if (last.predicate[0] == "rnd_walk_to" && predicate[0] != "rnd_walk_to") {
      console.log("Revising intention queue. Replacing", last.predicate, "with", predicate);
      const intention = new Intention(this, predicate);
      this.intention_queue.push(intention);
      last.stop();
      return;
    }
    // * If I'm delivering a parcel, and the intention of delivering it arises, then select by distance.
    // * Also if the parcels don't decay, just select by distance
    if ((last.predicate[0] == "go_put_down" && predicate[0] == "go_put_down") || CONFIG.PARCEL_DECADING_INTERVAL >= 999999) {
      let [go_put_down, x, y, id] = predicate;
      let current_d = distance({ x, y }, me);
      let last_d = distance({ x: last.predicate[1], y: last.predicate[2] }, me);
      if (current_d < last_d) {
        console.log("Revising intention queue. Replacing", last.predicate, "with", predicate);
        const intention = new Intention(this, predicate);
        this.intention_queue.push(intention);
        if (last) { last.stop(); }
      } else { return; }
    }
    // TODO: If I'm picking up a parcel, and the intention of picking up a new parcel arises, then maximize the reward! [Calc distance and score]
    // ? Calculate the real_profit of both and compare them
    if ((last.predicate[0] == "go_pick_up" && predicate[0] == "go_pick_up")) {
      let [go_pick_up, x, y, id, reward] = predicate;
      let profit = real_profit({ x: x, y: y, reward: reward }, carrying_parcels);
      let last_profit = real_profit({ x: last.predicate[1], y: last.predicate[2], reward: last.predicate[4] }, carrying_parcels);
      if (profit > last_profit) {
        console.log("Revising intention queue. Replacing", last.predicate, "with", predicate);
        const intention = new Intention(this, predicate);
        this.intention_queue.push(intention);
        if (last) { last.stop(); }
      } else { return; }
    }

    // TODO: If I'm delivering a parcel, and the intention of picking up a new parcel arises, then maximize the reward! [Calc distance and score]
    // ? Calculate the real_profit of both and compare them

    // TODO: If I'm picking up a parcel, and the intention of delivering it arises, then maximize the reward! [Calc distance and score]
    // ? BASE CASE: For now we are just replacing the intention
    const intention = new Intention(this, predicate);
    this.intention_queue.push(intention);
    last.stop();
  }
}

// * Start intention revision loop
// const myAgent = new IntentionRevisionQueue();
// const myAgent = new IntentionRevisionReplace();
const myAgent = new IntentionRevisionRevise();
myAgent.loop();

// * Intention
class Intention {
  // Plan currently used for achieving the intention
  #current_plan;
  // This is used to stop the intention
  #stopped = false;
  get stopped() { return this.#stopped; }
  stop() {
    // this.log( 'stop intention', ...this.#predicate );
    this.#stopped = true;
    if (this.#current_plan) { this.#current_plan.stop(); }
  }
  // * #parent refers to caller
  #parent;
  // * predicate is in the form ['go_to', x, y]
  get predicate() { return this.#predicate; }
  #predicate;
  constructor(parent, predicate) {
    this.#parent = parent;
    this.#predicate = predicate;
  }
  log(...args) {
    if (this.#parent && this.#parent.log) { this.#parent.log("\t", ...args); }
    else { console.log(...args); }
  }
  #started = false;
  // * Using the plan library to achieve an intention
  async achieve() {
    // Cannot start twice
    if (this.#started) { return this; }
    else { this.#started = true; }

    // Trying all plans in the library
    for (const planClass of planLibrary) {
      // if stopped then quit
      if (this.stopped) { throw ["stopped intention", ...this.predicate]; }

      // if plan is 'statically' applicable
      if (planClass.isApplicableTo(...this.predicate)) {
        // plan is instantiated
        this.#current_plan = new planClass(this.parent);
        this.log("achieving intention", ...this.predicate, "with plan", planClass.name);
        // and plan is executed and result returned
        try {
          const plan_res = await this.#current_plan.execute(...this.predicate);
          this.log("succesful intention", ...this.predicate, "with plan", planClass.name, "with result:", plan_res);
          return plan_res;
          // or errors are caught so to continue with next plan
        } catch (error) {
          this.log("failed intention", ...this.predicate, "with plan", planClass.name, "with error:", error);
          if (error == "stucked") {
            // ? If stucked then try the next plan
            this.log("Found a stucked plan, trying the next one!");
            continue;
          }
        }
      }
    }

    // if stopped then quit
    if (this.stopped) { throw ["stopped intention", ...this.predicate]; }

    // no plans have been found to satisfy the intention
    this.log( 'no plan satisfied the intention ', ...this.predicate );
    throw ["no plan satisfied the intention ", ...this.predicate];
  }
}

// * Plan library
const planLibrary = [];
class Plan {
  #stopped = false;
  stop() {
    this.#stopped = true;
    for (const i of this.#sub_intentions) { i.stop(); }
  }
  get stopped() { return this.#stopped; }
  // * #parent refers to caller
  #parent;
  constructor(parent) { this.#parent = parent; }
  log(...args) {
    if (this.#parent && this.#parent.log) { this.#parent.log("\t", ...args); }
    else { console.log(...args); }
  }
  // this is an array of sub intention. Multiple ones could eventually being achieved in parallel.
  #sub_intentions = [];
  async subIntention(predicate) {
    const sub_intention = new Intention(this, predicate);
    this.#sub_intentions.push(sub_intention);
    return await sub_intention.achieve();
  }
}

class GoPickUp extends Plan {
  static isApplicableTo(go_pick_up, x, y, id) { return go_pick_up == "go_pick_up"; }
  async execute(go_pick_up, x, y) {
    if (this.stopped) throw ["stopped"]; // if stopped then quit
    await this.subIntention(["go_to", x, y]);
    if (this.stopped) throw ["stopped"]; // if stopped then quit
    let res = await client.pickup();
    if (this.stopped) throw ["stopped"]; // if stopped then quit
    carrying_parcels = res.length;
    return true;
  }
}

class GoPutDown extends Plan {
  static isApplicableTo(go_put_down, x, y, id) { return go_put_down == "go_put_down"; }
  async execute(go_put_down, x, y) {
    if (this.stopped) throw ["stopped"]; // if stopped then quit
    await this.subIntention(["go_to", x, y]);
    if (this.stopped) throw ["stopped"]; // if stopped then quit
    await client.putdown();
    if (this.stopped) throw ["stopped"]; // if stopped then quit
    carrying_parcels = 0;
    return true;
  }
}

class AStarMove extends Plan {
  static isApplicableTo(go_to, x, y) { return (go_to == "go_to" || go_to == "rnd_walk_to"); }
  async execute(go_to, x, y) {
    if (this.stopped) { throw ["stopped"]; }
    await this.astars(x, y);
    if (this.stopped) { throw ["stopped"]; }
    return true;
  }

  async astars(x, y) {
    // ? Base Case Must Be Checked
    if (distance({ x: me.x, y: me.y }, { x, y }) == 0) { return true; }
    if (this.stopped) { throw ["stopped"]; }
    if (distance({ x: me.x, y: me.y }, { x, y }) == 1) {
      let res = await this.towards(x, y);
      if (!res) {
        console.log("Stucked at the end, can't touch the objective block!");
        throw "stucked";
      }
      return true;
    }
    if (this.stopped) { throw ["stopped"]; }
    this.log("Now searching for a solution in Me: { x: ", me.x, ", y: ", me.y, " }, To: { x: ", x, ", y: ", y, "}");
    let path = pathFind.findPath(me.x, me.y, x, y);
    // maplog(me, x, y, path);
    if (path && path.length > 0) {
      // * We found the solution! We can follow it!
      this.log("Found the solution!, From: { x: ", me.x, ", y: ", me.y, " }, To: { x: ", x, ", y: ", y, "}, Path: ", path);
      for (let i = 0; i < path.length; i++) {
        let [nx, ny] = [path[i].x, path[i].y];
        if (nx == me.x && ny == me.y) { continue; }
        let res = await this.towards(nx, ny);
        if (!res) {
          // ? Recalculate the road!
          this.log("Currently stuck, recalculating the road!");
          if (this.stopped) { throw ["stopped"]; }
          await this.astars(x, y);
          if (this.stopped) { throw ["stopped"]; }
          return true;
        }
      }
      if (this.stopped) { throw ["stopped"]; }
      return true;
    } else {
      // * Log the grid also
      // maplog(me, x, y, path);
      if (this.stopped) { throw ["stopped"]; }
      this.log("No solution found, Me: { x: ", me.x, ", y: ", me.y, " }, To: { x: ", x, ", y: ", y, "}, Path: ", path);
      this.log("stucked");
      throw "stucked";
    }
  }

  async towards(x, y) {
    let status_x = false;
    let status_y = false;
    if (this.stopped) { throw ["stopped"]; } // if stopped then quit
    if (x > me.x) { status_x = await client.move("right"); }
    else if (x < me.x) { status_x = await client.move("left"); }
    if (status_x) {
      if (me.y != status_x.y) { console.log("ERROR IN X MOVEMENT"); return; }
      me.x = status_x.x;
      me.y = status_x.y;
    }
    if (this.stopped) { throw ["stopped"]; } // if stopped then quit
    if (y > me.y) { status_y = await client.move("up"); }
    else if (y < me.y) { status_y = await client.move("down"); }
    if (status_y) {
      if (me.x != status_y.x) { console.log("ERROR IN Y MOVEMENT"); return; }
      me.x = status_y.x;
      me.y = status_y.y;
    }
    if (this.stopped) { throw ["stopped"]; }
    return status_x || status_y;
  }
}

function maplog(me, x, y, path) {
  for (let i = MAP_SIZE - 1; i > 0; i--) {
    let row = "";
    for (let j = 0; j < MAP_SIZE; j++) {
      // COLOR ME.XY in green
      if (pathFind.tiles[i][j].val == 1) { row += "\x1b[44m"; }
      if (path.find((t) => { return t.y == i && t.x == j; })) { row += "\x1b[45m"; }
      if (i == me.y && j == me.x) { row += "\x1b[42m"; }
      if (i == y && j == x) { row += "\x1b[41m"; }
      row += pathFind.tiles[i][j].val + "\x1b[0m ";
    }
    console.log(row);
  }
  console.log();
}


// plan classes are added to plan library
planLibrary.push(GoPickUp);
planLibrary.push(GoPutDown);
planLibrary.push(AStarMove);
