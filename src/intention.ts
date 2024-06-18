import { CONFIG, client, currTeamObj, delivery_tiles, me, parcels, pathFindInit } from "./agent";
import { Plan, planLibrary } from "./plan";
import { OptionStr, point2DEqual, type Option } from "./types";
import { anyAgentOnTile, carrying_parcels_fn, distance, reachable, real_profit } from "./utils";
import { generateOptions } from "./options";
import clc from "chalk";
import { agentArgs } from "./args";
import { MsgBuilder, MsgType } from "./communication";


export interface IntentionRevisionInterface {
  push(predicate: Option): void;
  loop(): Promise<void>;
}

export class IntentionRevision implements IntentionRevisionInterface {
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
        // ? Check that the team mate is not already doing the same thing, and in that case, skip only if i'm the further away
        if (currTeamObj && !validObjOnTeamMate(intention.predicate)) {
          if (distance(intention.predicate.position, me.position) > distance(intention.predicate.position, currTeamObj.position)) {
            console.log("Skipping intention because no more valid, team mate is already doing the same thing", OptionStr(intention.predicate));
            this.intention_queue.shift();
            continue;
          }
        }
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

export class IntentionRevisionQueue extends IntentionRevision implements IntentionRevisionInterface {
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

export class IntentionRevisionReplace extends IntentionRevision implements IntentionRevisionInterface{
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

export class IntentionRevisionRevise extends IntentionRevision implements IntentionRevisionInterface{
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

export class Intention {
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

    if (!validObjOnTeamMate(this.predicate)) {
      this.log("Intention goes in conflict with team mate intention, skipping...", OptionStr(this.predicate));
      throw { msg: "Intention goes in conflict with team mate intention, skipping...", option: this.predicate };
    }

    let planClass: Plan | undefined = planLibrary.get(this.predicate.desire);
    if (planClass === undefined) { throw { msg: "no plan found for intention", option: this.predicate }; }
    else { this.log("Found plan", planClass.constructor.name); }
    if (planClass.isApplicableTo(this.predicate)) {
      // plan is instantiated
      this.#current_plan = planClass;
      this.log("achieving intention", OptionStr(this.predicate), "with plan", planClass.constructor.name);
      let msg: string = new MsgBuilder().kind(MsgType.ON_OBJECTIVE).objective(this.predicate).build();
      client.say(agentArgs.teamId, msg);
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

function validObjOnTeamMate(objective: Option): boolean {
  // * Check if the intention is valid for the team mate
  // * For now, just check if the team mate is not already doing the same thing
  if (currTeamObj === null) { return true; }
  if (currTeamObj.desire == objective.desire && point2DEqual(currTeamObj.position, objective.position)) { return false; }
  // TODO: Add controls for going through the same path
  return true;
}
