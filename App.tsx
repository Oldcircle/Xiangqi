
import React, { useState, useEffect, useCallback } from 'react';
import { Board } from './components/Board';
import { createInitialBoard, getLegalMovesForPiece, isKingInCheck } from './utils/gameLogic';
import { getBestMove, resetEngine } from './services/engine'; 
import { BoardState, Difficulty, GameStatus, Move, Position, Side, Language, MoveRecord } from './types';

const translations = {
  [Language.EN]: {
    title: "XIANGQI MASTER",
    subtitle: "Professional Engine",
    redWin: "Red Victory",
    blackWin: "Black Victory",
    yourTurn: "Your Turn",
    opponentTurn: "Opponent's Turn",
    aiThinking: "AI Thinking",
    difficulty: "Strength",
    language: "Language",
    newGame: "New Game",
    strategyTitle: "Analysis",
    thinking: "Calculating best variation...",
    ready: "Waiting for game start...",
    logTitle: "History",
    noMoves: "No moves yet",
    red: "Red",
    black: "Black",
    connectionFailed: "Engine Error",
    invalidMove: "Invalid Move",
    undo: "Undo Move",
    check: "Check!",
    playAs: "Play As",
    evalAdvantage: "Advantage",
    difficulties: {
      [Difficulty.BEGINNER]: "Novice",
      [Difficulty.INTERMEDIATE]: "Amateur",
      [Difficulty.EXPERT]: "Expert",
      [Difficulty.MASTER]: "Master",
      [Difficulty.GRANDMASTER]: "Grandmaster"
    }
  },
  [Language.CN]: {
    title: "中国象棋·大师版",
    subtitle: "专业博弈引擎",
    redWin: "红方获胜",
    blackWin: "黑方获胜",
    yourTurn: "轮到你走",
    opponentTurn: "对手思考",
    aiThinking: "AI 思考中",
    difficulty: "棋力",
    language: "语言",
    newGame: "重新开始",
    strategyTitle: "局势分析",
    thinking: "正在推演最佳着法...",
    ready: "准备就绪",
    logTitle: "对局记录",
    noMoves: "对局尚未开始",
    red: "红方",
    black: "黑方",
    connectionFailed: "引擎错误",
    invalidMove: "无效走法",
    undo: "悔棋",
    check: "将军!",
    playAs: "执棋",
    evalAdvantage: "优劣势",
    difficulties: {
      [Difficulty.BEGINNER]: "新手 (2层)",
      [Difficulty.INTERMEDIATE]: "业余 (4层)",
      [Difficulty.EXPERT]: "大师 (6层)",
      [Difficulty.MASTER]: "特大 (8层)",
      [Difficulty.GRANDMASTER]: "神级 (20层)"
    }
  }
};

