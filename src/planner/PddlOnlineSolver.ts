import fetch from "node-fetch";
import { sleep } from "bun";
import { agentArgs } from "../args";
import type { pddlPlanStep } from "@unitn-asa/pddl-client/src/PddlOnlineSolver";

const BASE_URL: string = agentArgs.pddlSolverURL;
const FETCH_URL: string = BASE_URL + "/package/lama-first/solve";

/**
 * Validate inputs to ensure they are strings.
 * @param {String} pddlDomain
 * @param {String} pddlProblem
 * @throws Will throw an error if inputs are not strings.
 */
function validateInputs(pddlDomain: any, pddlProblem: any): void {
  if (typeof pddlDomain !== "string" && !(pddlDomain instanceof String)) {
    throw new Error("pddlDomain is not a string");
  }
  if (typeof pddlProblem !== "string" && !(pddlProblem instanceof String)) {
    throw new Error("pddlProblem is not a string");
  }
}

/**
 * Get the URL to fetch the plan
 * @param {String} pddlDomain
 * @param {String} pddlProblem
 * @returns {Promise<Object>}
 * @throws Will throw an error if the fetch fails.
 */
async function getPlanFetchUrl(
  pddlDomain: string,
  pddlProblem: string
): Promise<any> {
  try {
    const response = await fetch(FETCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        domain: pddlDomain,
        problem: pddlProblem,
        number_of_plans: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Error at ${FETCH_URL}: ${response.statusText}`);
    }

    const result: any = await response.json();

    if (result.status === "error") {
      const errorMessage: string = result.result.error || "Unknown error";
      throw new Error(`Error at ${FETCH_URL}: ${errorMessage}`);
    }

    return result.result;
  } catch (error: any) {
    console.log(`Failed to fetch initial plan: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch the plan until it's ready or times out.
 * @param {String} fetchPlanUrl
 * @param {number} maxAttempts - Maximum number of retry attempts
 * @param {number} baseDelay - Base delay in milliseconds for exponential backoff
 * @returns {Promise<Object>}
 * @throws Will throw an error if the fetch fails or times out.
 */
async function fetchPlan(
  fetchPlanUrl: string,
  maxAttempts: number = 10,
  baseDelay: number = 100
): Promise<any> {
  let attempts: number = 0;
  let response: any = null;

  const fetchWithRetry = async () => {
    const fetchResponse = await fetch(fetchPlanUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // body: JSON.stringify({ adaptor: "planning_editor_adaptor" }),
    });

    if (!fetchResponse.ok) {
      throw new Error(`Error at ${fetchPlanUrl}: ${fetchResponse.statusText}`);
    }
    response = await fetchResponse.json();
    if (response.status === "error") {
      const errorMessage: string = response.result.error || "Unknown error";
      throw new Error(`Error at ${fetchPlanUrl}: ${errorMessage}`);
    }
    return response;
  };

  while (attempts < maxAttempts) {
    attempts++;
    await sleep(baseDelay);
    try {
      response = await fetchWithRetry();
      if (response.status !== "PENDING") {
        return response.result.output.sas_plan;
      }
    } catch (error: any) {
      console.log(`Attempt ${attempts} failed: ${error.message}`);
      if (attempts === maxAttempts) {
        throw new Error("Timeout while waiting for the detailed plan");
      }
    }
  }
  throw new Error("Failed to fetch detailed plan after maximum attempts");
}

/**
 * Process the plan result into pddlPlanStep array.
 * @param {Object} planResult
 * @returns {PddlPlanStep[]}
 */
function processPlan(planResult: any): pddlPlanStep[] {
  var lines = planResult.split("\n");
  lines = lines.map((line: string) =>
    line.replace("(", "").replace(")", "").split(" ")
  );
  lines.pop();
  lines.pop();

  var plan: Array<pddlPlanStep> = [];

  for (let /**@type {string}*/ line of lines) {
    var action = line.shift();
    var args = line;
    plan.push({ parallel: false, action: action, args: args });
  }

  return plan;
}

/**
 * @param {String} pddlDomain
 * @param {String} pddlProblem
 * @returns {Promise<PddlPlanStep[]>}
 */
export default async function onlineSolver(
  pddlDomain: string,
  pddlProblem: string
): Promise<pddlPlanStep[]> {
  try {
    validateInputs(pddlDomain, pddlProblem);
    const fetchPlanUrlRes: string = await getPlanFetchUrl(
      pddlDomain,
      pddlProblem
    );
    if (!fetchPlanUrlRes) {
      return [];
    }
    const fetchPlanUrl: string = BASE_URL + fetchPlanUrlRes;
    const detailedPlan: any = await fetchPlan(fetchPlanUrl);
    if (!detailedPlan) {
      return [];
    }
    return processPlan(detailedPlan);
  } catch (error: any) {
    console.log(`Error in onlineSolver: ${error.message}`);
    return [];
  }
}
