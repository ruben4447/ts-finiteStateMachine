import { FiniteStateMachine, IExecuteReturn, IFSMCheck, IFSMInstance, IState, Role, ROLE_ACCEPT, ROLE_NONE, ROLE_START } from "./FiniteStateMachine";
import { arrow, downloadBlob, extractCoords, readTextFile } from "./utils";

interface IInteractiveState extends IState {
  x: number;
  y: number;
}

var canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D;
var states = new Map<string, IInteractiveState>();
var paths = new Map<string, number[][] | number>();
const RADIUS = 30;
var toHighlight: string; // Current state to highlight
var selectedState: string;
var activePath: number[][]; // Current path we are creating
var mouseX = 0, mouseY = 0;
var FSM: FiniteStateMachine;
var pathTable: HTMLTableElement;
var doUpdate = false;
var inputContainer: HTMLSpanElement;
var fsmInput = '10101', fsmInputIndex = -1, fsmRunning = false, traceHistory = false;
var execContainer: HTMLDivElement;

window.getStates = () => states;

function main() {
  canvas = document.createElement('canvas');
  ctx = canvas.getContext("2d");
  document.body.appendChild(canvas);
  canvas.width = 900;
  canvas.height = 600;

  registerEvents();

  pathTable = document.createElement("table");
  document.body.appendChild(pathTable);

  let deleteBtn = document.createElement("button");
  deleteBtn.innerText = "Delete FSM";
  deleteBtn.addEventListener('click', () => {
    states.clear();
    paths.clear();
    doUpdate = true;
    generateFSM();
    updateTable();
  });
  document.body.appendChild(deleteBtn);

  let downloadBtn = document.createElement("button");
  downloadBtn.innerText = "Download FSM";
  downloadBtn.addEventListener('click', () => {
    downloadBlob(FSMtoString(), Date.now() + '.fsm.txt', 'plain/text');
  });
  document.body.appendChild(downloadBtn);

  let uploadBtn = document.createElement("button");
  uploadBtn.innerText = "Upload FSM";
  uploadBtn.addEventListener('click', () => inputUpload.click());
  document.body.appendChild(uploadBtn);
  const inputUpload = document.createElement("input");
  inputUpload.type = "file";
  inputUpload.addEventListener('change', async e => {
    const file = inputUpload.files[0];
    if (file) {
      const text = await readTextFile(file);
      FSMfromString(text);
    }
  });

  document.body.insertAdjacentHTML("beforeend", "<br><br>");
  let inputDiv = document.createElement("div");
  document.body.appendChild(inputDiv);
  inputDiv.insertAdjacentHTML("beforeend", "FSM Input: ");
  inputContainer = document.createElement("span");
  inputContainer.classList.add('fsm-input-container');
  inputDiv.appendChild(inputContainer);
  if (fsmInput.length === 0) inputContainer_input(); else inputContainer_text();

  execContainer = document.createElement("div");
  document.body.appendChild(execContainer);
  exechtml_start();

  FSMfromString(`[START] S0 :: S0: 0|0, S1: 1|1;200,300
[ACCEPT] S1 :: S1: 0|0, S0: 1|1;500,300
;-;
S0->S0:-1.5707963267948966
S0->S1:300,200,400,200
S1->S1:1.5707963267948966
S1->S0:350,400
`);

  doUpdate = true;
  mainLoop();
  updateTable();
  generateFSM();
}

