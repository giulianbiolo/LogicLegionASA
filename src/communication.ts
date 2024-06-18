import { CONFIG } from "./agent";
import type { Parcel, Point2D, Option } from "./types";

// * communication system
/**
 * Enum to represent the type of message
 * @enum {number}
 * @readonly
 * @property {number} ON_ME - Message about the agent itself
 * @property {number} ON_PARCELS - Message about the parcels
 * @property {number} ON_TILE - Message about the tile
 * @property {number} ON_AGENTS - Message about the agents
 * @property {number} ON_PICKUP - Message about the pickup
 * @property {number} ON_PUTDOWN - Message about the putdown
 * @property {number} ON_LOCAL_PLANNER - Message about the local planner
 * @property {number} ON_OBJECTIVE - Message about the objective
 * @property {number} UNKNOWN - Unknown message
 */
export enum MsgType {
    ON_ME,
    ON_PARCELS,
    ON_TILE,
    ON_AGENTS,
    ON_PICKUP,
    ON_PUTDOWN,
    ON_LOCAL_PLANNER,
    ON_OBJECTIVE,
    UNKNOWN,
};

/**
 * Interface to represent the message
 * @interface Message
 * @property {MsgType} kind - The type of message
 * @property {Point2D} [position] - The position of the agent
 * @property {Array<Parcel>} [parcels] - The parcels
 * @property {{position: Point2D, delivery: boolean}} [tile] - The tile
 * @property {Array<{id: string, name: string, x: number, y: number, score: number}>} [agents] - The agents
 * @property {{id: string}} [pickup] - The pickup
 * @property {{id: string}} [putdown] - The putdown
 * @property {boolean} [mutex] - The mutex
 * @property {{desire: string, position: Point2D}} [objective] - The objective
 * @example
 * let message: Message = { kind: MsgType.ON_ME, position: { x: 0, y: 0 } };
 * console.log(message);
 * // { kind: MsgType.ON_ME, position: { x: 0, y: 0 } }
 * @example
 * let message: Message = { kind: MsgType.ON_PARCELS, parcels: [{ id: "1", position: { x: 0, y: 0 }, carriedBy: "", reward: 10 }] };
 * console.log(message);
 * // { kind: MsgType.ON_PARCELS, parcels: [{ id: "1", position: { x: 0, y: 0 }, carriedBy: "", reward: 10 }] }
 * @example
 * let message: Message = { kind: MsgType.ON_TILE, tile: { position: { x: 0, y: 0 }, delivery: true } };
 * console.log(message);
 * // { kind: MsgType.ON_TILE, tile: { position: { x: 0, y: 0 }, delivery: true } }
 * @example
 * let message: Message = { kind: MsgType.ON_AGENTS, agents: [{ id: "1", name: "agent", x: 0, y: 0, score: 0 }] };
 * console.log(message);
 * // { kind: MsgType.ON_AGENTS, agents: [{ id: "1", name: "agent", x: 0, y: 0, score: 0 }] }
 */
export type Message = {
    kind: MsgType;
    position?: Point2D;
    parcels?: Array<Parcel>;
    tile?: { position: Point2D, delivery: boolean };
    agents?: Array<{id: string, name: string, x: number, y: number, score: number}>;
    pickup?: { id: string };
    putdown?: { id: string };
    mutex?: boolean;
    objective?: {desire: string, position: Point2D};
};

/**
 * Class to build and parse messages
 * @class MsgBuilder
 * @constructor
 * @method kind
 * @method position
 * @method parcels
 * @method tile
 * @method agents
 * @method pickup
 * @method putdown
 * @method local_planner
 * @method objective
 * @method build
 * @method load
 * @return {Message}
 * @example
 * let msg: string = new MsgBuilder().kind(MsgType.ON_ME).position({ x: 0, y: 0 }).build();
 * let message: Message = new MsgBuilder().load(msg);
 * console.log(message);
 * // { kind: MsgType.ON_ME, position: { x: 0, y: 0 } }
 * @example
 * let msg: string = new MsgBuilder().kind(MsgType.ON_PARCELS).parcels([{ id: "1", position: { x: 0, y: 0 }, carriedBy: "", reward: 10 }]).build();
 * let message: Message = new MsgBuilder().load(msg);
 * console.log(message);
 * // { kind: MsgType.ON_PARCELS, parcels: [{ id: "1", position: { x: 0, y: 0 }, carriedBy: "", reward: 10 }] }
 * @example
 * let msg: string = new MsgBuilder().kind(MsgType.ON_TILE).tile({ position: { x: 0, y: 0 }, delivery: true }).build();
 * let message: Message = new MsgBuilder().load(msg);
 * console.log(message);
 */
