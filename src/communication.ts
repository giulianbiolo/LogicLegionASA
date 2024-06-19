import { CONFIG } from "./agent";
import { type Parcel, type Point2D, type Option, type Desire, desireFromStr, desireStr } from "./types";
import clc from "chalk";

// * communication system
/**
 * Enum used to represent the type of a message being passed between agents
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
 * @property {number} ORDER_PUTDOWN - Order to putdown
 * @property {number} ORDER_PICKUP - Order to pickup
 * @property {number} ORDER_MOVE_AWAY - Order to move away
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
    ORDER_PUTDOWN,
    ORDER_PICKUP,
    ORDER_MOVE_AWAY,
    UNKNOWN,
};

/**
 * Interface to represent the message being passed between agents
 * @interface Message
 * @property {MsgType} kind - The type of message
 * @property {Point2D} [position] - The position of the agent
 * @property {Array<{id: string, x: number, y: number, carriedBy: string | null, reward: number}>} [parcels] - The parcels
 * @property {{position: Point2D, delivery: boolean, spawner: boolean}} [tile] - The tile
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
 * let message: Message = { kind: MsgType.ON_PARCELS, parcels: [{ id: "1", x: 0, y: 0, carriedBy: "", reward: 10 }] };
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
    parcels?: Array<{id: string, x: number, y: number, carriedBy: string | null, reward: number}>;
    tile?: { position: Point2D, delivery: boolean, spawner: boolean };
    agents?: Array<{id: string, name: string, x: number, y: number, score: number}>;
    pickup?: { id: string };
    putdown?: { id: string };
    mutex?: boolean;
    objective?: {desire: Desire, position: Point2D};
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
 * @method valid
 * @method load
 * @return {Message}
 * @example
 * let msg: MsgBuilder = new MsgBuilder().kind(MsgType.ON_ME).position({ x: 0, y: 0 });
 * if (msg.valid()) { client.say(agentArgs.teamId, msg.build()); }
 * let message: Message = new MsgBuilder().load(msg);
 * console.log(message);
 * // { kind: MsgType.ON_ME, position: { x: 0, y: 0 } }
 * @example
 * let msg: MsgBuilder = new MsgBuilder().kind(MsgType.ON_PARCELS).parcels([{ id: "1", position: { x: 0, y: 0 }, carriedBy: "", reward: 10 }]);
 * if (msg.valid()) { client.say(agentArgs.teamId, msg.build()); }
 * let message: Message = new MsgBuilder().load(msg);
 * console.log(message);
 * // { kind: MsgType.ON_PARCELS, parcels: [{ id: "1", position: { x: 0, y: 0 }, carriedBy: "", reward: 10 }] }
 * @example
 * let msg: MsgBuilder = new MsgBuilder().kind(MsgType.ON_TILE).tile({ position: { x: 0, y: 0 }, delivery: true });
 * if (msg.valid()) { client.say(agentArgs.teamId, msg.build()); }
 * let message: Message = new MsgBuilder().load(msg);
 * console.log(message);
 */
