import fs from "fs";

export default class PddlProblem {
  static nextId: number = 0;
  name: string;
  objects: string;
  inits: string;
  goals: string;

  constructor(name: string, objects: string, init: string, goal: string) {
    this.name = "problem-" + name + "-" + PddlProblem.nextId++;
    this.objects = objects;
    this.inits = init;
    this.goals = goal;
  }

  saveToFile(): Promise<any> {
    var path: string = "./tmp/" + this.name + ".pddl";
    return new Promise((res, rej) => {
      fs.writeFile(path, this.toPddlString(), (err) => {
        if (err) rej(err);
        // console.log("File written successfully");
        else res(path);
      });
    });
  }

  toPddlString(): string {
    return `\
;; problem file: ${this.name}.pddl
(define (problem default)
    (:domain default)
    (:objects ${this.objects})
    (:init ${this.inits})
    (:goal (${this.goals}))
)
`;
  }
}
