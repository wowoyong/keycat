const canvas = document.getElementById("cat-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

// 임시: 원 하나 그려서 투명 창 작동 확인
ctx.fillStyle = "#FF8C00";
ctx.beginPath();
ctx.arc(100, 100, 80, 0, Math.PI * 2);
ctx.fill();
