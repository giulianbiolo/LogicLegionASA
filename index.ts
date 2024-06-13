import { AGENTS_CONFIG, type AgentConfig } from "./config";
import clc from "chalk";
import { spawn, type ErrorLike, type Subprocess } from "bun";

spawnAgent(AGENTS_CONFIG.agent_1, AGENTS_CONFIG.agent_2);
spawnAgent(AGENTS_CONFIG.agent_2, AGENTS_CONFIG.agent_1);

function spawnAgent(self_agent: AgentConfig, teammate_agent: AgentConfig) {
  const agent_process: Subprocess = spawn([
    "bun",
    "run",
    `./src/agent.ts`,
    `host=${AGENTS_CONFIG.host}`,
    `token=${self_agent.token}`,
    `teamId=${teammate_agent.id}`,
    `pddlSolverURL=${AGENTS_CONFIG.pddlSolverURL}`,
    "usePDDL",
  ], {
    stdout: "inherit",
    stderr: "inherit",
    onExit(subprocess: Subprocess, exitCode: number, signalCode: number, error: ErrorLike | undefined): void {
      console.log(clc.red(`Agent ${self_agent.name} exited with code ${exitCode}`));
    },
    onStdout(data: string): void {
      console.log(clc.green(`Agent ${self_agent.name} stdout: ${data}`));
    },
    onStderr(data: string): void {
      console.log(clc.red(`Agent ${self_agent.name} stderr: ${data}`));
    },
  });
}
