import { parseArgs } from 'args-json';
import clc from "chalk";

export type AgentArgs = {
    host: string,
    token: string,
    teamId: string,
    pddlSolverURL: string,
};
export const agentArgs: AgentArgs = _getArgs();

function _getArgs(): AgentArgs {
    let args: Record<string, any> = parseArgs();
    let argsArr: Array<string> = args[""];
    if (!argsArr.includes("host") || argsArr[argsArr.findIndex((el) => el.trim() === "host") + 1].trim() === "") {
        console.log(clc.red("Host is required"));
        throw new Error("Host is required");
    }
    if (!argsArr.includes("token") || argsArr[argsArr.findIndex((el) => el.trim() === "token") + 1].trim() === "") {
        console.log(clc.red("Token is required"));
        throw new Error("Token is required");
    }
    if (!argsArr.includes("teamId") || argsArr[argsArr.findIndex((el) => el.trim() === "teamId") + 1].trim() === "") {
        console.log(clc.red("TeamId is required"));
        throw new Error("TeamId is required");
    }
    if (!argsArr.includes("pddlSolverURL") || argsArr[argsArr.findIndex((el) => el.trim() === "pddlSolverURL") + 1].trim() === "") {
        console.log(clc.red("PDDL Solver URL is required"));
        throw new Error("PDDL Solver URL is required");
    }
    return {
        host: argsArr[argsArr.findIndex((el) => el.trim() === "host") + 1].trim(),
        token: argsArr[argsArr.findIndex((el) => el.trim() === "token") + 1].trim(),
        teamId: argsArr[argsArr.findIndex((el) => el.trim() === "teamId") + 1].trim(),
        pddlSolverURL: argsArr[argsArr.findIndex((el) => el.trim() === "pddlSolverURL") + 1].trim(),
    }
}