export class MsgBuilder {
    private msg: Message;
    constructor() { this.msg = { kind: MsgType.UNKNOWN }; }
    kind(kind: MsgType): MsgBuilder {
        if (kind === MsgType.UNKNOWN) { throw new Error("Unknown message type"); }
        this.msg.kind = kind;
        return this;
    }
    position(pos: Point2D): MsgBuilder {
        this.msg.position = pos;
        return this;
    }
    parcels(parcels: Array<{id: string, x: number, y: number, carriedBy: string, reward: number}>): MsgBuilder {
        if (parcels.length > 0) {
            this.msg.parcels = parcels.map((parcel) => {
                return { id: parcel.id, position: { x: parcel.x, y: parcel.y }, carriedBy: parcel.carriedBy, reward: parcel.reward };
            });
        }
        return this;
    }
    tile(tile: {position: Point2D, delivery: boolean}): MsgBuilder {
        this.msg.tile = tile;
        return this;
    }
    agents(agents: Array<{id: string, name: string, x: number, y: number, score: number}>): MsgBuilder {
        if (agents.length > 0) { this.msg.agents = agents; }
        return this;
    }
    pickup(parcel: {id: string}): MsgBuilder {
        this.msg.pickup = parcel;
        return this;
    }
    putdown(parcel: {id: string}): MsgBuilder {
        this.msg.putdown = parcel;
        return this;
    }
    local_planner(mutex: boolean): MsgBuilder {
        this.msg.mutex = mutex;
        return this;
    }
    objective(objective: Option): MsgBuilder {
        this.msg.objective = objective;
        return this;
    }
    build(): string {
        switch (this.msg.kind) {
            case MsgType.ON_ME:
                if (this.msg.position === undefined) { return "k:8;"; }
                return "k:0;p:" + this.msg.position?.x + "," + this.msg.position?.y;
                break;
            case MsgType.ON_PARCELS:
                if (this.msg.parcels === undefined) {
                    console.log("no parcels loaded, returning unknown...");
                    return "k:8;";
                }
                let parcels_str: string = "";
                this.msg.parcels?.map((parcel: Parcel) => {
                    if (parcel.reward === null) { parcel.reward = CONFIG.PARCEL_REWARD_AVG; }
                    if (parcel.carriedBy === null) { parcel.carriedBy = ""; }
                    parcels_str += "id:" + parcel.id + ".p:" + Math.round(parcel.position.x) + "," + Math.round(parcel.position.y) + ".c:" + parcel.carriedBy + ".r:" + parcel.reward + ";";
                });
                return "k:1;" + parcels_str;
                break;
            case MsgType.ON_TILE:
                return "k:2;p:" + this.msg.tile?.position.x + "," + this.msg.tile?.position.y + ";d:" + (this.msg.tile?.delivery ? 1 : 0);
                break;
            case MsgType.ON_AGENTS:
                if (this.msg.agents === undefined) {
                    console.log("no agents loaded, returning unknown...");
                    return "k:8;";
                }
                let agents_str: string = ""; 
                this.msg.agents?.map((agent: {id: string, name: string, x: number, y: number, score: number}) => {
                    agents_str += "p:" + Math.round(agent.x) + "," + Math.round(agent.y) + ".i:" + agent.id + ";";
                });
                return "k:3;" + agents_str;
                break;
            case MsgType.ON_PICKUP:
                return "k:4;i:" + this.msg.pickup?.id;
                break;
            case MsgType.ON_PUTDOWN:
                return "k:5;i:" + this.msg.putdown?.id;
                break;
            case MsgType.ON_LOCAL_PLANNER:
                return "k:6;m:" + (this.msg.mutex ? 1 : 0);
                break;
            case MsgType.ON_OBJECTIVE:
                if (this.msg.objective === undefined) {
                    console.log("no objective loaded, returning unknown...");
                    return "k:8;";
                }
                return "k:7;d:" + this.msg.objective?.desire + ";p:" + Math.round(this.msg.objective?.position.x) + "," + Math.round(this.msg.objective?.position.y);
                break;
            default:
                return "k:8;";
                break;
        };
    }
    load(msg: string): Message {
        let parts: string[] = msg.split(";");
        let kind: number = parseInt(parts[0].split(":")[1]);
        console.log("Now parsing message: ", msg);
        console.log("Kind: ", kind);
        console.log("Parts: ", parts);
        switch (kind) {
            case MsgType.ON_ME:
                let pos_team = parts[1].split(":")[1].split(",");
                return { kind: MsgType.ON_ME, position: { x: parseInt(pos_team[0]), y: parseInt(pos_team[1]) } };
                break;
            case MsgType.ON_PARCELS:
                let parcels: Array<Parcel> = [];
                for (let i = 1; i < parts.length; i++) {
                    if (parts[i] === "") { continue; }
                    let parcel = parts[i].split(".");
                    console.log("Current Parcel: ", parcel);
                    let pos = parcel[1].split(":")[1].split(",");
                    let id = parcel[0].split(":")[1];
                    let carried: string | null = parcel[2].split(":")[1];
                    if (carried === "") { carried = null; }
                    let reward = parseInt(parcel[3].split(":")[1]);
                    parcels.push({ id: id, position: { x: Math.round(parseFloat(pos[0])), y: Math.round(parseFloat(pos[1])) }, carriedBy: carried, reward: reward });
                }
                return { kind: MsgType.ON_PARCELS, parcels: parcels };
                break;
            case MsgType.ON_TILE:
                console.log("Parsing tile: ", parts);
                let pos_tile = parts[1].split(":")[1].split(",");
                let delivery = parseInt(parts[2].split(":")[1]) === 1;
                return { kind: MsgType.ON_TILE, tile: { position: { x: parseInt(pos_tile[0]), y: parseInt(pos_tile[1]) }, delivery: delivery } };
                break;
            case MsgType.ON_AGENTS:
                let agents: Array<{id: string, name: string, x: number, y: number, score: number}> = [];
                for (let i = 1; i < parts.length; i++) {
                    if (parts[i] === "") { continue; }
                    let agent = parts[i].split(".");
                    console.log("Current Agent: ", agent);
                    let pos = agent[0].split(":")[1].split(",");
                    console.log("Position: { x: ", Math.round(parseFloat(pos[0])), ", y: ", Math.round(parseFloat(pos[1])), " }");
                    let id = agent[1].split(":")[1];
                    agents.push({ id: id, name: "agent", x: Math.round(parseFloat(pos[0])), y: Math.round(parseFloat(pos[1])), score: 0 });
                }
                return { kind: MsgType.ON_AGENTS, agents: agents };
                break;
            case MsgType.ON_PICKUP:
                let id_pickup = parts[1].split(":")[1];
                return { kind: MsgType.ON_PICKUP, pickup: { id: id_pickup } };
                break;
            case MsgType.ON_PUTDOWN:
                let id_putdown = parts[1].split(":")[1];
                return { kind: MsgType.ON_PUTDOWN, putdown: { id: id_putdown } };
                break;
            case MsgType.ON_LOCAL_PLANNER:
                let mutex = parseInt(parts[1].split(":")[1]) === 1;
                return { kind: MsgType.ON_LOCAL_PLANNER, mutex: mutex };
                break;
            case MsgType.ON_OBJECTIVE:
                let desire = parts[1].split(":")[1];
                let pos_obj = parts[2].split(":")[1].split(",");
                return { kind: MsgType.ON_OBJECTIVE, objective: { desire: desire, position: { x: parseInt(pos_obj[0]), y: parseInt(pos_obj[1]) } } };
                break;
            default:
                return { kind: MsgType.UNKNOWN };
                break;
        };
    }
}
