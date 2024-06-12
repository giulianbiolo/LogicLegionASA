import { type Point2D, type Parcel, point2DEqual } from "./types";
import { CONFIG, me, parcels, delivery_tiles, other_agents, pathFind } from "./agent";
import { sleep } from "bun";
import fs from "fs";


export function distance(pt1: Point2D, pt2: Point2D): number {
  const dx = Math.abs(Math.round(pt1.x) - Math.round(pt2.x));
  const dy = Math.abs(Math.round(pt1.y) - Math.round(pt2.y));
  return dx + dy;
}

export function reachable(pt: Point2D): boolean {
  try {
    let mypos = { x: Math.round(me.position.x), y: Math.round(me.position.y) };
    let path = pathFind.findPath(mypos.x, mypos.y, pt.x, pt.y);
    return ((path !== null) && (path.length > 0));
  } catch { return true; } // ? If the pathfind fails, then just blind belief that it's reachable
}

export function carrying_parcels_fn(): number {
  let count: number = 0;
  for (const parcel of parcels.values()) {
    if (parcel.carriedBy === me.id) { count += 1; }
  }
  return count;
}

export function carrying_parcels_val(): Parcel[] {
  let carrying: Parcel[] = [];
  for (const parcel of parcels.values()) {
    if (parcel.carriedBy === me.id) { carrying.push(parcel); }
  }
  return carrying;
}

export function onAnyDeliveryTile(parcel: Parcel): boolean {
  for (const delivery of delivery_tiles) {
    if (point2DEqual(parcel.position, delivery)) { return true; }
  }
  return false;
}

export function anyAgentOnTile(pt: Point2D) {
  for (const other_agent of other_agents.values()) {
    let other_pos = { x: Math.round(other_agent.position.x), y: Math.round(other_agent.position.y) };
    let pt_round = { x: Math.round(pt.x), y: Math.round(pt.y) };
    if (point2DEqual(pt_round, other_pos)) { return true; }
  }
  return false;
}

export function real_profit(parcel: Parcel, carrying: number): number {
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

export async function try_action(action: Function, check: Function, maxTries: number): Promise<boolean> {
  let tries = 0;
  while (tries < maxTries) {
    await action();
    if (check()) { return true; }
    await sleep(CONFIG.MOVEMENT_DURATION);
    tries += 1;
  }
  return false;
}

/**
 * @param {string} path
 * @returns {Promise<string>} the content of the file at path
 */
export function readFile(path: string): Promise<any> {
  return new Promise((res, rej) => {
      fs.readFile(path, "utf8", (err, data) => {
          if (err) rej(err)
          else res(data)
      })
  })
}
