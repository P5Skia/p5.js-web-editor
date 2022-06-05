const defaultSketch = `function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(220);
}`;

const defaultHTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <script src="https://p5code.jb1.io/p5skia/0.73/canvaskit.js"></script>
    <script src="https://p5code.jb1.io/p5skia/0.73/p5skia.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/addons/p5.sound.min.js"></script>
    <link rel="stylesheet" type="text/css" href="style.css">
    <meta charset="utf-8" />

  </head>
  <body>
    <main>
    </main>
    <script src="sketch.js"></script>
  </body>
</html>
`;

const defaultCSS = `html, body {
  margin: 0;
  padding: 0;
}
canvas {
  display: block;
}
`;

export default function createDefaultFiles() {
  return {
    'index.html': {
      content: defaultHTML
    },
    'style.css': {
      content: defaultCSS
    },
    'sketch.js': {
      content: defaultSketch
    }
  };
}
