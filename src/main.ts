import { FiniteStateMachine, IState, Role, ROLE_ACCEPT, ROLE_NONE, ROLE_START } from "./FiniteStateMachine";
import { arrow, downloadBlob, extractCoords } from "./utils";

interface IInteractiveState extends IState {
  x: number;
  y: number;
}

var canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D;
var states = new Map<string, IInteractiveState>();
window.states = states
var paths = new Map<string, number[][] | number>();
window.paths = paths;
const RADIUS = 30;
var toHighlight: string; // Current state to highlight
var selectedState: string;
var activePath: number[][]; // Current path we are creating
var mouseX = 0, mouseY = 0;
var FSM: FiniteStateMachine;
var pathTable: HTMLTableElement;
var doUpdate = false;

function main() {
  canvas = document.createElement('canvas');
  ctx = canvas.getContext("2d");
  document.body.appendChild(canvas);
  canvas.width = 900;
  canvas.height = 600;

  registerEvents();

  pathTable = document.createElement("table");
  document.body.appendChild(pathTable);

  let downloadBtn = document.createElement("button");
  downloadBtn.innerText = "Download FSM";
  downloadBtn.addEventListener('click', () => {
    downloadBlob(FSM.toString(), 'FSM.txt', 'plain/text');
  });
  document.body.appendChild(downloadBtn);

  FSM = new FiniteStateMachine();
  FSM.addStateFromString("[START] S0 :: S0: 0, S1: 1");
  FSM.addStateFromString("[ACCEPT] S1 :: S1: 0, S0: 1");

  states.set("S0", { ...FSM.getState("S0"), x: 200, y: 300 });
  paths.set("S0-S0", -Math.PI / 2);
  paths.set("S0-S1", [[350, 200]]);
  states.set("S1", { ...FSM.getState("S1"), x: 500, y: 300 });
  paths.set("S1-S0", [[350, 400]]);
  paths.set("S1-S1", Math.PI / 2);

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
          const aout = confirm("Map inputs to outputs?");
          const role = +prompt(`Enter role\n${ROLE_NONE}: None; ${ROLE_START}: Start; ${ROLE_ACCEPT}: Accepting`, ROLE_NONE.toString()) as Role;
          const state: IInteractiveState = { label, input: [], conns: [], role, x: mouseX, y: mouseY };
          if (aout) state.output = [];
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
    doUpdate = true;
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
      let text = state.input[i] + (state.output ? '|' + state.output[i] : '');
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
        if (inputInput.value.length == 0) {
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
      td.appendChild(inputInput);
      tr.appendChild(td);
      td = document.createElement("td");
      if (state.output) {
        let inputOutput = document.createElement("input");
        inputOutput.type = "text";
        inputOutput.value = state.output[i];
        inputOutput.addEventListener('change', () => {
          if (inputOutput.value.length == 0) {
            inputOutput.value = state.output[i];
          } else {
            if (/\s/.test(inputOutput.value)) {
              alert("Cannot contain whitespace");
              inputOutput.value = state.output[i];
            } else {
              state.output[i] = inputOutput.value;
              doUpdate = true;
            }
          }
        });
        td.appendChild(inputOutput);
      } else {
        td.insertAdjacentHTML("beforeend", "<em title='Output must be enabled when state is created'>N/A</em>");
      }
      tr.appendChild(td);
      td = document.createElement("td");
      let btnDel = document.createElement("button");
      btnDel.innerText = 'Del';
      btnDel.addEventListener('click', () => {
        paths.delete(label + '-' + conn);
        state.conns.splice(i, 1);
        updateTable();
        generateFSM();
        doUpdate = true;
      });
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
  window.FSM = FSM;
  return FSM;
}

window.addEventListener('load', main);