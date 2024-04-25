import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";

const client = new DeliverooApi(
    'http://localhost:8080',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjMwZTU2ZDYwN2MyIiwibmFtZSI6InRlc3QxIiwiaWF0IjoxNzEzNzg5NDI1fQ.hovsONlTbtjfcf3LiGcOZ9YlCNVD93XC7WPtC3AdkAE'
)

function distance( {x:x1, y:y1}, {x:x2, y:y2}) {
    const dx = Math.abs( Math.round(x1) - Math.round(x2) )
    const dy = Math.abs( Math.round(y1) - Math.round(y2) )
    return dx + dy;
}

/**
 * Belief revision function
**/

/**
 * @type {id, name, x, y, score}
 */
var me = {};
client.onYou(({id, name, x, y, score}) => {
    me.id = id;
    me.name = name;
    me.x = x;
    me.y = y;
    me.score = score;
});
/**
 * @type {Map<id,{id, x, y, carriedBy, reward}>}
 */
const parcels = new Map();
var carrying_parcels = 0;
var delivery_tiles = [];
const CONFIG = {};
client.onConfig((config) => {
    CONFIG.PARCELS_MAX = config["PARCELS_MAX"];
    CONFIG.MOVEMENT_STEPS = config["MOVEMENT_STEPS"];
    CONFIG.MOVEMENT_DURATION = config["MOVEMENT_DURATION"];
    CONFIG.PARCEL_DECADING_INTERVAL = config["PARCEL_DECADING_INTERVAL"];
    CONFIG.CLOCK = config["CLOCK"];
});
client.onParcelsSensing(async (perceived_parcels) => {
    // Take into account the time and the decadence speed of the parcels
    // Parcels have a reward that decays over time
    for (const p of perceived_parcels) { parcels.set(p.id, p); }
});
client.onTile((x, y, delivery) => { if (!delivery) { return; } delivery_tiles.push({x, y}); });

var clock = 0;
function updateParcels() {
    // this method gets called at each clock cycle
    clock += 1;
    if (clock >= ((CONFIG.PARCEL_DECADING_INTERVAL * 1000) / CONFIG.CLOCK) == 0) {
        clock = 0;
        for (const [id, parcel] of parcels) {
            // decay the parcels
            parcel.reward -= 1;
        }
        // if parcel reward is 0 remove it from array
        for (const [id, parcel] of parcels) {
            if (parcel.reward == 0) { parcels.delete(id); }
        }
    }
}

/**
 * BDI loop
**/
function agentLoop() {
    //console.log("Current Config: ", CONFIG);
    /**
     * Options
    **/
    const options = [];
    for (const parcel of parcels.values()) {
        // TODO: Aggiungere controllo distanza e tempo (se la parcel muore prima che io arrivi, non ha senso andare a prenderla)
        if (!parcel.carriedBy) {
            options.push({desire: 'go_pick_up', args: [parcel]});
        }
    }
    if (carrying_parcels > 0) {
        for (const delivery of delivery_tiles) {
            options.push({desire: 'go_put_down', args: [delivery]});
        }
    }
    /* * Random walk
    if (options.length == 0) {
        // Desire to random walk, so one block at a time, to avoid losing track of other parcels
        let x = me.x + Math.floor(Math.random() * 3) - 1;
        let y = me.y + Math.floor(Math.random() * 3) - 1;
        options.push({desire: 'go_to', args: [{x, y}]});
    }*/

    /**
     * Select best intention
    **/
    // * Select the nearest parcel that has desire go_pick_up
    let must_deliver = (carrying_parcels >= CONFIG.PARCELS_MAX); // ? Se ho più di un pacco devo per forza consegnare [ Temporaneo per testing ]
    let nothing_to_deliver = (carrying_parcels == 0);
    if (must_deliver && nothing_to_deliver) { console.log("PARCELS_MAX Cannot Be Set To 0 !!!"); return; }
    let best_option;
    let nearest_parcel = Number.MAX_VALUE;
    for (const option of options) {
        if (must_deliver && option.desire == 'go_pick_up') { continue; }
        if (nothing_to_deliver && option.desire == 'go_put_down') { continue; }
        let current_d = distance(option.args[0], me);
        if (current_d < nearest_parcel) {
            best_option = option;
            nearest_parcel = current_d;
        }
    }
    /**
     * Revise/queue intention 
     */
    // * Queue the best intention for now with no revision in particular...
    console.log("Executing: ", best_option);
    if(best_option) { myAgent.queue(best_option.desire, ...best_option.args); }
}
client.onParcelsSensing(agentLoop);
// client.onAgentsSensing(agentLoop);
// client.onYou(agentLoop);

