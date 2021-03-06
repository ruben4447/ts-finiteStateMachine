export const VALID_LABEL_REGEX = /[A-Za-z$0-9_]/;

/**
 * Each state must have a unique label.
 * input[] must be same size as conns[]. If input[i] is encountered, next state is conns[i].
 * If output[] is defined, must be same length as input[]. If input[i] is encountered, output[i] is appended to stdout.
 */
export interface IState {
  label: string;
  input: string[];
  output: string[];
  isStart?: boolean;
  isAccept?: boolean;
  conns: string[];
}

export interface IExecuteReturn {
  accepted: boolean;
  final: string;
  history?: string[];
  output: string;
  states: number;
  msg: string;
}

export interface IFSMInstance {
  done: boolean;
  step: () => boolean;
  state: string;
  output: string;
  states: number;
  msg: string;
  history?: string[];
  pos: number;
}

export interface IFSMCheck {
  code: number;
  state?: string;
  conn?: string
}

export class FiniteStateMachine {
  private _states = new Map<string, IState>();

  /** Does this FSM have a state with this label? */
  public hasState(label: string) {
    return this._states.has(label);
  }

  /** Get state within this FSM which has the given label (or undefined) */
  public getState(label: string) {
    return this._states.get(label);
  }

  /** Remove state with the given label from this FSM. Return success. */
  public removeState(label: string) {
    return this._states.delete(label);
  }

  /** Add state to this FSM. Return success. */
  public addState(state: IState) {
    if (this.hasState(state.label)) return false;
    this._states.set(state.label, state);
    return true;
  }

  /** Add state this this FSM from a string */
  public addStateFromString(string: string) {
    const state = FiniteStateMachine.stateFromString(string);
    if (typeof state === 'object') return this.addState(state);
    return false;
  }

  /** Get label of starting state in FSM */
  public getStartingState() {
    for (const [label, state] of this._states) {
      if (state.isStart) return label;
    }
    return undefined;
  }

  /**
   * Check if valid FSM. Returns the following codes:
   * 0 -> Valid
   * 1 -> No starting state
   * 2 -> More than one starting state. Provides { state }
   * 3 -> No accepting state
   * 4 -> Unknown connection. Provides { state, conn }
   * 5 -> Unbalanced input/output/conns. Provides { state }
   */
  public check(): IFSMCheck {
    let metStart = false, metAccept = false;
    for (const [label, state] of this._states) {
      if (state.isStart) {
        if (metStart) return { code: 2, state: label };
        metStart = true;
      }
      if (state.isAccept) {
        metAccept = true;
      }
      if (state.input.length !== state.conns.length || (state.output && state.input.length !== state.output.length)) return { code: 5, state: label };
      for (const conn of state.conns) {
        if (!this.hasState(conn)) return { code: 4, state: label, conn };
      }
    }
    if (!metStart) return { code: 1 };
    if (!metAccept) return { code: 3 };
    return { code: 0 };
  }

  /** Execute FSM against some input. Populate traceback history? */
  public execute(input: string, recordHistory = false): IExecuteReturn {
    let output = '', states = 0, state = this.getState(this.getStartingState()), history = [state.label], pos = 0, msg = '', error = false;
    while (pos < input.length) {
      let next: string; // Label of next state, or undefined
      for (let i = 0; !next && i < state.input.length; ++i) {
        let substr = input.substr(pos, state.input[i].length);
        if (pos + state.input[i].length > input.length) continue; // Skip if input too large
        if (substr === state.input[i]) { // Input match!
          next = state.conns[i];
          if (state.output && state.output[i]) output += state.output[i];
          if (recordHistory) history.push(next);
          states++;
          pos += state.input[i].length;
        }
      }
      if (!next) { // No matches :(
        msg = `${state.label}: Input "${input.substr(pos)}" does not match one of [${state.input.map(s => `"${s}"`).join(',')}]`;
        error = true;
        break;
      }
      state = this.getState(next);
    }
    if (!error) msg = "End Of Input";
    const obj: IExecuteReturn = { accepted: state.isAccept && !error, final: state.label, output, states, msg };
    if (recordHistory) obj.history = history;
    return obj;
  }

