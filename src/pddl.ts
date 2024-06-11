import { delivery_tiles, me, parcels, pathFind } from "./agent";
import { MAP_SIZE } from "./conf";


export function getPddlObjects(): string {
  var pddlGrid: string = "";
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      /* @ts-ignore */
      if (pathFind.tiles[y][x].val === 1) {
        pddlGrid += `y${y}_x${x} - position `;
      }
    }
  }
  for (const parcel of parcels.values()) {
    pddlGrid += `${parcel.id} - parcel `;
  }
  pddlGrid += `${me.id} - agent `;
  return pddlGrid;
}

export function getPddlInit(): string {
  var pddlString: string = "";
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      /* @ts-ignore */
      if (pathFind.tiles[y][x].val === 1) {
        /* @ts-ignore */
        if (y > 0 && pathFind.tiles[y - 1][x].val === 1) {
          pddlString += `(can-move y${y}_x${x} y${y - 1}_x${x}) `;
        }
        /* @ts-ignore */
        if (x > 0 && pathFind.tiles[y][x - 1].val === 1) {
          pddlString += `(can-move y${y}_x${x} y${y}_x${x - 1}) `;
        }
        /* @ts-ignore */
        if (y < MAP_SIZE - 1 && pathFind.tiles[y + 1][x].val === 1) {
          pddlString += `(can-move y${y}_x${x} y${y + 1}_x${x}) `;
        }
        /* @ts-ignore */
        if (x < MAP_SIZE - 1 && pathFind.tiles[y][x + 1].val === 1) {
          pddlString += `(can-move y${y}_x${x} y${y}_x${x + 1}) `;
        }
      }
    }
  }
  for (const delivery of delivery_tiles) {
    pddlString += `(delivery y${delivery.y}_x${delivery.x}) `;
  }
  for (const parcel of parcels.values()) {
    if (parcel) {
      pddlString += `(at ${parcel.id} y${parcel.position.y}_x${parcel.position.x}) `;
    }
  }
  pddlString += `(blocked y${Math.round(me.position.y)}_x${Math.round(me.position.x)}) `;
  pddlString += `(at ${me.id} y${Math.round(me.position.y)}_x${Math.round(me.position.x)}) `;
  return pddlString;
}