/**
 * Intention revision / execution loop
**/
class Agent {
    intention_queue = new Array();
    async intentionLoop() {
        while (true) {
            const intention = this.intention_queue.shift();
            if (intention) { await intention.achieve(); }
            await new Promise(res => setImmediate(res));
        }
    }
    async queue(desire, ...args) {
        // const last = this.intention_queue.at(this.intention_queue.length - 1);
        const current = new Intention(desire, ...args);
        this.intention_queue.push(current);
    }
    async stop() {
        //console.log('stop agent queued intentions');
        for (const intention of this.intention_queue) { intention.stop(); }
    }
}

const myAgent = new Agent();
myAgent.intentionLoop();

// client.onYou( () => myAgent.queue( 'go_to', {x:11, y:6} ) )

// client.onParcelsSensing( parcels => {
//     for (const {x, y, carriedBy} of parcels) {
//         if ( ! carriedBy )
//             myAgent.queue( 'go_pick_up', {x, y} );
//     }
// } )

/**
 * Intention
 */
class Intention extends Promise {
    #current_plan;
    stop() {
        //console.log('stop intention and current plan');
        this.#current_plan.stop();
    }
    #desire;
    #args;

    #resolve;
    #reject;
    constructor(desire, ...args) {
        var resolve, reject;
        super(async (res, rej) => { resolve = res; reject = rej; });
        this.#resolve = resolve
        this.#reject = reject
        this.#desire = desire;
        this.#args = args;
    }

    #started = false;
    async achieve() {
        if (this.#started) { return this; }
        else { this.#started = true; }

        for (const plan of plans) {
            if (plan.isApplicableTo(this.#desire)) {
                this.#current_plan = plan;
                //console.log('achieving desire', this.#desire, ...this.#args, 'with plan', plan);
                try {
                    const plan_res = await plan.execute( ...this.#args );
                    this.#resolve( plan_res );
                    //console.log('plan', plan, 'succesfully achieved intention', this.#desire, ...this.#args, 'with result', plan_res);
                    return plan_res;
                } catch (error) {
                    //console.log('plan', plan, 'failed while trying to achieve intention', this.#desire, ...this.#args, 'with error', error);
                    console.log("Plan Failed: ", error);
                }
            }
        }
        this.#reject();
        //console.log('no plan satisfied the desire ', this.#desire, ...this.#args);
        throw 'no plan satisfied the desire ' + this.#desire;
    }
}

/**
 * Plan library
 */
const plans = [];

class Plan {
    stop() {
        //console.log('stop plan and all sub intentions');
        for (const i of this.#sub_intentions ) { i.stop(); }
    }

    #sub_intentions = [];
    async subIntention(desire, ...args) {
        const sub_intention = new Intention(desire, ...args);
        this.#sub_intentions.push(sub_intention);
        return await sub_intention.achieve();
    }

}

class GoPickUp extends Plan {
    isApplicableTo(desire) { return desire == 'go_pick_up'; }

    async execute({x, y}) {
        await this.subIntention('go_to', {x, y});
        await client.pickup().then(() => { carrying_parcels += 1; });
    }
}

class GoPutDown extends Plan {
    isApplicableTo(desire) { return desire == 'go_put_down'; }

    async execute({x, y}) {
        await this.subIntention('go_to', {x, y});
        await client.putdown().then(() => { carrying_parcels = 0; });
    }
}

class BlindMove extends Plan {
    isApplicableTo(desire) { return desire == 'go_to'; }

    async execute ({x, y}) {
        while(me.x != x || me.y != y) {
            let status_x = undefined;
            let status_y = undefined;
            if (x > me.x) { status_x = await client.move('right'); }
            else if (x < me.x) { status_x = await client.move('left'); }
            if (status_x) { me.x = status_x.x; me.y = status_x.y; }

            if (y > me.y) { status_y = await client.move('up'); }
            else if (y < me.y) { status_y = await client.move('down'); }
            if (status_y) { me.x = status_y.x; me.y = status_y.y; }

            if (!status_x && !status_y) { break; }
            else if (me.x == x && me.y == y) { break; }
        }
    }
}

plans.push(new GoPickUp());
plans.push(new GoPutDown());
plans.push(new BlindMove());
