
import React from 'react';
import { BoardState, Move, Piece, PieceType, Position, Side } from '../types';

interface BoardProps {
  board: BoardState;
  onSquareClick: (pos: Position) => void;
  selectedPos: Position | null;
  lastMove: Move | null;
  validMoves: Position[];
  isPlayerTurn: boolean;
  flipped: boolean;
}

const PieceComponent: React.FC<{ piece: Piece, flipped: boolean }> = ({ piece, flipped }) => {
  const isRed = piece.side === Side.RED;
  
  const getLabel = (p: Piece) => {
    if (p.side === Side.RED) {
      switch (p.type) {
        case PieceType.KING: return '帅';
        case PieceType.ADVISOR: return '仕';
        case PieceType.ELEPHANT: return '相';
        case PieceType.HORSE: return '马';
        case PieceType.ROOK: return '车';
        case PieceType.CANNON: return '炮';
        case PieceType.PAWN: return '兵';
      }
    } else {
      switch (p.type) {
        case PieceType.KING: return '将';
        case PieceType.ADVISOR: return '士';
        case PieceType.ELEPHANT: return '象';
        case PieceType.HORSE: return '马';
        case PieceType.ROOK: return '车';
        case PieceType.CANNON: return '炮';
        case PieceType.PAWN: return '卒';
      }
    }
    return '?';
  };

  // 3D Piece Styles
  const baseStyle = "w-full h-full rounded-full flex items-center justify-center select-none transition-all duration-200 relative";
  
  // Visual distinction: Red pieces are lighter wood, Black pieces slightly darker/richer
  const pieceGradient = "bg-gradient-to-br from-[#fdf2e3] to-[#e6c69e]"; 

  // Realistic shadow for 3D effect - optimized for perfect centering
  const shadowStyle = "shadow-[0_3px_5px_rgba(0,0,0,0.4),inset_0_2px_3px_rgba(255,255,255,0.6),inset_0_-2px_3px_rgba(0,0,0,0.2)]";
  const innerRingStyle = "w-[82%] h-[82%] rounded-full border-2 flex items-center justify-center shadow-[inset_0_1px_2px_rgba(0,0,0,0.2),0_1px_1px_rgba(255,255,255,0.5)]";

  const textColor = isRed ? "text-[#c21f1f]" : "text-[#1a1a1a]";
  const borderColor = isRed ? "border-[#dcb386]" : "border-[#dcb386]";
  
  return (
    <div className={`${baseStyle} ${pieceGradient} ${shadowStyle}`} style={{ transform: flipped ? 'rotate(180deg)' : 'none' }}>
        {/* Carved Ring */}
        <div className={`${innerRingStyle} ${borderColor}`}>
            <span 
                className={`text-2xl sm:text-3xl md:text-4xl font-bold font-serif leading-none mt-[-4px] ${textColor}`}
                style={{ textShadow: '0 1px 1px rgba(255,255,255,0.8), 0 -1px 0 rgba(0,0,0,0.1)' }}
            >
                {getLabel(piece)}
            </span>
        </div>
    </div>
  );
};

