import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import ApathFind from "a-star-pathfind";

const client = new DeliverooApi(
  "http://localhost:8080",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjMwZTU2ZDYwN2MyIiwibmFtZSI6InRlc3QxIiwiaWF0IjoxNzEzNzg5NDI1fQ.hovsONlTbtjfcf3LiGcOZ9YlCNVD93XC7WPtC3AdkAE"
);
const MAP_SIZE = 10;

function distance({ x: x1, y: y1 }, { x: x2, y: y2 }) {
  const dx = Math.abs(Math.round(x1) - Math.round(x2));
  const dy = Math.abs(Math.round(y1) - Math.round(y2));
  return dx + dy;
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
var tiles = [];

var delivery_tiles = [];
/**
 * @type {Map<id,{id, name, x, y, score}>}
 */
var other_agents = new Map();
const CONFIG = {};
client.onConfig((config) => {
  CONFIG.PARCELS_MAX = config["PARCELS_MAX"];
  CONFIG.MOVEMENT_STEPS = config["MOVEMENT_STEPS"];
  CONFIG.MOVEMENT_DURATION = config["MOVEMENT_DURATION"];
  CONFIG.AGENTS_OBSERVATION_DISTANCE = config["AGENTS_OBSERVATION_DISTANCE"];
  CONFIG.PARCEL_DECADING_INTERVAL = config["PARCEL_DECADING_INTERVAL"];
  CONFIG.CLOCK = config["CLOCK"];

  // * Init matrix of map
  for (let i = 0; i < MAP_SIZE; i++) {
    tiles[i] = [];
    for (let j = 0; j < MAP_SIZE; j++) {
      tiles[i][j] = 0;
    }
  }
  pathFind.init(tiles, { allowDiagonal: false, });
});
client.onParcelsSensing(async (perceived_parcels) => {
  for (const p of perceived_parcels) {
    parcels.set(p.id, p);
  }
});
client.onTile((x, y, delivery) => {
  pathFind.changeTileValue(x, y, 1);
  if (delivery) { delivery_tiles.push({ x, y }); }
});

// * Options generation and filtering function
client.onParcelsSensing((parcels) => {
  // TODO revisit beliefset revision so to trigger option generation only in the case a new parcel is observed
  // * Options generation
  const options = [];
  for (const parcel of parcels.values()) { if (!parcel.carriedBy) { options.push(["go_pick_up", parcel.x, parcel.y, parcel.id]); } }
  if (carrying_parcels > 0) { for (const delivery of delivery_tiles) { options.push(["go_put_down", delivery.x, delivery.y, null]); } }
  if (options.length == 0) {
    // * Consider random walk to a tile in the map that is reachable
    let x, y = 0;
    do {
      x = Math.floor(Math.random() * MAP_SIZE);
      y = Math.floor(Math.random() * MAP_SIZE);
    } while (pathFind.tiles[y][x].val == 0);
    options.push(["go_to", x, y]);
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
    let [go_pick_up, x, y, id] = option;
    let current_d = distance({ x, y }, me);
    if (current_d < nearest) {
      best_option = option;
      nearest = current_d;
    }
  }
  // * Best option is selected
  if (best_option) { myAgent.push(best_option); }
});
client.onAgentsSensing((agents) => {
  // TODO: Make it more intelligent, remove the old belief only if disproven by sensing an empty tile or moved agent, don't always clear all the beliefs
  // * Now let's update the grid beliefset by replacement!
  // ? Clear all of our old beliefs!
  other_agents.forEach((agent, id) => {
    pathFind.changeTileValue(Math.round(agent.x), Math.round(agent.y), 1);
  });
  other_agents.clear();
  // ? Add new beliefs!
  for (const agent of agents) { other_agents.set(agent.id, agent); }
  other_agents.forEach((agent, id) => {
    pathFind.changeTileValue(Math.round(agent.x), Math.round(agent.y), 0);
  });
});

// * Intention revision loop
class IntentionRevision {
  #intention_queue = new Array();
  get intention_queue() { return this.#intention_queue; }

  async loop() {
    while (true) {
      // Consumes intention_queue if not empty
      if (this.intention_queue.length > 0) {
        console.log("intentionRevision.loop", this.intention_queue.map((i) => i.predicate));
        // Current intention
        const intention = this.intention_queue[0];
        // Is queued intention still valid? Do I still want to achieve it?
        // TODO this hard-coded implementation is an example
        let id = intention.predicate[2];
        let p = parcels.get(id);
        if (p && p.carriedBy) {
          console.log("Skipping intention because no more valid", intention.predicate);
          continue;
        }
        // Start achieving intention
        await intention
          .achieve()
          // Catch eventual error and continue
          .catch((error) => { console.log('Failed intention', ...intention.predicate, 'with error:', error) });
        // Remove from the queue
        this.intention_queue.shift();
      }
      // Postpone next iteration at setImmediate
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
  }
}

// * Start intention revision loop
// const myAgent = new IntentionRevisionQueue();
const myAgent = new IntentionRevisionReplace();
// const myAgent = new IntentionRevisionRevise();
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
        } catch (error) { this.log("failed intention", ...this.predicate, "with plan", planClass.name, "with error:", error); }
      }
    }

    // if stopped then quit
    if (this.stopped) { throw ["stopped intention", ...this.predicate]; }

    // no plans have been found to satisfy the intention
    // this.log( 'no plan satisfied the intention ', ...this.predicate );
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

class BlindMove extends Plan {
  static isApplicableTo(go_to, x, y) { return go_to == "go_to"; }
  async execute(go_to, x, y) {
    await this.astars(x, y);
    return true;
  }

  async astars(x, y) {
    // ? Base Case Must Be Checked
    if (distance({ x: me.x, y: me.y }, { x, y }) == 0) { return true; }
    if (distance({ x: me.x, y: me.y }, { x, y }) == 1) {
      let res = await this.towards(x, y);
      if (!res) {
        console.log("Stucked at the end, can't touch the objective block!");
        throw "stucked";
      }
      return true;
    }
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
          await this.astars(x, y);
          return true;
        }
      }
      return true;
    } else {
      // * Log the grid also
      maplog(me, x, y, path);
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
planLibrary.push(BlindMove);
