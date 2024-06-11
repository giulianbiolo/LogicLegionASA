export type AgentConfig = {
    id: string,
    name: string,
    token: string,
}

export type ProjectConfig = {
    host: string,
    agent_1: AgentConfig,
    agent_2: AgentConfig,
    pddlSolverURL: string,
};

export const AGENTS_CONFIG: ProjectConfig = {
    host: "http://localhost:8080",
    // host: "https://deliveroojs.onrender.com",
    agent_1: {
        id: "aa5852ab3a1",
        name: "LogicLegion_1",
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFhNTg1MmFiM2ExIiwibmFtZSI6IkxvZ2ljTGVnaW9uXzEiLCJpYXQiOjE3MTc0MTczOTF9.Cb0Egl3SEgwmETX8wu6NY8UxKi-oL_5fN7TFyC22Qis",
    },
    agent_2: {
        id: "f9daf789033",
        name: "LogicLegion_2",
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImY5ZGFmNzg5MDMzIiwibmFtZSI6IkxvZ2ljTGVnaW9uXzIiLCJpYXQiOjE3MTgwMjI5Mjl9.POutHvmhRINgh04o954hz_muFErgV7ctwcPIhFDuKM8",
    },
    // pddlSolverURL: "http://127.0.0.1:5001",
    pddlSolverURL: "https://solver.planning.domains:5001",
};
