import { type UserConfig } from "./types";


export const MAP_SIZE: number = 100;
export const DEBUG: boolean = true;

export function configParse(config: any): UserConfig {
  let parcel_decading_interval: number = 1;
  if (config["PARCEL_DECADING_INTERVAL"].includes("infinite")) {
    parcel_decading_interval = Number.MAX_VALUE;
  } else if (config["PARCEL_DECADING_INTERVAL"].includes("s")) {
    parcel_decading_interval = Number(config["PARCEL_DECADING_INTERVAL"].replace("s", ""));
  } else if (config["PARCEL_DECADING_INTERVAL"].includes("m")) {
    parcel_decading_interval = Number(config["PARCEL_DECADING_INTERVAL"].replace("m", "")) * 60;
  } else if (config["PARCEL_DECADING_INTERVAL"].includes("h")) {
    parcel_decading_interval = Number(config["PARCEL_DECADING_INTERVAL"].replace("h", "")) * 60 * 60;
  }
  return {
    PARCELS_MAX: Number(config["PARCELS_MAX"]),
    MOVEMENT_STEPS: Number(config["MOVEMENT_STEPS"]),
    MOVEMENT_DURATION: Number(config["MOVEMENT_DURATION"]),
    AGENTS_OBSERVATION_DISTANCE: Number(config["AGENTS_OBSERVATION_DISTANCE"]),
    PARCEL_DECADING_INTERVAL: parcel_decading_interval,
    PARCEL_REWARD_AVG: Number(config["PARCEL_REWARD_AVG"]),
    CLOCK: Number(config["CLOCK"]),
  };
}
