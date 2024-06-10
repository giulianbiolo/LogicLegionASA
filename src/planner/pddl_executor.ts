import type { PddlPlanStep } from "@unitn-asa/pddl-client/src/PddlExecutor.js";
import { me } from "../agent.ts"
import "../types.ts"
import type { Option, Point2D } from "../types.ts"

export default class PddlExecutor {
  plan: Array<PddlPlanStep>;
  /**
   * @param {PddlPlanStep[]} plan
   */
  constructor(plan: Array<PddlPlanStep>) { this.plan = plan; }

  getIntentionsList() {
    /** @type {Option[]} */
    const intentions: Array<Option> = [];
    // console.log("getIntentionsList this.plan")
    // console.log(this.plan)

    for (const planStep of this.plan) {
      if (planStep.action === "move") {
        const target: Point2D = this.getCoordinatesFromString(planStep.args[2]);
        intentions.push({ desire: "go_to", position: target, id: null, reward: null });
      } else if (planStep.action === "pickup") {
        intentions.push({ desire: "pick_up", position: me.position, id: planStep.args[1], reward: null});
      } else if (planStep.action === "deliver") {
        intentions.push({ desire: "put_down", position: me.position, id: planStep.args[1], reward: null});
      }
    }
    return intentions
  }

  getCoordinatesFromString(str: string): Point2D {
    const args = str.split("_");
    const y = parseInt(args[0].replace("y", ""));
    const x = parseInt(args[1].replace("x", ""));
    return { x, y };
  }
}
