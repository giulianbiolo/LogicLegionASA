export default class Beliefset {
  #objects = new Set();
  #facts = new Map();

  constructor() {}

  addObject(obj: any): void {
    if (!(typeof obj === "string"))
      throw "String expected, got " + typeof obj + ": " + obj;
    this.#objects.add(obj);
  }

  removeObject(obj: any): void {
    if (!(typeof obj === "string"))
      throw "String expected, got " + typeof obj + ": " + obj;
    this.#objects.delete(obj);
  }

  get objects(): Array<any> {
    return Array.from(this.#objects);
  }

  /**
   * call the declare method with false value
   * @param {String} fact A fact is composed by a predicate and arguments e.g. 'person_in_room bob kitchen'
   * @returns changed
   */
  undeclare(fact: any): boolean {
    return this.declare(fact, false);
  }

  /**
   *
   * @param {String} fact A fact is composed by a predicate and arguments e.g. 'person_in_room bob kitchen'
   * @param {boolean} value Fact status, true or false. Default value is true
   * @returns {boolean} true if changed otherwise false
   */
  declare(fact: any, value: boolean = true) {
    if (!(typeof fact === "string"))
      throw "String expected, got " + typeof fact + ": " + fact;
    if (fact.split(" ")[0] == "not")
      throw "Fact expected, got a negative literal: " + fact;

    if (!this.#facts.has(fact) || this.#facts.get(fact) != value) {
      this.#facts.set(fact, value);

      for (let obj of fact.split(" ").splice(1)) this.addObject(obj);

      return true;
    }

    return false;
  }

  /**
   * @type { [fact:string, positive:boolean] [] }
   */
  get entries(): Array<any> {
    return Array.from(this.#facts.entries());
  }

  /**
   * @return {Array<String>} Return an Array of String literals (possibly negated facts) e.g. 'light_on kitchen_light' or 'not (light_on kitchen_light)'
   */
  toPddlString(): string {
    return this.entries
      .map(([fact, value]) => (value ? fact : "not (" + fact + ")"))
      .map((fact) => "(" + fact + ")")
      .join(" ");
  }

  /**
   * Closed World assumption; if i don't know about something then it is false!
   *
   * @param {boolean} positive Positive/negated
   * @param {string} fact e.g 'light_on l1'
   * @returns {boolean} true if verified, otherwise false
   */
  check(positive: any, fact: any): boolean {
    if (this.#facts.has(fact) && this.#facts.get(fact))
      if (positive) return true;
      else return false;
    // Closed World assumption; if i don't know about something then it is false
    else if (positive) return false;
    else return true;
  }
}
