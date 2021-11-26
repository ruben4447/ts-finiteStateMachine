export function arrow(ctx: CanvasRenderingContext2D, fromx: number, fromy: number, tox: number, toy: number, r: number) {
  let x_center = tox, y_center = toy;
  let angle: number, x: number, y: number;

  ctx.beginPath();

  angle = Math.atan2(toy - fromy, tox - fromx)
  x = r * Math.cos(angle) + x_center;
  y = r * Math.sin(angle) + y_center;

  ctx.moveTo(x, y);

  angle += (1 / 3) * (2 * Math.PI)
  x = r * Math.cos(angle) + x_center;
  y = r * Math.sin(angle) + y_center;

  ctx.lineTo(x, y);

  angle += (1 / 3) * (2 * Math.PI)
  x = r * Math.cos(angle) + x_center;
  y = r * Math.sin(angle) + y_center;

  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
}

export function extractCoords(event: MouseEvent) {
  const box = (<HTMLElement>event.target).getBoundingClientRect();
  return [event.clientX - box.left, event.clientY - box.top];
}

export async function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function downloadBlob(data: any, filename: string, mimeType: string) {
  let blob = new Blob([data], { type: mimeType });
  let url = window.URL.createObjectURL(blob);
  downloadLink(url, filename);
}

/** Download the link <href> with name <fname> to client */
export function downloadLink(href: string, fname: string) {
  const a = document.createElement('a');
  a.href = href;
  a.setAttribute('download', fname);
  a.click();
  a.remove();
}