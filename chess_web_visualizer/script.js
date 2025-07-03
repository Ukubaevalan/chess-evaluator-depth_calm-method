// Load chess.js logic
const boardElement = document.getElementById("board");
const evalFill = document.getElementById("eval-fill");
const fragilityFill = document.getElementById("fragility-fill");
const infoBox = document.getElementById("info");

const pieceSize = 64;
let stockfish = new Worker("stockfish.js");

let chess = new window.Chess();
let moves = [];
let moveIndex = 0;
let evaluations = [];
let fragilities = [];

// Load PGN directly (you can later replace this with dynamic file input)
const pgnText = `[Event "Norway Chess"]
[Site "Stavanger NOR"]
[Date "2025.06.01"]
[EventDate "2025.05.26"]
[Round "6"]
[White "Gukesh D"]
[Black "Carlsen, Magnus"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. d3 Bc5 5. c3 O-O
6. O-O d6 7. h3 a6 8. Ba4 h6 9. Re1 b5 10. Bc2 Bb6
11. Nbd2 Ne7 12. a4 Rb8 13. d4 Ng6 14. Nf1 c5 15. Ng3 cxd4
16. cxd4 bxa4 17. Bxa4 Bb7 18. d5 a5 19. Be3 Bc8 20. b3 Bxe3
21. Rxe3 Nf4 22. Bc6 Rb4 23. Qc2 g6 24. Kh1 Ba6 25. Qa2 Bd3
26. Nd2 h5 27. Qxa5 Qxa5 28. Rxa5 h4 29. Ra4 Rfb8 30. Ra2 Kg7
31. Ra7 Rd4 32. Nf3 hxg3 33. fxg3 Nxh3 34. gxh3 Bxe4 35. Kh2 Rd1
36. g4 Bxd5 37. Bxd5 Nxd5 38. Re2 Nf4 39. Rc2 Kf6 40. h4 Ke6
41. Ng5+ Kd5 42. Ra5+ Kd4 43. Ra4+ Kd3 44. Rf2 f6 45. Rf3+ Ke2
46. Ra2+ Rd2 47. Rxd2+ Kxd2 48. Ne4+ Ke2 49. Kg3 d5 50. Nxf6 Rf8
51. Rf2+ Ke1 52. Nd7 Ne2+ 53. Rxe2+ Kxe2 54. Nxf8 d4 55. Ne6 d3
56. Nc5 Ke3 57. Na4 e4 58. h5 gxh5 59. gxh5 Kd2 60. Nb2 e3
61. Nc4+ Ke2 62. Kf4 1-0`;

chess.load_pgn(pgnText);
moves = chess.history();
chess.reset();

renderBoard();

function renderBoard() {
  boardElement.innerHTML = "";

  const squares = Array(64).fill().map((_, i) => {
    const file = i % 8;
    const rank = 7 - Math.floor(i / 8);
    const color = (file + rank) % 2 === 0 ? "#f0d9b5" : "#b58863";

    const square = document.createElement("div");
    square.classList.add("square");
    square.style.backgroundColor = color;

    const squareIndex = rank * 8 + file;
    const piece = chess.board()[rank][file];
    if (piece) {
      const pieceCode = `${piece.color}${piece.type}`; // e.g. 'bp'
      square.style.backgroundImage = `url('pieces/${pieceCode}.png')`;
    }

    return square;
  });

  squares.forEach(square => boardElement.appendChild(square));
}

function nextMove() {
  if (moveIndex < moves.length) {
    chess.move(moves[moveIndex]);
    moveIndex++;
    renderBoard();
    evaluateCurrent();
  }
}

function prevMove() {
  if (moveIndex > 0) {
    chess.undo();
    moveIndex--;
    renderBoard();
    evaluateCurrent();
  }
}

function evaluateCurrent() {
  const fen = chess.fen();

  // Send to Stockfish for evaluation
  stockfish.postMessage("ucinewgame");
  stockfish.postMessage("position fen " + fen);
  stockfish.postMessage("go depth 12");

  let scores = [];
  let bestScore = null;

  stockfish.onmessage = function (event) {
    const line = event.data;

    if (line.startsWith("info") && line.includes("score")) {
      const match = line.match(/score (cp|mate) (-?\\d+)/);
      if (match) {
        let score = match[1] === "cp" ? parseInt(match[2], 10) / 100 : match[2] * 100;
        scores.push(score);
        if (bestScore === null) bestScore = score;
      }
    }

    if (line.startsWith("bestmove")) {
      const fragility = calculateFragility(scores, bestScore);
      updateEvalBar(bestScore);
      updateFragilityBar(fragility);
      updateInfo(bestScore, fragility);
    }
  };
}

function calculateFragility(scores, best) {
  if (!scores.length) return 0;
  const threshold = 0.2;
  const goodMoves = scores.filter(s => Math.abs(s - best) <= threshold).length;
  return goodMoves / scores.length;
}

function updateEvalBar(score) {
  const clipped = Math.max(-5, Math.min(5, score));
  const percent = ((clipped + 5) / 10) * 100;
  evalFill.style.height = percent + "%";
  evalFill.style.top = (100 - percent) + "%";
  evalFill.style.background = clipped >= 0 ? "white" : "black";
}

function updateFragilityBar(value) {
  const height = Math.round(value * 512);
  fragilityFill.style.height = `${height}px`;
}

function updateInfo(score, fragility) {
  infoBox.innerText = `Eval: ${score.toFixed(2)} | Fragility: ${(fragility * 100).toFixed(0)}%`;
}