  /**
   * Create and return an execution instance, allow step-by-step execution of FSM.
   * Returns object. Call Object.step() to step through machine (returns success).
   * Object contains information on current status of machine. This is updated every call to Object.step
  */
  public createInstance(input: string, recordHistory = false): IFSMInstance {
    let output = '', states = 0, state = this.getState(this.getStartingState()), history = [state.label], pos = 0, msg = '', done = false;
    const step = () => {
      if (pos >= input.length) {
        done = true;
        msg = "End Of Input";
        _update(instance);
        return false;
      }
      let next: string; // Label of next state, or undefined
      for (let i = 0; !next && i < state.input.length; ++i) {
        let substr = input.substr(pos, state.input[i].length);
        if (pos + state.input[i].length > input.length) continue; // Skip if input too large
        if (substr === state.input[i]) { // Input match!
          next = state.conns[i];
          if (state.output) output += state.output[i];
          if (recordHistory) history.push(next);
          states++;
          pos += state.input[i].length;
        }
      }
      if (next) {
        state = this.getState(next);
        _update(instance);
        return true;
      } else { // No matches :(
        msg = `No inputs from string "${input.substr(pos)}" matching [${state.input.map(s => `"${s}"`).join(',')}]`;
        done = true;
        _update(instance);
        return false;
      }
    };

    /** Update object */
    const _update = (instance: IFSMInstance) => {
      instance.state = state.label;
      instance.output = output;
      instance.states = states;
      instance.msg = msg;
      instance.done = done;
      instance.pos = pos;
      if (recordHistory) instance.history = history;
    };

    const instance: IFSMInstance = { step, state: state.label, output, states, msg, done, pos };
    _update(instance);
    return instance;
  }

  /** Return string representation */
  public toString() {
    return Array.from(this._states.values()).map(state => FiniteStateMachine.stateToString(state)).join('\n');
  }

  /** Convert state to a string */
  public stateToString(label: string) {
    if (!this.hasState(label)) return undefined;
    return FiniteStateMachine.stateToString(this.getState(label));
  }

  /** Convert state to a string */
  public static stateToString(state: IState) {
    return `[${state.isStart ? 'START' : ''}${state.isAccept ? 'ACCEPT' : ''}] ${state.label} :: ${state.input.map((input, i) => state.conns[i] + ': ' + input + (state.output && state.output[i] ? '|' + state.output[i] : '')).join(', ')}`;
  }

  /** Return State object from string or number if unable to parse (number is last successful position parsed) */
  public static stateFromString(string: string): IState | number {
    let pos = 0, isStart = false, isAccept = false;
    string.trim();
    if (string[pos] === '[') { // Role
      pos++;
      if (string.substr(pos, 5).toUpperCase() === 'START') {
        isStart = true;
        pos += 5;
      }
      if (string.substr(pos, 6).toUpperCase() === 'ACCEPT') {
        isAccept = true;
        pos += 6;
      }
      if (string[pos] === ']') pos++;
      else return pos;
    }
    let label = '';
    while (/\s/.test(string[pos])) pos++; // Remove whitespace
    while (VALID_LABEL_REGEX.test(string[pos])) label += string[pos++];
    if (label.length === 0) return pos; // No label
    while (/\s/.test(string[pos])) pos++; // Remove whitespace
    if (string.substr(pos, 2) !== '::') return pos;
    pos += 2;
    while (/\s/.test(string[pos])) pos++; // Remove whitespace
    let inputs: string[] = [], outputs: string[] = [], conns: string[] = [];
    while (pos < string.length) {
      let label = '';
      while (/\s/.test(string[pos])) pos++; // Remove whitespace
      while (VALID_LABEL_REGEX.test(string[pos])) label += string[pos++];
      if (label.length === 0) return pos; // No label
      while (/\s/.test(string[pos])) pos++; // Remove whitespace
      if (string[pos] !== ':') return pos;
      pos++;
      while (/\s/.test(string[pos])) pos++; // Remove whitespace
      conns.push(label);

      let input = '';
      while (/\s/.test(string[pos])) pos++; // Remove whitespace
      while (string[pos] && !/[\s,\|]/.test(string[pos])) input += string[pos++];
      if (input.length === 0) return pos;
      while (/\s/.test(string[pos])) pos++; // Remove whitespace
      inputs.push(input);

      let output = '';
      if (string[pos] === '|') { // Output!
        pos++;
        while (/\s/.test(string[pos])) pos++; // Remove whitespace
        while (string[pos] && !/[\s,]/.test(string[pos])) output += string[pos++];
        if (output.length === 0) return pos;
        while (/\s/.test(string[pos])) pos++; // Remove whitespace
      }
      outputs.push(output);

      if (string[pos] !== ',') break; // If no comma, assume end
      pos++;
      while (/\s/.test(string[pos])) pos++; // Remove whitespace
    }

    const state: IState = { label, isStart, isAccept, input: inputs, conns, output: outputs };
    return state;
  }

  /** Create and return FSM from string */
  public static fromString(string: string) {
    const FSM = new FiniteStateMachine();
    string.split('\n').forEach(line => {
      const state = FiniteStateMachine.stateFromString(line);
      if (typeof state === 'object') FSM.addState(state);
    });
    return FSM;
  }
}