import { type Point2D, type Parcel, point2DEqual } from "./types";
import { CONFIG, me, parcels, delivery_tiles, other_agents, pathFind, spawner_tiles } from "./agent";
import { sleep } from "bun";
import fs from "fs";


/**
 * 
 * @param {Point2D} pt1 First Point
 * @param {Point2D} pt2 Second Point
 * @returns {number} Distance in Manhattan metric between two points
 */
export function distance(pt1: Point2D, pt2: Point2D): number {
  const dx = Math.abs(Math.round(pt1.x) - Math.round(pt2.x));
  const dy = Math.abs(Math.round(pt1.y) - Math.round(pt2.y));
  return dx + dy;
}

/**
 * 
 * @param {Point2D} pt Point to check
 * @param {Point2D} agentPos Starting agent position
 * @returns {boolean} true if the point is reachable given current knowledge of the map, false otherwise
 */
export function reachable(pt: Point2D, agentPos: Point2D = me.position): boolean {
  try {
    let mypos = { x: Math.round(agentPos.x), y: Math.round(agentPos.y) };
    if (point2DEqual(mypos, pt)) { return true; }
    let path = pathFind.findPath(mypos.x, mypos.y, pt.x, pt.y);
    return ((path !== null) && (path.length > 0));
  } catch { return true; } // ? If the pathfind fails, then just blind belief that it's reachable
}

/**
 * @param {string} agentId the agent id to check
 * @returns {number} the number of parcels carried by the agent
 */
export function carrying_parcels_fn(agentId: string = me.id): number {
  let count: number = 0;
  for (const parcel of parcels.values()) {
    if (parcel.carriedBy === agentId) { count += 1; }
  }
  return count;
}

/**
 * 
 * @returns {Parcel[]} the parcels carried by the agent
 */
export function carrying_parcels_val(): Parcel[] {
  let carrying: Parcel[] = [];
  for (const parcel of parcels.values()) {
    if (parcel.carriedBy === me.id) { carrying.push(parcel); }
  }
  return carrying;
}

/**
 * 
 * @param {Point2D} pt Point position to check
 * @returns {number} Distance from point to nearest spawner block
 */
export function nearest_spawner(pt: Point2D): number {
  let nearest: number = Number.MAX_VALUE;
  for (const spawner of spawner_tiles) {
    let d = distance(spawner, pt);
    if (d < nearest) { nearest = d; }
  }
  return nearest;
}

/**
 * 
 * @param {Point2D} pt Point position to check
 * @returns {number} Distance from point to nearest delivery block
 */
export function nearest_delivery(pt: Point2D): number {
  let nearest: number = Number.MAX_VALUE;
  for (const delivery of delivery_tiles) {
    let d = distance(delivery, pt);
    if (d < nearest) { nearest = d; }
  }
  return nearest;
}

/**
 * 
 * @param parcel the parcel to check
 * @returns true if the parcel is on a delivery tile, false otherwise
 */
export function onAnyDeliveryTile(parcel: Parcel): boolean {
  for (const delivery of delivery_tiles) {
    if (point2DEqual(parcel.position, delivery)) { return true; }
  }
  return false;
}

/**
 * 
 * @param pt the point to check
 * @returns true if there is any agent on the tile, false otherwise
 */
export function anyAgentOnTile(pt: Point2D) {
  for (const other_agent of other_agents.values()) {
    let other_pos = { x: Math.round(other_agent.position.x), y: Math.round(other_agent.position.y) };
    let pt_round = { x: Math.round(pt.x), y: Math.round(pt.y) };
    if (point2DEqual(pt_round, other_pos)) { return true; }
  }
  return false;
}

/**
 * 
 * @param pt the point to check
 * @returns true if there is any parcel on the tile, false otherwise
 */
export function anyParcelOnTile(pt: Point2D) {
  for (const parcel of parcels.values()) {
    let parcel_pos = { x: Math.round(parcel.position.x), y: Math.round(parcel.position.y) };
    let pt_round = { x: Math.round(pt.x), y: Math.round(pt.y) };
    if (point2DEqual(pt_round, parcel_pos)) { return true; }
  }
  return false;
}

/**
 * 
 * @param parcel the parcel to check
 * @param carrying the number of parcels carried by the agent
 * @returns the expected profit achievable by going to pick up a parcel, instead of moving to a delivery tile
 */
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

/**
 * 
 * @param {Function} action the action to try
 * @param {Function} check the check to perform
 * @param {number} maxTries the maximum number of tries
 * @returns 
 */
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
 * @param {string} path the path to the file
 * @returns {Promise<string>} the content of the file at path
 */
export function readFile(path: string): Promise<string> {
  return new Promise((res, rej) => {
      fs.readFile(path, "utf8", (err, data) => {
          if (err) rej(err)
          else res(data)
      })
  })
}