export class MsgBuilder {
    private msg: Message;
    constructor() { this.msg = { kind: MsgType.UNKNOWN }; }
    kind(kind: MsgType): MsgBuilder {
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
                return { id: parcel.id, x: parcel.x, y: parcel.y, carriedBy: parcel.carriedBy, reward: parcel.reward };
            });
        } else { this.msg.parcels = undefined; }
        return this;
    }
    tile(tile: {position: Point2D, delivery: boolean, spawner: boolean}): MsgBuilder {
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
                if (this.msg.parcels === undefined) { return "k:8;"; }
                let parcels_str: string = "";
                this.msg.parcels?.map((parcel: {id: string, x: number, y: number, carriedBy: string | null, reward: number}) => {
                    if (parcel.reward === null) { parcel.reward = CONFIG.PARCEL_REWARD_AVG; }
                    if (parcel.carriedBy === null) { parcel.carriedBy = ""; }
                    parcels_str += "id:" + parcel.id + ".p:" + Math.round(parcel.x) + "," + Math.round(parcel.y) + ".c:" + parcel.carriedBy + ".r:" + parcel.reward + ";";
                });
                return "k:1;" + parcels_str;
                break;
            case MsgType.ON_TILE:
                if (this.msg.tile === undefined) { return "k:8;"; }
                return "k:2;p:" + this.msg.tile?.position.x + "," + this.msg.tile?.position.y + ";d:" + (this.msg.tile?.delivery ? "1" : "0") + ";s:" + (this.msg.tile?.spawner ? "1" : "0");
                break;
            case MsgType.ON_AGENTS:
                if (this.msg.agents === undefined) { return "k:8;"; }
                let agents_str: string = ""; 
                this.msg.agents?.map((agent: {id: string, name: string, x: number, y: number, score: number}) => {
                    agents_str += "p:" + Math.round(agent.x) + "," + Math.round(agent.y) + ".i:" + agent.id + ";";
                });
                return "k:3;" + agents_str;
                break;
            case MsgType.ON_PICKUP:
                if (this.msg.pickup === undefined || this.msg.pickup.id === undefined || this.msg.pickup.id === "") { return "k:8;"; }
                return "k:4;i:" + this.msg.pickup?.id;
                break;
            case MsgType.ON_PUTDOWN:
                if (this.msg.putdown === undefined || this.msg.putdown.id === undefined || this.msg.putdown.id === "") { return "k:8;"; }
                return "k:5;i:" + this.msg.putdown?.id;
                break;
            case MsgType.ON_LOCAL_PLANNER:
                if (this.msg.mutex === undefined) { return "k:8;"; }
                return "k:6;m:" + this.msg.mutex ? "1" : "0";
                break;
            case MsgType.ON_OBJECTIVE:
                if (this.msg.objective === undefined) { return "k:8;"; }
                return "k:7;d:" + desireStr(this.msg.objective?.desire) + ";p:" + Math.round(this.msg.objective?.position.x) + "," + Math.round(this.msg.objective?.position.y);
                break;
            case MsgType.ORDER_PUTDOWN:
                return "k:9;";
                break;
            case MsgType.ORDER_PICKUP:
                return "k:10;";
                break;
            case MsgType.ORDER_MOVE_AWAY:
                return "k:11;";
                break;
            default:
                return "k:8;";
                break;
        };
    }
    valid(): boolean {
        let res = this.build();
        return res !== "k:8;" && res.startsWith("k:");
    }
    load(msg: string): Message {
        if (!msg.startsWith("k:")) { return { kind: MsgType.UNKNOWN }; }
        if (msg === "k:8;") { return { kind: MsgType.UNKNOWN }; }
        let parts: string[] = msg.split(";");
        let kind: number = parseInt(parts[0].split(":")[1]);
        switch (kind) {
            case MsgType.ON_ME:
                let pos_team = parts[1].split(":")[1].split(",");
                return { kind: MsgType.ON_ME, position: { x: parseInt(pos_team[0]), y: parseInt(pos_team[1]) } };
                break;
            case MsgType.ON_PARCELS:
                let parcels: {id: string, x: number, y: number, carriedBy: string | null, reward: number}[] = [];
                for (let i = 1; i < parts.length; i++) {
                    if (parts[i] === "") { continue; }
                    let parcel: string[] = parts[i].split(".");
                    let pos_parcel: string[] = parcel[1].split(":")[1].split(",");
                    let id: string = parcel[0].split(":")[1];
                    let carried: string | null = parcel[2].split(":")[1];
                    if (carried === "") { carried = null; }
                    let reward: number = parseInt(parcel[3].split(":")[1]);
                    parcels.push({ id: id, x: parseInt(pos_parcel[0]), y: parseInt(pos_parcel[1]), carriedBy: carried, reward: reward });
                }
                return { kind: MsgType.ON_PARCELS, parcels: parcels };
                break;
            case MsgType.ON_TILE:
                let pos_tile = parts[1].split(":")[1].split(",");
                let delivery = parseInt(parts[2].split(":")[1]) === 1;
                let spawner = parseInt(parts[3].split(":")[1]) === 1;
                return { kind: MsgType.ON_TILE, tile: { position: { x: parseInt(pos_tile[0]), y: parseInt(pos_tile[1]) }, delivery: delivery, spawner: spawner } };
                break;
            case MsgType.ON_AGENTS:
                let agents: Array<{id: string, name: string, x: number, y: number, score: number}> = [];
                for (let i = 1; i < parts.length; i++) {
                    if (parts[i] === "") { continue; }
                    let agent = parts[i].split(".");
                    let pos = agent[0].split(":")[1].split(",");
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
                let mutex: boolean = parseInt(parts[1].split(":")[1]) === 1;
                return { kind: MsgType.ON_LOCAL_PLANNER, mutex: mutex };
                break;
            case MsgType.ON_OBJECTIVE:
                let desire = parts[1].split(":")[1];
                let pos_obj = parts[2].split(":")[1].split(",");
                return { kind: MsgType.ON_OBJECTIVE, objective: { desire: desireFromStr(desire), position: { x: parseInt(pos_obj[0]), y: parseInt(pos_obj[1]) } } };
                break;
            case MsgType.ORDER_PUTDOWN:
                return { kind: MsgType.ORDER_PUTDOWN };
                break;
            case MsgType.ORDER_PICKUP:
                return { kind: MsgType.ORDER_PICKUP };
                break;
            case MsgType.ORDER_MOVE_AWAY:
                return { kind: MsgType.ORDER_MOVE_AWAY };
                break;
            default:
                return { kind: MsgType.UNKNOWN };
                break;
        };
    }
}
