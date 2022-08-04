var Jimp = require("jimp");

// Color map to make more readable image serializations
var COLORS = [
  Jimp.rgbaToInt(0,0,0,0),

  Jimp.rgbaToInt(0,0,0,255),
  Jimp.rgbaToInt(255,255,255,255),
];

const lightness = [50,70,30,60,80,40];
function generateColors() {
  for (let s = 90; s > 10; s -= 10) {
      for (let l = 0; l < lightness.length; l++) {
          for (let hue = 0; hue < 360; hue += 15) {
              let color = "hsl(" + hue + ", " + s + "%, " + lightness[l] + "%)";
              let hex = Jimp.cssColorToHex(color);
              COLORS.push(hex);
          }
      }
  }
}
generateColors();

exports.COLORS = COLORS;