function registerEvents() {
  var isMouseDown = false;

  function getStateOver(x: number, y: number) {
    for (const [label, state] of states) {
      if (x >= state.x - RADIUS && x < state.x + RADIUS && y >= state.y - RADIUS && y < state.y + RADIUS) {
        return label;
      }
    }
    return undefined;
  }

  canvas.addEventListener('mousemove', e => {
    if (fsmRunning) return;
    const [x, y] = extractCoords(e);
    mouseX = x;
    mouseY = y;
    if (isMouseDown && selectedState) {
      const state = states.get(selectedState);
      state.x = Math.round(mouseX);
      state.y = Math.round(mouseY);
      doUpdate = true;
    }
    if (activePath) doUpdate = true;
  });

  canvas.addEventListener('click', e => {
    if (fsmRunning) return;
    if (activePath) {
      activePath.push([Math.round(mouseX), Math.round(mouseY)]);
      const over = getStateOver(mouseX, mouseY);
      if (over) {
        const ptxt = selectedState + '-' + over;
        if (paths.has(ptxt)) {
          alert(`Path ${selectedState} to ${over} already exists.`);
        } else {
          const sstate = states.get(selectedState);
          paths.set(ptxt, selectedState === over ? Math.random() * 2 * Math.PI : activePath.slice(1, activePath.length - 2));
          sstate.conns.push(over);
          sstate.input.push(prompt(`Input value for connection ${ptxt}`, '0') ?? '0');
          if (sstate.output) {
            sstate.output.push(prompt(`Output value for connection ${ptxt} (input = ${sstate.input[sstate.input.length - 1]})`, '0') ?? '0');
          }
          updateTable();
          generateFSM();
        }
        activePath = undefined;
        selectedState = undefined;
      }
      doUpdate = true;
    } else {
      selectedState = getStateOver(mouseX, mouseY);
    }
    doUpdate = true;
  });

  canvas.addEventListener('mousedown', () => {
    isMouseDown = true;
  });
  canvas.addEventListener('mouseup', () => {
    isMouseDown = false;
  });

  document.body.addEventListener('keydown', e => {
    if (fsmRunning) return;
    if (selectedState && e.key === 'c') {
      const state = states.get(selectedState);
      activePath = [[state.x, state.y]];
      doUpdate = true
    } else if (e.key === 'n') {
      const label = prompt("Enter label for new state");
      if (label !== null) {
        if (states.has(label)) {
          alert("Label already exists");
        } else {
          const role = +prompt(`Enter role\n${ROLE_NONE}: None; ${ROLE_START}: Start; ${ROLE_ACCEPT}: Accepting`, ROLE_NONE.toString()) as Role;
          const state: IInteractiveState = { label, input: [], conns: [], role, x: mouseX, y: mouseY };
          state.output = [];
          states.set(label, state);
          doUpdate = true;
          generateFSM();
        }
      }
    } else if (selectedState && e.key === 'Delete') {
      states.delete(selectedState);
      for (const [label, state] of states) {
        for (let i = state.conns.length - 1; i >= 0; i--) {
          if (state.conns[i] === selectedState) {
            paths.delete(`${selectedState}-${label}`);
            paths.delete(`${label}-${selectedState}`);
            state.conns.splice(i, 1);
            state.input.splice(i, 1);
            if (state.output) state.output.splice(i, 1);
          }
        }
      }
      selectedState = undefined;
      doUpdate = true;
      updateTable();
      generateFSM();
    } else if (selectedState && e.key === 's') {
      alert(FiniteStateMachine.stateToString(states.get(selectedState)));
    }
  });
}

