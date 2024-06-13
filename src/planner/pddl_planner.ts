import onlineSolver, { offlineSolver } from "./PddlOnlineSolver.js"
import { readFile } from "../utils.ts"
import path from "path"
import { fileURLToPath } from "url"
import { type PddlPlanStep } from "@unitn-asa/pddl-client/src/PddlExecutor.js"

const __filename: string = fileURLToPath(import.meta.url)
const __dirname: string = path.dirname(__filename)

/**
 * Get the plan given a problem inside the deliveroo domain
 * @param {String} problem - The problem in pddl format
 * @returns {Promise<PddlPlanStep[]>} The list of steps to execute in order to achieve the plan
 */
export async function getPlan(problem: string): Promise<PddlPlanStep[]> {
  let domainPath: string = path.join(__dirname, "domain.pddl")
  let domain: string = await readFile(domainPath)
  // * var plan: Array<PddlPlanStep> = await onlineSolver(domain, problem)
  var plan: Array<PddlPlanStep> = await offlineSolver(domain, problem)
  return plan
}
