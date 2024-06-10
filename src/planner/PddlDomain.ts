import fs from "fs";
import PddlAction from "./PddlAction.ts";

const PADDING: string = " ".repeat(4);

export default class PddlDomain {
  static nextId: number = 0;

  name: string = "";
  predicates: Array<string> = [];
  actions: Array<any> = [];

  /**
   *
   * @param {string} name
   * @param {PddlAction} actions
   */
  constructor(name: string, ...actions: any[]) {
    this.name = "domain-" + name + "-" + PddlDomain.nextId++;
    this.addAction(...actions);
  }

  addPredicate(predicate: string) {
    // predicate = 'light-on ?l'
    if (this.predicates.find((e) => e == predicate)) return false;
    if (
      this.predicates.find(
        (e: string) =>
          e.split(" ")[0] == predicate.split(" ")[0] &&
          e.length != predicate.length
      )
    )
      throw new Error(
        "Duplicated predicate with different number of parameters!"
      );
    this.predicates.push(predicate);
    return true;
  }

  /**
   *
   * @param {...PddlAction} actions
   */
  addAction(...actions: any[]) {
    for (let action of actions) {
      /** @argument {array<array|string>} tokenized e.g. [ 'and', [ 'switched-on', '?l' ], [ 'not', [ 'switched-off', '?l' ] ] ] */
      const recursiveNavigateTokenized = (tokenized: any) => {
        if (tokenized[1] && Array.isArray(tokenized[1])) {
          for (let subtokenized of tokenized.slice(1))
            recursiveNavigateTokenized(subtokenized);
        } else {
          this.addPredicate(tokenized.join(" "));
        }
      };

      let tokenizedPreconditions = PddlAction.tokenize(action.precondition);
      recursiveNavigateTokenized(tokenizedPreconditions);

      let tokenizedEffects = PddlAction.tokenize(action.effect);
      recursiveNavigateTokenized(tokenizedEffects);

      this.actions.push(action);
    }
  }

  saveToFile(): Promise<any> {
    var path: string = "./tmp/" + this.name + ".pddl";
    return new Promise((res, rej) => {
      fs.writeFile(path, this.toPddlString(), (err) => {
        if (err) rej(err);
        else res(path);
      });
    });
  }

  toPddlString(): string {
    return `\
;; domain file: ${this.name}.pddl
(define (domain default)
(:requirements :strips)
(:predicates
${this.predicates
  .map((p) => "(" + p + ")")
  .join("\n" + PADDING.repeat(2))}              
)
${this.actions.map((a) => a.toPddlString()).join("\n" + PADDING.repeat(2))}
)`;
  }
}
