import { sleep } from "bun";
import { CONFIG, client, me, parcels, pathFind } from "./agent";
import { Intention } from "./intention";
import { point2DEqual, type Option, type Point2D } from "./types";
import { carrying_parcels_fn, distance, try_action } from "./utils";
import clc from "chalk";


export const planLibrary: Map<string, Plan> = new Map();
interface PlanInterface {
  isApplicableTo(option: Option): boolean;
  execute(option: Option): Promise<boolean>;
}

export class Plan implements PlanInterface {
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

// plan classes are added to plan library
planLibrary.set("go_pick_up", new GoPickUp());
planLibrary.set("go_put_down", new GoPutDown());
planLibrary.set("go_to", new AStarMove());
planLibrary.set("rnd_walk_to", new AStarMove());