function mainLoop() {
  if (doUpdate) {
    render();
    doUpdate = false;
  }
  requestAnimationFrame(mainLoop.bind(this));
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // DRAW PATHS
  ctx.strokeStyle = 'black';
  ctx.fillStyle = 'black';
  ctx.font = '11px monospace';
  states.forEach(state => {
    for (let i = 0; i < state.conns.length; ++i) {
      const destination = states.get(state.conns[i]);
      let textX: number, textY: number;
      const path = paths.get(`${state.label}-${destination.label}`);
      if (state === destination) {
        ctx.beginPath();
        let r = RADIUS / 2, t = path as unknown as number;
        const cx = state.x + 2 * r * Math.cos(t);
        const cy = state.y + 2 * r * Math.sin(t);
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.stroke();
        // arrow(cx, cy, state.x + 2.5 * r * Math.cos(t), state.y + 2.5 * r * Math.sin(t), r / 2);
        textX = state.x + 3.5 * r * Math.cos(t);
        textY = state.y + 3.5 * r * Math.sin(t);
      } else {
        ctx.beginPath();
        ctx.moveTo(state.x, state.y);
        if (path) (path as number[][]).forEach(([x, y]) => {
          ctx.lineTo(x, y);
        });
        ctx.lineTo(destination.x, destination.y);
        ctx.stroke();
        if (!Array.isArray(path) || path.length === 0) {
          textX = Math.abs(destination.x + state.x) / 2;
          textY = Math.abs(destination.y + state.y) / 2 - 8;
        } else {
          textX = Math.abs(path[0][0] + state.x) / 2;
          textY = Math.abs(path[0][1] + state.y) / 2 - 8;
        }
        arrow(ctx, state.x, state.y, textX, textY + 8, 5);
      }
      ctx.fillStyle = 'black';
      let text = state.input[i] + (state.output && state.output[i] ? '|' + state.output[i] : '');
      ctx.fillText(text, textX, textY);
    }
  });
  // DRAW STATES
  ctx.font = '12px Arial';
  states.forEach(state => {
    ctx.beginPath();
    ctx.fillStyle = selectedState === state.label ? 'silver' : (toHighlight === state.label ? 'khaki' : 'white');
    ctx.arc(state.x, state.y, RADIUS, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = 'black';
    ctx.arc(state.x, state.y, RADIUS, 0, 2 * Math.PI);
    ctx.stroke();
    if (state.role === ROLE_ACCEPT) {
      ctx.beginPath();
      ctx.arc(state.x, state.y, RADIUS - (RADIUS / 5), 0, 2 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = 'forestgreen';
    } else if (state.role === ROLE_START) {
      ctx.beginPath();
      ctx.strokeStyle = 'black';
      ctx.moveTo(state.x - RADIUS - 20, state.y);
      ctx.lineTo(state.x - RADIUS - 6, state.y);
      ctx.stroke();
      ctx.fillStyle = 'black';
      arrow(ctx, state.x - RADIUS - 12, state.y, state.x - RADIUS - 6, state.y, 6);
      ctx.fillStyle = 'purple';
    } else {
      ctx.fillStyle = 'black';
    }
    ctx.fillText(state.label, state.x, state.y);
  });
  // Render active path
  if (activePath && activePath.length > 0) {
    ctx.strokeStyle = 'red';
    ctx.beginPath();
    for (let i = 0; i < activePath.length; i++) {
      if (i === 0) ctx.moveTo(activePath[i][0], activePath[i][1]);
      else ctx.lineTo(activePath[i][0], activePath[i][1]);
    }
    ctx.lineTo(mouseX, mouseY);
    ctx.stroke();
  }
  if (fsmRunning) {
    ctx.fillStyle = 'forestgreen';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 12px Courier New';
    ctx.fillText('[running]', 2, 2);
  }
}

function updateTable() {
  pathTable.innerHTML = '';
  pathTable.createTHead().insertAdjacentHTML("beforeend", "<tr><th>Conn</th><th>Input(s)</th><th>Output(s)</th></tr>");
  const tbody = pathTable.createTBody();
  for (const [label, state] of states) {
    state.conns.forEach((conn, i) => {
      const tr = document.createElement("tr");
      tr.insertAdjacentHTML("beforeend", `<td>${label} &rarr; ${conn}</td>`);
      let td = document.createElement("td");
      let inputInput = document.createElement("input");
      inputInput.type = "text";
      inputInput.value = state.input[i];
      inputInput.addEventListener('change', () => {
        if (fsmRunning || inputInput.value.length == 0) {
          inputInput.value = state.input[i];
        } else {
          if (/\s/.test(inputInput.value)) {
            alert("Cannot contain whitespace");
            inputInput.value = state.input[i];
          } else {
            state.input[i] = inputInput.value;
            doUpdate = true;
          }
        }
      });
      if (fsmRunning) inputInput.disabled = true;
      td.appendChild(inputInput);
      tr.appendChild(td);
      td = document.createElement("td");
      if (state.output) {
        let inputOutput = document.createElement("input");
        inputOutput.type = "text";
        inputOutput.value = state.output[i];
        inputOutput.addEventListener('change', () => {
          if (fsmRunning) {
            inputOutput.value = state.output[i];
          } else if (/\s/.test(inputOutput.value)) {
            alert("Cannot contain whitespace");
            inputOutput.value = state.output[i];
          } else {
            state.output[i] = inputOutput.value;
            doUpdate = true;
          }
        });
        if (fsmRunning) inputOutput.disabled = true;
        td.appendChild(inputOutput);
      } else {
        td.insertAdjacentHTML("beforeend", "<em title='Output must be enabled when state is created'>N/A</em>");
      }
      tr.appendChild(td);
      td = document.createElement("td");
      let btnDel = document.createElement("button");
      btnDel.innerText = 'Del';
      btnDel.addEventListener('click', () => {
        if (fsmRunning) return;
        paths.delete(label + '-' + conn);
        state.conns.splice(i, 1);
        state.input.splice(i, 1);
        state.output.splice(i, 1);
        updateTable();
        generateFSM();
        doUpdate = true;
      });
      if (fsmRunning) btnDel.disabled = true;
      td.appendChild(btnDel);
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
  }
}

function generateFSM() {
  FSM = new FiniteStateMachine();
  for (const [label, state] of states) {
    FSM.addState(state);
  }
  return FSM;
}

const SEC_SEP = ';-;\n';

function FSMtoString() {
  let s_states = '', s_paths = '';
  for (const [label, state] of states) {
    s_states += FiniteStateMachine.stateToString(state) + ";" + state.x + "," + state.y + "\n";
    for (let i = 0; i < state.conns.length; ++i) {
      s_paths += label + "->" + state.conns[i] + ":" + paths.get(label + '-' + state.conns[i]) + "\n";
    }
  }
  return s_states + SEC_SEP + s_paths;
}

// Create FSM from a string
function FSMfromString(string: string) {
  const data = parseFSMString(string);
  states = data.states;
  paths = data.paths;
  fixPaths();
  activePath = undefined;
  selectedState = undefined;
  toHighlight = undefined;
  doUpdate = true;
  updateTable();
  generateFSM();
}

function parseFSMString(string: string) {
  const strings = string.split(SEC_SEP);
  const states = new Map<string, IInteractiveState>(), paths = new Map<string, number[][] | number>();
  strings[0].split("\n").forEach(ss => {
    ss = ss.trim();
    if (ss.length === 0) return;
    let [stateInfo, pos] = ss.split(';');
    const v = FiniteStateMachine.stateFromString(stateInfo.trim());
    if (typeof v === 'object') {
      let x: number, y: number;
      if (pos) {
        const coords = pos.split(',').map(n => parseFloat(n));
        x = coords[0];
        y = coords[1];
      } else {
        x = Math.random() * canvas.width;
        y = Math.random() * canvas.height;
      }
      const istate: IInteractiveState = { ...v, x, y };
      states.set(istate.label, istate);
    }
  });
  strings[1]?.split("\n").forEach(s => {
    s = s.trim();
    if (s.length === 0) return;
    const [meta, path] = s.split(':');
    const [start, end] = meta.split('->');
    if (!states.has(start)) return;
    if (!states.has(end)) return;
    const pstr = start + "-" + end;
    const nums = path.split(',').map(n => +n);
    if (start === end) {
      paths.set(pstr, nums[0]); // Rotation for self
    } else {
      const coords = nums.reduce<number[][]>((rows, key, index) => (index % 2 == 0 ? rows.push([key]) : rows[rows.length - 1].push(key)) && rows, []);
      paths.set(pstr, coords);
    }
  });
  return { states, paths };
}

/** Fix connection in paths */
function fixPaths() {
  states.forEach((state, label) => {
    state.conns.forEach((conn, i) => {
      const str = label + '-' + conn;
      if (!paths.has(str)) {
        if (conn === label) {
          paths.set(str, Math.random() * 2 * Math.PI);
        } else {
          paths.set(str, []);
        }
      }
    });
  });
}

// Populate inputContainer with <input />
function inputContainer_input(focus = false) {
  inputContainer.innerHTML = '';
  let input = document.createElement('input');
  input.type = "text";
  input.value = fsmInput;
  input.addEventListener('change', () => fsmInput = input.value);
  input.addEventListener('blur', () => fsmInput.length !== 0 && inputContainer_text());
  inputContainer.appendChild(input);
  if (focus) input.focus();
}

// Populate inputContainer with display div
function inputContainer_text() {
  inputContainer.innerHTML = '';
  let code = document.createElement('code');
  if (fsmInputIndex > -1) {
    code.innerHTML = fsmInput.substring(0, fsmInputIndex) + "<span class='curr-index'>" + fsmInput[fsmInputIndex] + "</span>" + fsmInput.substr(fsmInputIndex + 1);
  } else {
    code.innerText = fsmInput;
  }
  code.addEventListener("click", () => !fsmRunning && inputContainer_input(true));
  inputContainer.appendChild(code);
}

// Set fsmRunning on or off
function setFSMRunning(bool: boolean) {
  fsmInputIndex = bool ? 0 : -1;
  inputContainer_text();
  fsmRunning = bool;
  activePath = undefined;
  selectedState = undefined;
  doUpdate = true;
  updateTable();
}

// Result from <FSM>.check() - return message
function fsmCheckResultToString(check: IFSMCheck) {
  switch (check.code) {
    case 0:
      return "OK";
    case 1:
      return "No startng state found";
    case 2:
      return `More than one starting state found (${check.state})`;
    case 3:
      return "No accepting state";
    case 4:
      return `State ${check.state}: unknown connecting state ${check.conn}`;
    case 5:
      return `State ${check.state}: unblanaced inputs/outputs/conns`;
    default:
      return "Unknown";
  }
}

// execContainer: provide user with options
function exechtml_start() {
  execContainer.innerHTML = 'Trace History: ';
  let traceHistoryInput = document.createElement("input");
  traceHistoryInput.type = "checkbox";
  traceHistoryInput.checked = traceHistory;
  traceHistoryInput.addEventListener("change", () => traceHistory = traceHistoryInput.checked);
  execContainer.appendChild(traceHistoryInput);
  let btnExecute = document.createElement("button");
  btnExecute.innerText = 'Execute';
  btnExecute.addEventListener('click', () => {
    generateFSM();
    const result = FSM.check();
    if (result.code === 0) {
      setFSMRunning(true);
      btnExecute.disabled = true;
      traceHistoryInput.disabled = true;
      exechtml_displayexecreturn({}, table);
      const data = FSM.execute(fsmInput, traceHistory);
      exechtml_displayexecreturn(data, table);
      setFSMRunning(false);
      selectedState = data.final;
      btnExecute.disabled = false;
      traceHistoryInput.disabled = false;
    } else {
      alert(`Unable to execute\nFSM check FAILED with code ${result.code}\n>> "${fsmCheckResultToString(result)}"`);
    }
  });
  execContainer.appendChild(btnExecute);
  let btnStep = document.createElement("button");
  btnStep.innerText = 'Step Through';
  btnStep.addEventListener("click", () => {
    generateFSM();
    const result = FSM.check();
    if (result.code === 0) {
      setFSMRunning(true);
      exechtml_stepthrough();
    } else {
      alert(`Unable to execute\nFSM check FAILED with code ${result.code}\n>> "${fsmCheckResultToString(result)}"`);
    }
  });
  execContainer.appendChild(btnStep);
  let table = document.createElement("table");
  execContainer.appendChild(table);
}

function exechtml_displayexecreturn(obj: {} | IExecuteReturn, table: HTMLTableElement) {
  table.innerHTML = '';
  const tbody = table.createTBody();
  if (Object.keys(obj).length === 0) {
    tbody.insertAdjacentHTML("beforeend", `<tr><th>Accepted</th><td>&mdash;</td></tr>`);
    tbody.insertAdjacentHTML("beforeend", `<tr><th>Final</th><td>&mdash;</td></tr>`);
    tbody.insertAdjacentHTML("beforeend", `<tr><th>Output</th><td>&mdash;</td></tr>`);
    tbody.insertAdjacentHTML("beforeend", `<tr><th>Message</th><td>&mdash;</td></tr>`);
    tbody.insertAdjacentHTML("beforeend", `<tr><th>Cycles</th><td>0</td></tr>`);
    if (traceHistory) tbody.insertAdjacentHTML("beforeend", `<tr><th>History</th><td>&mdash;</td></tr>`);
  } else {
    const data = obj as IExecuteReturn;
    tbody.insertAdjacentHTML("beforeend", `<tr><th title='Is FSM in an accepting state'>Accepted</th><td><span class='bool-${data.accepted}'>${data.accepted}</span></td></tr>`);
    tbody.insertAdjacentHTML("beforeend", `<tr><th title='Final state of FSM'>Final</th><td>${data.final}</td></tr>`);
    tbody.insertAdjacentHTML("beforeend", `<tr><th title='FSM Output'>Output</th><td><code>"${data.output}"</code></td></tr>`);
    tbody.insertAdjacentHTML("beforeend", `<tr><th title='Message from FSM'>Message</th><td><code>${data.msg}</code></td></tr>`);
    tbody.insertAdjacentHTML("beforeend", `<tr><th title='How many states were visited'>Cycles</th><td>${data.states}</td></tr>`);
    if (traceHistory) tbody.insertAdjacentHTML("beforeend", `<tr><th title='Traceback history of all states visited'>History</th><td><code>${data.history?.join(',')}</code></td></tr>`);
  }
  const btn = document.createElement("button");
  btn.innerText = 'Close';
  btn.addEventListener("click", () => table.innerHTML = '');
  table.createTFoot().appendChild(btn);
}

async function exechtml_stepthrough() {
  execContainer.innerHTML = '';
  const instance = FSM.createInstance(fsmInput, traceHistory);
  selectedState = instance.state;
  doUpdate = true;
  const btnStep = document.createElement("button");
  btnStep.innerText = 'Step';
  btnStep.addEventListener("click", () => {
    let ok = instance.step();
    exechtml_displayinstancetable(instance, table);
    inputContainer_text();
    if (ok) {
      fsmInputIndex = instance.pos;
    } else {
      btnStep.disabled = true;
      setFSMRunning(false);
    }
    selectedState = instance.state;
    doUpdate = true;
  });
  execContainer.appendChild(btnStep);
  const btnExit = document.createElement("button");
  btnExit.innerText = 'Exit';
  btnExit.addEventListener("click", () => {
    setFSMRunning(false);
    exechtml_start();
  });
  execContainer.appendChild(btnExit);
  const table = document.createElement("table");
  execContainer.appendChild(table);
  exechtml_displayinstancetable(instance, table);
}

function exechtml_displayinstancetable(instance: IFSMInstance, table: HTMLTableElement) {
  table.innerHTML = "";
  const tbody = table.createTBody();
  tbody.insertAdjacentHTML("beforeend", `<tr><th>Done</th><td><span class='bool-${instance.done}'>${instance.done}</span></td></tr>`);
  tbody.insertAdjacentHTML("beforeend", `<tr><th title='State we are currently in'>State</th><td>${instance.state}</td></tr>`);
  tbody.insertAdjacentHTML("beforeend", `<tr><th title='FSM Output'>Output</th><td><code>"${instance.output}"</code></td></tr>`);
  tbody.insertAdjacentHTML("beforeend", `<tr><th title='How many states have been visited'>Cycles</th><td>${instance.states}</td></tr>`);
  tbody.insertAdjacentHTML("beforeend", `<tr><th title='Message from FSM'>Message</th><td><code>${instance.msg}</code></td></tr>`);
  if (traceHistory) tbody.insertAdjacentHTML("beforeend", `<tr><th title='Traceback history of all states visited so far'>History</th><td><code>${instance.history?.join(',')}</code></td></tr>`);
}

window.addEventListener('load', main);