const App: React.FC = () => {
  const [board, setBoard] = useState<BoardState>(createInitialBoard());
  const [turn, setTurn] = useState<Side>(Side.RED);
  const [playerSide, setPlayerSide] = useState<Side>(Side.RED);
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [status, setStatus] = useState<GameStatus>(GameStatus.PLAYING);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.INTERMEDIATE);
  const [lang, setLang] = useState<Language>(Language.CN);
  const [aiReasoning, setAiReasoning] = useState<string>("");
  const [isThinking, setIsThinking] = useState(false);
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([]);
  const [isCheck, setIsCheck] = useState(false);
  const [evalScore, setEvalScore] = useState(0); // Positive = Red advantage, Negative = Black
  const [historyStack, setHistoryStack] = useState<{
      board: BoardState, 
      turn: Side, 
      lastMove: Move | null, 
      status: GameStatus, 
      moveHistory: MoveRecord[], 
      evalScore: number 
  }[]>([]);

  const aiSide = playerSide === Side.RED ? Side.BLACK : Side.RED;
  const t = translations[lang];

  const pushHistory = useCallback(() => {
    setHistoryStack(prev => [...prev, {
      board: board.map(row => [...row]),
      turn,
      lastMove,
      status,
      moveHistory: [...moveHistory],
      evalScore
    }]);
  }, [board, turn, lastMove, status, moveHistory, evalScore]);

  const performUndo = () => {
    if (historyStack.length < 2) return;
    if (isThinking) return;

    const newStack = [...historyStack];
    if (newStack.length >= 2) {
        newStack.pop(); // Remove current state
        const targetState = newStack.pop(); // Get previous valid state (before AI + Player move)
        
        if (targetState) {
            setBoard(targetState.board);
            setTurn(targetState.turn);
            setLastMove(targetState.lastMove);
            setStatus(targetState.status);
            setMoveHistory(targetState.moveHistory);
            setEvalScore(targetState.evalScore);
            setHistoryStack(newStack);
            setAiReasoning("(已悔棋 / Undone)");
            setIsCheck(false);
        }
    }
  };

  const executeMove = useCallback((move: Move) => {
    setBoard(prev => {
        const newBoard = prev.map(row => [...row]);
        const piece = newBoard[move.from.r][move.from.c];
        if (!piece) return prev;
        newBoard[move.to.r][move.to.c] = piece;
        newBoard[move.from.r][move.from.c] = null;
        const nextTurn = turn === Side.RED ? Side.BLACK : Side.RED;
        const inCheck = isKingInCheck(newBoard, nextTurn);
        setIsCheck(inCheck);
        let redKing = false;
        let blackKing = false;
        newBoard.forEach(row => row.forEach(p => {
            if (p?.type === 'k') {
                if (p.side === Side.RED) redKing = true;
                else blackKing = true;
            }
        }));
        if (!redKing) setStatus(GameStatus.BLACK_WIN);
        else if (!blackKing) setStatus(GameStatus.RED_WIN);
        setTurn(nextTurn);
        return newBoard;
    });
    setLastMove(move);
    setMoveHistory(prev => {
       const piece = board[move.from.r][move.from.c];
       const target = board[move.to.r][move.to.c];
       if (!piece) return prev;
       return [{ side: piece.side, from: move.from, to: move.to, captured: !!target }, ...prev];
    });
  }, [board, turn]);

  const handleSquareClick = (pos: Position) => {
    if (status !== GameStatus.PLAYING) return;
    if (turn !== playerSide) return;

    const clickedPiece = board[pos.r][pos.c];
    if (clickedPiece && clickedPiece.side === playerSide) {
      setSelectedPos(pos);
      const moves = getLegalMovesForPiece(board, pos, playerSide);
      setValidMoves(moves);
      return;
    }
    if (selectedPos) {
      const isMoveValid = validMoves.some(m => m.r === pos.r && m.c === pos.c);
      if (isMoveValid) {
        pushHistory();
        executeMove({ from: selectedPos, to: pos });
        setSelectedPos(null);
        setValidMoves([]);
      } else {
        setSelectedPos(null);
        setValidMoves([]);
      }
    }
  };

  // AI Move Logic
  useEffect(() => {
    if (turn === aiSide && status === GameStatus.PLAYING) {
      const timer = setTimeout(async () => {
        setIsThinking(true);
        setAiReasoning(t.thinking);
        try {
            await new Promise(r => setTimeout(r, 50));
            const result = await getBestMove(board, aiSide, difficulty, lang);
            if (result && result.move) {
                setAiReasoning(result.reasoning);
                const globalScore = aiSide === Side.RED ? result.score : -result.score;
                setEvalScore(globalScore);
                
                pushHistory();
                executeMove(result.move);
            } else {
                if (isKingInCheck(board, aiSide)) {
                    setStatus(aiSide === Side.RED ? GameStatus.BLACK_WIN : GameStatus.RED_WIN);
                    setAiReasoning(lang === Language.CN ? "绝杀，比赛结束。" : "Checkmate. Game Over.");
                } else {
                    setStatus(GameStatus.STALEMATE);
                    setAiReasoning(lang === Language.CN ? "困毙，和棋。" : "Stalemate.");
                }
            }
        } catch (e) { console.error(e); }
        setIsThinking(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [turn, status, board, difficulty, lang, aiSide, executeMove, pushHistory, t]);

  const resetGame = (newSide?: Side) => {
    resetEngine(); // Reset AI randomness/hash
    setBoard(createInitialBoard());
    setTurn(Side.RED); 
    if (newSide) setPlayerSide(newSide);
    setStatus(GameStatus.PLAYING);
    setLastMove(null);
    setMoveHistory([]);
    setAiReasoning("");
    setSelectedPos(null);
    setValidMoves([]);
    setHistoryStack([]);
    setIsCheck(false);
    setEvalScore(0);
  };

  const getEvalBarWidth = () => {
      const clamped = Math.max(-2000, Math.min(2000, evalScore));
      return 50 + (clamped / 40); 
  };

  return (
    <div className="min-h-screen bg-[#181512] text-[#e0d0c0] font-sans flex flex-col items-center py-4 sm:py-8">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,_rgba(60,40,30,0.2)_0%,_rgba(20,15,12,1)_100%)] pointer-events-none"></div>

      <div className="relative w-full max-w-6xl flex flex-col lg:flex-row items-start justify-center gap-8 px-4 z-10">
        
        {/* Left Column: Board */}
        <div className="w-full max-w-[550px] flex flex-col gap-4 mx-auto lg:mx-0">
             {/* Status Header */}
             <div className="flex justify-between items-end px-2">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-bold font-serif text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-700 drop-shadow-md">
                        {t.title}
                    </h1>
                    <p className="text-xs text-amber-600/80 tracking-[0.2em] uppercase mt-1">{t.subtitle}</p>
                </div>
                <div className="text-right">
                     {isCheck && <div className="text-red-500 font-bold animate-pulse text-lg font-serif tracking-widest drop-shadow">{t.check}</div>}
                     <div className={`mt-1 px-3 py-1 rounded text-xs font-bold uppercase tracking-wide border ${
                         status !== GameStatus.PLAYING 
                            ? 'border-amber-500 text-amber-400 bg-amber-900/40' 
                            : (turn === playerSide ? 'border-green-800 text-green-400 bg-green-950/30' : 'border-amber-800 text-amber-400 bg-amber-950/30')
                     }`}>
                        {status !== GameStatus.PLAYING 
                         ? (status === GameStatus.RED_WIN ? t.redWin : (status === GameStatus.BLACK_WIN ? t.blackWin : "DRAW")) 
                         : (turn === playerSide ? t.yourTurn : t.opponentTurn)}
                     </div>
                </div>
             </div>
             
            {/* Evaluation Gauge */}
            <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden relative shadow-inner border border-neutral-700/50 group">
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/20 z-20 transform -translate-x-1/2"></div>
                <div 
                    className="absolute top-0 bottom-0 bg-gradient-to-r from-neutral-800 via-red-600 to-red-500 transition-all duration-1000 ease-out"
                    style={{ width: `${getEvalBarWidth()}%` }}
                ></div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-[10px] px-2 py-1 rounded text-white pointer-events-none whitespace-nowrap">
                    {t.evalAdvantage}: {evalScore > 0 ? `+${evalScore} (Red)` : `${evalScore} (Black)`}
                </div>
            </div>

            {/* Board Component */}
            <div className="shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] rounded-lg">
                <Board 
                    board={board} 
                    onSquareClick={handleSquareClick}
                    selectedPos={selectedPos}
                    lastMove={lastMove}
                    validMoves={validMoves}
                    isPlayerTurn={turn === playerSide}
                    flipped={playerSide === Side.BLACK}
                />
            </div>
        </div>

        {/* Right Column: Controls & Logs */}
        <div className="w-full lg:w-[380px] flex flex-col gap-5">
            
            {/* Control Panel */}
            <div className="bg-[#231e1a]/80 backdrop-blur-md border border-white/5 rounded-xl p-6 shadow-xl">
                <div className="space-y-4 mb-6">
                    {/* Play As Selection */}
                    <div className="space-y-2">
                         <label className="text-[10px] uppercase tracking-widest text-amber-600 font-bold">{t.playAs}</label>
                         <div className="flex gap-2">
                             <button 
                                onClick={() => resetGame(Side.RED)}
                                className={`flex-1 py-2 rounded border text-xs font-bold transition-all ${playerSide === Side.RED ? 'bg-red-900/40 border-red-700 text-red-400 shadow-[0_0_10px_rgba(220,38,38,0.2)]' : 'bg-[#15120f] border-[#3e3228] text-neutral-500 hover:border-neutral-600'}`}
                             >
                                {t.red} (先手)
                             </button>
                             <button 
                                onClick={() => resetGame(Side.BLACK)}
                                className={`flex-1 py-2 rounded border text-xs font-bold transition-all ${playerSide === Side.BLACK ? 'bg-neutral-800 border-neutral-500 text-neutral-300 shadow-[0_0_10px_rgba(255,255,255,0.1)]' : 'bg-[#15120f] border-[#3e3228] text-neutral-500 hover:border-neutral-600'}`}
                             >
                                {t.black} (后手)
                             </button>
                         </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-amber-600 font-bold">{t.difficulty}</label>
                            <select 
                                value={difficulty} 
                                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                                className="w-full bg-[#15120f] border border-[#3e3228] rounded-lg px-3 py-2 text-sm text-amber-100 focus:border-amber-500 outline-none transition-colors hover:border-amber-700"
                                disabled={turn === aiSide}
                            >
                                {Object.values(Difficulty).map(d => (
                                    <option key={d} value={d}>{t.difficulties[d]}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-amber-600 font-bold">{t.language}</label>
                            <div className="flex bg-[#15120f] rounded-lg border border-[#3e3228] overflow-hidden h-[38px]">
                                <button onClick={() => setLang(Language.CN)} className={`flex-1 text-xs font-medium transition-colors ${lang === Language.CN ? 'bg-amber-800 text-amber-100' : 'text-neutral-500 hover:bg-[#1f1a16]'}`}>中文</button>
                                <div className="w-[1px] bg-[#3e3228]"></div>
                                <button onClick={() => setLang(Language.EN)} className={`flex-1 text-xs font-medium transition-colors ${lang === Language.EN ? 'bg-amber-800 text-amber-100' : 'text-neutral-500 hover:bg-[#1f1a16]'}`}>EN</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-3">
                    <button 
                        onClick={() => resetGame()} 
                        className="flex-1 py-3 rounded-lg bg-gradient-to-b from-amber-700 to-amber-800 text-amber-100 font-bold text-sm shadow-[0_2px_0_rgba(0,0,0,0.2)] active:translate-y-[1px] active:shadow-none transition-all border border-amber-600/30 hover:brightness-110"
                    >
                        {t.newGame}
                    </button>
                    <button 
                        onClick={performUndo} 
                        disabled={historyStack.length < 2 || turn === aiSide || status !== GameStatus.PLAYING} 
                        className="flex-1 py-3 rounded-lg bg-[#2e2823] text-neutral-400 font-bold text-sm border border-[#3e3228] hover:bg-[#362f29] active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {t.undo}
                    </button>
                </div>
            </div>

            {/* Analysis & Reasoning */}
            <div className="bg-[#231e1a]/80 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden shadow-lg flex flex-col">
                <div className="px-5 py-3 border-b border-white/5 bg-gradient-to-r from-[#2a241f] to-transparent flex justify-between items-center">
                     <h3 className="text-xs uppercase tracking-widest text-amber-500 font-bold flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        {t.strategyTitle}
                     </h3>
                     {isThinking && <span className="text-[10px] text-amber-400/70 animate-pulse">Computing...</span>}
                </div>
                <div className="p-5 min-h-[100px] bg-[#15120f]/50">
                    <p className="text-sm leading-relaxed text-neutral-300 font-mono border-l-2 border-amber-800/50 pl-3">
                        {aiReasoning || <span className="text-neutral-600 italic text-xs">{t.ready}</span>}
                    </p>
                </div>
            </div>

            {/* Move History Log */}
            <div className="flex-1 bg-[#231e1a]/80 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden shadow-lg flex flex-col max-h-[300px]">
                <div className="px-5 py-3 border-b border-white/5 bg-gradient-to-r from-[#2a241f] to-transparent">
                    <h3 className="text-xs uppercase tracking-widest text-neutral-500 font-bold">{t.logTitle}</h3>
                </div>
                <div className="overflow-y-auto p-0 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-amber-900/50">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-[#15120f] text-neutral-600 text-[10px] uppercase sticky top-0">
                            <tr>
                                <th className="pl-5 py-2 font-medium w-12">#</th>
                                <th className="py-2 font-medium">{t.red}</th>
                                <th className="py-2 font-medium">{t.black}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs sm:text-sm">
                            {moveHistory.map((m, i) => (
                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                    <td className="pl-5 py-2 text-neutral-600 font-mono">{moveHistory.length - i}</td>
                                    <td className="py-2">
                                        <span className={`font-mono ${m.side === Side.RED ? 'text-red-400' : 'text-neutral-500'}`}>
                                            {m.side === Side.RED ? t.red : t.black}
                                        </span>
                                    </td>
                                    <td className="py-2 font-mono text-neutral-300">
                                        <span className="opacity-70">{m.from.r},{m.from.c}</span> 
                                        <span className="mx-1 text-amber-700">➞</span> 
                                        <span>{m.to.r},{m.to.c}</span>
                                        {m.captured && <span className="ml-2 text-amber-500">x</span>}
                                    </td>
                                </tr>
                            ))}
                            {moveHistory.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="py-8 text-center text-neutral-600 italic text-xs">{t.noMoves}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default App;
