import { CONFIG, delivery_tiles, me, myAgent, parcels, pathFind, pathFindInit } from "./agent";
import { MAP_SIZE } from "./conf";
import { type Option, OptionStr } from "./types";
import { anyAgentOnTile, carrying_parcels_fn, distance, onAnyDeliveryTile, reachable } from "./utils";


export function generateOptions() {
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
    // Select a random tile that is reachable and not where I am now
    /*
    do {
      rnd_x = Math.max(Math.min(Math.floor(me.position.x + Math.floor(Math.random() * 6) - 3), MAP_SIZE - 1), 0);
      rnd_y = Math.max(Math.min(Math.floor(me.position.y + Math.floor(Math.random() * 6) - 3), MAP_SIZE - 1), 0);
      console.log("trying with { x: ", rnd_x, ", y: ", rnd_y, " }");
    } while ((pathFind.tiles[rnd_y][rnd_x].val == 0) || (!reachable({x: rnd_x, y: rnd_y})) || (distance({ x: rnd_x, y: rnd_y }, me.position) <= 1));
    */
   // * For the PDDL Planner we don't need to check reachability and stay near the agent
    do {
      rnd_x = Math.floor(Math.random() * MAP_SIZE);
      rnd_y = Math.floor(Math.random() * MAP_SIZE);
      /* @ts-ignore */
    } while ((pathFind.tiles[rnd_y][rnd_x].val == 0) || distance({ x: rnd_x, y: rnd_y }, me.position) <= 1);


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