export const Board: React.FC<BoardProps> = ({ 
  board, 
  onSquareClick, 
  selectedPos, 
  lastMove, 
  validMoves,
  flipped
}) => {
  
  const isSelected = (r: number, c: number) => selectedPos?.r === r && selectedPos?.c === c;
  const isValid = (r: number, c: number) => validMoves.some(m => m.r === r && m.c === c);
  const isLastMoveSource = (r: number, c: number) => lastMove?.from.r === r && lastMove?.from.c === c;
  const isLastMoveDest = (r: number, c: number) => lastMove?.to.r === r && lastMove?.to.c === c;

  return (
    <div className="relative select-none transition-transform duration-500" style={{ transform: flipped ? 'rotate(180deg)' : 'none' }}>
      {/* Outer Frame */}
      <div className="p-3 sm:p-4 bg-[#5c4033] rounded-lg shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] border border-[#3e2b22]">
          
        {/* Inner Board Area */}
        <div className="relative bg-[#eecfa1] w-full aspect-[9/10] shadow-inner border border-[#8b5a2b]">
            
            {/* Wood Grain Texture Overlay */}
            <div className="absolute inset-0 opacity-30 pointer-events-none mix-blend-multiply" 
                 style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`}}>
            </div>

            {/* Grid System SVG */}
            <div className="absolute inset-0 grid grid-rows-10 grid-cols-9 z-0">
                 <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 90 100">
                    
                    {/* Border Rectangle */}
                    <rect x="4" y="4" width="82" height="92" fill="none" stroke="#5d3a1a" strokeWidth="2" />

                    {/* Horizontal Lines */}
                    {Array.from({ length: 10 }).map((_, i) => (
                        <line key={`h-${i}`} x1="5" y1={5 + i * 10} x2="85" y2={5 + i * 10} stroke="#5d3a1a" strokeWidth="0.6" />
                    ))}

                    {/* Vertical Lines */}
                    {Array.from({ length: 7 }).map((_, i) => (
                        <line key={`v-top-${i}`} x1={15 + i * 10} y1="5" x2={15 + i * 10} y2="45" stroke="#5d3a1a" strokeWidth="0.6" />
                    ))}
                    {Array.from({ length: 7 }).map((_, i) => (
                        <line key={`v-bot-${i}`} x1={15 + i * 10} y1="55" x2={15 + i * 10} y2="95" stroke="#5d3a1a" strokeWidth="0.6" />
                    ))}
                    
                    {/* Palaces */}
                    <line x1="35" y1="5" x2="55" y2="25" stroke="#5d3a1a" strokeWidth="0.6" />
                    <line x1="55" y1="5" x2="35" y2="25" stroke="#5d3a1a" strokeWidth="0.6" />
                    <line x1="35" y1="95" x2="55" y2="75" stroke="#5d3a1a" strokeWidth="0.6" />
                    <line x1="55" y1="95" x2="35" y2="75" stroke="#5d3a1a" strokeWidth="0.6" />

                    {/* Setup Marks */}
                    {[
                        [2,1], [2,7], // Cannons Top
                        [3,0], [3,2], [3,4], [3,6], [3,8], // Pawns Top
                        [7,1], [7,7], // Cannons Bottom
                        [6,0], [6,2], [6,4], [6,6], [6,8]  // Pawns Bottom
                    ].map(([r, c], idx) => {
                        const x = 5 + c * 10;
                        const y = 5 + r * 10;
                        const g = 1; 
                        const l = 2;
                        return (
                            <g key={`mark-${idx}`} stroke="#5d3a1a" strokeWidth="0.6">
                                {c > 0 && <polyline points={`${x-g-l},${y-g} ${x-g},${y-g} ${x-g},${y-g-l}`} fill="none" />}
                                {c < 8 && <polyline points={`${x+g+l},${y-g} ${x+g},${y-g} ${x+g},${y-g-l}`} fill="none" />}
                                {c > 0 && <polyline points={`${x-g-l},${y+g} ${x-g},${y+g} ${x-g},${y+g+l}`} fill="none" />}
                                {c < 8 && <polyline points={`${x+g+l},${y+g} ${x+g},${y+g} ${x+g},${y+g+l}`} fill="none" />}
                            </g>
                        )
                    })}

                    {/* Move Trajectory Layer (Meteor Effect) */}
                    {lastMove && (() => {
                        const targetPiece = board[lastMove.to.r][lastMove.to.c];
                        if (targetPiece) {
                            const isRed = targetPiece.side === Side.RED;
                            
                            // Coords
                            const x1 = 5 + lastMove.from.c * 10;
                            const y1 = 5 + lastMove.from.r * 10;
                            const x2 = 5 + lastMove.to.c * 10;
                            const y2 = 5 + lastMove.to.r * 10;

                            // Lighter, softer colors for the meteor tail
                            // Head color is visible, tail is transparent
                            // Red: Bright Red with opacity
                            // Black: Dark Grey with opacity
                            const headColor = isRed ? "rgba(239, 68, 68, 0.7)" : "rgba(60, 60, 60, 0.7)";
                            const gradId = `traj-grad-${isRed ? 'red' : 'black'}`;

                            return (
                                <g className="pointer-events-none">
                                    <defs>
                                        {/* Reduced size marker: viewBox 0 0 5 5, but displayed at 2.5x2.5 size */}
                                        <marker id={`arrow-${isRed ? 'red' : 'black'}`} markerWidth="2.5" markerHeight="2.5" refX="5" refY="2.5" orient="auto" viewBox="0 0 5 5">
                                            <path d="M0,0 L0,5 L5,2.5 z" fill={headColor} />
                                        </marker>
                                        {/* Meteor Gradient: Start transparent, End opaque */}
                                        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
                                            <stop offset="0%" stopColor={headColor} stopOpacity="0" />
                                            <stop offset="100%" stopColor={headColor} stopOpacity="1" />
                                        </linearGradient>
                                    </defs>
                                    
                                    {/* Start Dot (Very faint echo of where it came from) */}
                                    <circle cx={x1} cy={y1} r="1.5" fill={headColor} opacity="0.2" />

                                    {/* The Meteor Tail */}
                                    <line 
                                        x1={x1} y1={y1} 
                                        x2={x2} y2={y2} 
                                        stroke={`url(#${gradId})`}
                                        strokeWidth="2.5" 
                                        strokeLinecap="round"
                                        markerEnd={`url(#arrow-${isRed ? 'red' : 'black'})`}
                                        className="animate-fade-in"
                                    />
                                </g>
                            );
                        }
                        return null;
                    })()}
                    
                    {/* River Text - Rotated if flipped */}
                    <g style={{ transformOrigin: 'center', transform: flipped ? 'rotate(180deg)' : 'none' }}>
                        <text x="20" y="50" fontSize="6" fill="#5d3a1a" textAnchor="middle" dominantBaseline="middle" className="font-serif tracking-widest opacity-80" style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}>楚 河</text>
                        <text x="70" y="50" fontSize="6" fill="#5d3a1a" textAnchor="middle" dominantBaseline="middle" className="font-serif tracking-widest opacity-80" style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}>漢 界</text>
                    </g>
                 </svg>

                 {/* Coordinates Labels */}
                 <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                     {/* Top numbers (Black side) */}
                     {Array.from({length: 9}).map((_, i) => (
                         <span key={`tc-${i}`} className="absolute top-[-6%] text-[#eecfa1] text-[min(3vw,12px)] font-serif opacity-80 font-bold" style={{ left: `${5.5 + i * 11.11}%`, transform: `translateX(-50%) ${flipped ? 'rotate(180deg)' : ''}` }}>{flipped ? ['一','二','三','四','五','六','七','八','九'][i] : i + 1}</span>
                     ))}
                     {/* Bottom numbers (Red side) */}
                     {['九','八','七','六','五','四','三','二','一'].map((char, i) => (
                         <span key={`bc-${i}`} className="absolute bottom-[-6%] text-[#eecfa1] text-[min(3vw,12px)] font-serif opacity-80 font-bold" style={{ left: `${5.5 + i * 11.11}%`, transform: `translateX(-50%) ${flipped ? 'rotate(180deg)' : ''}` }}>{flipped ? i+1 : char}</span>
                     ))}
                 </div>

                 {/* Interactive Layer */}
                 {board.map((row, r) => (
                    row.map((piece, c) => (
                        <div 
                        key={`${r}-${c}`}
                        className="relative w-full h-full flex items-center justify-center z-10 p-[10%]"
                        onClick={() => onSquareClick({ r, c })}
                        >
                        {/* Selection & Move Highlights */}
                        {(isSelected(r, c) || isLastMoveSource(r, c) || isLastMoveDest(r, c)) && (
                            <div className={`absolute inset-[12%] rounded-full border-2 ${isSelected(r, c) ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'border-blue-400/50'} z-0 animate-pulse`}></div>
                        )}
                        
                        {/* Valid Move Marker */}
                        {isValid(r, c) && (
                            <div className={`absolute z-20 ${piece 
                                ? 'inset-2 border-4 border-green-500/60 rounded-full animate-pulse' 
                                : 'w-3 h-3 sm:w-4 sm:h-4 bg-green-600/50 rounded-full shadow-sm'}`}>
                            </div>
                        )}

                        {/* Piece Render */}
                        {piece && (
                            <div className={`w-full h-full transition-transform duration-200 ease-out ${isSelected(r, c) ? '-translate-y-2 shadow-xl' : ''} ${(isLastMoveDest(r, c) && !isSelected(r,c)) ? 'scale-105' : ''}`}>
                                <PieceComponent piece={piece} flipped={flipped} />
                            </div>
                        )}
                        </div>
                    ))
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};
