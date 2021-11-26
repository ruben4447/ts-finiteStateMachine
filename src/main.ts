import { FiniteStateMachine, ROLE_ACCEPT, ROLE_START } from "./FiniteStateMachine";

// const FSM = new FiniteStateMachine();
// FSM.addState({ label: 'S0', role: ROLE_START, input: ['0', '1'], conns: ['S0', 'S1'] });
// FSM.addState({ label: 'S1', role: ROLE_ACCEPT, input: ['0', '1'], conns: ['S1', 'S0'] });
// console.log(FSM.toString());

const FSM = FiniteStateMachine.fromString(`[START] S0 :: S0: 0, S1: 1
[ACCEPT] S1 :: S1: 0, S0: 1`);
console.log(FSM.toString())